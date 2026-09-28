import { useEffect, useState } from 'react';
import {
  POLL_INTERVAL_MS,
  fetchAccessRequestStatus,
  isFinalState,
  requestSummary,
  waitView,
} from '../../lib/access-request';
import type { AccessRequestStatus, SubmittedAccessRequest } from '../../lib/access-request';
import styles from './AccessRequestWait.module.css';

/**
 * REG-00-WAIT — Espera de aprobación del Operador (Módulo 01, Ruta 00.2).
 *
 * Pantalla completa sin shell: la ve quien acaba de enviar el FSR y todavía no
 * tiene credenciales, y por eso es hija directa de `#root` (ver el comentario de
 * `.page` en el CSS Module: sin `overflow-y: auto` propio la tarjeta se
 * recortaría sin barra).
 *
 * Posee el último estado recibido —`null` mientras no se sabe, que `waitView`
 * pinta como «en revisión»— y es el único sitio que llama a la red, con
 * `fetchAccessRequestStatus(request.id)`.
 *
 * SONDEO: `setTimeout` encadenado, nunca `setInterval`. Al montar se pregunta; la
 * siguiente pregunta se programa SOLO cuando la anterior ha terminado, así que
 * jamás hay dos en vuelo. Se deja de programar cuando el estado es final
 * (`isFinalState`), que es lo que decide la capa de datos, no esta pantalla.
 *
 * Un fallo es SILENCIOSO (spec §6: «Polling periódico silencioso»): no se pinta
 * ningún error, ni `role="alert"`, y la pantalla se queda como estaba —
 * reintentando. Al desmontar se cancela el temporizador pendiente y una respuesta
 * que llegue después no toca el estado.
 *
 * Lo que el HTML aprobado enseña y el MVP no tiene (y por eso NO se pinta): el
 * panel de VERA (spec §5 — VERA solo responde con sesión), el correo de
 * resolución (EML-07/EML-08, sin proveedor: F-212) y la redirección automática al
 * FRO al aprobarse. Borrar la solicitud de `sessionStorage` lo hace el wiring en
 * `onClose`: aquí no se importa `clearWaitingRequest`.
 */
export function AccessRequestWait({
  request,
  onClose,
}: {
  request: SubmittedAccessRequest;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<AccessRequestStatus | null>(null);

  useEffect(() => {
    // `cancelled` no es cosmético: una respuesta en vuelo que llegue después del
    // desmontaje no debe tocar el estado ni programar nada.
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const next = await fetchAccessRequestStatus(request.id);
        if (cancelled) return;
        setStatus(next);
        if (!isFinalState(next.state)) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch {
        // Silencioso a propósito: se reintenta, no se pinta nada.
        if (cancelled) return;
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [request.id]);

  const view = waitView(status);
  const summary = requestSummary(request.form);

  return (
    <div className={styles.page}>
      <div className={styles.brandBar}>
        <div>ZERO KNOWLEDGE ARCHITECTURE · CRYPTOGRAPHIC SECURITY</div>
        <div>CONNECT · TRADE · SECURE</div>
        <div>INDUSTRIAL INTELLIGENCE NETWORK</div>
      </div>

      <header className={styles.header}>
        <img className={styles.logo} src="/intentologo.png" alt="Bearingworld.io" />
      </header>

      <div className={styles.body}>
        <div className={styles.card}>
          <p className={styles.eyebrow}>Módulo 01 · Onboarding</p>

          <div className={styles.spinner}>
            <svg
              className={[styles.bearing, view.phase === 'review' ? styles.spinning : '']
                .filter(Boolean)
                .join(' ')}
              aria-hidden="true"
              width="72"
              height="72"
              viewBox="0 0 72 72"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="36" cy="36" r="34" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" opacity="0.6" />
              <circle cx="36" cy="36" r="28" stroke="currentColor" strokeWidth="3" fill="none" />
              <circle cx="36" cy="36" r="22" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.25" />
              <circle cx="36" cy="36" r="14" stroke="currentColor" strokeWidth="2.5" fill="none" />
              <circle cx="36" cy="36" r="8" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4" />
              <circle cx="36" cy="8" r="3.5" fill="currentColor" opacity="0.9" />
              <circle cx="60.1" cy="22" r="3.5" fill="currentColor" opacity="0.7" />
              <circle cx="60.1" cy="50" r="3.5" fill="currentColor" opacity="0.5" />
              <circle cx="36" cy="64" r="3.5" fill="currentColor" opacity="0.7" />
              <circle cx="11.9" cy="50" r="3.5" fill="currentColor" opacity="0.9" />
              <circle cx="11.9" cy="22" r="3.5" fill="currentColor" opacity="0.7" />
              <circle cx="36" cy="36" r="4" fill="currentColor" opacity="0.5" />
            </svg>
            <div className={styles.spinnerLabel}>{view.spinnerLabel}</div>
          </div>

          <h1 className={styles.title}>{view.title}</h1>
          <p className={styles.subtitle}>{view.subtitle}</p>

          <div
            data-testid="status-badge"
            className={[
              styles.badge,
              view.phase === 'review' ? styles.badgeReview : '',
              view.phase === 'approved' ? styles.badgeApproved : '',
              view.phase === 'rejected' ? styles.badgeRejected : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className={styles.badgeDot} aria-hidden="true" />{view.badge}
          </div>

          {view.notice !== null && (
            <div
              data-testid="status-notice"
              className={[
                styles.notice,
                view.phase === 'approved' ? styles.noticeApproved : '',
                view.phase === 'rejected' ? styles.noticeRejected : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <strong>{view.notice.strong}</strong> {view.notice.detail}
            </div>
          )}

          <section className={styles.summary} aria-label="Datos enviados">
            <div className={styles.summaryHeader}>Datos enviados</div>
            {summary.map((row) => (
              <div key={row.label} className={styles.summaryRow}>
                <span className={styles.summaryLabel}>{row.label}</span>
                <span className={styles.summaryValue}>{row.value}</span>
              </div>
            ))}
          </section>

          <div className={styles.singleUse}>
            <p>
              <strong>Pantalla de un solo uso.</strong> Una vez cierres el navegador o recibas
              respuesta por email, no podrás volver a acceder a esta pantalla.
            </p>
          </div>

          <button type="button" className={styles.close} onClick={onClose}>
            Cerrar y esperar el email
          </button>
        </div>
      </div>
    </div>
  );
}
