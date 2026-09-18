import { sanitizeSearch } from './search';
import { supabase } from './supabase';

/**
 * Capa de datos de FORO-01 · Lista de Categorías del Foro.
 *
 * **La escribe Claude Code a mano, no el Coder** (`CLAUDE.md` §3, y
 * `UMBRAL-FABRICA-V1.md` §1). Tercera y última de las tres pantallas del H1.
 *
 * ⚠ **El foro es la única parte NO cifrada del producto** (Plan §3.1). Aquí no
 * hay CEK, ni reparto de claves, ni `content_ciphertext`: hay `body`, en claro,
 * y la pantalla lo advierte en un bloque permanente. Si estás copiando una
 * consulta de mensajería a este fichero, párate: no es el mismo modelo.
 *
 * ⚠ **`forum_threads` NO es `threads`.** `threads` es la negociación cifrada
 * entre dos organizaciones, con su reparto de claves y su máquina de estados.
 * Comparten la palabra "hilo" en castellano y nada más.
 *
 * Lo que esta capa NO trae, porque FORO-01 no lo pinta: el contenido de las
 * publicaciones. La pantalla es una rejilla de cuatro tarjetas con contadores y
 * una lista de cinco títulos; el cuerpo de los mensajes es de FORO-02.
 */

// -----------------------------------------------------------------------------
// Tiempo relativo
// -----------------------------------------------------------------------------

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/**
 * ⚠ **DOS FORMATOS, Y LOS DOS SALEN DE LA MISMA SPEC.** Su bloque de datos de
 * ejemplo escribe los hilos recientes en compacto -- *"hace 2h"*, *"hace 5h"*,
 * *"hace 3 días"* -- y la última actividad de la tarjeta en largo -- *"Última
 * actividad hace 2 días"*, *"hace 5 horas"*. No es una incoherencia que haya que
 * unificar: la lista de recientes es una fila apretada con cuatro datos y la
 * tarjeta tiene sitio. Se implementan los dos, con su nombre, para que nadie
 * "arregle" uno creyendo que el otro está mal.
 */
export function relativeShort(iso: string, now: Date = new Date()): string {
  const ms = elapsed(iso, now);
  if (ms < HORA) return 'hace un momento';
  if (ms < DIA) return `hace ${Math.floor(ms / HORA)}h`;
  const dias = Math.floor(ms / DIA);
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
}

/** El de la tarjeta: *"Última actividad hace 5 horas"* se compone con esto. */
export function relativeLong(iso: string, now: Date = new Date()): string {
  const ms = elapsed(iso, now);
  if (ms < HORA) {
    const minutos = Math.max(1, Math.floor(ms / MINUTO));
    return minutos === 1 ? 'hace 1 minuto' : `hace ${minutos} minutos`;
  }
  if (ms < DIA) {
    const horas = Math.floor(ms / HORA);
    return horas === 1 ? 'hace 1 hora' : `hace ${horas} horas`;
  }
  const dias = Math.floor(ms / DIA);
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
}

function elapsed(iso: string, now: Date): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, now.getTime() - t);
}

// -----------------------------------------------------------------------------
// Los contadores de la tarjeta
// -----------------------------------------------------------------------------

/** *"X hilos"*, y en singular cuando toca. */
export function threadCountLabel(n: number): string {
  return n === 1 ? '1 hilo' : `${n} hilos`;
}

/** *"Y publicaciones"*. El singular lleva tilde y el plural no: `publicación` → `publicaciones`. */
export function postCountLabel(n: number): string {
  return n === 1 ? '1 publicación' : `${n} publicaciones`;
}

// -----------------------------------------------------------------------------
// Categorías
// -----------------------------------------------------------------------------

export interface CategoryRaw {
  id: string;
  slug: string;
  name: string;
  description: string;
  position: number;
  thread_count: number | null;
  post_count: number | null;
  last_activity_at: string | null;
}

export interface Category {
  id: string;
  /** Lo que va en la URL hacia FORO-02. */
  slug: string;
  name: string;
  description: string;
  position: number;
  threadCount: number;
  postCount: number;
  /** `null` en una categoría sin una sola publicación: la tarjeta sigue, sin fecha. */
  lastActivityAt: string | null;
}

export function toCategory(raw: CategoryRaw): Category {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    description: raw.description,
    position: raw.position,
    threadCount: Number(raw.thread_count ?? 0),
    postCount: Number(raw.post_count ?? 0),
    lastActivityAt: raw.last_activity_at,
  };
}

/**
 * Las cuatro tarjetas, en el orden que fija el producto.
 *
 * Sale de la vista `forum_category_stats`, que calcula los contadores en vez de
 * guardarlos (ver la cabecera de `0029`). **Una categoría sin un solo hilo sigue
 * saliendo**, con sus contadores a cero: la rejilla de lanzamiento tiene cuatro
 * tarjetas el primer día, cuando no hay nada escrito, y un `inner join` las
 * habría hecho desaparecer justo entonces.
 */
export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('forum_category_stats')
    .select('id, slug, name, description, position, thread_count, post_count, last_activity_at')
    .order('position', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r) => toCategory(r as unknown as CategoryRaw));
}

// -----------------------------------------------------------------------------
// Hilos recientes
// -----------------------------------------------------------------------------

export const RECENT_LIMIT = 5;

export interface RecentThreadRaw {
  id: string;
  title: string;
  last_post_at: string;
  forum_categories: { slug: string; name: string } | null;
  organizations: { name: string } | null;
}

export interface RecentThread {
  id: string;
  title: string;
  lastPostAt: string;
  categorySlug: string;
  categoryName: string;
  authorOrgName: string;
}

export function toRecentThread(raw: RecentThreadRaw): RecentThread {
  return {
    id: raw.id,
    title: raw.title,
    lastPostAt: raw.last_post_at,
    categorySlug: raw.forum_categories?.slug ?? '',
    categoryName: raw.forum_categories?.name ?? '',
    authorOrgName: raw.organizations?.name ?? '',
  };
}

const RECENT_COLUMNS =
  'id, title, last_post_at, ' +
  'forum_categories!forum_threads_category_id_fkey(slug, name), ' +
  'organizations!forum_threads_author_org_id_fkey(name)';

/**
 * *"Los últimos 5 hilos con actividad reciente de cualquier categoría"*.
 *
 * Las dos claves ajenas van **nombradas** en el `select`, aunque hoy no haya
 * ambigüedad: es la decisión viva de `F-020`. El día que `forum_threads` gane una
 * segunda referencia a `organizations` -- por ejemplo, la organización que
 * modera -- esto seguirá funcionando en vez de devolver `PGRST201` y dejar la
 * sección en blanco.
 *
 * *"Esta sección es opcional y se oculta si no hay actividad reciente (foro
 * recién lanzado)"*: aquí eso es una lista vacía, y quien decide ocultarla es la
 * pantalla. La capa de datos no devuelve `null` para decir "no pintes esto".
 */
export async function fetchRecentThreads(limit: number = RECENT_LIMIT): Promise<RecentThread[]> {
  const { data, error } = await supabase
    .from('forum_threads')
    .select(RECENT_COLUMNS)
    .order('last_post_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((r) => toRecentThread(r as unknown as RecentThreadRaw));
}

// -----------------------------------------------------------------------------
// FORO-02 · la categoría y su lista de hilos
// -----------------------------------------------------------------------------
//
// Escrito a mano por Claude Code ANTES de la tarea de FORO-02, como las tres
// capas del H1. Lee de `forum_thread_list` (0030), que ya trae calculados los
// dos contadores de la fila:
//   · respuestas = publicaciones del hilo MENOS la inicial;
//   · reacciones = el TOTAL del hilo, sumando todas sus publicaciones
//     (Módulo 08 v1.1 §3, "Lista de hilos"), no solo las de la inicial.
// Ninguno de los dos se recalcula en el cliente: si la pantalla los sumara con
// lo que tiene en memoria, contaría solo la página que ve.

/** Spec FORO-02 §3: "20 hilos por página, navegación numérica. Server-side." */
export const THREADS_PAGE_SIZE = 20;

/** Cuántas páginas hay. Siempre al menos una: cero hilos es una página vacía. */
export function threadPageCount(total: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / THREADS_PAGE_SIZE));
}

/** La página pedida, encajada en el rango que existe. 1-based, como la navegación. */
export function clampThreadPage(page: number, total: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.trunc(page)), threadPageCount(total));
}

/** Spec FORO-02 §3, fila: "`X respuestas`". Y el singular, como en FORO-01. */
export function replyCountLabel(n: number): string {
  return n === 1 ? '1 respuesta' : `${n} respuestas`;
}

/** Spec FORO-02 §3, fila: "`👍 Y`". */
export function reactionLabel(n: number): string {
  return `👍 ${n}`;
}

/**
 * La categoría por su `slug`, con sus contadores: FORO-02 pinta su nombre como
 * título y su descripción como subtítulo. `null` si el slug no existe, para que
 * la pantalla lo diga en vez de pintar un título vacío.
 */
export async function fetchCategory(slug: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from('forum_category_stats')
    .select('id, slug, name, description, position, thread_count, post_count, last_activity_at')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  return data ? toCategory(data as unknown as CategoryRaw) : null;
}

export interface ThreadRowRaw {
  id: string;
  title: string;
  author_org_name: string | null;
  reply_count: number | string | null;
  reaction_count: number | string | null;
  last_post_at: string;
}

/** Una fila de la lista de FORO-02. */
export interface ThreadRow {
  id: string;
  title: string;
  authorOrgName: string;
  replyCount: number;
  reactionCount: number;
  lastPostAt: string;
}

export function toThreadRow(raw: ThreadRowRaw): ThreadRow {
  return {
    id: raw.id,
    title: raw.title,
    authorOrgName: raw.author_org_name ?? '',
    // PostgREST manda los `count()` de una vista como número o como texto según
    // el tipo: se normaliza aquí, igual que en `toCategory`.
    replyCount: Number(raw.reply_count ?? 0),
    reactionCount: Number(raw.reaction_count ?? 0),
    lastPostAt: raw.last_post_at,
  };
}

export interface ThreadQuery {
  categoryId: string;
  /** Texto del buscador. Vacío = sin filtro. Busca SOLO en el título (spec §7). */
  search: string;
  /** 1-based. */
  page: number;
}

export interface ThreadPage {
  rows: ThreadRow[];
  /** Hilos que cumplen el filtro, en todas las páginas. */
  total: number;
  /** La página que de verdad se devolvió, ya encajada en el rango. */
  page: number;
  pageCount: number;
}

const THREAD_COLUMNS = 'id, title, author_org_name, reply_count, reaction_count, last_post_at';

/**
 * Los hilos de una categoría, una página.
 *
 * Orden: SIEMPRE por actividad reciente, la respuesta más nueva primero (spec
 * §7). Las reacciones no ordenan nada (RNG-FORO-07). El `id` desempata para que
 * la paginación no repita ni pierda filas con dos hilos de la misma hora.
 *
 * Búsqueda: `ilike` sobre el título, en el servidor. El texto se lava con
 * `sanitizeSearch` por lo mismo que en SRCH-01 y DIR-01: la sintaxis de filtros
 * de PostgREST usa comas y paréntesis.
 *
 * Si se pide una página que ya no existe (se buscó algo con menos resultados
 * estando en la 3), se vuelve a pedir la última que sí existe, en vez de pintar
 * una lista vacía que parezca "no hay hilos".
 */
export async function fetchThreads({ categoryId, search, page }: ThreadQuery): Promise<ThreadPage> {
  const texto = sanitizeSearch(search);

  const pedir = async (pagina: number) => {
    let q = supabase
      .from('forum_thread_list')
      .select(THREAD_COLUMNS, { count: 'exact' })
      .eq('category_id', categoryId);
    if (texto) q = q.ilike('title', `%${texto}%`);
    const desde = (pagina - 1) * THREADS_PAGE_SIZE;
    return q
      .order('last_post_at', { ascending: false })
      .order('id', { ascending: true })
      .range(desde, desde + THREADS_PAGE_SIZE - 1);
  };

  const pedida = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
  let { data, error, count } = await pedir(pedida);
  if (error) throw error;

  const total = count ?? 0;
  const valida = clampThreadPage(pedida, total);
  if (valida !== pedida) {
    ({ data, error, count } = await pedir(valida));
    if (error) throw error;
  }

  return {
    rows: (data ?? []).map((r) => toThreadRow(r as unknown as ThreadRowRaw)),
    total: count ?? total,
    page: valida,
    pageCount: threadPageCount(count ?? total),
  };
}

// -----------------------------------------------------------------------------
// FORO-03 · el hilo: su cabecera, sus publicaciones, responder y reaccionar
// -----------------------------------------------------------------------------
//
// Escrito a mano por Claude Code ANTES de la tarea de FORO-03, mismo patrón que
// las cuatro capas anteriores del módulo. Alcance de ESTA pantalla (lo que el
// PO pidió sumar sobre FORO-02): ver el hilo, publicar una respuesta y
// reaccionar/quitar reacción, con el límite de RNG-FORO-06 (0031/0032).
// `Editar`/`Eliminar` NO se construyen: `0029` no tiene UPDATE ni DELETE en
// `forum_posts`, y crear un hilo (FL-FORO-01) sigue sin existir -- FORO-03 se
// abre siempre sobre un hilo YA CREADO, nunca en "modo creación" (spec §6).

export interface ThreadHeaderRaw {
  id: string;
  title: string;
  category_id: string;
  forum_categories: { slug: string; name: string } | null;
}

/** La cabecera del hilo: lo que arma el breadcrumb y el título (spec §3). */
export interface ThreadHeader {
  id: string;
  title: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
}

export function toThreadHeader(raw: ThreadHeaderRaw): ThreadHeader {
  return {
    id: raw.id,
    title: raw.title,
    categoryId: raw.category_id,
    categorySlug: raw.forum_categories?.slug ?? '',
    categoryName: raw.forum_categories?.name ?? '',
  };
}

const THREAD_HEADER_COLUMNS =
  'id, title, category_id, forum_categories!forum_threads_category_id_fkey(slug, name)';

/**
 * El hilo por su `id`, para la cabecera. `null` si no existe -- spec §6 no
 * define ese estado explícitamente para FORO-03, pero es el mismo criterio que
 * "esta categoría no existe" en FORO-02: un hilo borrado o un enlace viejo no
 * puede pintar un título vacío como si fuera uno real.
 */
export async function fetchThread(threadId: string): Promise<ThreadHeader | null> {
  const { data, error } = await supabase
    .from('forum_threads')
    .select(THREAD_HEADER_COLUMNS)
    .eq('id', threadId)
    .maybeSingle();

  if (error) throw error;
  return data ? toThreadHeader(data as unknown as ThreadHeaderRaw) : null;
}

export interface ForumPostRaw {
  id: string;
  author_org_id: string;
  author_org_name: string | null;
  author_org_country: string | null;
  body: string;
  created_at: string;
  reaction_count: number | string | null;
  reacted_by_me: boolean | null;
}

/** Una publicación del hilo -- la inicial o una respuesta, misma forma (spec §3). */
export interface ForumPost {
  id: string;
  authorOrgId: string;
  authorOrgName: string;
  /** ISO-3166-1 alfa-2, como `organizations.country` (badge de país, spec §3). */
  authorOrgCountry: string;
  body: string;
  createdAt: string;
  /** De ESTA publicación, no el total del hilo (esa cifra es de FORO-02). */
  reactionCount: number;
  /** Si el miembro que consulta ya reaccionó a ESTA publicación. */
  reactedByMe: boolean;
}

export function toForumPost(raw: ForumPostRaw): ForumPost {
  return {
    id: raw.id,
    authorOrgId: raw.author_org_id,
    authorOrgName: raw.author_org_name ?? '',
    authorOrgCountry: (raw.author_org_country ?? '').toUpperCase(),
    body: raw.body,
    createdAt: raw.created_at,
    reactionCount: Number(raw.reaction_count ?? 0),
    reactedByMe: raw.reacted_by_me === true,
  };
}

const POST_COLUMNS =
  'id, author_org_id, author_org_name, author_org_country, body, created_at, reaction_count, reacted_by_me';

/**
 * Todas las publicaciones del hilo, en orden cronológico -- la primera fila
 * ES la publicación inicial (spec §3): ningún hilo se crea sin ella, así que
 * no hace falta una columna aparte para distinguirla.
 */
export async function fetchThreadPosts(threadId: string): Promise<ForumPost[]> {
  const { data, error } = await supabase
    .from('forum_post_detail')
    .select(POST_COLUMNS)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r) => toForumPost(r as unknown as ForumPostRaw));
}

/**
 * Publicar una respuesta (spec §3, "Publicar respuesta"). Ni `author_member_id`
 * ni `author_org_id` van en el `insert`: los pone la base (`app.guard_forum_author`,
 * `0029`), igual que en cualquier otra escritura del foro -- pasarlos aquí solo
 * invitaría a alguien a creer que se pueden elegir.
 */
export async function postReply(threadId: string, body: string): Promise<void> {
  const { error } = await supabase.from('forum_posts').insert({ thread_id: threadId, body });
  if (error) throw error;
}

/** Reaccionar a una publicación (spec §3, `👍`). La firma la pone la base (`0030`). */
export async function reactToPost(postId: string): Promise<void> {
  const { error } = await supabase.from('forum_reactions').insert({ post_id: postId });
  if (error) throw error;
}

/**
 * Quitar la propia reacción. Sin filtrar por `member_id`: la política de
 * `DELETE` de `forum_reactions` (`0030`) ya restringe a `member_id = auth.uid()`,
 * así que esto nunca puede borrar la reacción de otro aunque se equivoque el
 * `post_id`.
 */
export async function unreactToPost(postId: string): Promise<void> {
  const { error } = await supabase.from('forum_reactions').delete().eq('post_id', postId);
  if (error) throw error;
}

export interface ForumRateLimitStatusRaw {
  used: number | string;
  limit: number | string;
  seconds_until_reset: number | string;
}

/** RNG-FORO-06: cuánto lleva publicado la organización de quien consulta en la hora natural actual. */
export interface ForumRateLimitStatus {
  used: number;
  limit: number;
  secondsUntilReset: number;
}

export function toForumRateLimitStatus(raw: ForumRateLimitStatusRaw): ForumRateLimitStatus {
  return {
    used: Number(raw.used),
    limit: Number(raw.limit),
    secondsUntilReset: Number(raw.seconds_until_reset),
  };
}

const RATE_LIMIT_FALLBACK: ForumRateLimitStatus = { used: 0, limit: 10, secondsUntilReset: 0 };

/**
 * Se consulta ANTES de intentar publicar, para bloquear el botón con su
 * mensaje (spec §6) en vez de dejar que el `INSERT` falle. `public.forum_rate_limit_status()`
 * (`0032`) es el envoltorio que sí puede llamar el cliente -- la función real
 * (`0031`) vive en `app`, que PostgREST no expone.
 */
export async function fetchForumRateLimitStatus(): Promise<ForumRateLimitStatus> {
  const { data, error } = await supabase.rpc('forum_rate_limit_status');
  if (error) throw error;
  const fila = (data ?? [])[0] as ForumRateLimitStatusRaw | undefined;
  return fila ? toForumRateLimitStatus(fila) : RATE_LIMIT_FALLBACK;
}

/** Spec §6, RNG-FORO-06: "alcanzado el límite" es `used >= limit`, no `>`. */
export function rateLimitReached(status: ForumRateLimitStatus): boolean {
  return status.used >= status.limit;
}

/**
 * Spec §6: *"Podrás publicar en [X minutos]"*. Redondea SIEMPRE hacia arriba:
 * si falta un segundo para la hora en punto, sigue siendo "en 1 minuto", nunca
 * "en 0 minutos" -- cero minutos le diría al usuario que ya puede publicar.
 */
export function rateLimitMinutesLabel(secondsUntilReset: number): string {
  const minutos = Math.max(1, Math.ceil(secondsUntilReset / 60));
  return minutos === 1 ? '1 minuto' : `${minutos} minutos`;
}
