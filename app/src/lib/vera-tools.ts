import type { MemberProfile } from './session';
import {
  EMPTY_CRITERIA,
  MAX_RESULTS,
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
import { fetchDirectoryCountries } from './directory';
import { NOTES_MAX } from './inquiry-form';

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
  'preparar_consulta',
  'preparar_oferta',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

/**
 * Las pantallas a las que `navegar` puede llevar: siete de los ocho ítems de `NAV_ITEMS`.
 *
 * ⚠ La lista se repite aquí a propósito en vez de derivarse de `NAV_ITEMS`:
 * `NAV_ITEMS` son los ítems del menú aprobado —ocho— y estas son las que
 * existen —siete—. Derivarla borraría justo la diferencia que hay que vigilar:
 * `Contacto` está en el menú y pinta `NotAvailable`.
 *
 * Empresas y Foros entran el 14-oct-2026 (decisión del PO): estaban construidas
 * desde agosto y la lista seguía siendo la del MVP. Se llega a su entrada —el
 * Directorio, la lista de categorías—, porque `navigate()` de `App.tsx` limpia la
 * ficha, la categoría y el hilo del foro al cambiar de ítem.
 *
 * Y NO es la lista de dónde está el usuario: esa es `veraScreenName` (`F-255`).
 */
export const SCREENS = ['Panel', 'Vendiendo', 'Comprando', 'Hilos', 'Inventario', 'Empresas', 'Foros'] as const;
export type Screen = (typeof SCREENS)[number];

/**
 * Lo que VERA deja preparado en el hilo abierto (MSG-03 §5, F-249). Es un BORRADOR: el formulario se abre
 * relleno y lo revisa y lo envía el usuario. Ninguno de los dos lleva precio, y no es un descuido: el
 * precio unitario no se pre-rellena nunca desde VERA (§4.2 y §7; decisión del PO, 12-oct-2026).
 */
export type DraftRequest =
  | { kind: 'consulta'; reference: string; brand: string; quantity: number; notes: string | null }
  | {
      kind: 'oferta';
      reference: string;
      brand: string;
      quantity: number | null;
      leadTimeDays: number | null;
      currency: string | null;
      notes: string | null;
    };

/** Lo que VERA deja puesto en Inventario cuando la respuesta es una lista de líneas (decisión del PO, 14-oct-2026). */
export interface InventoryView {
  filter: Filter;
  search: string;
}

/** Lo que VERA deja puesto en el Directorio de Empresas: el país por el que filtrar (código ISO de dos letras, en mayúsculas). */
export interface DirectoryView {
  country: string;
}

export interface ToolContext {
  profile: MemberProfile;
  navigate: (screen: Screen) => void;
  setCriteria: (criteria: SearchCriteria) => void;
  /** Hay un hilo abierto en pantalla: sin él no hay formulario donde preparar nada. */
  threadOpen: boolean;
  prepareDraft: (draft: DraftRequest) => void;
  /**
   * Lleva a Inventario con ese filtro y esa búsqueda puestos. Opcional: sin él, la herramienta lo dice
   * y contesta en texto, en vez de prometer una pantalla que no se ha movido.
   */
  showInventory?: (view: InventoryView) => void;
  /**
   * Lleva al Directorio con ese país puesto en el filtro (`directory-access-from-vera`). Opcional: sin él, la
   * herramienta lo dice en vez de prometer un filtro que no se ha aplicado.
   */
  showDirectory?: (view: DirectoryView) => void;
  /**
   * Lo que el usuario quitó o cambió a mano en Comprando desde los últimos filtros puestos (`removedFilters`),
   * calculado al enviar la pregunta. `buscar_en_catalogo` no los repone sin confirmación (`F-258`, B2).
   */
  removedFilters?: readonly RemovedFilter[];
}

/** Un borrador ya pedido, con un número que cambia en cada petición: la misma petición dos veces tiene que reabrir el formulario. */
export type VeraDraft = DraftRequest & { nonce: number };

/** Las divisas del formulario de oferta (`OfferCounterForm`); un test las compara con las de allí. */
export const OFFER_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'PLN'] as const;
const NOTES_OFFER_MAX = 500;
/** Diez años: por encima, casi seguro un año o unos días mal leídos. */
const LEAD_TIME_MAX_DAYS = 3650;

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
 * Los filtros de Comprando dichos al modelo con los nombres de los parámetros de `buscar_en_catalogo`
 * (`F-101`). Con los nombres de los chips tendría que traducir «Europa · España» de vuelta a `EU` y
 * `ES` para afinar la búsqueda; así los copia tal cual. Y no depende de cómo se pinten los chips.
 */
export function describeCriteria(c: SearchCriteria): string {
  const partes = [
    c.partNumber ? `referencia=${c.partNumber}` : '',
    c.brand ? `marca=${c.brand}` : '',
    c.minQuantity !== null ? `cantidad_minima=${c.minQuantity}` : '',
    c.zone ? `zona=${c.zone}` : '',
    c.country ? `pais=${c.country}` : '',
    c.maxLeadTimeDays !== null ? `plazo_maximo_dias=${c.maxLeadTimeDays}` : '',
  ].filter(Boolean);
  return partes.length ? partes.join(' · ') : 'ninguno';
}

/**
 * Lo que el usuario cambió A MANO en Comprando desde la última búsqueda de VERA, o `null` si nada.
 *
 * Entra el 14-oct-2026 por `F-258` (B2): con solo la lista de filtros vivos, Sonnet 5 volvió a poner dos
 * veces una zona que el usuario había quitado con la ×, porque la conversación decía «6204 en Europa».
 * La diferencia, dicha como un hecho («quitó zona=EU»), no se puede leer de otra manera.
 */
/** Los criterios con los nombres de los parámetros de `buscar_en_catalogo`, en su orden; vacío si no hay. */
const PARAMETROS = ['referencia', 'marca', 'cantidad_minima', 'zona', 'pais', 'plazo_maximo_dias'] as const;
type Parametro = (typeof PARAMETROS)[number];

function comoParametros(c: SearchCriteria): Record<Parametro, string> {
  return {
    referencia: c.partNumber,
    marca: c.brand,
    cantidad_minima: c.minQuantity === null ? '' : String(c.minQuantity),
    zona: c.zone ?? '',
    pais: c.country,
    plazo_maximo_dias: c.maxLeadTimeDays === null ? '' : String(c.maxLeadTimeDays),
  };
}

export function describeManualChanges(vera: SearchCriteria | null, vivos: SearchCriteria | null): string | null {
  if (!vera || !vivos) return null;
  const antes = comoParametros(vera);
  const ahora = comoParametros(vivos);
  const cambios = PARAMETROS.filter((p) => antes[p] !== ahora[p]).map((p) =>
    !ahora[p] ? `quitó ${p}=${antes[p]}` : !antes[p] ? `añadió ${p}=${ahora[p]}` : `cambió ${p}=${antes[p]} por ${p}=${ahora[p]}`,
  );
  return cambios.length ? cambios.join('; ') : null;
}

/** Un filtro que estaba puesto y el usuario quitó o sustituyó a mano: el valor que ya no quiere. */
export interface RemovedFilter {
  param: Parametro;
  value: string;
}

/**
 * Los filtros que el usuario quitó o cambió a mano desde los últimos que se pusieron (`F-258`, B2).
 * Es la versión estructurada de `describeManualChanges`, para que `buscar_en_catalogo` pueda comprobar,
 * sin interpretar nada, si el modelo intenta volver a ponerlos.
 */
export function removedFilters(vera: SearchCriteria | null, vivos: SearchCriteria | null): RemovedFilter[] {
  if (!vera || !vivos) return [];
  const antes = comoParametros(vera);
  const ahora = comoParametros(vivos);
  return PARAMETROS.filter((p) => antes[p] !== '' && antes[p] !== ahora[p]).map((p) => ({ param: p, value: antes[p] }));
}

const igual = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

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
   * ⚠ EL FILTRO QUE EL USUARIO QUITÓ A MANO NO SE REPONE SIN QUE LO DIGA (`F-258`, B2; PO, 15-oct-2026).
   * Con el aviso en el contexto, Sonnet 5 lo reponía 4 de 4: entre lo que el usuario dijo («6204 en Europa»)
   * y lo que hizo con la ×, se quedaba con lo dicho. Aquí se comprueba sin interpretar nada: si la llamada
   * vuelve a poner un valor que el usuario quitó o sustituyó, no se aplica —ni pantalla ni criterios— y se le
   * pide que decida. Reponerlo exige `confirmar_filtros_quitados`, que solo vale si lo ha pedido ahora.
   */
  const pedidos = comoParametros(criteria);
  const repuestos = (ctx.removedFilters ?? []).filter((r) => pedidos[r.param] !== '' && igual(pedidos[r.param], r.value));
  if (repuestos.length > 0 && campo(input, 'confirmar_filtros_quitados') !== true) {
    const lista = repuestos.map((r) => `${r.param}=${r.value}`).join(', ');
    return {
      content:
        `NO se ha buscado: vuelves a poner ${lista}, y el usuario lo quitó A MANO en Comprando después de tu última búsqueda. ` +
        'Si en su último mensaje no te ha pedido expresamente volver a ponerlo, repite la búsqueda sin ese filtro. ' +
        'Si te lo ha pedido, repítela con confirmar_filtros_quitados: true. No lo deduzcas de mensajes anteriores: lo que hizo a mano es posterior.',
      isError: true,
    };
  }

  /*
   * Escribe CRITERIOS, no chips. `search.ts:154` lo dejó dicho el día 6: los
   * chips son una función pura de los criterios, y si VERA escribiera sobre la
   * lista pintada habría dos verdades sobre qué se está filtrando.
   */
  ctx.setCriteria(criteria);

  /*
   * Por cantidad, como se midió contra Sonnet 5 (`F-258`): con más de 25 filas, «¿quién tiene más stock?»
   * solo se contesta bien si las de más stock están entre las que ve. La pantalla del usuario ordena por
   * antigüedad (`DEFAULT_SORT`, 16-oct), y eso se le dice en el retorno.
   */
  const page = await fetchResults({
    orgId: ctx.profile.orgId,
    memberId: ctx.profile.id,
    criteria,
    orden: 'cantidad',
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
      // 16-oct-2026: la tabla del usuario ordena por antigüedad por defecto; estas filas, por cantidad.
      'Estas filas te llegan ordenadas por cantidad, de más a menos. La tabla del usuario las ordena por antigüedad, las más recientes arriba: no le hables de «la primera» o «la de arriba» como si vierais el mismo orden.',
      /*
       * El límite de 25 (`MAX_FILAS`) es de lo que ve el MODELO, no de la pantalla. En la prueba contra
       * Sonnet 5 (`F-258`) contestó seis veces «91 resultados, se muestran 25»: falso, la tabla enseña
       * todas hasta el tope de 200. Se le dice aquí, que es donde ve el 25.
       */
      ...(page.total > filas.length
        ? [`La tabla de Comprando le enseña al usuario TODAS estas coincidencias${page.capped ? ` hasta las ${MAX_RESULTS} primeras` : ''}: el límite de ${MAX_FILAS} es solo lo que ves TÚ. No le digas que en pantalla se muestran ${MAX_FILAS}.`]
        : []),
      // El tope de SRCH-01 (`MAX_RESULTS`): la pantalla lo avisa, y la línea de VERA no puede dar
      // un recuento que parezca el de la tabla.
      ...(page.capped
        ? [`La pantalla Comprando solo enseña los ${MAX_RESULTS} primeros de estos ${page.total}: si das el recuento, dilo.`]
        : []),
      /*
       * La herramienta MUEVE al usuario (`App.tsx`, `setCriteria` navega a Comprando) y él ya está viendo
       * la tabla. Hasta el 14-oct se le pedía que lo dijera; desde ese día, además, que no repita lo que
       * la pantalla enseña: gastaba salida y duplicaba en dos sitios lo que puede discrepar (`F-075`,
       * `F-105`). Decisión del PO, `DECISIONES-V1.md`.
       */
      `Esta búsqueda ha llevado al usuario a la pantalla Comprando con estos filtros puestos: ${describeCriteria(criteria)}. ` +
        'Él ya ve la tabla, los filtros y el recuento: NO repitas las filas. Si solo pidió la búsqueda, contesta en una línea con los filtros y el recuento; ' +
        'si además preguntó algo, contesta solo eso. Añade algo más únicamente si una parte de lo que pidió no se ha podido poner como filtro, o si no hay resultados (entonces propón qué filtro quitar).',
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

  /*
   * Decisión del PO del 14-oct-2026: si la respuesta es una LISTA de líneas, se enseña en Inventario
   * con el mismo filtro y la misma búsqueda (la pantalla tiene exactamente los mismos), y VERA contesta
   * en una línea. Si es un número o un sí/no, no se mueve la pantalla: el usuario puede estar en un hilo.
   * Lo decide el modelo con `mostrar_en_pantalla`; por defecto, no se mueve.
   */
  const mostrar = campo(input, 'mostrar_en_pantalla') === true;
  const enPantalla = mostrar && ctx.showInventory !== undefined;
  if (enPantalla) ctx.showInventory!({ filter, search: busqueda });

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
      enPantalla
        ? 'Esto ha llevado al usuario a la pantalla Inventario con ese filtro y esa búsqueda puestos: ya ve las líneas. ' +
          'NO las repitas: contesta en una línea con el recuento, o con lo que te haya preguntado.'
        : mostrar
          ? 'No se ha podido abrir Inventario desde aquí: la pantalla no se ha movido, así que tu respuesta es lo único que verá. Sé breve.'
          : 'La pantalla no se ha movido: tu respuesta es lo único que el usuario verá de esto. Contesta lo que te ha preguntado, sin listar más de lo necesario.',
    ].join('\n'),
    isError: false,
  };
}

async function listarMisHilos(input: unknown, ctx: ToolContext): Promise<ToolResult> {
  const page = await fetchThreadPage({
    orgId: ctx.profile.orgId,
    search: texto(input, 'contraparte'),
    page: 1,
    reference: texto(input, 'referencia') || undefined,
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
    const base = [t.counterpartyName, countryName(t.counterpartyCountry), t.state, ultimo].join(' · ');
    if (!t.referenceMatches || t.referenceMatches.length === 0) return base;
    // Búsqueda por referencia: se dicen TODOS los elementos que la llevan, no
    // solo el último (un hilo puede tener varias referencias).
    const coincidencias = t.referenceMatches
      .map(
        (m) =>
          `${m.type}${m.state ? ` ${m.state}` : ''} sobre ${m.partNumber ?? '—'}${m.brand ? ` (${m.brand})` : ''}, ${
            m.isOwn ? 'lo enviaste tú' : 'lo envió la contraparte'
          }`,
      )
      .join('; ');
    return `${base} · con esa referencia: ${coincidencias}`;
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
      // La lista de Hilos no filtra por referencia ni por turno: no hay pantalla que enseñe esto, así
      // que aquí el texto SÍ es la respuesta (decisión del PO, 14-oct-2026). Breve, no un volcado.
      'La pantalla no se ha movido y la lista de Hilos no puede enseñar esto filtrado: tu respuesta es lo único que verá. Contesta solo lo que te ha preguntado, una línea por hilo como mucho.',
    ].join('\n'),
    isError: false,
  };
}

/**
 * Un entero positivo EXACTO, o `null`. A diferencia de `entero`, no trunca: «2,5» o 300.5 son un dato
 * que el modelo ha entendido mal, y redondearlo a 2 o a 300 es escribir una cifra que nadie dijo.
 */
function enteroPositivo(input: unknown, clave: string): number | null {
  const v = campo(input, clave);
  if (typeof v === 'number' && Number.isInteger(v) && v > 0) return v;
  if (typeof v === 'string' && /^\d+$/.test(v.trim()) && Number(v.trim()) > 0) return Number(v.trim());
  return null;
}

/** ¿Vino el campo con algo? (para distinguir «no lo dijo» de «lo dijo mal»). */
function presente(input: unknown, clave: string): boolean {
  const v = campo(input, clave);
  return v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');
}

const SIN_HILO: ToolResult = {
  content:
    'No hay ningún hilo abierto en pantalla, así que no hay formulario donde preparar nada. No inventes ' +
    'a qué empresa se refiere: dile que abra el hilo con ella (puedes llevarle a Hilos con la herramienta navegar).',
  isError: true,
};

function prepararConsulta(input: unknown, ctx: ToolContext): ToolResult {
  if (!ctx.threadOpen) return SIN_HILO;

  const referencia = texto(input, 'referencia');
  if (!referencia) {
    return { content: 'Falta la referencia. Pregúntale al usuario sobre cuál quiere consultar; no la supongas.', isError: true };
  }
  const cantidad = enteroPositivo(input, 'cantidad');
  if (cantidad === null) {
    return {
      content:
        'Falta la cantidad, o no es un entero positivo. Es obligatoria y tiene que ser la que dijo el usuario: ' +
        'pregúntasela. No la supongas ni propongas una (tampoco la de stock).',
      isError: true,
    };
  }
  const notas = texto(input, 'notas');
  if (notas.length > NOTES_MAX) {
    return { content: `Las notas pasan de ${NOTES_MAX} caracteres. Acórtalas o déjalas fuera.`, isError: true };
  }
  const marca = texto(input, 'marca');

  ctx.prepareDraft({ kind: 'consulta', reference: referencia, brand: marca, quantity: cantidad, notes: notas || null });
  return {
    content: [
      `Formulario de consulta abierto en el hilo con: referencia ${referencia}${marca ? ` (${marca})` : ''}, cantidad ${cantidad}${notas ? ', y notas' : ''}.`,
      'NO está enviada: el usuario tiene que revisarla y pulsar «Enviar consulta».',
      'Si la referencia no coincide con una sola línea publicada de esa empresa, antes verá un selector para elegirla: no sabes cuál de los dos casos ha ocurrido, así que no lo afirmes.',
      'Díselo en una o dos frases —qué has rellenado— y pídele que lo revise antes de enviar. No digas que la has enviado.',
    ].join('\n'),
    isError: false,
  };
}

function prepararOferta(input: unknown, ctx: ToolContext): ToolResult {
  if (!ctx.threadOpen) return SIN_HILO;

  const referencia = texto(input, 'referencia');
  const marca = texto(input, 'marca');

  let cantidad: number | null = null;
  if (presente(input, 'cantidad')) {
    cantidad = enteroPositivo(input, 'cantidad');
    if (cantidad === null) {
      return { content: 'La cantidad no es un entero positivo. Pregúntale al usuario cuántas unidades ofrece; no la redondees.', isError: true };
    }
  }

  let plazo: number | null = null;
  if (presente(input, 'plazo_dias')) {
    plazo = enteroPositivo(input, 'plazo_dias');
    if (plazo === null || plazo > LEAD_TIME_MAX_DAYS) {
      return { content: 'El plazo no es un número de días entero y razonable. Pregúntale al usuario el plazo en días.', isError: true };
    }
  }

  let divisa: string | null = null;
  if (presente(input, 'divisa')) {
    const d = texto(input, 'divisa').toUpperCase();
    if (!(OFFER_CURRENCIES as readonly string[]).includes(d)) {
      return { content: `Divisa no admitida: ${OFFER_CURRENCIES.join(', ')}. Pregúntale al usuario en cuál ofrece.`, isError: true };
    }
    divisa = d;
  }

  const notas = texto(input, 'notas');
  if (notas.length > NOTES_OFFER_MAX) {
    return { content: `Las notas pasan de ${NOTES_OFFER_MAX} caracteres. Acórtalas o déjalas fuera.`, isError: true };
  }

  ctx.prepareDraft({
    kind: 'oferta',
    reference: referencia,
    brand: marca,
    quantity: cantidad,
    leadTimeDays: plazo,
    currency: divisa,
    notes: notas || null,
  });

  const rellenado = [
    referencia ? `referencia ${referencia}${marca ? ` (${marca})` : ''}` : null,
    cantidad !== null ? `cantidad ${cantidad}` : null,
    plazo !== null ? `plazo ${plazo} días` : null,
    divisa ? `divisa ${divisa}` : null,
    notas ? 'notas' : null,
  ].filter((x): x is string => x !== null);

  return {
    content: [
      `Formulario de oferta abierto en el hilo${rellenado.length ? ` con: ${rellenado.join(', ')}` : ', sin ningún campo rellenado'}.`,
      'NO está enviada: el usuario tiene que revisarla y pulsar «Enviar oferta».',
      'EL PRECIO UNITARIO ESTÁ VACÍO A PROPÓSITO y lo escribe siempre el usuario: no se rellena desde aquí. ' +
        'Si te lo dijo, repítelo en tu respuesta para que lo teclee; no propongas, sugieras, calcules ni completes ninguna cifra de precio.',
      'Díselo en una o dos frases —qué has rellenado y que falta el precio— y pídele que lo revise antes de enviar. No digas que la has enviado.',
    ].join('\n'),
    isError: false,
  };
}

async function navegar(input: unknown, ctx: ToolContext): Promise<ToolResult> {
  const destino = texto(input, 'pantalla');
  const pais = texto(input, 'pais');
  if (!destino) {
    return { content: 'Falta la pantalla de destino.', isError: true };
  }
  if (!(SCREENS as readonly string[]).includes(destino)) {
    /*
     * `navIndexOf` devuelve 0 —Panel— para cualquier etiqueta que no encuentre,
     * y `Contacto` SÍ está en el menú. Sin este corte, "llévame a Contacto"
     * aterrizaría en Panel y VERA diría que ya está: un recorte silencioso
     * contado con aplomo. El mensaje distingue Contacto (existe en el menú, no
     * está construida) de un nombre que no es ninguna pantalla.
     */
    return {
      content:
        destino === 'Contacto'
          ? `«Contacto» está en el menú pero todavía no está construida. A las que puedes llevar: ${SCREENS.join(', ')}.`
          : `«${destino}» no es una pantalla a la que puedas llevar al usuario. Las que hay: ${SCREENS.join(', ')}.`,
      isError: true,
    };
  }
  if (pais) {
    // `directory-access-from-vera`: "las organizaciones de Polonia" -> el Directorio con el país puesto.
    if (destino !== 'Empresas') {
      return {
        content: 'El filtro de país solo vale con la pantalla Empresas (el Directorio). La pantalla no se ha movido.',
        isError: true,
      };
    }
    const code = pais.toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) {
      return {
        content: `«${pais}» no es un código de país: pasa el código ISO de dos letras (PL para Polonia, DE para Alemania). La pantalla no se ha movido.`,
        isError: true,
      };
    }
    // Solo se filtra por un país que tenga organizaciones: otro dejaría una tabla vacía que VERA no vería
    // y que contaría como "no hay" sin saberlo. Los países salen de la base, igual que el desplegable.
    const disponibles = await fetchDirectoryCountries();
    const encontrado = disponibles.find((c) => c.code === code);
    if (!encontrado) {
      return {
        content:
          `En el Directorio no hay ninguna organización de ${code}. La pantalla no se ha movido. ` +
          `Países con organizaciones: ${disponibles.map((c) => `${c.label} (${c.code})`).join(', ') || 'ninguno'}.`,
        isError: false,
      };
    }
    if (!ctx.showDirectory) {
      ctx.navigate('Empresas');
      return {
        content: `Abierta la pantalla Empresas, pero NO se ha podido dejar filtrada por ${encontrado.label}: el usuario verá el Directorio entero. Díselo y que use el desplegable de país.`,
        isError: false,
      };
    }
    ctx.showDirectory({ country: code });
    return {
      content: `Abierta la pantalla Empresas con el filtro de país ${encontrado.label} (${code}) puesto: el usuario ya ve la tabla filtrada. No cuentes ni nombres organizaciones: no las has visto.`,
      isError: false,
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
        return await navegar(input, ctx);
      case 'preparar_consulta':
        return prepararConsulta(input, ctx);
      case 'preparar_oferta':
        return prepararOferta(input, ctx);
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
