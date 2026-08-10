import { useEffect, useState, type FormEvent } from 'react';
import type { MemberProfile } from '../../lib/session';
import { fetchThreadPage, pageCount } from '../../lib/threads';
import type { ThreadSummary } from '../../lib/threads';
import { ThreadList } from './ThreadList';
import styles from './Messages.module.css';

/**
 * MSG-01 · Lista de Hilos — pantalla completa del panel de contenido.
 *
 * Posee el estado de búsqueda y de página, y llama a `fetchThreadPage` con el
 * `orgId` del perfil. `now` es inyectable para que los tests no dependan del
 * reloj; por defecto es `new Date()`.
 *
 * El aviso E2EE con botón `Introducir frase de seguridad` se pinta como bloque
 * informativo permanente pero el botón va deshabilitado: en el MVP no existe
 * passphrase, backup ni recuperación (CLAUDE.md §4; Plan §9 'Fuera'). Igual que
 * `Nuevo contacto` / `Ir al Directorio`, que abrirían DIR-01 (fuera de alcance).
 */
export function Messages({
  profile,
  now = new Date(),
}: {
  profile: MemberProfile;
  now?: Date;
}) {
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchThreadPage({ orgId: profile.orgId, search: submittedSearch, page })
      .then((result) => {
        if (!active) return;
        setThreads(result.threads);
        setTotal(result.total);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los hilos.');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profile.orgId, submittedSearch, page]);

  const pages = pageCount(total);
  const searching = submittedSearch.trim() !== '';

  const handleOpenThread = (_id: string) => {
    // MSG-02 (detalle de hilo) no entra en el alcance del MVP: el shell de
    // navegación decidirá a dónde lleva este id. La firma se mantiene para que
    // el cableado de ThreadList siga siendo verificable por los tests.
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSubmittedSearch(search.trim());
  };

  return (
    <div className={styles.page}>
      <div className={styles.eyebrow}>Módulo 04 · Mensajería E2EE</div>
      <h1 className={styles.title}>Hilos</h1>
      <p className={styles.subtitle}>
        Tus conversaciones con otros distribuidores. Todo el contenido está cifrado de extremo
        a extremo.
      </p>

      <div className={styles.e2eeBar} role="status">
        <i className="ti ti-lock" aria-hidden="true" />
        <span className={styles.e2eeTitle}>Contenido cifrado</span>
        <span className={styles.e2eeText}>
          — Introduce tu frase de seguridad para ver el contenido de los hilos.
        </span>
        <button
          type="button"
          className={styles.e2eeBtn}
          disabled
          aria-describedby="e2ee-reason"
        >
          Introducir frase de seguridad
        </button>
        <span id="e2ee-reason" className={styles.srOnly}>
          La recuperación por frase de seguridad no está disponible en esta versión: las claves
          viven en memoria de sesión.
        </span>
      </div>

      <div className={styles.actionsBar}>
        <form className={styles.searchWrap} role="search" onSubmit={submitSearch}>
          <i className="ti ti-search" aria-hidden="true" />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Buscar por nombre de organización..."
            aria-label="Buscar por nombre de organización"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </form>
        <button type="button" className={styles.primaryBtn} disabled aria-describedby="dir-reason">
          <i className="ti ti-address-book" aria-hidden="true" />
          Nuevo contacto
        </button>
        <span id="dir-reason" className={styles.srOnly}>
          DIR-01 no está disponible en esta versión.
        </span>
        <span className={styles.count}>
          {total.toLocaleString('es-ES')} {total === 1 ? 'hilo' : 'hilos'} · Página {page} de{' '}
          {pages}
        </span>
      </div>

      {loading ? (
        <div className={styles.status} role="status">
          Cargando hilos…
        </div>
      ) : error ? (
        <div className={styles.statusError} role="alert">
          {error}
        </div>
      ) : threads.length === 0 ? (
        searching ? (
          <div className={styles.empty}>
            <p>No se han encontrado hilos para «{submittedSearch}».</p>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => {
                setSearch('');
                setSubmittedSearch('');
                setPage(1);
              }}
            >
              Limpiar búsqueda
            </button>
          </div>
        ) : (
          <div className={styles.empty}>
            <p>
              Todavía no tienes ninguna conversación. Usa el Directorio para contactar con otras
              organizaciones.
            </p>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled
              aria-describedby="dir-empty-reason"
            >
              <i className="ti ti-address-book" aria-hidden="true" />
              Ir al Directorio
            </button>
            <span id="dir-empty-reason" className={styles.srOnly}>
              DIR-01 no está disponible en esta versión.
            </span>
          </div>
        )
      ) : (
        <ThreadList threads={threads} now={now} onOpen={handleOpenThread} />
      )}

      {!loading && !error && pages > 1 && (
        <div className={styles.pagination} role="navigation" aria-label="Paginación de hilos">
          <button
            type="button"
            className={styles.pageBtn}
            aria-label="Página anterior"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ‹
          </button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={`${styles.pageBtn} ${n === page ? styles.pageActive : ''}`}
              aria-current={n === page ? 'page' : undefined}
              onClick={() => setPage(n)}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            className={styles.pageBtn}
            aria-label="Página siguiente"
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
