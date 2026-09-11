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
