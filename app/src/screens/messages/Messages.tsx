import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { errorMessage, type MemberProfile } from '../../lib/session';
import { onThreadsChanged } from '../../lib/realtime';
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
 * **No hay bloque de passphrase, ni siquiera deshabilitado.** El Coder lo pintó
 * como aviso permanente con el botón inerte, que es la lectura razonable de la
 * §6 del spec — pero la decisión viva dice *"metadatos siempre, sin puntitos y
 * sin bloque de passphrase"* (F-027, resuelto a favor de la §7). Un bloque que
 * pide una frase de seguridad que no existe promete recuperación de claves donde
 * el MVP las tiene en memoria de sesión y las pierde al recargar: es el mock
 * prometiendo lo que no hay, que es lo que `out_of_scope` existe para cortar.
 * `Nuevo contacto` e `Ir al Directorio` sí se quedan, deshabilitados y con el
 * motivo en texto — quitarlos dejaría la barra y el estado vacío sin salida
 * visible (F-023 e).
 */
export function Messages({
  profile,
  now = new Date(),
  onOpenThread,
}: {
  profile: MemberProfile;
  now?: Date;
  /** A dónde lleva un hilo. **Opcional a propósito:** el contrato de aceptación
   *  de MSG-01 monta `<Messages profile={…} now={…} />` sin él, y hacerlo
   *  obligatorio rompería sus tests por el wiring, no por la pantalla. Lo pasa
   *  `App.tsx` desde el día 7, cuando MSG-02 existe. */
  onOpenThread?: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * La consulta de la página. Sale del `useEffect` a un `useCallback` porque
   * ahora la llaman **dos**: el montaje y el canal de Realtime.
   *
   * `vivo` sigue siendo un objeto y no un booleano suelto por lo mismo de antes:
   * una respuesta que llega después de cambiar de página no debe pisar a la
   * nueva. Con Realtime eso deja de ser teórico — dos relecturas pueden estar en
   * vuelo a la vez.
   */
  const cargar = useCallback(() => {
    const vivo = { si: true };
    setLoading(true);
    setError(null);
    fetchThreadPage({ orgId: profile.orgId, search: submittedSearch, page })
      .then((result) => {
        if (!vivo.si) return;
        setThreads(result.threads);
        setTotal(result.total);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!vivo.si) return;
        // `instanceof Error ? … : <texto generico>` es exactamente F-020: los
        // errores de PostgREST son objetos planos, así que un `PGRST201` —el que
        // devuelve `threads` si un embed va sin la clave ajena nombrada— se
        // convertía en un mensaje que no dice nada, tapando el que lo decía todo.
        // `errorMessage` existe desde el día 3 para esto.
        setError(errorMessage(err));
        setLoading(false);
      });
    return () => {
      vivo.si = false;
    };
  }, [profile.orgId, submittedSearch, page]);

  useEffect(() => cargar(), [cargar]);

  /**
   * Realtime (`Plan §3`, día 7). Un elemento nuevo en cualquiera de mis hilos
   * mueve su fila al principio de la lista y le cambia la vista previa, y eso lo
   * escribe la otra parte: sin esto, MSG-01 se queda rancia hasta recargar.
   *
   * El evento es una **señal para releer**, no una fuente de datos. Aquí importa
   * especialmente: la lista está paginada y ordenada por `last_item_at` en el
   * servidor, así que insertar a mano un hilo que llega por el socket lo pondría
   * en una página que a lo mejor no es la que se está viendo.
   */
  useEffect(() => onThreadsChanged(cargar), [cargar]);

  const pages = pageCount(total);
  const searching = submittedSearch.trim() !== '';

  const handleOpenThread = (id: string) => {
    // MSG-02 existe desde el día 7. Quien decide a dónde lleva el id es el shell,
    // no esta pantalla: sin `onOpenThread` el clic no hace nada, que es lo que
    // hacía antes y lo que siguen viendo los tests de MSG-01.
    onOpenThread?.(id);
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
        <button type="button" className={styles.primaryBtn} disabled>
          <i className="ti ti-address-book" aria-hidden="true" />
          Nuevo contacto
        </button>
        {/* El motivo va en texto visible, no en un `aria-describedby` invisible:
            F-023 e. Un botón deshabilitado sin explicación se lee como avería. */}
        <span className={styles.scopeNote} data-testid="directorio-scope">
          El Directorio (DIR-01) queda fuera del MVP.
        </span>
        <span className={styles.count} data-testid="pag-info">
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
      ) : threads.length === 0 && searching ? (
        // Vacío por búsqueda ≠ vacío de verdad, y mezclarlos diría "todavía no
        // tienes ninguna conversación" a quien tiene cinco y ha escrito mal un
        // nombre. El vacío de la spec §6 lo pinta `ThreadList`, que es de quien
        // es: si lo decidieran los dos, acabarían discrepando.
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
