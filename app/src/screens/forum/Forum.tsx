import { useEffect, useState } from 'react';
import { errorMessage, type MemberProfile } from '../../lib/session';
import {
  fetchCategories,
  fetchRecentThreads,
  postCountLabel,
  relativeLong,
  relativeShort,
  threadCountLabel,
  type Category,
  type RecentThread,
} from '../../lib/forum';
import styles from './Forum.module.css';

const EYEBROW = 'Módulo 08 · Foro de la Comunidad';
const TITLE = 'Foro de la Comunidad';
const SUBTITLE =
  'Un espacio de discusión pública entre miembros. El contenido del foro no está cifrado — es visible para toda la comunidad.';

/**
 * Las tarjetas de categoría apuntan a FORO-02 (spec §3). Desde el 17-sep FORO-02
 * existe, y la tarjeta navega en cuanto quien la monta le pasa `onOpenCategory`;
 * sin él, sigue apagada y dice por qué, en vez de fingir una navegación.
 *
 * Los hilos recientes apuntan al DETALLE del hilo, FORO-03, que todavía no
 * existe: siguen apagados, y su `title` nombra la pantalla que de verdad falta.
 * (Cambio a mano de Claude Code sobre el artefacto aceptado de FORO-01,
 * precondición de la tarea de FORO-02.)
 */
const FORO02_TITLE = 'FORO-02 (la lista de hilos) llega en una próxima versión.';
const FORO03_TITLE = 'FORO-03 (el detalle del hilo) llega en una próxima versión.';

interface Props {
  /**
   * La sesión del miembro. FORO-01 no la usa: el foro es común a todos y su capa
   * de datos no tiene una sola consulta por organización. Va en la firma porque
   * es el contrato de las pantallas de miembro, igual que en el resto.
   */
  profile: MemberProfile;
  /** Inyectable para que los tests no dependan del reloj (INV-01/SRCH-01/PANEL-01). */
  now?: Date;
  /** Abre FORO-02 con el `slug` de la categoría. Sin él, las tarjetas no navegan. */
  onOpenCategory?: (slug: string) => void;
}

export function Forum({ now, onOpenCategory }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [threads, setThreads] = useState<RecentThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /*
   * Una sola vez al montar, en paralelo: la pantalla no está completa hasta tener
   * las dos respuestas, y las dos consultas son independientes entre sí.
   *
   * `now` NO entra en el efecto a propósito: la capa de datos no lo recibe
   * (`fetchCategories` ordena por `position` y `fetchRecentThreads` por
   * `last_post_at`), así que depender de él solo volvería a consultar la base en
   * cada render — el bucle que documenta `Panel.tsx` (F-079). `now` se usa para
   * formatear, no para consultar.
   */
  useEffect(() => {
    let active = true;

    Promise.all([fetchCategories(), fetchRecentThreads()])
      .then(([nextCategories, nextThreads]) => {
        if (!active) return;
        setCategories(nextCategories);
        setThreads(nextThreads);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(errorMessage(e));
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const currentTime = now ?? new Date();

  return (
    <div className={styles.body}>
      <div className={styles.eyebrow}>{EYEBROW}</div>
      <h1 className={styles.title}>{TITLE}</h1>
      <p className={styles.sub}>{SUBTITLE}</p>

      {/* ── Aviso de confidencialidad: permanente y obligatorio (spec §7).
          Sin botón de cierre, sin estado y sin condición: no es ocultable. ── */}
      <div className={styles.notice}>
        <i className={`ti ti-alert-circle ${styles.noticeIcon}`} aria-hidden="true" />
        <p className={styles.noticeText}>
          El contenido publicado en el Foro es texto plano, visible para todos los miembros de
          Bearingworld.io.{' '}
          <strong>Nada de lo escrito aquí tiene ninguna garantía de confidencialidad.</strong> Para
          conversaciones privadas, usa la mensajería cifrada.
        </p>
      </div>

      {loading ? (
        <p className={styles.loading} aria-busy="true" data-testid="forum-loading">
          Cargando foro…
        </p>
      ) : error !== null ? (
        <div className={styles.error} role="alert" data-testid="forum-error">
          {error}
        </div>
      ) : (
        <>
          {/* ── (6) Actividad reciente: la sección entera desaparece con cero
              filas (spec §3 y §6). No hay estado vacío aparte. ── */}
          {threads.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionHead}>Actividad reciente</h2>
              <div className={styles.recentList}>
                {threads.map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    className={styles.recentItem}
                    data-testid={`forum-recent-${thread.id}`}
                    disabled
                    title={FORO03_TITLE}
                  >
                    <span className={styles.recentTitle}>{thread.title}</span>
                    {/* El badge del HTML aprobado va en mayúsculas (mono, 9px).
                        Se pone en mayúsculas en el dato y no solo con
                        `text-transform`, porque `text-transform` no cambia el
                        texto que lee un lector de pantalla: así lo que se ve y
                        lo que se anuncia son la misma cosa. La categoría sigue
                        siendo la misma `thread.categoryName`, sin traducir ni
                        abreviar. */}
                    <span className={styles.badgeCat}>
                      {thread.categoryName.toUpperCase()}
                    </span>
                    <span className={styles.recentOrg}>{thread.authorOrgName}</span>
                    <span className={styles.recentTime}>
                      {relativeShort(thread.lastPostAt, currentTime)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── (7) Categorías: siempre, en el orden que llega (ya viene por
              `position`). Sin filtro ni reordenación, y sin estado vacío: una
              categoría con cero hilos sale con sus contadores a cero. ── */}
          <section className={styles.section}>
            <h2 className={styles.sectionHead}>Categorías</h2>
            <div className={styles.catGrid}>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={styles.catCard}
                  data-testid={`forum-category-${category.slug}`}
                  disabled={!onOpenCategory}
                  title={onOpenCategory ? undefined : FORO02_TITLE}
                  onClick={onOpenCategory ? () => onOpenCategory(category.slug) : undefined}
                >
                  <span className={styles.catName}>{category.name}</span>
                  <span className={styles.catDesc}>{category.description}</span>
                  <span className={styles.catStats}>
                    <span className={styles.catStat}>
                      {threadCountLabel(category.threadCount)}
                    </span>
                    <span className={styles.catStat}>{postCountLabel(category.postCount)}</span>
                  </span>
                  {/* Sin actividad todavía no es una fecha: la spec no da literal
                      para ese caso, así que la línea no se pinta. */}
                  {category.lastActivityAt !== null && (
                    <span className={styles.catLast}>
                      {`Última actividad ${relativeLong(category.lastActivityAt, currentTime)}`}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
