import { supabase } from './supabase';
import { fetchStats } from './inventory';
import { fetchSentOffers, sentAtLabel } from './sent-offers';

/**
 * Capa de datos de PANEL-01 · Mi Panel (dashboard de inicio).
 *
 * **La escribe Claude Code a mano y se ENTREGA, no se declara** (F-057): el
 * Coder la importa, no la reescribe.
 *
 * ⚠ **LO MÁS IMPORTANTE DE ESTE FICHERO ES LO QUE DEVUELVE `null`.**
 *
 * De los diez números que pide el spec, **tres no tienen fuente de datos**, y se
 * comprobó contra el esquema antes de escribir una línea:
 *
 * | Métrica | Por qué no existe |
 * |---|---|
 * | Visitas (30d), §4.3 | **No hay ninguna tabla de visitas.** INV-01 ya lo resolvió igual el día 3 |
 * | Hilos sin leer, §4.4 | **No hay ningún registro de lectura.** Es F-027 (a), aplazado por el PO |
 * | Favoritos del mes, §4.6 | `favorite_distributors.created_at` existe, pero `favorites_select_own` (`0005:67`) restringe a `member_id = auth.uid()`: **la consulta devolvería 0 en silencio**, no un error |
 *
 * Las tres devuelven `null`, y el tipo lo dice —`visits: null`, no `number`— para
 * que no se pueda pintar un cero por descuido. **Un cero aquí sería una mentira
 * amparada por el propio spec**: `RNG-PANEL-02` dice que las cajas se ven
 * *"incluso en valor 0 … para reforzar que el dato está actualizado y no
 * ausente"*, así que un 0 afirma *"he mirado y no hay ninguno"*. Se pintan con
 * guion (`metricLabel`), que es lo que decidió el PO el 12-ago.
 *
 * Y lo que sí existe se reutiliza en vez de reimplementarse: las ofertas salen
 * de `sent-offers.ts` (VND-01, día 8) y el inventario de `inventory.ts` (día 3).
 * El spec lo pide así —*"mismo criterio que VND-01"*, *"mismo dato que INV-01"*—
 * y una segunda implementación acabaría discrepando sin dar error.
 */

// -----------------------------------------------------------------------------
// Forma
// -----------------------------------------------------------------------------

/** La línea de detalle de una caja. `null` cuando no hay ninguna fila. */
export interface PanelHighlight {
  partNumber: string | null;
  orgName: string;
  at: string;
}

export interface PanelSummary {
  offers: { pending: number; latest: PanelHighlight | null };
  queries: { unanswered: number; latest: PanelHighlight | null };
  inventory: {
    published: number;
    lastUploadAt: string | null;
    /** Sin fuente. Ver la cabecera. */
    visits: null;
  };
  threads: {
    /** Sin fuente (F-027 a). Ver la cabecera. */
    unread: null;
    latest: null;
  };
  month: { acceptedOffers: number; madeOffers: number; receivedQueries: number };
  favorites: {
    /** Sin fuente por RLS. Ver la cabecera. */
    monthly: null;
  };
}

export interface PanelQuery {
  orgId: string;
  now?: Date;
}

// -----------------------------------------------------------------------------
// Lógica pura
// -----------------------------------------------------------------------------

const DIA_SEMANA = new Intl.DateTimeFormat('es-ES', { weekday: 'long' });
const FECHA_CORTA = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/**
 * `Bienvenido, {nombre_usuario}. Hoy es {día_semana} {DD/MM/AAAA}.` (spec §3).
 *
 * El día de la semana sale del CLDR y no de una tabla a mano, y las cifras van a
 * dos dígitos: `es-ES` por defecto daría `30/6/2026` y la spec escribe
 * `DD/MM/AAAA` con el ejemplo `martes 30/06/2026`.
 */
export function subtitleLabel(fullName: string | null, email: string, now: Date = new Date()): string {
  const nombre = (fullName ?? '').trim() || email;
  return `Bienvenido, ${nombre}. Hoy es ${DIA_SEMANA.format(now)} ${FECHA_CORTA.format(now)}.`;
}

/**
 * El número grande de una caja.
 *
 * **`null` se pinta con raya, nunca con `0`.** Es la diferencia entre "he mirado
 * y no hay ninguno" y "esto todavía no se mide", y `RNG-PANEL-02` hace que la
 * primera lectura sea la que el usuario da por buena.
 */
export function metricLabel(n: number | null): string {
  return n === null ? '—' : String(n);
}

/**
 * La fecha de una tarjeta: `28 Jun 2026`.
 *
 * ⚠ **NO es el formato del subtítulo.** El HTML aprobado usa dos: el subtítulo
 * lleva `DD/MM/AAAA` porque la spec §3 lo escribe así con su ejemplo
 * (`martes 30/06/2026`), y las líneas de detalle de las tarjetas llevan
 * `29 Jun 2026`. Se descubrió leyendo el HTML, no la spec: la §4.1 solo dice
 * `{fecha}`.
 *
 * Y no se reimplementa: es `sentAtLabel` de VND-01, que ya hace exactamente
 * esto. Dos formateadores del mismo formato acabarían discrepando en el mes
 * abreviado o en el punto, y la discrepancia no daría error.
 */
export function dateLabel(iso: string | null): string {
  return iso ? sentAtLabel(iso) : '—';
}

/** `Más reciente: {referencia} · {organización} ({fecha})` (spec §4.1). */
export function latestOfferLine(h: PanelHighlight | null): string {
  if (!h) return 'Sin ofertas pendientes';
  return `Más reciente: ${h.partNumber ?? '—'} · ${h.orgName} (${dateLabel(h.at)})`;
}

/** `Última consulta: {referencia} · {organización}` (spec §4.2). */
export function latestQueryLine(h: PanelHighlight | null): string {
  if (!h) return 'Sin consultas pendientes';
  return `Última consulta: ${h.partNumber ?? '—'} · ${h.orgName}`;
}

/**
 * El primer instante del mes corriente, en ISO.
 *
 * Se calcula en hora local y no en UTC a propósito: "el mes corriente" es el del
 * usuario que mira la pantalla. En España eso desplaza el corte dos horas, y con
 * UTC una oferta del día 1 a las 00:30 caería en el mes anterior.
 */
export function monthStart(now: Date = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
}

// -----------------------------------------------------------------------------
// Consultas
// -----------------------------------------------------------------------------

/**
 * El embed lleva la clave ajena NOMBRADA aunque hoy solo haya una de
 * `thread_items` a `threads`: es la decisión viva de F-020, y el nombre está
 * verificado contra `pg_constraint`, no supuesto.
 *
 * Las dos organizaciones del hilo vienen en el par canónico (`org_low`/`org_high`)
 * y no por rol, así que la contraparte es "la que no soy yo" — igual que en
 * `threads.ts`.
 */
const CONSULTA_COLUMNS =
  'part_number, created_at, ' +
  'threads!thread_items_thread_id_fkey!inner(' +
  'org_low_id, org_high_id, ' +
  'org_low:organizations!threads_org_low_id_fkey(name), ' +
  'org_high:organizations!threads_org_high_id_fkey(name))';

interface ConsultaRow {
  part_number: string | null;
  created_at: string;
  threads: {
    org_low_id: string;
    org_high_id: string;
    org_low: { name: string } | null;
    org_high: { name: string } | null;
  } | null;
}

/**
 * Consultas propias **sin respuesta en firme**.
 *
 * ⚠ "Sin respuesta" es `estado_consulta = 'Pendiente'`, que es la definición que
 * **ya trae el esquema desde el día 2** (`0003:137-139`, con su índice parcial en
 * `0003:175`) y la que usa la máquina de estados del hilo (`0007`). La
 * alternativa —"nadie ha escrito nada después"— daría OTRO número: un
 * `MENSAJE` de cortesía contaría como respuesta, y `estado_consulta` solo pasa a
 * `'Respondida con oferta'` cuando llega una oferta de verdad. Dos definiciones
 * del mismo hecho es cómo se llega a dos verdades que no dan error.
 */
export async function fetchPendingQueries(orgId: string): Promise<{ count: number; latest: PanelHighlight | null }> {
  const { data, error, count } = await supabase
    .from('thread_items')
    .select(CONSULTA_COLUMNS, { count: 'exact' })
    .eq('item_type', 'CONSULTA')
    .eq('sender_org_id', orgId)
    .eq('estado_consulta', 'Pendiente')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;

  const fila = ((data ?? []) as unknown as ConsultaRow[])[0];
  if (!fila || !fila.threads) return { count: count ?? 0, latest: null };

  const otra = fila.threads.org_low_id === orgId ? fila.threads.org_high : fila.threads.org_low;
  return {
    count: count ?? 0,
    latest: { partNumber: fila.part_number, orgName: otra?.name ?? '—', at: fila.created_at },
  };
}

/**
 * Las tres cifras de la caja "Resumen mes" (spec §4.5).
 *
 * **Las aceptadas se cuentan por `estado_changed_at`, no por `created_at`**: una
 * oferta enviada en julio y aceptada en agosto se aceptó en agosto. `0007:58`
 * puso esa columna justamente para poder distinguirlo.
 *
 * Las recibidas usan `.neq('sender_org_id', orgId)` y no un `.eq` sobre la
 * contraparte: RLS ya limita `thread_items` a los hilos en los que participo, así
 * que "las que no envié yo" son exactamente las que recibí.
 */
export async function fetchMonth(orgId: string, now: Date): Promise<PanelSummary['month']> {
  const desde = monthStart(now);
  const base = () => supabase.from('thread_items').select('id', { count: 'exact', head: true });

  const [aceptadas, realizadas, recibidas] = await Promise.all([
    base()
      .eq('item_type', 'OFERTA')
      .eq('sender_org_id', orgId)
      .eq('estado_oferta', 'Aceptada')
      .gte('estado_changed_at', desde),
    base().eq('item_type', 'OFERTA').eq('sender_org_id', orgId).gte('created_at', desde),
    base().eq('item_type', 'CONSULTA').neq('sender_org_id', orgId).gte('created_at', desde),
  ]);

  for (const r of [aceptadas, realizadas, recibidas]) {
    if (r.error) throw r.error;
  }

  return {
    acceptedOffers: aceptadas.count ?? 0,
    madeOffers: realizadas.count ?? 0,
    receivedQueries: recibidas.count ?? 0,
  };
}

/**
 * Todo el panel de una vez.
 *
 * Las cuatro consultas van en paralelo porque son independientes: en serie, el
 * dashboard de entrada tardaría la suma de las cuatro.
 */
export async function fetchPanelSummary({ orgId, now = new Date() }: PanelQuery): Promise<PanelSummary> {
  const [ofertas, consultas, inventario, mes] = await Promise.all([
    fetchSentOffers(orgId),
    fetchPendingQueries(orgId),
    fetchStats(orgId, now),
    fetchMonth(orgId, now),
  ]);

  /*
   * Las pendientes se filtran del mismo listado que pinta VND-01, que es lo que
   * pide el spec (*"mismo criterio que VND-01, RNG-VND-02"*). El estado va
   * capitalizado, no en mayúsculas: la §5.2 de VND-01 escribe `PENDIENTE` y no
   * manda — manda `0003:132`.
   */
  const pendientes = ofertas.filter((o) => o.state === 'Pendiente');
  const reciente = pendientes.reduce<(typeof pendientes)[number] | null>(
    (mejor, o) => (!mejor || o.createdAt > mejor.createdAt ? o : mejor),
    null,
  );

  return {
    offers: {
      pending: pendientes.length,
      latest: reciente
        ? { partNumber: reciente.partNumber, orgName: reciente.counterpartyName, at: reciente.createdAt }
        : null,
    },
    queries: { unanswered: consultas.count, latest: consultas.latest },
    inventory: {
      published: inventario.published,
      lastUploadAt: inventario.lastUploadAt,
      visits: null,
    },
    threads: { unread: null, latest: null },
    month: mes,
    favorites: { monthly: null },
  };
}
