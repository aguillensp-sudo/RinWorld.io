import { useEffect, useRef, useState } from 'react';
import { errorMessage, type MemberProfile } from '../../lib/session';
import {
  dateLabel,
  fetchPanelSummary,
  latestOfferLine,
  latestQueryLine,
  metricLabel,
  subtitleLabel,
  type PanelSummary,
} from '../../lib/panel';
import styles from './Panel.module.css';

const EYEBROW = 'Panel · PANEL-01';
const TITLE = 'Mi Panel';

interface Props {
  profile: MemberProfile;
  now?: Date;
  onNavigate: (screen: 'Vendiendo' | 'Comprando' | 'Inventario' | 'Hilos') => void;
}

export function Panel({ profile, now, onNavigate }: Props) {
  const [summary, setSummary] = useState<PanelSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  /*
   * REVISION A MANO (F-079). El efecto dependia del OBJETO `now`, y `App.tsx`
   * construye `now={new Date()}` EN EL RENDER a proposito -con su comentario- para
   * que una sesion larga no pinte tiempos rancios. Eso significa identidad nueva
   * en cada render: cada respuesta provocaba un render, cada render un `now`
   * nuevo y cada `now` nuevo otra consulta. Bucle infinito contra la base en la
   * primera pantalla despues del login, sin fallar ni avisar.
   *
   * La dependencia pasa a ser el DIA, que es la granularidad que de verdad
   * cambia el resultado: el corte de "desactualizado" son 7 dias y el mes
   * corriente cambia una vez al mes. El valor exacto se lee de una ref para que
   * no quede congelado en el cierre.
   */
  const nowRef = useRef(now);
  nowRef.current = now;
  const dayKey = now ? now.toDateString() : '';

  useEffect(() => {
    let active = true;
    setSummary(null);
    setError(null);

    const n = nowRef.current;
    const query = n ? { orgId: profile.orgId, now: n } : { orgId: profile.orgId };

    fetchPanelSummary(query)
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch((e: unknown) => {
        if (active) setError(errorMessage(e));
      });

    return () => {
      active = false;
    };
  }, [profile.orgId, dayKey]);

  const subtitle = subtitleLabel(profile.fullName, profile.email, now);

  return (
    <div className={styles.body}>
      <div className={styles.inner}>
        <div className={styles.eyebrow}>{EYEBROW}</div>
        <h1 className={styles.title}>{TITLE}</h1>
        <p className={styles.sub}>{subtitle}</p>

        {summary === null && error === null && (
          <p className={styles.loading} aria-busy="true" data-testid="panel-loading">
            Cargando panel…
          </p>
        )}

        {error !== null && (
          <p className={styles.error} role="alert" data-testid="panel-error">
            No se ha podido cargar el panel. {error}
          </p>
        )}

        {summary !== null && (
          <div className={styles.grid}>
            {/* ── Ofertas → VND-01 ── */}
            <button
              type="button"
              className={styles.card}
              data-testid="card-ofertas"
              onClick={() => onNavigate('Vendiendo')}
            >
              <span className={styles.cardHeader}>
                <span className={styles.icon}>
                  <i className="ti ti-tag" aria-hidden="true" />
                </span>
                <span className={styles.cardTitle}>Ofertas</span>
              </span>
              <span className={styles.num} data-testid="offers-count">
                {metricLabel(summary.offers.pending)}
              </span>
              <span className={styles.label}>pendientes de respuesta</span>
              <span className={styles.detail} data-testid="offers-detail">
                {latestOfferLine(summary.offers.latest)}
              </span>
            </button>

            {/* ── Consultas → SRCH-01 ── */}
            <button
              type="button"
              className={styles.card}
              data-testid="card-consultas"
              onClick={() => onNavigate('Comprando')}
            >
              <span className={styles.cardHeader}>
                <span className={styles.icon}>
                  <i className="ti ti-search" aria-hidden="true" />
                </span>
                <span className={styles.cardTitle}>Consultas</span>
              </span>
              <span className={styles.num} data-testid="queries-count">
                {metricLabel(summary.queries.unanswered)}
              </span>
              <span className={styles.label}>sin respuesta</span>
              <span className={styles.detail} data-testid="queries-detail">
                {latestQueryLine(summary.queries.latest)}
              </span>
            </button>

            {/* ── Inventario → INV-01 ── */}
            <button
              type="button"
              className={styles.card}
              data-testid="card-inventario"
              onClick={() => onNavigate('Inventario')}
            >
              <span className={styles.cardHeader}>
                <span className={styles.icon}>
                  <i className="ti ti-package" aria-hidden="true" />
                </span>
                <span className={styles.cardTitle}>Inventario</span>
              </span>
              <span className={styles.invLine}>
                <b>{summary.inventory.published.toLocaleString('es-ES')}</b> líneas publicadas
              </span>
              <span className={styles.invLine}>
                Última publicación: {dateLabel(summary.inventory.lastUploadAt)}
              </span>
              <span className={styles.invLine}>
                <b>{metricLabel(summary.inventory.visits)}</b> visitas (30d)
              </span>
            </button>

            {/* ── Hilos → MSG-01 ── */}
            <button
              type="button"
              className={styles.card}
              data-testid="card-hilos"
              onClick={() => onNavigate('Hilos')}
            >
              <span className={styles.cardHeader}>
                <span className={styles.icon}>
                  <i className="ti ti-messages" aria-hidden="true" />
                </span>
                <span className={styles.cardTitle}>Hilos</span>
              </span>
              <span className={styles.num} data-testid="threads-count">
                {metricLabel(summary.threads.unread)}
              </span>
              <span className={styles.label}>con mensajes sin leer</span>
              {/* `threads.latest` es siempre null en el MVP (F-027 a, ver la
                  cabecera de `lib/panel.ts`): no hay registro de lectura. Se
                  muestra la ausencia con un guion, igual que el resto de métricas
                  sin fuente, en vez de inventar un orgName y un estatus que no se
                  han consultado. */}
              <span className={styles.detail}>—</span>
            </button>

            {/* ── Resumen mes (ancho completo) → VND-01 ── */}
            <button
              type="button"
              className={`${styles.card} ${styles.cardWide}`}
              data-testid="card-resumen-mes"
              onClick={() => onNavigate('Vendiendo')}
            >
              <span className={styles.cardHeader}>
                <span className={styles.icon}>
                  <i className="ti ti-circle-check" aria-hidden="true" />
                </span>
                <span className={styles.cardTitle}>Resumen mes</span>
              </span>
              <span className={styles.metricsRow}>
                <span className={styles.metric}>
                  <span className={styles.num} data-testid="month-accepted">
                    {metricLabel(summary.month.acceptedOffers)}
                  </span>
                  <span className={styles.label}>Ofertas Aceptadas</span>
                </span>
                <span className={styles.metric}>
                  <span className={styles.num} data-testid="month-made">
                    {metricLabel(summary.month.madeOffers)}
                  </span>
                  <span className={styles.label}>Ofertas Realizadas</span>
                </span>
                <span className={styles.metric}>
                  <span className={styles.num} data-testid="month-queries">
                    {metricLabel(summary.month.receivedQueries)}
                  </span>
                  <span className={styles.label}>Consultas Realizadas</span>
                </span>
              </span>
            </button>

            {/* ── Favoritos recibidos: DIR-01/DIR-02 no existen en el MVP
                (Plan §9 "Fuera"), así que esta tarjeta no navega a ninguna
                parte. ── */}
            <button
              type="button"
              className={styles.card}
              data-testid="card-favoritos"
            >
              <span className={styles.cardHeader}>
                <span className={styles.icon}>
                  <i className="ti ti-star" aria-hidden="true" />
                </span>
                <span className={styles.cardTitle}>Favoritos recibidos</span>
              </span>
              <span className={styles.num} data-testid="favorites-count">
                {metricLabel(summary.favorites.monthly)}
              </span>
              <span className={styles.label}>
                organizaciones te añadieron a favoritos este mes
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
