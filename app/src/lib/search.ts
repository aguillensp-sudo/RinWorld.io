import { supabase } from './supabase';
import { ageLabel, ageLevel, daysSince, freshnessNote, type AgeLevel } from './inventory';

/**
 * Lo común de SRCH-01, SRCH-02 y los watchers: formato, orden de la tabla de ofertas, favoritos y consultadas.
 * La búsqueda en dos fases (criterios, chips, lista previa y ofertas) vive en `part-search.ts` desde el
 * 25-oct-2026; el modelo de una sola tabla (`SearchCriteria`, `fetchResults`) se retiró con `SearchResults.tsx`.
 *
 * Mismo reparto que `inventory.ts` y `threads.ts`: la lógica pura se exporta
 * suelta para poder probarla sin base ni React, y lo que toca red son las
 * cuatro funciones del final.
 *
 * **Esta capa la escribe Claude Code a mano, no el Coder** (`CLAUDE.md` §3: se
 * reparte por coste del fallo). Aquí el fallo es doblemente silencioso: SRCH-01
 * es la única pantalla del MVP que lee **inventario ajeno**, y una consulta mal
 * filtrada no da error — da una tabla plausible con el catálogo equivocado.
 *
 * La antigüedad no se reimplementa: se reexporta la de `inventory.ts`, que es la
 * misma regla del mismo spec (`data-freshness`) y ya está probada. Dos
 * implementaciones del borde de los 7 días acabarían discrepando, y esa
 * discrepancia costó F-026.
 */

export { ageLabel, ageLevel, daysSince, freshnessNote };
export type { AgeLevel };

// -----------------------------------------------------------------------------
// Zonas · los continentes de ARE y de los watchers
// -----------------------------------------------------------------------------

/** Los siete continentes del CHECK de `organizations_continent_chk` (0001). */
export const ZONES = ['AF', 'AN', 'AS', 'EU', 'NA', 'OC', 'SA'] as const;
export type Zone = (typeof ZONES)[number];

export const ZONE_LABELS: Record<Zone, string> = {
  AF: 'África',
  AN: 'Antártida',
  AS: 'Asia',
  EU: 'Europa',
  NA: 'América del Norte',
  OC: 'Oceanía',
  SA: 'América del Sur',
};

// -----------------------------------------------------------------------------
// Formato
// -----------------------------------------------------------------------------

const REGIONS = new Intl.DisplayNames(['es-ES'], { type: 'region' });

/**
 * El nombre completo del país en el idioma de sesión, **nunca el código ISO**
 * (`single-reference-search`: *"la columna País muestra el nombre completo del
 * país en el idioma de sesión del usuario (nunca código ISO)"*).
 *
 * Sale del CLDR y no de una tabla a mano, y los tests comparan contra esta
 * función y no contra el literal del mock (F-024). La nota de la columna 7 de la
 * spec escribe *"España, Alemania, France..."* — `France` en francés dentro de
 * una lista en español es una errata del propio spec; el bloque "Datos de
 * ejemplo" de la misma spec escribe `Francia`, que es lo que da el CLDR de `es`.
 */
export function countryName(iso: string): string {
  if (!iso) return '';
  try {
    return REGIONS.of(iso.toUpperCase()) ?? iso;
  } catch {
    return iso;
  }
}

const NUMBERS = new Intl.NumberFormat('es-ES');

/**
 * La cantidad disponible. Por `Intl`, nunca a mano: el CLDR de `es` **no agrupa
 * cuatro cifras**, así que 1200 es `1200` y no `1.200`. El mock escribe `1.200`
 * en la fila 3 y es la misma trampa que costó F-024 en el pie de INV-01.
 */
export function quantityLabel(n: number): string {
  return NUMBERS.format(n);
}

/** Columna 5. `null` es "el distribuidor no lo ha publicado", no "cero días". */
export function leadTimeLabel(days: number | null): string {
  if (days === null) return '—';
  return days === 1 ? '1 día' : `${days} días`;
}

// -----------------------------------------------------------------------------
// Ordenación
// -----------------------------------------------------------------------------

/**
 * Las **seis** columnas ordenables de la spec §3. Checkbox, Referencia, Empresa y
 * Acciones no lo son, y el orden de las columnas es fijo e inamovible (§7): esto
 * ordena filas, nunca columnas.
 */
export const SORTABLE_COLUMNS = ['brand', 'quantity', 'leadTime', 'country', 'age', 'favorites'] as const;
export type SortColumn = (typeof SORTABLE_COLUMNS)[number];

export interface Sort {
  column: SortColumn;
  direction: 'asc' | 'desc';
}

/**
 * Por defecto, **antigüedad ascendente: lo más reciente arriba** (PO, 16-oct-2026, `DECISIONES-V1.md`).
 *
 * Sustituye a la spec §3 (*"Por defecto: cantidad disponible descendente"*), que no se edita: el propio HTML
 * aprobado ya traía las dos cosas (`sortState` con antigüedad «más reciente primero» y, debajo, el init por
 * cantidad citando esa spec), y se construyó con la segunda. Para un comprador, un stock de hace 40 días
 * delante de uno de ayer es el orden equivocado aunque tenga más unidades.
 */
export const DEFAULT_SORT: Sort = { column: 'age', direction: 'asc' };

/**
 * El toggle de tres clics de la spec §3: *"primer clic → ascendente, segundo clic
 * → descendente, tercer clic → restaura orden por defecto"*.
 *
 * `null` significa "vuelta al orden por defecto", que no es lo mismo que
 * `DEFAULT_SORT`: la cabecera de Cantidad tiene que poder perder su indicador
 * aunque el orden resultante coincida.
 */
export function nextSort(current: Sort | null, column: SortColumn): Sort | null {
  if (!current || current.column !== column) return { column, direction: 'asc' };
  if (current.direction === 'asc') return { column, direction: 'desc' };
  return null;
}

function compareBy(column: SortColumn, a: SearchResultRow, b: SearchResultRow): number {
  switch (column) {
    case 'brand':
      return a.brand.localeCompare(b.brand, 'es-ES');
    case 'quantity':
      return a.quantity - b.quantity;
    case 'leadTime':
      // Sin plazo publicado va al final en ascendente. `null` no es 0: una línea
      // sin plazo no es la más rápida.
      return (a.leadTimeDays ?? Number.POSITIVE_INFINITY) - (b.leadTimeDays ?? Number.POSITIVE_INFINITY);
    case 'country':
      // Por el NOMBRE que se ve, no por el ISO. No es lo mismo: `AT` < `DE` por
      // código, y `Alemania` < `Austria` por nombre. Ordenar por el código daría
      // una columna que se ve desordenada y no falla.
      return countryName(a.country).localeCompare(countryName(b.country), 'es-ES');
    case 'age':
      // Más reciente primero en ascendente: "antigüedad ascendente" es menos días.
      return new Date(b.lastUploadAt).getTime() - new Date(a.lastUploadAt).getTime();
    case 'favorites':
      return a.favoriteCount - b.favoriteCount;
  }
}

/**
 * Ordena una copia, nunca el array de entrada.
 *
 * **El desempate por `id` no es cosmético.** Con 215 líneas sembradas hay marcas
 * y cantidades repetidas; sin desempate estable, dos ordenaciones seguidas por la
 * misma columna pueden devolver órdenes distintos y las filas saltan en pantalla
 * al re-renderizar.
 */
export function sortRows(rows: SearchResultRow[], sort: Sort | null): SearchResultRow[] {
  const s = sort ?? DEFAULT_SORT;
  const factor = s.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const c = compareBy(s.column, a, b);
    return c !== 0 ? c * factor : a.id.localeCompare(b.id);
  });
}

/** Columna 4: verde si llega al mínimo pedido, Steel Mist si no (spec §3). */
export function meetsMinQuantity(quantity: number, minQuantity: number | null): boolean {
  return minQuantity === null || quantity >= minQuantity;
}

// -----------------------------------------------------------------------------
// "Consultar seleccionados" (GAP-004)
// -----------------------------------------------------------------------------

/**
 * Forma mínima y estructural de lo que devuelve `sendInquiries`
 * (`lib/thread-detail.ts`), sin importar de ahí: GAP-004 dice que
 * conversational-search "dispara la acción" y no al revés. `InquiryOutcome`
 * encaja aquí porque tiene todos estos campos y de sobra — TypeScript lo deja
 * pasar sin que este fichero necesite saber nada de hilos ni de cifrado.
 */
export interface InquirySendResult {
  distributorOrgId: string;
  ok: boolean;
  error?: string;
}

/**
 * El mensaje de confirmación de `Rinworld_spec_SRCH-01.md`, sección
 * *""Consultar Seleccionados" ejecutado"*: *"Consultas enviadas a X
 * distribuidores. Las respuestas llegarán a tu bandeja de Hilos."* — VERBATIM
 * cuando todo sale bien.
 *
 * Cuando algo falla, el mensaje **lo dice** en vez de sumarlo en silencio al
 * recuento de éxitos (F-023): un fallo de un distribuidor no es una consulta
 * enviada, y "enviadas a X" tiene que seguir siendo una cifra verdadera.
 *
 * **`omitidas` cierra F-087.** La pantalla descarta las filas ya consultadas
 * antes de enviar —`create_inquiry` las rechazaría—, pero hasta hoy solo lo
 * decía cuando la selección entera lo estaba. Con "Seleccionar todos", que es
 * como se va a usar en la demo, el caso normal es el MIXTO: se envían unas y se
 * callan otras, y el usuario solo podía deducirlo del sombreado de la fila. El
 * recuento de éxitos nunca fue falso; lo que faltaba era decir qué pasó con el
 * resto. Va **después** del literal de la spec §6, que se conserva palabra por
 * palabra, y no en lugar de él.
 */
export function consultSummary(resultados: InquirySendResult[], omitidas = 0): string {
  const exitos = resultados.filter((r) => r.ok);
  const fallos = resultados.filter((r) => !r.ok);
  const distribuidores = new Set(exitos.map((r) => r.distributorOrgId)).size;

  const partes: string[] = [];
  if (distribuidores > 0) {
    partes.push(
      `Consultas enviadas a ${distribuidores} distribuidor${distribuidores === 1 ? '' : 'es'}. ` +
        'Las respuestas llegarán a tu bandeja de Hilos.',
    );
  }
  if (omitidas > 0) {
    partes.push(
      omitidas === 1
        ? '1 fila de la selección ya estaba consultada y no se ha vuelto a enviar.'
        : `${omitidas} filas de la selección ya estaban consultadas y no se han vuelto a enviar.`,
    );
  }
  if (fallos.length > 0) {
    const motivos = [...new Set(fallos.map((f) => f.error).filter((e): e is string => Boolean(e)))];
    partes.push(
      `${fallos.length} ${fallos.length === 1 ? 'consulta no se pudo enviar' : 'consultas no se pudieron enviar'}` +
        (motivos.length > 0 ? `: ${motivos.join('; ')}` : '.'),
    );
  }
  return partes.join(' ');
}

// -----------------------------------------------------------------------------
// Consultas
// -----------------------------------------------------------------------------

export interface SearchResultRow {
  /** `inventory_lines.id`. Es la unidad de selección y de consulta. */
  id: string;
  partNumber: string;
  brand: string;
  quantity: number;
  leadTimeDays: number | null;
  /** La organización distribuidora, que es de quien es el favorito. */
  orgId: string;
  orgName: string;
  /** ISO-2 de `inventory_lines.location_country`: dónde está el stock. */
  country: string;
  lastUploadAt: string;
  favoriteCount: number;
  isFavorite: boolean;
  /** Ya consultada por mi organización. Spec §3, "Estado de fila ya consultada". */
  consulted: boolean;
}

/**
 * Mismo saneado que en `inventory.ts` y `threads.ts`, y por la misma razón: los
 * guiones y las barras SÍ se conservan porque `6205-2RS/C3` es justo lo que se
 * busca aquí.
 */
export function sanitizeSearch(raw: string): string {
  return raw.trim().replace(/[,()"*\\]/g, '').slice(0, 80);
}

/**
 * Qué organizaciones tengo marcadas como favoritas.
 *
 * Es **por miembro**, no por organización: `favorites_select_own` restringe a
 * `member_id = auth.uid()`. El recuento agregado que se ve en la columna 9 es
 * otra cosa y viene de `organizations.favorite_count` (migración 0006): la
 * estrella la marca cada uno, el número es de toda la plataforma.
 */
export async function fetchFavoriteOrgIds(memberId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('favorite_distributors')
    .select('distributor_org_id')
    .eq('member_id', memberId);
  if (error) throw error;
  return new Set(((data ?? []) as { distributor_org_id: string }[]).map((r) => r.distributor_org_id));
}

/**
 * Qué líneas de las que se ven tienen una consulta MÍA todavía PENDIENTE.
 *
 * Desde 0060 (F-249, decisión del PO del 12-oct) solo cuenta la pendiente: tras una respuesta o un
 * «Sin stock» la línea vuelve a poder consultarse, igual que en la base (`create_inquiry`).
 *
 * Sostiene el "Estado de fila ya consultada" de la spec §3. `sender_org_id` es
 * mío porque la consulta la envié yo: una consulta que me enviaron a mí sobre mi
 * propia línea no marca nada aquí — y por el `.neq` de `fetchResults` esas líneas
 * ni siquiera están en la tabla.
 */
export async function fetchConsultedLineIds(orgId: string, lineIds: string[]): Promise<Set<string>> {
  if (lineIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('thread_items')
    .select('inventory_line_id')
    .eq('item_type', 'CONSULTA')
    .eq('estado_consulta', 'Pendiente')
    .eq('sender_org_id', orgId)
    .in('inventory_line_id', lineIds);
  if (error) throw error;
  return new Set(
    ((data ?? []) as { inventory_line_id: string | null }[])
      .map((r) => r.inventory_line_id)
      .filter((id): id is string => id !== null),
  );
}

/** Una línea publicada de una organización concreta, para elegir sobre cuál abrir una consulta. */
export interface OrgLine {
  id: string;
  partNumber: string;
  brand: string;
  quantity: number;
  /** ISO de 2 letras: dónde está el stock. */
  country: string;
  /** Mi organización ya tiene una consulta PENDIENTE sobre ella (F-249). */
  consulted: boolean;
}

/** Cuántas líneas enseña el selector de `Crear consulta`: hay que afinar la búsqueda, no paginar. */
export const ORG_LINES_LIMIT = 30;

/**
 * Las líneas PUBLICADAS de UNA organización (la contraparte de un hilo), para `Crear consulta` dentro
 * del hilo (MSG-03 §3.2, F-249). Lo que se ve lo decide la RLS de `inventory_lines`: si el
 * distribuidor me excluyó de su inventario, no sale nada —y el selector lo dice, no inventa—.
 *
 * `term` busca por referencia o marca, con el mismo saneado que `fetchResults` (quita las comas y los
 * paréntesis que romperían el `.or`). Búsqueda al pulsar Intro, no en vivo: es el estándar del proyecto.
 */
export async function fetchOrgLines(orgId: string, ownOrgId: string, term: string): Promise<OrgLine[]> {
  let q = supabase
    .from('inventory_lines')
    .select('id, part_number, brand, quantity, location_country')
    .eq('org_id', orgId)
    .eq('status', 'PUBLISHED');

  const t = sanitizeSearch(term);
  if (t) q = q.or(`part_number.ilike.%${t}%,brand.ilike.%${t}%`);

  const { data, error } = await q
    .order('part_number', { ascending: true })
    .order('id', { ascending: true })
    .limit(ORG_LINES_LIMIT);
  if (error) throw error;

  const rows = (data ?? []) as {
    id: string;
    part_number: string;
    brand: string;
    quantity: number;
    location_country: string;
  }[];
  const pendientes = await fetchConsultedLineIds(
    ownOrgId,
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({
    id: r.id,
    partNumber: r.part_number,
    brand: r.brand,
    quantity: r.quantity,
    country: r.location_country,
    consulted: pendientes.has(r.id),
  }));
}

/**
 * Marcar o desmarcar favorita a una distribuidora.
 *
 * El recuento de `organizations.favorite_count` lo mantiene el trigger
 * `favorite_distributors_sync_count`, así que **no se escribe desde aquí** — el
 * guardia `guard_organization_columns` lo rechazaría, y con razón: es un derivado.
 * Quien llama vuelve a consultar para ver el número nuevo.
 */
export async function toggleFavorite(memberId: string, distributorOrgId: string, next: boolean): Promise<void> {
  if (next) {
    const { error } = await supabase
      .from('favorite_distributors')
      .insert({ member_id: memberId, distributor_org_id: distributorOrgId });
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('favorite_distributors')
    .delete()
    .eq('member_id', memberId)
    .eq('distributor_org_id', distributorOrgId);
  if (error) throw error;
}
