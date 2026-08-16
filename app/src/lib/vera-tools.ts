import type { MemberProfile } from './session';
import {
  EMPTY_CRITERIA,
  ZONES,
  countryName,
  fetchResults,
  leadTimeLabel,
  quantityLabel,
  type SearchCriteria,
  type Zone,
} from './search';
import {
  FILTERS,
  ageLabel,
  ageLevel,
  daysSince,
  fetchPage,
  type AgeLevel,
  type Filter,
} from './inventory';
import { fetchThreadPage } from './threads';

/**
 * Las cuatro herramientas de VERA · lado cliente (D-09-01, D-09-05).
 *
 * **Se ejecutan aquí y no en la Edge Function, y es la decisión del día**: así
 * `spec.md:223` —*"con los permisos del usuario autenticado sin posibilidad de
 * escalar privilegios"*— lo impone RLS con el JWT que ya vive en el navegador,
 * en vez de depender de que el servidor use bien unas credenciales.
 *
 * Nada de esto reimplementa consultas: las cuatro se apoyan en la capa de datos
 * que ya existe y ya está probada (`search.ts` del día 6, `inventory.ts` del 3,
 * `threads.ts` del 5). Una segunda implementación de "mi inventario" acabaría
 * discrepando de la primera, y la discrepancia no daría error: daría dos
 * respuestas distintas a la misma pregunta según quién la hiciera.
 */

export const TOOL_NAMES = [
  'buscar_en_catalogo',
  'consultar_mi_inventario',
  'listar_mis_hilos',
  'navegar',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

/**
 * Las cinco pantallas construidas, de los ocho ítems de `NAV_ITEMS`.
 *
 * ⚠ La lista se repite aquí a propósito en vez de derivarse de `NAV_ITEMS`:
 * `NAV_ITEMS` son los ítems del menú aprobado —ocho— y estas son las que
 * existen —cinco—. Derivarla borraría justo la diferencia que hay que vigilar.
 */
export const SCREENS = ['Panel', 'Vendiendo', 'Comprando', 'Hilos', 'Inventario'] as const;
export type Screen = (typeof SCREENS)[number];

export interface ToolContext {
  profile: MemberProfile;
  navigate: (screen: Screen) => void;
  setCriteria: (criteria: SearchCriteria) => void;
}

export interface ToolResult {
  content: string;
  isError: boolean;
}

/**
 * Cuántas filas se le enseñan al modelo.
 *
 * ⚠ **ERA 10, Y ESO PROVOCÓ EL PRIMER CASO REAL DE RIESGO #1 DEL PROYECTO
 * (F-075).** En la primera corrida contra Sonnet, la herramienta devolvió 10 de
 * 13 filas y el pie decía *"13 coincidencias (se listan 10)"*. VERA contestó
 * nombrando la marca `NTN` y un stock *"desde 150"* — **ninguna de las dos cosas
 * estaba en su retorno**: eran los puestos 11-13, que no vio. No sonaron raras
 * porque eran valores reales de la base; rellenó el hueco con conocimiento del
 * mundo que casualmente encajaba.
 *
 * Dársele un recuento cuyo contenido no puede ver es una invitación a especular.
 * Se ataca por los dos lados: **el tope sube** —estas líneas son cortas y 25
 * caben de sobra— y **cuando aun así se recorta, se le prohíbe explícitamente
 * suponer nada de lo que no ve** (ver `recorte`).
 */
const MAX_FILAS = 25;

export const FORBIDDEN_THREAD_FIELDS = [
  'content_ciphertext',
  'contentCiphertext',
  'wrapped_cek',
  'ephemeral_pubkey',
] as const;

/**
 * ¿Se ha colado algo cifrado en lo que va a ver el modelo?
 *
 * Existe como función y no como comentario porque es lo único que separa
 * "metadata-only" de una promesa. Se prueba en los dos sentidos: contra la
 * salida real, y contra un caso construido que SÍ lleva ciphertext (F-066).
 */
export function leaksCiphertext(payload: unknown): boolean {
  const texto = typeof payload === 'string' ? payload : JSON.stringify(payload ?? '');
  return FORBIDDEN_THREAD_FIELDS.some((campo) => texto.includes(campo));
}

// -----------------------------------------------------------------------------
// Lectura de la entrada del modelo
// -----------------------------------------------------------------------------

function campo(input: unknown, clave: string): unknown {
  if (typeof input !== 'object' || input === null) return undefined;
  return (input as Record<string, unknown>)[clave];
}

function texto(input: unknown, clave: string): string {
  const v = campo(input, clave);
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Un entero, aceptando también el número escrito como cadena: los modelos mandan
 * `"500"` con la misma naturalidad que `500`, y rechazarlo perdería el filtro
 * sin decir nada.
 */
function entero(input: unknown, clave: string): number | null {
  const v = campo(input, clave);
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v.trim());
  return null;
}

export function criteriaFromInput(input: unknown): SearchCriteria {
  const zonaCruda = texto(input, 'zona').toUpperCase();
  const zona = (ZONES as readonly string[]).includes(zonaCruda) ? (zonaCruda as Zone) : null;
  return {
    ...EMPTY_CRITERIA,
    partNumber: texto(input, 'referencia'),
    brand: texto(input, 'marca'),
    minQuantity: entero(input, 'cantidad_minima'),
    zone: zona,
    country: texto(input, 'pais').toUpperCase(),
    maxLeadTimeDays: entero(input, 'plazo_maximo_dias'),
  };
}

/**
 * La cabecera del retorno.
 *
 * Cuando hay más filas que las mostradas **se lo dice y le prohíbe suponer**.
 * Decirle solo *"13 (se listan 10)"* fue lo que produjo F-075: un recuento sin
 * contenido es un hueco, y este modelo rellena huecos con fluidez.
 */
function recorte(mostradas: number, total: number, singular: string, plural: string): string {
  if (total === 0) return `Ninguna ${singular}.`;
  const cabeza = total === 1 ? `1 ${singular}` : `${total} ${plural}`;
  if (total <= mostradas) return cabeza;
  const ocultas = total - mostradas;
  return (
    `${cabeza}, y AQUÍ SOLO VES ${mostradas}. Las otras ${ocultas} NO se te han mostrado: ` +
    `no menciones marcas, cantidades, plazos ni empresas que no estén en la lista de abajo, ` +
    `y si te preguntan por el resto di que hay ${ocultas} más y que hace falta afinar la búsqueda.`
  );
}

/**
 * La antigüedad del dato, con su nivel dicho y no solo los días.
 *
 * ⚠ **ENTRA EL 17-AGO POR LA PREGUNTA DE `F-102` HECHA A LAS OTRAS TRES
 * HERRAMIENTAS:** *¿qué pregunta razonable no puede contestarse con lo que
 * devuelvo, y qué va a inventar el modelo para taparlo?*.
 *
 * *"¿Ese stock está actualizado?"* es lo que pregunta cualquier comprador antes
 * de fiarse de una cifra, y la frescura es media demo —221 líneas, 159 frescas,
 * 53 naranja, 9 rojas (`F-094`)—. `search.ts` e `inventory.ts` ya traían
 * `lastUploadAt` en cada fila: se pedía a la base, se pintaba en pantalla **y se
 * tiraba antes de llegar al modelo**. Misma familia que `F-102`: el dato existe,
 * está pagado y no se propaga; el modelo solo puede callarse o suponer.
 *
 * Va el nivel además del literal porque *"hace 12 días"* no le dice al modelo si
 * eso es normal o es un aviso: los umbrales (>7 y >30) son del proyecto, no
 * suyos, y sin ellos tendría que inventarse uno.
 */
const NIVEL_FRESCURA: Record<AgeLevel, string> = {
  fresh: 'al día',
  stale: 'desactualizada',
  critical: 'muy desactualizada',
};

function frescura(iso: string): string {
  const dias = daysSince(iso);
  return `${ageLabel(dias).toLowerCase()}, ${NIVEL_FRESCURA[ageLevel(dias)]}`;
}

// -----------------------------------------------------------------------------
// Las cuatro
// -----------------------------------------------------------------------------

async function buscarEnCatalogo(input: unknown, ctx: ToolContext): Promise<ToolResult> {
  const criteria = criteriaFromInput(input);

  /*
   * Escribe CRITERIOS, no chips. `search.ts:154` lo dejó dicho el día 6: los
   * chips son una función pura de los criterios, y si VERA escribiera sobre la
   * lista pintada habría dos verdades sobre qué se está filtrando.
   */
  ctx.setCriteria(criteria);

  const page = await fetchResults({
    orgId: ctx.profile.orgId,
    memberId: ctx.profile.id,
    criteria,
  });

  const filas = page.rows.slice(0, MAX_FILAS).map((r) =>
    [
      r.partNumber,
      r.brand,
      `${quantityLabel(r.quantity)} u`,
      leadTimeLabel(r.leadTimeDays),
      countryName(r.country),
      r.orgName,
      // Los dos campos que ya venían en la fila y no llegaban al modelo.
      `actualizada ${frescura(r.lastUploadAt)}`,
      ...(r.consulted ? ['YA CONSULTADA por tu organización'] : []),
    ].join(' · '),
  );

  const cabecera = recorte(filas.length, page.total, 'coincidencia', 'coincidencias');
  return {
    // Los avisos finales no son de cortesía: sin ellos, el modelo lee la ausencia
    // de una columna como un hecho —"es gratis", "nadie ha preguntado", "estas
    // son las mejores"— y lo dice con aplomo.
    content: [
      cabecera,
      ...filas,
      'Ninguna de estas filas incluye condiciones económicas: eso se negocia cifrado dentro de un hilo.',
      'Las filas que no llevan «YA CONSULTADA» son las que tu organización todavía no ha consultado.',
      'Este orden no es un ranking de idoneidad. Si eliges unas cuantas para recomendar, di cuántas había y con qué criterio has elegido.',
      // Cuarto hueco de la misma revisión: la herramienta MUEVE al usuario
      // (`App.tsx:157` navega a Comprando al escribir criterios) y no lo decía.
      // El usuario cambia de pantalla mientras lee una respuesta que no lo menciona.
      'Esta búsqueda ha llevado al usuario a la pantalla Comprando con estos filtros ya puestos: dilo en tu respuesta, porque acaba de cambiar de pantalla.',
    ].join('\n'),
    isError: false,
  };
}

async function consultarMiInventario(input: unknown, ctx: ToolContext): Promise<ToolResult> {
  const filtroCrudo = texto(input, 'filtro').toLowerCase();
  if (filtroCrudo && !(FILTERS as readonly string[]).includes(filtroCrudo)) {
    return {
      content: `No existe el filtro «${filtroCrudo}». Los que hay son: ${FILTERS.join(', ')}.`,
      isError: true,
    };
  }
  const filter = (filtroCrudo || 'todos') as Filter;

  const busqueda = texto(input, 'referencia');
  const page = await fetchPage({
    orgId: ctx.profile.orgId,
    filter,
    search: busqueda,
    page: 1,
  });

  const filas = page.lines
    .slice(0, MAX_FILAS)
    .map((l) =>
      [
        l.partNumber,
        l.brand,
        `${quantityLabel(l.quantity)} u`,
        l.status,
        // Misma revisión que arriba: "¿qué tengo que actualizar?" es LA pregunta
        // de quien mira su propio inventario, y `lastUploadAt` ya venía en la
        // línea. Sin él, el modelo solo puede callarse o estimar.
        `actualizada ${frescura(l.lastUploadAt)}`,
      ].join(' · '),
    );

  return {
    content: [
      /*
       * ⚠ EL RECUENTO SIN DECIR SOBRE QUÉ SE HA CONTADO ES UN HUECO (`F-102`).
       * "14 líneas" no significa lo mismo con el filtro `todos` que con
       * `publicados`, y cuando el modelo redacta la respuesta ya no tiene
       * delante con qué argumentos llamó: puede decir "tienes 14 líneas" de un
       * recuento que era solo de las publicadas. Se dice aquí, que es donde se
       * sabe.
       */
      `Esto es tu propio inventario, filtro «${filter}»${busqueda ? ` y búsqueda «${busqueda}»` : ''}. El recuento de abajo es SOLO de lo que cumple ese filtro.`,
      recorte(filas.length, page.total, 'línea', 'líneas'),
      ...filas,
    ].join('\n'),
    isError: false,
  };
}

async function listarMisHilos(input: unknown, ctx: ToolContext): Promise<ToolResult> {
  const page = await fetchThreadPage({
    orgId: ctx.profile.orgId,
    search: texto(input, 'contraparte'),
    page: 1,
  });

  /*
   * ⚠ AQUÍ NO SE PIDE NI SE PINTA CONTENIDO, Y ES LA MITAD DEL PRODUCTO.
   * `ThreadSummary` ya es metadata-only por construcción (`threads.ts`: la vista
   * previa nunca muestra contenido descifrado), así que lo único que hay que no
   * hacer es añadirlo. `leaksCiphertext` comprueba que sigue siendo verdad.
   */
  /*
   * ⚠ LA DIRECCIÓN DEL ÚLTIMO ELEMENTO VA EN LA FILA, Y NO ES ADORNO (`F-102`).
   * Sin ella, el único indicio que le quedaba al modelo era el estado del hilo,
   * y afirmó —con datos por lo demás correctos y con todo el aplomo— que el
   * usuario tenía dos hilos «que requieren tu atención», incluyendo una CONSULTA
   * que había enviado él mismo. Quién envió el último elemento es lo que decide
   * de quién es el turno; el estado, por sí solo, no lo dice.
   */
  const filas = page.threads.slice(0, MAX_FILAS).map((t) => {
    const ultimo = t.lastItem
      ? `último: ${t.lastItem.type}` +
        `${t.lastItem.partNumber ? ` sobre ${t.lastItem.partNumber}` : ''}` +
        `, ${t.lastItem.isOwn ? 'lo enviaste tú' : `lo envió ${t.counterpartyName}`}`
      : 'sin elementos';
    return [t.counterpartyName, countryName(t.counterpartyCountry), t.state, ultimo].join(' · ');
  });

  return {
    content: [
      recorte(filas.length, page.total, 'negociación', 'negociaciones'),
      ...filas,
      /*
       * El nombre del estado empuja al error por sí mismo, así que se desactiva
       * aquí: `CON CONSULTA PENDIENTE` describe el hilo, no de quién es el turno.
       */
      'El estado describe el hilo, no de quién es el turno: «CON CONSULTA PENDIENTE» significa ' +
        'que hay una consulta esperando respuesta, la enviara quien la enviara. Quién tiene que ' +
        'responder se deduce SOLO de quién envió el último elemento, que va dicho en cada fila.',
      'Solo metadatos: el contenido de estos hilos va cifrado y no se puede leer desde aquí.',
    ].join('\n'),
    isError: false,
  };
}

function navegar(input: unknown, ctx: ToolContext): ToolResult {
  const destino = texto(input, 'pantalla');
  if (!destino) {
    return { content: 'Falta la pantalla de destino.', isError: true };
  }
  if (!(SCREENS as readonly string[]).includes(destino)) {
    /*
     * `navIndexOf` devuelve 0 —Panel— para cualquier etiqueta que no encuentre,
     * y `Empresas`, `Foros` y `Contacto` SÍ están en el menú. Sin este corte,
     * "llévame a Empresas" aterrizaría en Panel y VERA diría que ya está: un
     * recorte silencioso contado con aplomo.
     */
    return {
      content: `«${destino}» está en el menú pero no está construida en el MVP. Las que existen: ${SCREENS.join(', ')}.`,
      isError: true,
    };
  }
  // NAVEGACIÓN va sin confirmación (`spec.md:205`): es reversible.
  ctx.navigate(destino as Screen);
  return { content: `Abierta la pantalla ${destino}.`, isError: false };
}

// -----------------------------------------------------------------------------
// Despacho
// -----------------------------------------------------------------------------

export async function runTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'buscar_en_catalogo':
        return await buscarEnCatalogo(input, ctx);
      case 'consultar_mi_inventario':
        return await consultarMiInventario(input, ctx);
      case 'listar_mis_hilos':
        return await listarMisHilos(input, ctx);
      case 'navegar':
        return navegar(input, ctx);
      default:
        /*
         * Un nombre que no existe se dice tal cual. La tentación es responder
         * algo vacío y dejar que el modelo siga; el resultado de eso es que
         * VERA rellena el hueco, que es exactamente el riesgo #1.
         */
        return { content: `La herramienta «${name}» no existe.`, isError: true };
    }
  } catch (e) {
    // Un fallo de red o de RLS vuelve COMO FALLO. Devolver vacío le haría
    // indistinguible de "no hay resultados", y sobre eso VERA respondería con
    // aplomo que no hay nada.
    const motivo = e instanceof Error ? e.message : String(e);
    return { content: `No se ha podido consultar: ${motivo}`, isError: true };
  }
}
