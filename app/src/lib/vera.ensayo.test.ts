/**
 * ENSAYO GENERAL · las quince preguntas del guion, ejecutables · día 15
 * =============================================================================
 *
 *     VERA_ENSAYO=1 npx vitest run src/lib/vera.ensayo.test.ts
 *
 * Apagado por defecto igual que la sonda: toca red, base real y cuota del
 * modelo. Habla con la **Edge Function desplegada** con sesión de `alpha@`.
 *
 * ── QUÉ ES Y QUÉ NO ES ─────────────────────────────────────────────────────
 *
 * Es `guion-sesion-2.md` §4 —A1…A10 y B1…B5, con el literal exacto y desde la
 * pantalla que cada una dice— convertido en un comando. **No sustituye al
 * recorrido a mano**: §3 (los tramos cronometrados), §5 (contraoferta entre dos
 * navegadores) y §6 (dos pestañas sobre el mismo hilo) siguen necesitando dos
 * personas y dos sesiones, y de eso se ocupa la suite e2e y el ensayo con el PO.
 * Lo que esto cubre es **el interrogatorio**, que es donde vive el riesgo #1.
 *
 * ── POR QUÉ EXISTE, Y POR QUÉ HOY ──────────────────────────────────────────
 *
 * Las quince preguntas llevaban desde el día 13 existiendo **solo como cita**.
 * F-097 ya dejó dicho lo que eso vale: *"una instrucción que no se ha ejecutado
 * nunca es una hipótesis, no un procedimiento"*. Y F-109, de hoy, es la misma
 * forma en código: una rama detrás de una guarda de doce horas que nadie había
 * visto correr, y que habría reventado la mañana del 20-ago.
 *
 * ── LO QUE SE ASEGURA AQUÍ Y LO QUE NO ─────────────────────────────────────
 *
 * Se asegura **solo lo que es una relación medible**: que no aparezca una cifra
 * en euros, que no se llame a una herramienta prohibida, que las filas pintadas
 * no superen a las recibidas, que los estados no se traduzcan. Todo eso puede
 * fallar de una sola manera y no puede acertar por casualidad.
 *
 * Lo que es **juicio** —si el resumen es fiel, si la negativa se entiende, si el
 * tono sirve delante del socio— no se asierta: se **imprime**, y lo contrasta
 * contra SQL quien corre el ensayo. Un aserto de juicio disfrazado de regex es
 * exactamente F-107, que ya pasó dos veces en verde sin comprobar nada.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { ask, createProxyCall } from './vera';
import type { SearchCriteria } from './search';
import type { MemberProfile } from './session';
import type { Screen, ToolContext } from './vera-tools';
import {
  TIMEOUT,
  cargarEnv,
  contarFilas,
  entrarComoAlpha,
  espiar,
  invarianteDeRecorte,
  tokenVigente,
} from './vera.sonda';

const ACTIVA = process.env.VERA_ENSAYO === '1';

let perfil: MemberProfile;

interface Anotacion {
  id: string;
  pantalla: Screen;
  pregunta: string;
  respuesta: string;
  herramientas: string[];
  vueltas: number;
  navegoA: Screen[];
  filasRecibidas: number;
  filasPintadas: number;
}

const registro: Anotacion[] = [];

/**
 * Una pregunta, desde su pantalla.
 *
 * La pantalla no es decoración: desde F-090 viaja en el bloque dinámico del
 * system prompt, y la misma pregunta desde dos sitios distintos es genuinamente
 * otra pregunta. Por eso se construye un `ProxyCall` por pregunta y no uno para
 * todas, que es lo que hace la sonda —a ella le da igual, a esto no.
 */
async function preguntar(
  id: string,
  pantalla: Screen,
  pregunta: string,
  opciones: { hiloAbierto?: boolean } = {},
): Promise<Anotacion> {
  const navegoA: Screen[] = [];
  const criterios: SearchCriteria[] = [];
  const ctx: ToolContext = {
    profile: perfil,
    navigate: (s) => navegoA.push(s),
    setCriteria: (c) => criterios.push(c),
  };

  /*
   * `hiloAbierto` se OMITE cuando no lo hay, en vez de mandarse en `false`.
   * `exactOptionalPropertyTypes` lo exige, pero además es lo correcto: el
   * bloque dinámico del prompt filtra por valor verdadero, así que un `false`
   * explícito y una ausencia producen el mismo prompt — y de las dos formas de
   * decir lo mismo, la que no viaja es la que no puede interpretarse mal.
   */
  const espia = espiar(
    createProxyCall(tokenVigente, {
      orgName: perfil.orgName,
      fullName: perfil.fullName,
      pantalla,
      ...(opciones.hiloAbierto === undefined ? {} : { hiloAbierto: opciones.hiloAbierto }),
    }),
  );

  const r = await ask(pregunta, ctx, espia.call);

  const anotacion: Anotacion = {
    id,
    pantalla,
    pregunta,
    respuesta: r.text,
    herramientas: r.toolsUsed,
    vueltas: r.steps,
    navegoA,
    filasRecibidas: espia.retornos.reduce((n, t) => n + contarFilas(t), 0),
    filasPintadas: contarFilas(r.text),
  };
  registro.push(anotacion);

  console.log(
    [
      '',
      `════════ ${id} · desde ${pantalla}${opciones.hiloAbierto ? ' · CON HILO ABIERTO' : ''}`,
      `«${pregunta}»`,
      '',
      r.text,
      '',
      `   herramientas: ${r.toolsUsed.join(', ') || 'ninguna'} · vueltas: ${r.steps}` +
        ` · navegó a: ${navegoA.join(', ') || '—'}` +
        ` · filas recibidas: ${anotacion.filasRecibidas} · pintadas: ${anotacion.filasPintadas}`,
    ].join('\n'),
  );

  return anotacion;
}

/** Una cifra en euros, en cualquiera de las formas en que se escribe. */
const CIFRA_EN_EUROS = /(?:€\s*\d|\d[\d.,]*\s*(?:€|eur\b|euros?\b))/i;

/** Markdown, que F-104 prohíbe porque la burbuja lo pinta en crudo. */
function sinMarkdown(texto: string): void {
  expect(texto).not.toMatch(/\*\*/);
  expect(texto).not.toMatch(/^\s*\|/m);
  expect(texto).not.toMatch(/^\s*#{1,6}\s/m);
}

describe.skipIf(!ACTIVA)('ENSAYO GENERAL · guion-sesion-2 §4 contra la v5 desplegada', () => {
  beforeAll(async () => {
    await cargarEnv();
    perfil = await entrarComoAlpha();
    console.log(`\nSesión: ${perfil.orgName} · miembro ${perfil.id.slice(0, 8)}…`);
  }, TIMEOUT);

  /*
   * El registro se escribe A FICHERO además de imprimirse, y no es comodidad:
   * el reporter de Vitest se traga los `console.log` en cuanto la salida no es
   * un terminal —`npx vitest run > fichero.txt` deja nueve líneas y ninguna
   * respuesta—. Un ensayo cuyo valor entero es lo que deja leer no puede
   * depender de que alguien esté mirando la consola en ese momento.
   */
  afterAll(() => {
    const destino = process.env.VERA_ENSAYO_OUT ?? 'ensayo-registro.md';

    const lineas = [
      `# Registro del ensayo · ${new Date().toISOString()}`,
      '',
      `Sesión: ${perfil?.orgName ?? '—'} · contra la Edge Function desplegada.`,
      '',
      '| # | Pantalla | Herramientas | Vueltas | Navegó a | Filas recibidas | Filas pintadas |',
      '|---|---|---|---|---|---|---|',
      ...registro.map(
        (a) =>
          `| ${a.id} | ${a.pantalla} | ${a.herramientas.join(' + ') || '—'} | ${a.vueltas} | ` +
          `${a.navegoA.join(', ') || '—'} | ${a.filasRecibidas} | ${a.filasPintadas} |`,
      ),
      '',
      '---',
      '',
      ...registro.flatMap((a) => [
        `## ${a.id} · desde ${a.pantalla}`,
        '',
        `**«${a.pregunta}»**`,
        '',
        '```',
        a.respuesta,
        '```',
        '',
        `herramientas: ${a.herramientas.join(', ') || 'ninguna'} · vueltas: ${a.vueltas}` +
          ` · navegó a: ${a.navegoA.join(', ') || '—'}` +
          ` · filas ${a.filasRecibidas} → ${a.filasPintadas}`,
        '',
      ]),
    ];

    writeFileSync(destino, lineas.join('\n'), 'utf8');
    console.log(`\n\n════════ registro escrito en ${destino} · ${registro.length} preguntas`);
  });

  // ── Grupo A · diez dentro de ámbito ───────────────────────────────────────

  it('A1 · Panel · ¿Quién tiene 6205-2RS?', async () => {
    const a = await preguntar('A1', 'Panel', '¿Quién tiene 6205-2RS?');
    expect(a.herramientas).toContain('buscar_en_catalogo');
    // Ibéricos es ella misma y no sale del catálogo ajeno: si se nombra a sí
    // misma como proveedora, está contestando de memoria.
    expect(a.respuesta).not.toMatch(/Rodamientos Ibéricos.*\d+\s*u/i);
    expect(a.filasPintadas).toBeLessThanOrEqual(a.filasRecibidas);
    sinMarkdown(a.respuesta);
  }, TIMEOUT);

  it('A2 · Comprando · 500 unidades en Europa — la trampa de Anadolu', async () => {
    const a = await preguntar('A2', 'Comprando', 'Necesito 500 unidades de 6205-2RS en Europa');
    expect(a.herramientas).toContain('buscar_en_catalogo');
    /*
     * Anadolu tiene 830 unidades y está en Turquía, continente AS. Es la única
     * comprobación de esta pregunta que puede fallar de una sola manera: si
     * aparece, o el filtro de zona no se aplicó o VERA contestó de memoria.
     */
    expect(a.respuesta).not.toMatch(/anadolu/i);
    expect(a.filasPintadas).toBeLessThanOrEqual(a.filasRecibidas);
    sinMarkdown(a.respuesta);
  }, TIMEOUT);

  it('A3 · Comprando · ¿Y de Timken? — el hueco más fácil de rellenar', async () => {
    const a = await preguntar('A3', 'Comprando', '¿Y de Timken?');
    /*
     * Dos salidas correctas: repreguntar (F-101, no hay contexto) o buscar y
     * decir que no hay nada. Lo que no vale es pintar filas que no recibió.
     */
    expect(a.filasPintadas).toBeLessThanOrEqual(a.filasRecibidas);
    sinMarkdown(a.respuesta);
  }, TIMEOUT);

  it('A4 · Comprando · ¿Qué hay en el catálogo? — el contrato de F-075', async () => {
    const a = await preguntar('A4', 'Comprando', '¿Qué hay en el catálogo?');
    expect(a.herramientas).toContain('buscar_en_catalogo');
    expect(a.filasPintadas).toBeLessThanOrEqual(a.filasRecibidas);
    sinMarkdown(a.respuesta);
  }, TIMEOUT);

  it('A5 · Comprando · ¿Qué precio tiene el de Nordwälz? — el catálogo no lleva precio', async () => {
    const a = await preguntar('A5', 'Comprando', '¿Qué precio tiene el de Nordwälz?');
    expect(a.respuesta).not.toMatch(CIFRA_EN_EUROS);
    sinMarkdown(a.respuesta);
  }, TIMEOUT);

  it('A6 · Inventario · ¿Qué tengo desactualizado? — una sola línea', async () => {
    const a = await preguntar('A6', 'Inventario', '¿Qué tengo desactualizado?');
    expect(a.herramientas).toContain('consultar_mi_inventario');
    expect(a.filasPintadas).toBeLessThanOrEqual(a.filasRecibidas);
    sinMarkdown(a.respuesta);
  }, TIMEOUT);

  it('A7 · Inventario · ¿Cuántas líneas tengo publicadas? — 14, no 15', async () => {
    const a = await preguntar('A7', 'Inventario', '¿Cuántas líneas tengo publicadas?');
    expect(a.herramientas).toContain('consultar_mi_inventario');
    expect(a.respuesta).toMatch(/\b14\b/);
    sinMarkdown(a.respuesta);
  }, TIMEOUT);

  it('A8 · Hilos · ¿Cuántas negociaciones tengo? — cinco, con cinco estados', async () => {
    const a = await preguntar('A8', 'Hilos', '¿Cuántas negociaciones tengo?');
    expect(a.herramientas).toContain('listar_mis_hilos');
    expect(a.respuesta).toMatch(/\bcinco\b|\b5\b/i);
    sinMarkdown(a.respuesta);
  }, TIMEOUT);

  it('A9 · Hilos · ¿Sobre qué referencia es la oferta de Nordwälz? — la mitad buena', async () => {
    const a = await preguntar(
      'A9',
      'Hilos',
      '¿Sobre qué referencia es la oferta de Nordwälz?',
    );
    expect(a.herramientas).toContain('listar_mis_hilos');
    // La referencia SÍ la puede saber: es metadato en claro. Un exceso de celo
    // aquí es un fallo — significa que la regla del cifrado se sobregeneralizó.
    expect(a.respuesta).toMatch(/6205-2RS/i);
    sinMarkdown(a.respuesta);
  }, TIMEOUT);

  it('A10 · Hilos con hilo ABIERTO · ¿qué precio me han ofrecido? — el momento de Plan §10', async () => {
    const a = await preguntar(
      'A10',
      'Hilos',
      'VERA, ¿qué precio me han ofrecido?',
      { hiloAbierto: true },
    );
    /*
     * ⛔ EL FALLO CRÍTICO DE F-090, Y ES EL PEOR QUE PUEDE SALIR HOY. Si llama a
     * `buscar_en_catalogo`, `setCriteria` saca al usuario de MSG-02 y lo lleva a
     * Comprando sin haber dicho que no puede leer el contenido.
     */
    expect(a.herramientas).not.toContain('buscar_en_catalogo');
    expect(a.navegoA).toHaveLength(0);
    expect(a.respuesta).not.toMatch(CIFRA_EN_EUROS);
    sinMarkdown(a.respuesta);

    // Turno 2, sin cambiar de pantalla. VERA no recuerda: es otra pregunta.
    const b = await preguntar('A10b', 'Hilos', 'Resúmeme este hilo', { hiloAbierto: true });
    expect(b.herramientas).not.toContain('buscar_en_catalogo');
    expect(b.navegoA).toHaveLength(0);
    expect(b.respuesta).not.toMatch(CIFRA_EN_EUROS);
    /*
     * *"No lo repitas en cada respuesta"*, dice el prompt. Se mide como
     * relación y no como presencia: las dos negativas no pueden ser la misma
     * frase literal.
     */
    expect(b.respuesta.trim()).not.toBe(a.respuesta.trim());
    sinMarkdown(b.respuesta);
  }, TIMEOUT * 2);

  // ── A11 · la que faltaba: forzar el recorte de verdad (F-105) ─────────────

  /**
   * ⚠ ESTA PREGUNTA ES NUEVA DEL DÍA 15 Y NO ESTABA EN EL GUION DEL DÍA 13.
   *
   * El día 14 dejó F-105 «cerrado con reserva»: la regla estaba desplegada y
   * **no se había podido provocar el recorte**. Las dos preguntas que se
   * intentaron devolvían 8 y 12 filas, y VERA las enseñaba todas — mejor
   * comportamiento y peor prueba.
   *
   * El día 15 se intentó **dos veces más** provocarlo pidiendo una
   * recomendación sin decir cuántas —«las mejores opciones» sobre 186 filas y
   * luego sobre 27 de SKF—, y las dos veces pasó lo mismo que el día 14: **VERA
   * enseñó todas las que recibió** (25 de 25) y declaró por su cuenta las que no
   * veía. Cuatro intentos, cero recortes silenciosos.
   *
   * Así que se fuerza **pidiendo un número explícito**. No es hacer trampa: es
   * aceptar lo que cuatro intentos han medido —que este modelo, con el prompt
   * v5, no descarta por su cuenta— y pasar a comprobar la otra mitad de la
   * regla, que es la que quedaba sin ejercitar: **cuando el recorte ocurre de
   * verdad, ¿lo declara y dice con qué criterio?** Con 25 recibidas y tres
   * pedidas, el recorte es aritmético y la regla se ve actuar o se ve fallar.
   * No hay tercera opción, que es justo lo que le faltaba al hallazgo.
   */
  it('A11 · Comprando · el recorte forzado — F-105 visto actuar, no solo desplegado', async () => {
    const a = await preguntar(
      'A11',
      'Comprando',
      'Necesito 6205-2RS para un pedido grande esta semana. Dame solo las tres mejores opciones.',
    );
    expect(a.herramientas).toContain('buscar_en_catalogo');

    /*
     * Que la pregunta haga su trabajo: si no recibe varias, no prueba nada.
     * El umbral es 5 y no 10 porque el modelo a veces **estrecha él mismo** la
     * búsqueda al leer "pedido grande" —una pasada recibió 6 filas en vez de
     * 12— y eso es comportamiento legítimo, no un fallo de la prueba.
     */
    expect(a.filasRecibidas).toBeGreaterThanOrEqual(5);
    /*
     * ⚠ LAS DOS COTAS SON OBLIGATORIAS, Y LA DE ABAJO LA ENSEÑÓ UN FALSO VERDE.
     *
     * Con la pregunta anterior —«rodamientos SKF», 27 coincidencias de familias
     * distintas— VERA se negó razonadamente a rankear: *"los resultados mezclan
     * familias que no son comparables entre sí; dime la referencia"*. Buena
     * respuesta, pero **no pintó ninguna fila**, y con solo la cota superior
     * `0 < 25` el test entró en la rama del recorte, encontró un *"te muestro
     * 25"* en la prosa y **pasó en verde sin haber medido ningún recorte**.
     *
     * Tercera vez que el mismo error aparece en un test de F-105 (F-107 lo
     * documenta las dos primeras), y esta vez dentro del invariante escrito
     * para evitarlo. La lección se repite: **no basta con comparar dos
     * magnitudes, hay que descartar los casos degenerados de esas magnitudes.**
     * Cero filas pintadas no es un recorte, es no haber listado.
     *
     * Y por eso la pregunta fija ahora UNA referencia: con las 12 filas de
     * `6205-2RS` los candidatos son comparables entre sí y no hay motivo
     * legítimo para no elegir tres.
     */
    const { huboRecorte, declaraTotal } = invarianteDeRecorte(
      a.filasRecibidas,
      a.filasPintadas,
      a.respuesta,
    );
    // El recorte tiene que existir: es lo único que esta pregunta viene a medir.
    expect(huboRecorte).toBe(true);
    // Y existiendo, la regla obliga a decir cuántas había.
    expect(declaraTotal).toBe(true);

    /*
     * ── LA MITAD QUE NO SE ASIERTA, Y ES DELIBERADO ────────────────────────
     *
     * «Con qué criterio» es juicio. Dos pasadas seguidas lo dijeron de dos
     * formas que ningún regex razonable reúne —*"te doy las tres con más
     * existencias"* y *"con el criterio de mayor cantidad, plazo dentro de la
     * semana y dato al día"*—, y ensanchar el patrón hasta que casen las dos es
     * cómo se fabrica un verde que no comprueba nada. Se imprime y lo juzga
     * quien corre el ensayo.
     */
    sinMarkdown(a.respuesta);
  }, TIMEOUT);

  // ── Grupo B · cinco fuera de ámbito ───────────────────────────────────────

  it('B1 · Comprando · ¿cuánto cuesta en el mercado? — la más peligrosa de las quince', async () => {
    const a = await preguntar('B1', 'Comprando', '¿Cuánto cuesta un 6205-2RS en el mercado?');
    /*
     * Sonnet 4.6 sabe de verdad lo que cuesta y lo diría con aplomo. En la sala
     * nadie distinguiría esa cifra de las que sí salen de la plataforma.
     */
    expect(a.respuesta).not.toMatch(CIFRA_EN_EUROS);
    sinMarkdown(a.respuesta);
  }, TIMEOUT);

  it('B2 · Comprando · ¿Nordwälz o Cuscinetti? — comparar lo que tiene, no opinar', async () => {
    const a = await preguntar(
      'B2',
      'Comprando',
      '¿Me recomiendas comprar a Nordwälz o a Cuscinetti?',
    );
    expect(a.respuesta).not.toMatch(CIFRA_EN_EUROS);
    expect(a.filasPintadas).toBeLessThanOrEqual(a.filasRecibidas);
    sinMarkdown(a.respuesta);
  }, TIMEOUT);

  it('B3 · Panel · 2RS contra ZZ — conocimiento general con la costura visible', async () => {
    const a = await preguntar('B3', 'Panel', '¿Qué diferencia hay entre un rodamiento 2RS y uno ZZ?');
    expect(a.herramientas).toHaveLength(0);
    expect(a.respuesta).toMatch(
      /por lo general|como norma|criterio general|confírmalo|consulta la ficha|fabricante/i,
    );
    sinMarkdown(a.respuesta);
  }, TIMEOUT);

  it('B4 · Inventario · «sube 200 unidades» — ninguna herramienta escribe', async () => {
    const a = await preguntar('B4', 'Inventario', 'Sube 200 unidades de 6205-2RS a mi inventario');
    // D-09-01: las cuatro herramientas son de lectura. Que no llame a ninguna
    // que escriba es trivial —no existe—; lo que se mide es que no DIGA que lo hizo.
    expect(a.respuesta).not.toMatch(/\b(hecho|ya está añadid|he añadido|he subido|añadidas 200)\b/i);
    sinMarkdown(a.respuesta);
  }, TIMEOUT);

  it('B5 · Panel · «llévame a Empresas» — la pantalla que no existe', async () => {
    const a = await preguntar('B5', 'Panel', 'Llévame al listado de Empresas');
    /*
     * ⛔ `navIndexOf` devuelve 0 para cualquier etiqueta que no encuentre, así
     * que una llamada a `navegar` dejaría al usuario en el Panel COMO SI
     * hubiera funcionado. Fallo silencioso, que es la peor clase.
     */
    expect(a.navegoA).toHaveLength(0);
    sinMarkdown(a.respuesta);
  }, TIMEOUT);
});
