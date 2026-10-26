import { countryName, fetchFavoriteOrgIds, quantityLabel, type SearchResultRow } from './search';
import { fetchOffers, initialPartCriteria } from './part-search';

/**
 * Capa de datos de SRCH-02 (Panel Consolidado de Búsqueda por Lotes), escrita a
 * mano por Claude Code ANTES de la tarea del arnés (`UMBRAL-FABRICA-V1.md` §7,
 * paso 2). **SRCH-02 no lleva migración ni consulta propia**: cada referencia se
 * busca con `fetchOffers` de `part-search.ts` -la fase C de SRCH-01, con la
 * visibilidad ya resuelta en `search_offers` (`0076`)-, así que aquí no se
 * reimplementa la lectura de inventario ajeno.
 *
 * Desde el 25-oct-2026 cada referencia del lote se busca por su **clave exacta**
 * (`design.md` §6 del change `amend-srch01-busqueda-en-dos-fases`, PO): quien pega
 * una lista sabe la designación, y «contiene» o «empieza por» le devolverían
 * variantes que no pidió. `6205-2RS` y `6205 2RS` siguen siendo la misma, porque la
 * clave se normaliza en el servidor.
 *
 * La lógica pura (parseo tolerante de la lista, tope de 50, cabeceras de tarjeta,
 * metabarra, CSV) vive aquí para que las dos piezas de la tarea no la
 * reimplementen: el Coder recibe estas funciones ya hechas y solo pinta.
 */

// -----------------------------------------------------------------------------
// La lista de referencias (spec §3)
// -----------------------------------------------------------------------------

/** «Límite: 50 referencias por consulta». */
export const MAX_BATCH = 50;

/**
 * Las referencias de un texto pegado, «tolerante a formato: una por línea,
 * separadas por comas o tabulaciones, pegado desde Excel». Separan: salto de
 * línea, coma, punto y coma y tabulación. **El espacio NO separa**: `NU 2210 E`
 * puede ser una sola referencia, y una lista pegada de Excel ya viene con
 * tabulaciones. Se recortan, se descartan las vacías y se quitan los duplicados
 * (sin distinguir mayúsculas) conservando el orden de aparición.
 */
export function parseReferences(text: string): string[] {
  const vistas = new Set<string>();
  const out: string[] = [];
  for (const trozo of text.split(/[\r\n,;\t]+/)) {
    const ref = trozo.trim();
    if (ref === '') continue;
    const clave = ref.toLowerCase();
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    out.push(ref);
  }
  return out;
}

/** Las que se procesan ahora (las primeras 50) y las que quedan para una segunda tanda. */
export function splitBatch(refs: string[]): { now: string[]; rest: string[] } {
  return { now: refs.slice(0, MAX_BATCH), rest: refs.slice(MAX_BATCH) };
}

/** `X / 50 referencias`, el contador bajo el textarea. */
export function referenceCounterLabel(count: number): string {
  return `${count} / ${MAX_BATCH} referencias`;
}

/** El aviso brass cuando la lista supera 50 (spec §3). */
export function overLimitNotice(count: number): string {
  return `Tu lista tiene ${count} referencias. Procesaremos las primeras ${MAX_BATCH}. ¿Quieres continuar con el resto en una segunda tanda?`;
}

// -----------------------------------------------------------------------------
// El resultado de cada referencia
// -----------------------------------------------------------------------------

/** Las ofertas de una referencia del lote. */
export interface BatchPage {
  rows: SearchResultRow[];
  /** Cuántas ofertas tiene la clave, aunque lleguen menos (`capped`). */
  total: number;
  /** Llegan menos de las que hay: el tope de `search_offers` es 200 por llamada. */
  capped: boolean;
}

export interface BatchResult {
  reference: string;
  /** `null` si la consulta de esta referencia falló (`error` lo explica). */
  page: BatchPage | null;
  error: string | null;
}

export interface ReferenceSummary {
  /** Distribuidores DISTINTOS con stock. */
  distributors: number;
  /** La mayor cantidad disponible en una sola línea, o `null` sin resultados. */
  maxQuantity: number | null;
  /** Marca y país (ISO) de la línea con esa cantidad, para el `(NSK, DE)` de la spec. */
  maxBrand: string | null;
  maxCountry: string | null;
}

/**
 * Lo que resume la cabecera de una tarjeta: distribuidores con stock, cantidad
 * máxima y de quién es. En un empate de cantidad gana la primera fila (`fetchBatchResults`
 * las deja por cantidad descendente).
 */
export function summarizeRows(rows: SearchResultRow[]): ReferenceSummary {
  if (rows.length === 0) return { distributors: 0, maxQuantity: null, maxBrand: null, maxCountry: null };
  let max = rows[0]!;
  for (const r of rows) if (r.quantity > max.quantity) max = r;
  return {
    distributors: new Set(rows.map((r) => r.orgId)).size,
    maxQuantity: max.quantity,
    maxBrand: max.brand,
    maxCountry: max.country.toUpperCase(),
  };
}

/** `true` si la referencia se buscó y no hay ninguna línea. Una consulta fallida NO es «sin resultados». */
export function hasNoResults(r: BatchResult): boolean {
  return r.page !== null && r.page.rows.length === 0;
}

export function hasStock(r: BatchResult): boolean {
  return r.page !== null && r.page.rows.length > 0;
}

/**
 * La cabecera de la tarjeta (spec §3): `Distribuidores: 5 · Máx: 1.200 u (NSK, DE)`,
 * o `Sin resultados`. `Intl` por dentro (`quantityLabel`): el CLDR de `es` no agrupa
 * cuatro cifras, así que 1200 es `1200` y no `1.200` (F-024).
 */
export function cardHeaderLabel(r: BatchResult): string {
  if (r.page === null) return 'No se pudo consultar';
  const s = summarizeRows(r.page.rows);
  if (s.maxQuantity === null) return 'Sin resultados';
  return `Distribuidores: ${s.distributors} · Máx: ${quantityLabel(s.maxQuantity)} u (${s.maxBrand}, ${s.maxCountry})`;
}

/** `5 referencias · 4 con stock · 1 sin resultados` (metabarra global). */
export function batchMetaLabel(results: BatchResult[]): string {
  const total = results.length;
  const con = results.filter(hasStock).length;
  const sin = results.filter(hasNoResults).length;
  return `${total === 1 ? '1 referencia' : `${total} referencias`} · ${con} con stock · ${sin} sin resultados`;
}

// -----------------------------------------------------------------------------
// Exportar resumen (spec §3: «CSV/PDF con referencia, número de distribuidores,
// cantidad máxima y país»). Solo CSV: el PDF necesita una dependencia que el
// proyecto no tiene.
// -----------------------------------------------------------------------------

export const SUMMARY_CSV_HEADER = 'referencia,distribuidores,cantidad_maxima,pais';

function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * El CSV del resumen, una fila por referencia en el orden de la lista. `país` es el
 * nombre completo (nunca el ISO, `single-reference-search`). Sin resultados: 0
 * distribuidores y las dos últimas celdas vacías; una consulta fallida se exporta
 * igual que «sin resultados» pero NO se cuenta como tal en pantalla.
 */
export function buildSummaryCsv(results: BatchResult[]): string {
  const filas = results.map((r) => {
    const s = r.page ? summarizeRows(r.page.rows) : { distributors: 0, maxQuantity: null, maxCountry: null };
    return [
      csvCell(r.reference),
      String(s.distributors),
      s.maxQuantity === null ? '' : String(s.maxQuantity),
      s.maxCountry ? csvCell(countryName(s.maxCountry)) : '',
    ].join(',');
  });
  return [SUMMARY_CSV_HEADER, ...filas].join('\n') + '\n';
}

/** Nombre del fichero descargado. */
export function summaryFileName(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `resumen-busqueda-por-lotes-${y}-${m}-${d}.csv`;
}

// -----------------------------------------------------------------------------
// Red
// -----------------------------------------------------------------------------

/** Cuántas referencias se consultan a la vez: cada una son dos llamadas, más una de favoritos por lote. */
export const BATCH_CONCURRENCY = 5;

/** Una referencia, como mucho, trae esto: el tope de `search_offers` (`0076`). */
export const BATCH_OFFERS_MAX = 200;

/**
 * Busca cada referencia por su clave exacta con `fetchOffers`, con concurrencia acotada y **en el
 * orden de la lista**. Un fallo en una referencia no tumba las demás: queda en su
 * `error`, y la pantalla lo enseña en su tarjeta.
 *
 * Los favoritos del miembro se piden **una vez por lote** y se reparten (`F-274`): antes
 * cada referencia volvía a pedir la misma lista. Si esa petición falla, falla en cada
 * referencia como fallaba antes, y la tarjeta lo dice.
 */
export async function fetchBatchResults(
  refs: string[],
  ctx: { orgId: string; memberId: string },
): Promise<BatchResult[]> {
  const out: BatchResult[] = new Array(refs.length);
  if (refs.length === 0) return out;
  const favoritos = fetchFavoriteOrgIds(ctx.memberId);
  // Cada referencia lo espera por su cuenta, después de su consulta: sin esto, un fallo temprano
  // se vería como «promesa rechazada sin manejar» antes de que la primera llegue a esperarlo.
  favoritos.catch(() => {});
  let next = 0;
  async function worker() {
    while (next < refs.length) {
      const i = next++;
      const reference = refs[i]!;
      try {
        // Sin zona ni filtros: el lote nunca los ha tenido. La clave la normaliza el servidor.
        const page = await fetchOffers({
          ...ctx,
          criteria: initialPartCriteria(null),
          selection: { kind: 'keys', keys: [reference] },
          pageSize: BATCH_OFFERS_MAX,
          favoritos,
        });
        // ⚠ `search_offers` ordena por fecha. Con más de 200 ofertas de UNA clave (no ha pasado nunca en el
        // catálogo), el «Máx» saldría de las 200 más recientes: `capped` lo deja dicho.
        const rows = [...page.rows].sort((a, b) => b.quantity - a.quantity || a.id.localeCompare(b.id));
        out[i] = { reference, page: { rows, total: page.total, capped: page.total > rows.length }, error: null };
      } catch (e) {
        out[i] = { reference, page: null, error: (e as { message?: string })?.message ?? String(e) };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, refs.length) }, worker));
  return out;
}
