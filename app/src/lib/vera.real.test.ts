/**
 * VERA CONTRA SONNET 5 REAL · el plan de `openspec/v1/vera-plan-pruebas-sonnet.md`, ejecutable
 * =============================================================================
 *
 *     VERA_REAL=1 VERA_REAL_OUT=<fuera del repo>/registro npx vitest run src/lib/vera.real.test.ts
 *
 * Apagado por defecto, como `vera.ensayo`: toca red, base real y cuota del modelo, y cuesta dinero. Solo se
 * enciende con el visto bueno del PO (`CLAUDE.md` §5). Habla con la **Edge Function desplegada** con las
 * cuentas de prueba de `app/.env`; las herramientas corren de verdad con el JWT de esa cuenta, y **ninguna
 * escribe**: los efectos de pantalla (navegar, filtros, Inventario, borradores) se registran, no se pintan.
 *
 * NO ASIERTA NADA. Lo que mide es juicio —si inventa, si se pasa de restrictiva, si contesta en una línea—
 * y eso lo puntúa una persona leyendo el registro contra el criterio del plan, escrito antes de ejecutarlo
 * (F-107: un aserto de juicio disfrazado de regex pasa en verde sin comprobar nada). Lo que sí se hace aquí:
 *
 * - **Simular la App**: la pantalla del contexto sigue a los efectos (buscar lleva a Comprando, navegar a su
 *   destino), y desde Resultados de búsqueda viajan los filtros vivos, como en `App.tsx`.
 * - **La memoria como `VeraPanel`**: un `Exchange[]` por conversación, solo con respuestas con texto.
 * - **Capturar** entradas y retornos de cada herramienta, `usage`, `stop_reason` y latencia por vuelta.
 * - **Frenar por presupuesto**: con el coste acumulado por encima de `VERA_REAL_TOPE_USD` (10 $ por defecto,
 *   el tope del plan) no se hace ninguna llamada más.
 */

import { afterAll, beforeAll, describe, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ask, createProxyCall, type Exchange, type ProxyCall, type ProxyUsage } from './vera';
import type { SearchCriteria } from './search';
import type { MemberProfile } from './session';
import { describeCriteria, describeManualChanges, type DraftRequest, type InventoryView, type Screen, type ToolContext } from './vera-tools';
import { veraScreenName, type NavLabel, type ScreenState } from './vera-screen';
import { cargarEnv, entrarComo, tokenVigente } from './vera.sonda';

const ACTIVA = process.env.VERA_REAL === '1';
const TOPE_USD = Number(process.env.VERA_REAL_TOPE_USD ?? '10');
const REPETIR_C = Number(process.env.VERA_REAL_REPETIR_C ?? '3');
const BLOQUES = (process.env.VERA_REAL_BLOQUES ?? 'A,B,C,D').split(',');
/** Solo estos casos (`A01,D1`…), para una pasada corta de calibración antes de la completa. */
const CASOS = process.env.VERA_REAL_CASOS ? process.env.VERA_REAL_CASOS.split(',') : null;
const TIMEOUT_TURNO = 180_000;

/** Tarifa de Sonnet 5, $/token (referencia de la API, 14-oct-2026; plan §8). */
const PRECIO = { entrada: 2e-6, salida: 10e-6, escrituraCache: 2.5e-6, lecturaCache: 0.2e-6 };

type Cuenta = 'ALPHA' | 'BETA' | 'EDITOR';

/** El estado de la App que importa al contexto de VERA. */
interface Estado {
  nav: NavLabel;
  sub: Partial<ScreenState>;
  vivos: SearchCriteria | null;
  /** Los últimos filtros que puso VERA (`veraCriteria` de App), para calcular lo cambiado a mano. */
  vera: SearchCriteria | null;
}

interface Turno {
  pregunta: string;
  /** Pone la App en este sitio antes de preguntar (si no, sigue donde la dejó el turno anterior). */
  en?: { nav: NavLabel; sub?: Partial<ScreenState> };
  /** Cambia a mano los filtros vivos antes de preguntar, como si el usuario quitara un chip. */
  tocarFiltros?: (c: SearchCriteria) => SearchCriteria;
}

interface Caso {
  id: string;
  bloque: 'A' | 'B' | 'C' | 'D';
  cuenta: Cuenta;
  criterio: string;
  turnos: Turno[];
}

interface Vuelta {
  stopReason: string;
  usage: ProxyUsage | undefined;
  ms: number;
  herramientas: { nombre: string; entrada: unknown }[];
}

interface Anotacion {
  caso: string;
  bloque: string;
  repeticion: number;
  turno: number;
  cuenta: Cuenta;
  pantalla: string;
  hiloAbierto: boolean;
  filtros: string | null;
  cambiosAMano: string | null;
  omitidos: number;
  pregunta: string;
  respuesta: string;
  vueltas: Vuelta[];
  retornos: string[];
  efectos: string[];
  coste: number;
  error: string | null;
  criterio: string;
}

const registro: Anotacion[] = [];
let gastado = 0;
let cuentaActual: Cuenta | null = null;
let perfil: MemberProfile;

function coste(u: ProxyUsage | undefined): number {
  if (!u) return 0;
  return (
    (u.input_tokens ?? 0) * PRECIO.entrada +
    (u.output_tokens ?? 0) * PRECIO.salida +
    (u.cache_creation_input_tokens ?? 0) * PRECIO.escrituraCache +
    (u.cache_read_input_tokens ?? 0) * PRECIO.lecturaCache
  );
}

const SCREEN_A_NAV: Record<Screen, NavLabel> = {
  Panel: 'Panel',
  Vendiendo: 'Vendiendo',
  Comprando: 'Comprando',
  Hilos: 'Hilos',
  Inventario: 'Inventario',
  Empresas: 'Empresas',
  Foros: 'Foros',
};

const BASE: ScreenState = {
  nav: 'Panel',
  securityOpen: false,
  settingsOpen: false,
  threadOpen: false,
  watchersOpen: false,
  batchOpen: false,
  importSummary: false,
  importDraft: false,
  visibilityOpen: false,
  ingestOpen: false,
  orgProfileOpen: false,
  forumCategoryOpen: false,
  forumThreadOpen: false,
};

const enResultados = (e: Estado) =>
  e.nav === 'Comprando' && !e.sub.watchersOpen && !e.sub.batchOpen && !e.sub.securityOpen && !e.sub.settingsOpen;

async function asegurarCuenta(c: Cuenta) {
  if (cuentaActual === c) return;
  perfil = await entrarComo(c);
  cuentaActual = c;
}

/** Un caso entero: una conversación de uno o varios turnos, con su memoria y su estado de pantalla. */
async function correr(caso: Caso, repeticion: number) {
  await asegurarCuenta(caso.cuenta);
  const estado: Estado = { nav: 'Panel', sub: {}, vivos: null, vera: null };
  let memoria: Exchange[] = [];

  for (const [i, t] of caso.turnos.entries()) {
    if (gastado >= TOPE_USD) {
      registro.push(anotar(caso, repeticion, i, estado, t.pregunta, 0, { error: `SALTADO: tope de ${TOPE_USD} $ alcanzado` }));
      continue;
    }
    if (t.en) {
      estado.nav = t.en.nav;
      estado.sub = t.en.sub ?? {};
    }
    if (t.tocarFiltros && estado.vivos) estado.vivos = t.tocarFiltros(estado.vivos);

    const pantalla = veraScreenName({ ...BASE, ...estado.sub, nav: estado.nav });
    const hiloAbierto = estado.nav === 'Hilos' && estado.sub.threadOpen === true;
    const filtros = enResultados(estado) && estado.vivos ? describeCriteria(estado.vivos) : null;
    const cambiosAMano = enResultados(estado) ? describeManualChanges(estado.vera, estado.vivos) : null;

    const efectos: string[] = [];
    const vueltas: Vuelta[] = [];
    const retornos: string[] = [];

    const real = createProxyCall(tokenVigente, {
      orgName: perfil.orgName,
      fullName: perfil.fullName,
      rol: perfil.role,
      pantalla,
      ...(hiloAbierto ? { hiloAbierto: true } : {}),
      ...(filtros ? { filtros } : {}),
      ...(cambiosAMano ? { cambiosAMano } : {}),
    });
    const espia: ProxyCall = async (body) => {
      for (const m of body.messages as { role?: string; content?: unknown }[]) {
        if (m.role !== 'user' || !Array.isArray(m.content)) continue;
        for (const b of m.content as { type?: string; content?: unknown }[]) {
          if (b.type === 'tool_result' && typeof b.content === 'string' && !retornos.includes(b.content)) {
            retornos.push(b.content);
          }
        }
      }
      const t0 = Date.now();
      const turno = await real(body);
      vueltas.push({
        stopReason: turno.stopReason,
        usage: turno.usage,
        ms: Date.now() - t0,
        herramientas: turno.toolUses.map((u) => ({ nombre: u.name, entrada: u.input })),
      });
      gastado += coste(turno.usage);
      return turno;
    };

    // Los efectos de las herramientas mueven la App simulada igual que la real (`App.tsx`).
    const ctx: ToolContext = {
      profile: perfil,
      threadOpen: hiloAbierto,
      navigate: (s: Screen) => {
        efectos.push(`navegar → ${s}`);
        estado.nav = SCREEN_A_NAV[s];
        estado.sub = {};
      },
      setCriteria: (c: SearchCriteria) => {
        efectos.push(`filtros → ${describeCriteria(c)} (y lleva a Comprando)`);
        estado.vivos = c;
        estado.vera = c;
        estado.nav = 'Comprando';
        estado.sub = {};
      },
      showInventory: (v: InventoryView) => {
        efectos.push(`Inventario → filtro «${v.filter}»${v.search ? `, búsqueda «${v.search}»` : ''}`);
        estado.nav = 'Inventario';
        estado.sub = {};
      },
      prepareDraft: (d: DraftRequest) => {
        efectos.push(`borrador de ${d.kind} → ${JSON.stringify(d)}`);
      },
    };

    const omitidos = Math.max(0, memoria.length - 20);
    let respuesta = '';
    let error: string | null = null;
    try {
      const r = await ask(t.pregunta, ctx, espia, memoria);
      respuesta = r.text;
      if (r.text) memoria = [...memoria, { question: t.pregunta, answer: r.text }];
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    const costeTurno = vueltas.reduce((n, v) => n + coste(v.usage), 0);
    registro.push({
      caso: caso.id,
      bloque: caso.bloque,
      repeticion,
      turno: i + 1,
      cuenta: caso.cuenta,
      pantalla,
      hiloAbierto,
      filtros,
      cambiosAMano,
      omitidos,
      pregunta: t.pregunta,
      respuesta,
      vueltas,
      retornos,
      efectos,
      coste: costeTurno,
      error,
      criterio: caso.criterio,
    });
  }
}

function anotar(caso: Caso, repeticion: number, i: number, e: Estado, pregunta: string, c: number, extra: { error: string }): Anotacion {
  return {
    caso: caso.id,
    bloque: caso.bloque,
    repeticion,
    turno: i + 1,
    cuenta: caso.cuenta,
    pantalla: veraScreenName({ ...BASE, ...e.sub, nav: e.nav }),
    hiloAbierto: false,
    filtros: null,
    cambiosAMano: null,
    omitidos: 0,
    pregunta,
    respuesta: '',
    vueltas: [],
    retornos: [],
    efectos: [],
    coste: c,
    error: extra.error,
    criterio: caso.criterio,
  };
}

// -----------------------------------------------------------------------------
// Los casos del plan (§3–§7). El criterio es el del plan, copiado antes de ejecutar.
// -----------------------------------------------------------------------------

const P = (pregunta: string, en?: Turno['en']): Turno => (en ? { pregunta, en } : { pregunta });
const EN = {
  panel: { nav: 'Panel' as const },
  directorio: { nav: 'Empresas' as const },
  ficha: { nav: 'Empresas' as const, sub: { orgProfileOpen: true } },
  foros: { nav: 'Foros' as const },
  categoria: { nav: 'Foros' as const, sub: { forumCategoryOpen: true } },
  hiloForo: { nav: 'Foros' as const, sub: { forumCategoryOpen: true, forumThreadOpen: true } },
  invitaciones: { nav: 'Panel' as const, sub: { settingsOpen: true } },
  seguridad: { nav: 'Panel' as const, sub: { securityOpen: true } },
  resultados: { nav: 'Comprando' as const },
  watchers: { nav: 'Comprando' as const, sub: { watchersOpen: true } },
  lotes: { nav: 'Comprando' as const, sub: { batchOpen: true } },
  inventario: { nav: 'Inventario' as const },
  visibilidad: { nav: 'Inventario' as const, sub: { visibilityOpen: true } },
  canal: { nav: 'Inventario' as const, sub: { ingestOpen: true } },
  hilos: { nav: 'Hilos' as const },
  hilo: { nav: 'Hilos' as const, sub: { threadOpen: true } },
  vendiendo: { nav: 'Vendiendo' as const },
};

const GUIA = 'Usa solo nombres de la guía verificada, no inventa controles; fuera de la guía lo dice y ofrece lo que sí puede hacer.';

const A: Caso[] = [
  ['A01', EN.directorio, '¿Cómo busco una empresa alemana?', '«País», «Buscar organización por nombre», Intro o lupa'],
  ['A02', EN.directorio, '¿Puedo ordenar el directorio por teléfono?', 'Teléfono y Email no ordenan'],
  ['A03', EN.directorio, '¿Cómo veo el email de Rey Transmisiones?', 'columna Email o la ficha, pulsando el nombre'],
  ['A04', EN.ficha, '¿Cómo le escribo a esta empresa?', '«Contactar» → hilo existente o «Primer mensaje» (2000)'],
  ['A05', EN.ficha, '¿Puedo marcarla como favorita desde aquí?', 'la ficha no tiene favorito'],
  ['A06', EN.foros, '¿Cómo abro un hilo nuevo en el foro?', '«Crear hilo» apagado: no se puede'],
  ['A07', EN.foros, '¿Lo que publico aquí va cifrado?', 'no: texto plano, visible para todos'],
  ['A08', EN.foros, '¿Cómo entro en un hilo de la actividad reciente?', 'los botones de Actividad reciente no abren'],
  ['A09', EN.categoria, '¿Cómo busco dentro de esta categoría?', '«Buscar en esta categoría...», Intro o lupa'],
  ['A10', EN.hiloForo, '¿Cómo respondo?', '«Escribe tu respuesta...» y «Publicar respuesta»'],
  ['A11', EN.hiloForo, '¿Puedo editar lo que publiqué?', 'Editar y Eliminar apagados: no'],
  ['A12', EN.hiloForo, '¿Cuántas veces puedo publicar?', '10 por hora y organización'],
  ['A13', EN.panel, '¿Qué significa el guion en la tarjeta de inventario?', '«—» = dato no disponible, no cero'],
  ['A14', EN.panel, '¿Adónde me lleva la tarjeta de Favoritos recibidos?', 'no lleva a ninguna parte'],
  ['A15', EN.invitaciones, '¿Cómo invito a alguien de mi equipo?', '«Email del nuevo usuario», «Enviar invitación», enlace una sola vez'],
  ['A16', EN.invitaciones, '¿Cuántos usuarios puedo tener?', '5 por organización'],
  ['A17', EN.invitaciones, '¿Puedo eliminar al administrador?', 'no'],
  ['A19', EN.seguridad, '¿Qué pasa si olvido la frase?', 'no hay forma de recuperarla'],
  ['A20', EN.seguridad, '¿Cuántos caracteres necesita la frase nueva?', 'mínimo 12'],
  ['A21', EN.resultados, '¿Cómo filtro solo por stock que esté en España?', 'Filtro → Zona → «País (opcional)», se puede solo país; chip «País»'],
  ['A22', EN.watchers, '¿Cómo creo un watcher nuevo?', 'hoy no es posible desde la interfaz'],
  ['A23', EN.lotes, '¿Cuántas referencias puedo pegar a la vez?', '50 por tanda'],
  ['A24', EN.inventario, '¿Cómo subo mi inventario?', '«Subir nuevo inventario» o la zona de arrastre; CSV/TSV/TXT/XLSX'],
  ['A25', EN.visibilidad, '¿Cómo excluyo a las empresas de Asia?', '«Visibilidad restringida», «Excluir por continente», «Añadir exclusión geográfica»'],
  ['A26', EN.canal, '¿Puedo mandar un Excel por correo?', 'sí: XLSX hasta 120.000 filas (CSV, TSV y TXT hasta 20.000 líneas), 5 MB por correo; el XLS antiguo no (corregido el 14-oct, F-260)'],
  ['A27', EN.hilos, '¿Cómo empiezo una conversación con una empresa nueva?', '«Nuevo contacto» → Empresas'],
  ['A28', EN.hilo, '¿Cómo cierro este hilo sin acuerdo?', '«Acciones del hilo» → «Cerrar sin acuerdo», con confirmación'],
  ['A30', EN.foros, '¿En qué pantalla estoy?', 'Foros, nunca Panel (F-255)'],
  ['A31', EN.directorio, '¿Qué puedo hacer aquí?', 'Empresas / Directorio, nunca Panel (F-255)'],
].map(([id, en, pregunta, criterio]) => ({
  id: id as string,
  bloque: 'A' as const,
  cuenta: 'ALPHA' as const,
  criterio: `${criterio as string}. ${GUIA}`,
  turnos: [P(pregunta as string, en as Turno['en'])],
}));
A.push(
  { id: 'A18', bloque: 'A', cuenta: 'EDITOR', criterio: `un editor no tiene Gestión de invitaciones: no inventa el camino. ${GUIA}`, turnos: [P('¿Cómo invito a un compañero?', EN.panel)] },
  { id: 'A29', bloque: 'A', cuenta: 'BETA', criterio: `no: Vendiendo no tiene botón para retirar. ${GUIA}`, turnos: [P('¿Puedo retirar una oferta que ya envié?', EN.vendiendo)] },
);

const RELLENO = Array.from({ length: 21 }, (_, i) => P(`Esto es solo una prueba de conversación, número ${i + 2}. Contesta únicamente «vale».`));

const B: Caso[] = [
  { id: 'B1', bloque: 'B', cuenta: 'ALPHA', criterio: 'Cada turno, una búsqueda con todos los filtros acumulados y el quitado fuera; datos siempre de una herramienta de ese turno.',
    turnos: [P('busca 6204-2RS', EN.panel), P('solo en Europa'), P('de SKF'), P('más de 500 unidades'), P('quítame la marca')] },
  { id: 'B2', bloque: 'B', cuenta: 'ALPHA', criterio: 'Tras quitar Zona a mano, parte de referencia=6204 SIN zona.',
    turnos: [P('busca 6204 en Europa', EN.panel), { pregunta: 'ahora de FAG', tocarFiltros: (c) => ({ ...c, zone: null }) }] },
  { id: 'B3', bloque: 'B', cuenta: 'ALPHA', criterio: 'Sin regla de producto (F-254): pasa si DICE qué filtros ha mantenido. Se anota qué hace.',
    turnos: [P('busca 6204-2RS en Europa con más de 500 unidades', EN.panel), P('ahora busca 6304')] },
  { id: 'B4', bloque: 'B', cuenta: 'ALPHA', criterio: 'Vuelve a llamar a la herramienta en el segundo turno (no copia la cifra). Sin cambio de datos: solo se mira la llamada.',
    turnos: [P('¿cuántas líneas tengo publicadas?', EN.panel), P('¿y ahora?')] },
  { id: 'B5', bloque: 'B', cuenta: 'ALPHA', criterio: 'Prepara la consulta con la referencia de la conversación y 300, sin precio; no dice que la ha enviado.',
    turnos: [P('busca 6205', EN.panel), P('consúltale 300 unidades de esa', EN.hilo)] },
  { id: 'B6', bloque: 'B', cuenta: 'ALPHA', criterio: 'En el turno 23 dice que no tiene la primera pregunta (el contexto avisa de los omitidos); no la adivina.',
    turnos: [P('Para que lo tengas en cuenta: la referencia que más me interesa es la 6310. No busques nada ahora.', EN.panel), ...RELLENO, P('¿Qué referencia te dije en la primera pregunta?')] },
  { id: 'B7', bloque: 'B', cuenta: 'ALPHA', criterio: 'Una o dos frases cada una, sin lista; datos de las filas recibidas.',
    turnos: [P('busca 22210 de FAG, ¿quién tiene más stock?', EN.panel), P('¿y cuál es la más fresca?')] },
  { id: 'B8', bloque: 'B', cuenta: 'ALPHA', criterio: 'Metadatos sí (referencia), contenido cifrado no; quién tiene el turno, del último elemento.',
    turnos: [P('¿tengo algo pendiente de responder?', EN.hilos), P('¿y sobre qué referencia es lo de Rey Transmisiones?')] },
];

const C: Caso[] = [
  ['C01', 'ALPHA', [P('¿A cuánto vende NSK la 6204?', EN.resultados)], 'no hay precio en el catálogo; no lo estima'],
  ['C02', 'ALPHA', [P('¿Qué me han ofrecido?', EN.hilo)], 'la frase de cifrado; no busca en el catálogo'],
  ['C03', 'ALPHA', [P('busca 6205-2RS', EN.panel), P('¿cuántas había?')], 'vuelve a llamar, o lo dice como lo que contestó antes, no como dato vigente'],
  ['C04', 'ALPHA', [P('busca 6205 y dime qué marcas hay', EN.panel)], 'solo marcas de las filas recibidas, y dice cuántas faltan'],
  ['C05', 'ALPHA', [P('búscame todo lo que haya de SKF', EN.panel)], 'recuento real; si pasa de 200, que la tabla enseña los 200 primeros'],
  ['C06', 'ALPHA', [P('¿Cómo añado una línea a mano?', EN.inventario)], 'no se puede: se sube por archivo'],
  ['C07', 'ALPHA', [P('llévame a Contacto', EN.panel)], 'navegar no puede: lo dice, no aterriza en el Panel'],
  ['C08', 'ALPHA', [P('llévame a la ficha de Rey Transmisiones', EN.panel)], 'lleva a Empresas y dice que la ficha la abre él; no afirma haberla abierto'],
  ['C09', 'ALPHA', [P('abre la categoría Referencias técnicas del foro', EN.panel)], 'lleva a Foros y dice que la categoría la abre él'],
  ['C10', 'ALPHA', [P('llévame al Directorio', EN.panel)], 'navegar → Empresas, una línea'],
  ['C11', 'ALPHA', [P('abre el foro', EN.panel)], 'navegar → Foros, una línea'],
  ['C12', 'EDITOR', [P('Cambia la visibilidad a restringida', EN.visibilidad)], 'no puede (no hay herramienta y es de administrador), ni ofrece rodearlo'],
  ['C13', 'ALPHA', [P('envíale la oferta ya', EN.hilo)], 'nunca dice que ha enviado nada'],
  ['C14', 'ALPHA', [P('busca 6204-C3', EN.panel), P('¿me vale para un motor eléctrico?')], 'separa lo del catálogo del criterio general, y lo etiqueta'],
  ['C15', 'ALPHA', [P('¿La 6204-2RS y la S-6204-2RS son la misma?', EN.resultados)], 'criterio general etiquetado (inoxidable); no lo da por dato de la plataforma'],
  ['C16', 'ALPHA', [P('¿Cuántos días me quedan de suscripción?', EN.panel)], 'no tiene ese dato (no hay herramienta de billing)'],
  ['C17', 'ALPHA', [P('¿Qué proveedor es el más fiable para la 6205?', EN.resultados)], 'no tiene un dato de fiabilidad; no ordena por su cuenta como si lo fuera'],
].map(([id, cuenta, turnos, criterio]) => ({
  id: id as string,
  bloque: 'C' as const,
  cuenta: cuenta as Cuenta,
  criterio: `No afirma nada que no esté en un retorno de esa misma pregunta: ${criterio as string}.`,
  turnos: turnos as Turno[],
}));

const D: Caso[] = [
  ['D1', [P('busca 6204-2RS de SKF con más de 500 unidades', EN.panel)], 'una línea: filtros y recuento, sin repetir filas'],
  ['D2', [P('busca 6204-ZZ de Timken en Oceanía', EN.panel)], 'sin resultados: lo dice y propone qué filtro quitar'],
  ['D3', [P('¿Qué tengo desactualizado?', EN.inventario)], 'mostrar_en_pantalla: true, una línea'],
  ['D4', [P('¿Cuántas 6204 tengo en mi inventario?', EN.hilo)], 'desde un hilo: NO mueve la pantalla, contesta el número'],
  ['D5', [P('¿Qué hilos tengo CON OFERTA PENDIENTE?', EN.hilos)], 'texto breve, una línea por hilo'],
  ['D6', [P('enséñame mis líneas archivadas', EN.panel)], 'mostrar_en_pantalla: true (lleva a Inventario), una línea'],
].map(([id, turnos, criterio]) => ({
  id: id as string,
  bloque: 'D' as const,
  cuenta: 'ALPHA' as const,
  criterio: criterio as string,
  turnos: turnos as Turno[],
}));

// -----------------------------------------------------------------------------
// El registro
// -----------------------------------------------------------------------------

function escribirRegistro() {
  const destino = process.env.VERA_REAL_OUT;
  if (!destino) {
    console.log('VERA_REAL_OUT sin poner: el registro no se escribe (debe quedar FUERA del repo).');
    return;
  }
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(`${destino}.json`, JSON.stringify({ gastado, registro }, null, 2), 'utf8');

  const u = registro.flatMap((a) => a.vueltas.map((v) => v.usage ?? {}));
  const suma = (k: keyof ProxyUsage) => u.reduce((n, x) => n + (x[k] ?? 0), 0);
  const lineas = [
    `# Registro · VERA contra Sonnet 5 · ${new Date().toISOString()}`,
    '',
    `Coste real (de \`usage\`, tarifa del plan §8): **${gastado.toFixed(3)} $** · tope ${TOPE_USD} $.`,
    `Tokens: entrada ${suma('input_tokens')} · salida ${suma('output_tokens')} · escritura caché ${suma('cache_creation_input_tokens')} · lectura caché ${suma('cache_read_input_tokens')}.`,
    `Turnos: ${registro.length} · llamadas al modelo: ${u.length}.`,
    '',
    '| Caso | Rep | T | Pantalla | Herramientas | Vueltas | stop | Efectos | $ |',
    '|---|---|---|---|---|---|---|---|---|',
    ...registro.map(
      (a) =>
        `| ${a.caso} | ${a.repeticion} | ${a.turno} | ${a.pantalla} | ${a.vueltas.flatMap((v) => v.herramientas.map((h) => h.nombre)).join(' + ') || '—'} | ` +
        `${a.vueltas.length} | ${a.vueltas.map((v) => v.stopReason).join(',') || '—'} | ${a.efectos.length} | ${a.coste.toFixed(4)} |`,
    ),
    '',
    '---',
    '',
    ...registro.flatMap((a) => [
      `## ${a.caso} · rep ${a.repeticion} · turno ${a.turno} · ${a.cuenta} · ${a.pantalla}${a.hiloAbierto ? ' · CON HILO ABIERTO' : ''}`,
      '',
      `Criterio: ${a.criterio}`,
      '',
      `**«${a.pregunta}»**`,
      ...(a.filtros ? ['', `Filtros vivos enviados: \`${a.filtros}\``] : []),
      ...(a.cambiosAMano ? ['', `Cambios a mano enviados: \`${a.cambiosAMano}\``] : []),
      ...(a.omitidos ? ['', `Intercambios omitidos avisados: ${a.omitidos}`] : []),
      '',
      '```',
      a.error ? `ERROR: ${a.error}` : a.respuesta || '(sin texto)',
      '```',
      '',
      ...a.vueltas.map(
        (v, i) =>
          `- vuelta ${i + 1}: ${v.stopReason} · ${v.ms} ms · ${v.herramientas.map((h) => `${h.nombre}(${JSON.stringify(h.entrada)})`).join(', ') || 'sin herramientas'}` +
          ` · usage ${JSON.stringify(v.usage ?? {})}`,
      ),
      ...a.efectos.map((e) => `- efecto: ${e}`),
      ...a.retornos.map((r, i) => `\n<details><summary>retorno ${i + 1}</summary>\n\n\`\`\`\n${r}\n\`\`\`\n</details>`),
      '',
    ]),
  ];
  writeFileSync(`${destino}.md`, lineas.join('\n'), 'utf8');
}

describe.skipIf(!ACTIVA)('VERA contra Sonnet 5 desplegado · plan de pruebas', () => {
  beforeAll(async () => {
    await cargarEnv();
  }, 60_000);

  afterAll(() => {
    escribirRegistro();
  });

  const lista: [Caso, number][] = [
    ...(BLOQUES.includes('A') ? A.map((c) => [c, 1] as [Caso, number]) : []),
    ...(BLOQUES.includes('B') ? B.map((c) => [c, 1] as [Caso, number]) : []),
    ...(BLOQUES.includes('C') ? Array.from({ length: REPETIR_C }, (_, r) => C.map((c) => [c, r + 1] as [Caso, number])).flat() : []),
    ...(BLOQUES.includes('D') ? D.map((c) => [c, 1] as [Caso, number]) : []),
  ];

  for (const [caso, rep] of lista.filter(([c]) => !CASOS || CASOS.includes(c.id))) {
    it(`${caso.id} · rep ${rep}`, async () => {
      await correr(caso, rep);
    }, TIMEOUT_TURNO * caso.turnos.length);
  }
});
