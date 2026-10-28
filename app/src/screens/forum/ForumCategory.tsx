import { useEffect, useState } from 'react';
import {
  fetchCategory,
  fetchForumRateLimitStatus,
  fetchThreads,
  rateLimitMinutesLabel,
  rateLimitReached,
  reactionLabel,
  relativeShort,
  replyCountLabel,
  type Category,
  type ForumRateLimitStatus,
  type ThreadPage,
} from '../../lib/forum';
import { errorMessage, type MemberProfile } from '../../lib/session';
import { SearchField } from '../../components/SearchField';
import styles from './ForumCategory.module.css';

interface Props {
  profile: MemberProfile;
  slug: string;
  onBack: () => void;
  /** FORO-03: abre el hilo por su id, al pulsar el título de una fila. */
  onOpenThread: (threadId: string) => void;
  /** FORO-03 en modo creación (FL-FORO-01): abre el formulario de hilo nuevo en esta categoría. */
  onCreateThread: () => void;
  now?: Date;
}

/**
 * FORO-02 · Lista de Hilos de una Categoría.
 *
 * Es la PANTALLA: posee todo el estado y es el único sitio que llama a la red.
 *
 * El reparto de estado es el de SRCH-01 / DIR-01, y por la misma razón:
 *
 * - La **búsqueda aplicada** (`appliedSearch`) es lo que se consulta de verdad.
 * - El **borrador** (`draft`) es lo que se está escribiendo. Son dos estados
 *   distintos porque la spec §3 pide «búsqueda server-side, no live search»:
 *   teclear no consulta; confirmar con Enter o con la lupa, sí.
 * - La **página pedida** y la **respuesta** son del servidor: aquí solo se
 *   guardan los últimos valores que devolvió.
 *
 * `category === undefined` significa «todavía no se sabe» (cargando o falló);
 * `category === null` significa «esa categoría no existe», que es un estado
 * propio de la spec §6 y NO es un error de red.
 *
 * El foro es común a todos los miembros: el perfil no decide nada aquí, pero va
 * en la firma porque el shell lo inyecta en todas las pantallas (como FORO-01).
 */
export function ForumCategory({ profile, slug, onBack, onOpenThread, onCreateThread, now = new Date() }: Props) {
  void profile;

  /** Se llena solo al pulsar `Crear hilo` con el límite de RNG-FORO-06 alcanzado (spec §6). */
  const [createLimit, setCreateLimit] = useState<ForumRateLimitStatus | null>(null);
  const [checkingCreate, setCheckingCreate] = useState(false);

  const [category, setCategory] = useState<Category | null | undefined>(undefined);
  const [result, setResult] = useState<ThreadPage | null>(null);
  const [draft, setDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loadingCategory, setLoadingCategory] = useState(true);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * La categoría, por su slug. Al cambiar de slug se vuelve al principio: la
   * búsqueda, el borrador y la página de la categoría anterior no significan
   * nada en la nueva.
   *
   * Si devuelve `null` NO se llama a `fetchThreads`: no hay `categoryId` con el
   * que consultar, y pintar «no hay hilos» cuando lo que pasa es que la
   * categoría no existe sería mentir con dos estados distintos de la spec §6.
   */
  useEffect(() => {
    let cancelled = false;

    setCategory(undefined);
    setResult(null);
    setError(null);
    setDraft('');
    setAppliedSearch('');
    setPage(1);
    setLoadingCategory(true);
    setLoadingThreads(false);

    fetchCategory(slug)
      .then((found) => {
        if (cancelled) return;
        setCategory(found);
        setLoadingCategory(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCategory(undefined);
        setError(errorMessage(err instanceof Error ? err : new Error(String(err))));
        setLoadingCategory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  /**
   * La lista. Depende de la categoría, de la búsqueda APLICADA y de la página
   * PEDIDA: cualquier cambio en las tres vuelve a preguntar al servidor, que es
   * lo que significa «paginación server-side» (spec §3).
   *
   * `cancelled` descarta la respuesta que llega tarde: al teclear una búsqueda
   * nueva, la respuesta de la búsqueda anterior no puede pintarse encima.
   */
  useEffect(() => {
    if (category === null || category === undefined) return;

    let cancelled = false;

    setLoadingThreads(true);
    setResult(null);
    setError(null);

    fetchThreads({ categoryId: category.id, search: appliedSearch, page })
      .then((res) => {
        if (cancelled) return;
        setResult(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setResult(null);
        setError(errorMessage(err instanceof Error ? err : new Error(String(err))));
      })
      .finally(() => {
        if (!cancelled) setLoadingThreads(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category, appliedSearch, page]);

  /** La única vía por la que el texto en pantalla se convierte en consulta. */
  function runSearch() {
    setAppliedSearch(draft.trim());
    setPage(1);
  }


  /** `Limpiar búsqueda`: vacía el campo y la consulta, y vuelve a la página 1. */
  function handleClearSearch() {
    setDraft('');
    setAppliedSearch('');
    setPage(1);
  }

  /**
   * `Crear hilo` (FL-FORO-01). Con el límite alcanzado no abre el formulario y
   * enseña el aviso inline (spec §6). Si no se puede saber el estado, se abre: el
   * formulario lo vuelve a comprobar y la base corta la publicación 11 de todos modos.
   */
  async function handleCreate() {
    if (checkingCreate) return;
    setCheckingCreate(true);
    setCreateLimit(null);

    let status: ForumRateLimitStatus | null = null;
    try {
      status = await fetchForumRateLimitStatus();
    } catch {
      status = null;
    }

    setCheckingCreate(false);

    if (status !== null && rateLimitReached(status)) {
      setCreateLimit(status);
      return;
    }
    onCreateThread();
  }

  /**
   * La página que se marca como actual es la que devolvió la capa (`result.page`),
   * ya encajada en el rango: si se pidió la 3 y solo hay 2, la capa devuelve la 2
   * y la navegación no puede seguir diciendo 3.
   */
  const currentPage = result?.page ?? 1;
  const pageCount = result?.pageCount ?? 1;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

  /**
   * El cuerpo es EXCLUYENTE. Además de los dos cargando, se considera carga el
   * hueco entre «ya sé la categoría» y «ya tengo la primera página»: sin eso,
   * ese instante pintaría un cuerpo vacío que no es ninguno de los estados.
   */
  const loading =
    loadingCategory ||
    loadingThreads ||
    (category !== null && category !== undefined && result === null && error === null);

  const rows = result?.rows ?? [];

  return (
    <div className={styles.page} data-testid="forum-category" data-slug={slug}>
      <p className={styles.eyebrow}>Módulo 08 · Foro de la Comunidad</p>

      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <button type="button" className={styles.breadcrumbLink} onClick={onBack}>
          Foros
        </button>
        {category !== null && category !== undefined && (
          <>
            <span className={styles.breadcrumbSeparator} aria-hidden="true">
              ›
            </span>
            <span className={styles.breadcrumbCurrent}>{category.name}</span>
          </>
        )}
      </nav>

      {category !== null && category !== undefined && (
        <>
          <h1 className={styles.title}>{category.name}</h1>
          <p className={styles.subtitle}>{category.description}</p>
        </>
      )}

      {/* El aviso de confidencialidad es permanente (spec §7): no lleva cierre
          ni estado, porque el foro es la única parte NO cifrada del producto. */}
      <div className={styles.notice}>
        <i className={`ti ti-alert-circle ${styles.noticeIcon}`} aria-hidden="true" />
        <p className={styles.noticeText}>
          {'El contenido publicado en el Foro es texto plano, visible para todos los miembros de Bearingworld.io. '}
          <strong>Nada de lo escrito aquí tiene ninguna garantía de confidencialidad.</strong>
          {' Para conversaciones privadas, usa la mensajería cifrada.'}
        </p>
      </div>

      {/* La barra no desaparece mientras carga: se puede seguir escribiendo la
          búsqueda siguiente. */}
      <div className={styles.actions}>
        <SearchField
          value={draft}
          onChange={setDraft}
          onSubmit={runSearch}
          placeholder="Buscar en esta categoría..."
          submitLabel="Buscar"
        />

        {/* FL-FORO-01. Con el límite alcanzado el botón NO abre el formulario
            (spec §6): el estado lo dice el servidor, y se pregunta al pulsar para
            que la cifra no esté rancia. */}
        <button
          type="button"
          className={styles.createButton}
          disabled={checkingCreate}
          onClick={() => void handleCreate()}
        >
          Crear hilo
        </button>
      </div>

      {createLimit !== null && (
        <p className={styles.createLimit} role="status">
          {`Tu organización ha alcanzado el límite de 10 publicaciones por hora. Podrás crear un nuevo hilo en ${rateLimitMinutesLabel(createLimit.secondsUntilReset)}.`}
        </p>
      )}

      {loading ? (
        <p className={styles.loading} aria-busy="true">
          Cargando hilos…
        </p>
      ) : error !== null ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : category === null ? (
        <p className={styles.empty}>Esta categoría no existe.</p>
      ) : rows.length === 0 ? (
        appliedSearch ? (
          <>
            <p className={styles.empty}>
              {`No hemos encontrado hilos que coincidan con "${appliedSearch}".`}
            </p>
            <button type="button" className={styles.clearSearch} onClick={handleClearSearch}>
              Limpiar búsqueda
            </button>
          </>
        ) : (
          <p className={styles.empty}>Todavía no hay hilos en esta categoría. ¡Sé el primero en abrir uno!</p>
        )
      ) : (
        <>
          <div className={styles.list}>
            {/* En el orden en que llegan: la capa ya ordena por actividad
                reciente descendente (spec §7). */}
            {rows.map((row) => (
              <div key={row.id} className={styles.row} data-testid={`forum-thread-${row.id}`}>
                <div className={styles.rowMain}>
                  {/* FORO-03 ya existe (precondición de su tarea, como "Foros"
                      lo fue para FORO-02): el título navega al hilo. Sin badge
                      de categoría: dentro de una categoría no aporta (spec §7). */}
                  <button type="button" className={styles.rowTitle} onClick={() => onOpenThread(row.id)}>
                    {row.title}
                  </button>
                  <div className={styles.rowMeta}>
                    <span className={styles.meta}>{row.authorOrgName}</span>
                    <span className={styles.meta}>{replyCountLabel(row.replyCount)}</span>
                    <span className={styles.meta}>{reactionLabel(row.reactionCount)}</span>
                  </div>
                </div>
                <span className={styles.time}>{relativeShort(row.lastPostAt, now)}</span>
              </div>
            ))}
          </div>

          {pageCount > 1 && (
            <nav className={styles.pagination} aria-label="Paginación">
              {/* Un botón por página, de 1 a pageCount. El número es el nombre
                  accesible: sin aria-label y sin anterior/siguiente. */}
              {pages.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={n === currentPage ? `${styles.pageButton} ${styles.currentPage}` : styles.pageButton}
                  aria-current={n === currentPage ? 'page' : undefined}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
