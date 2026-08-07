import { useCallback, useEffect, useState } from 'react';
import { errorMessage, type MemberProfile } from '../../lib/session';
import {
  ageLabel,
  archiveLine,
  daysSince,
  deleteLine,
  fetchPage,
  fetchStats,
  FILTERS,
  FILTER_LABELS,
  pageButtons,
  pageCount,
  PAGE_SIZE,
  type Filter,
  type InventoryLine,
  type Stats,
} from '../../lib/inventory';
import { InventoryTable } from './InventoryTable';
import styles from './Inventory.module.css';

/**
 * INV-01 · Panel de Inventario. Escrita a mano (Claude Code), no por el arnés.
 * Contrato: `openspec/design-gui/specs y html aprobados/specs/Rinworld_spec_INV-01.md`
 * y su HTML aprobado.
 *
 * =============================================================================
 * CUATRO DECISIONES QUE LA SPEC NO PODÍA TOMAR
 * =============================================================================
 *
 * 1 · `DELETED` NO SE MUESTRA EN NINGÚN CHIP.
 *    El spec define cuatro estados (`inventory-line-lifecycle`) y el HTML aprobado
 *    solo pinta tres. Los cuatro chips — Todos, Publicados, Desactualizados,
 *    Archivados — están en un orden que el spec llama "fijo", así que añadir un
 *    quinto chip "Eliminados" sería tocar un contrato aprobado. Entonces:
 *    eliminar es un borrado lógico, la línea sale del panel, y `Todos` significa
 *    "todo lo que gestionas", es decir todo menos las lápidas. La fila sobrevive
 *    en base porque puede estar referenciada por una tarjeta de consulta de un
 *    hilo abierto. **Consecuencia que hay que saber: desde INV-01 no hay forma de
 *    ver ni de restaurar una línea eliminada.** Es un hueco del diseño aprobado,
 *    no de esta implementación — anotado como F-023.
 *
 * 2 · EL PRECIO NO ES UN PROBLEMA EN ESTA PANTALLA, Y CONVIENE DECIRLO.
 *    `ESTADO.md` avisaba de que `unit_price` está cifrado y que INV-01 tendría que
 *    descifrarlo en cliente o no mostrarlo. Al ir a la spec: **las siete columnas
 *    de INV-01 no incluyen precio** (Referencia, Marca, Cantidad, País, Estado,
 *    Antigüedad, Acciones). No hay nada que decidir. El aviso era prudente pero
 *    apuntaba a una pantalla que no muestra precios.
 *
 * 3 · "VISITAS RECIBIDAS (30 DÍAS)" SALE CON UN GUION.
 *    No hay tabla de visitas en el esquema ni en el plan. Ver `fetchStats`.
 *
 * 4 · LOS TRES ENLACES DE "CANALES DE ACTUALIZACIÓN" NO LLEVAN A NINGUNA PARTE, Y
 *    LA PANTALLA LO DICE.
 *    Plan §9 "Fuera" excluye textualmente "importación de inventario
 *    (INV-02/03/04)" e "INV-07". Es decir: los tres destinos de esta sección —
 *    subir archivo (INV-02), gestionar canal email (INV-04) y configurar
 *    visibilidad (INV-07) — están fuera del MVP. La sección se pinta porque es
 *    parte del diseño aprobado y de la demo, pero **con su estado real**: badge
 *    "Fuera del MVP" en vez de "Activo", dropzone inerte, dirección de ingestión
 *    con guion. Un badge verde que dice "Activo" sobre un canal que no existe es
 *    el riesgo #1 de `CLAUDE.md` §7 trasladado a la interfaz — y delante del socio
 *    es peor en la UI que en el chat, porque en la UI parece verificable.
 */

const EYEBROW = 'Módulo 02 · Gestión de Inventario';
const TITLE = 'Mi inventario';
const SUBTITLE =
  'Gestiona y publica tu stock de rodamientos. Los distribuidores verificados podrán consultarlo en tiempo real.';

/** Literales de la sección de canales, del HTML aprobado. */
const CHANNELS = {
  manualName: 'Subida manual',
  manualDesc:
    'Sube un archivo puntualmente desde tu ordenador. Ideal para actualizaciones periódicas o correcciones de stock.',
  dropMain: 'Arrastra tu archivo aquí',
  dropSecondary: 'o haz clic para seleccionar',
  dropHint: 'CSV · XLSX · XLS · TSV · TXT · máx. 50 MB',
  emailName: 'Canal email',
  emailDesc:
    'Tu ERP o sistema externo envía el archivo adjunto a tu dirección única. Se procesa automáticamente sin intervención manual.',
  ingestLabel: 'Dirección de ingestión',
} as const;

/** El texto único que sustituye a los badges "Activo"/"Siempre disponible". */
const OUT_OF_SCOPE = 'Fuera del MVP';
const OUT_OF_SCOPE_NOTE =
  'La importación de inventario (INV-02, INV-03, INV-04) y la configuración de visibilidad (INV-07) están fuera del alcance del MVP. Las líneas de abajo se sembraron directamente en la base de datos.';

interface Props {
  profile: MemberProfile;
  /** Inyectable para que los tests no dependan del reloj. */
  now?: Date;
}

export function Inventory({ profile, now }: Props) {
  const [filter, setFilter] = useState<Filter>('todos');
  const [page, setPage] = useState(1);
  /** Lo que hay escrito en la caja. */
  const [draft, setDraft] = useState('');
  /** Lo que se ha buscado de verdad. Spec §3: la búsqueda es server-side y se
   *  ejecuta al pulsar Enter o la lupa — **no es live search**, porque el
   *  inventario puede llegar a 500.000 líneas. */
  const [search, setSearch] = useState('');

  const [lines, setLines] = useState<InventoryLine[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const orgId = profile.orgId;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, s] = await Promise.all([
        fetchPage({ orgId, filter, search, page }),
        fetchStats(orgId),
      ]);
      setLines(p.lines);
      setTotal(p.total);
      setStats(s);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [orgId, filter, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const runSearch = () => {
    setPage(1);
    setSearch(draft);
  };

  const pickFilter = (f: Filter) => {
    setPage(1);
    setFilter(f);
  };

  const act = async (line: InventoryLine, what: 'archive' | 'delete') => {
    setBusyId(line.id);
    try {
      await (what === 'archive' ? archiveLine(line.id, orgId) : deleteLine(line.id, orgId));
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const pages = pageCount(total);
  const lastDays = stats?.lastUploadAt ? daysSince(stats.lastUploadAt, now) : null;

  return (
    <div className={styles.body}>
      <div className={styles.inner}>
        <div className={styles.eyebrow}>{EYEBROW}</div>
        <h1 className={styles.title}>{TITLE}</h1>
        <p className={styles.sub}>{SUBTITLE}</p>

        {/* ── Tarjetas de resumen (spec §3) ───────────────────────────────── */}
        <div className={styles.statsRow}>
          <Stat
            label="Líneas publicadas"
            value={stats ? stats.published.toLocaleString('es-ES') : null}
            sub="líneas activas"
            testId="stat-published"
          />
          <Stat
            label="Desactualizadas"
            value={stats ? stats.stale.toLocaleString('es-ES') : null}
            sub={`sin actualizar +${7} días`}
            /* Spec §3: "Las tarjetas con valor crítico (> 0) muestran el número en
               naranja aviso". A cero se pinta normal: un cero en naranja lee como
               alarma cuando es la buena noticia. */
            warn={!!stats && stats.stale > 0}
            testId="stat-stale"
          />
          <Stat
            label="Última actualización"
            value={lastDays === null ? '—' : ageLabel(lastDays)}
            sub={
              stats?.lastUploadAt
                ? new Date(stats.lastUploadAt).toLocaleString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'sin subidas'
            }
            small
            testId="stat-last"
          />
          <Stat
            label="Visitas (30 días)"
            /* Ver decisión 3 en la cabecera. No hay dato, así que no hay número. */
            value={stats ? '—' : null}
            sub="sin instrumentar en el MVP"
            testId="stat-visits"
          />
        </div>

        {/* ── Canales de actualización (spec §3) ──────────────────────────── */}
        <section className={styles.channels} aria-labelledby="channels-title">
          <h2 className={styles.channelsTitle} id="channels-title">
            Canales de actualización
          </h2>
          <p className={styles.channelsNote} data-testid="channels-scope">
            {OUT_OF_SCOPE_NOTE}
          </p>

          <div className={styles.channelsRow}>
            <div className={styles.chCard}>
              <div className={styles.chHead}>
                <div className={`${styles.chIcon} ${styles.chIconManual}`} aria-hidden="true">
                  <i className="ti ti-cloud-upload" />
                </div>
                <div>
                  <div className={styles.chName}>{CHANNELS.manualName}</div>
                  <span className={styles.chBadge}>{OUT_OF_SCOPE}</span>
                </div>
              </div>
              <p className={styles.chDesc}>{CHANNELS.manualDesc}</p>
              {/* Inerte a propósito: no es un botón, no acepta drop y no abre un
                  selector de archivos. Ofrecer el gesto y no hacer nada es peor
                  que no ofrecerlo. */}
              <div className={styles.miniDz} aria-disabled="true">
                <i className="ti ti-cloud-upload" aria-hidden="true" />
                <div className={styles.dzMain}>{CHANNELS.dropMain}</div>
                <div className={styles.dzSec}>{CHANNELS.dropSecondary}</div>
                <div className={styles.dzHint}>{CHANNELS.dropHint}</div>
              </div>
            </div>

            <div className={styles.chCard}>
              <div className={styles.chHead}>
                <div className={`${styles.chIcon} ${styles.chIconEmail}`} aria-hidden="true">
                  <i className="ti ti-mail" />
                </div>
                <div>
                  <div className={styles.chName}>{CHANNELS.emailName}</div>
                  <span className={styles.chBadge}>{OUT_OF_SCOPE}</span>
                </div>
              </div>
              <p className={styles.chDesc}>{CHANNELS.emailDesc}</p>
              <div>
                <div className={styles.ingestLbl}>{CHANNELS.ingestLabel}</div>
                <div className={styles.ingestAddr}>
                  {/* Sin dirección inventada. Una dirección de ingestión falsa es
                      una a la que alguien puede mandar su inventario de verdad. */}
                  <span className={styles.ingestVal} data-testid="ingest-addr">
                    —
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.visRow}>
            <i className={`ti ti-eye ${styles.visIcon}`} aria-hidden="true" />
            <span className={styles.visLbl}>Visibilidad del inventario:</span>
            <span className={styles.visVal} data-testid="visibility">
              Visible para todos los miembros verificados
            </span>
          </div>
        </section>

        {/* ── Barra de acciones (spec §3) ─────────────────────────────────── */}
        <div className={styles.toolbar}>
          <div className={styles.chips} role="group" aria-label="Filtros de inventario">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={`${styles.chip} ${f === filter ? styles.act : ''}`}
                aria-pressed={f === filter}
                onClick={() => pickFilter(f)}
              >
                {FILTER_LABELS[f]}
                {/* El contador del chip que el spec §6 pide: `Desactualizados (34)`. */}
                {f === 'desactualizados' && stats && stats.stale > 0 ? ` (${stats.stale})` : ''}
              </button>
            ))}
          </div>
          <div className={styles.toolbarRight}>
            <div className={styles.srchWrap}>
              <button
                type="button"
                className={styles.srchBtn}
                aria-label="Buscar"
                onClick={runSearch}
              >
                <i className="ti ti-search" aria-hidden="true" />
              </button>
              <input
                className={styles.srchInp}
                type="search"
                value={draft}
                aria-label="Buscar por referencia o marca"
                placeholder="Buscar por referencia o marca..."
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runSearch();
                }}
              />
            </div>
          </div>
        </div>

        {error !== null && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        {/* ── Tabla ───────────────────────────────────────────────────────── */}
        <div className={styles.tblCard}>
          {loading ? (
            <p className={styles.tblMsg} aria-busy="true">
              Cargando inventario…
            </p>
          ) : lines.length === 0 ? (
            <p className={styles.tblMsg} data-testid="inventory-empty">
              {search || filter !== 'todos'
                ? 'Ninguna línea coincide con el filtro.'
                : 'Todavía no tienes ninguna línea de inventario publicada.'}
            </p>
          ) : (
            <>
              <InventoryTable
                lines={lines}
                {...(now ? { now } : {})}
                busyId={busyId}
                onArchive={(l) => void act(l, 'archive')}
                onDelete={(l) => void act(l, 'delete')}
              />
              <nav className={styles.pag} aria-label="Paginación del inventario">
                <span className={styles.pagInfo} data-testid="pag-info">
                  {total.toLocaleString('es-ES')} {total === 1 ? 'línea' : 'líneas'} · pág.{' '}
                  {page}/{pages}
                </span>
                <button
                  type="button"
                  className={`${styles.pagBtn} ${styles.nav}`}
                  aria-label="Página anterior"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ‹
                </button>
                {pageButtons(page, pages).map((p, i) =>
                  p === null ? (
                    <span key={`gap-${i}`} className={styles.pagGap} aria-hidden="true">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className={`${styles.pagBtn} ${p === page ? styles.act : ''}`}
                      aria-label={`Página ${p}`}
                      aria-current={p === page ? 'page' : undefined}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className={`${styles.pagBtn} ${styles.nav}`}
                  aria-label="Página siguiente"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  ›
                </button>
              </nav>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface StatProps {
  label: string;
  /** `null` mientras carga: skeleton, que es lo que pide el spec §6. */
  value: string | null;
  sub: string;
  warn?: boolean;
  small?: boolean;
  testId: string;
}

function Stat({ label, value, sub, warn, small, testId }: StatProps) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statLbl}>{label}</div>
      {value === null ? (
        <div className={styles.statSkeleton} aria-hidden="true" />
      ) : (
        <div
          className={`${styles.statVal} ${warn ? styles.warn : ''} ${small ? styles.small : ''}`}
          data-testid={testId}
        >
          {value}
        </div>
      )}
      <div className={styles.statSub}>{sub}</div>
    </div>
  );
}

export { PAGE_SIZE };
