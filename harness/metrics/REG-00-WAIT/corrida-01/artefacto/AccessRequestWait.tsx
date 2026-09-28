import { useEffect, useState } from 'react';
import {
  POLL_INTERVAL_MS,
  fetchAccessRequestStatus,
  isFinalState,
  requestSummary,
  waitView,
} from '../../lib/access-request';
import type { AccessRequestStatus, SubmittedAccessRequest, WaitPhase } from '../../lib/access-request';
import styles from './AccessRequestWait.module.css';

/**
 * REG-00-WAIT — Espera de aprobación del Operador (Ruta 00.2).
 *
 * La ve quien acaba de enviar el FSR y todavía no tiene cuenta ni invitación, así
 * que es pantalla completa SIN shell y cuelga directa de `#root` (ver el
 * comentario de `.page` en el CSS Module: sin `overflow-y: auto` propio, la
 * tarjeta se recortaría sin barra).
 *
 * Es la página entera y posee su único estado: el último `AccessRequestStatus`
 * recibido, o `null` mientras no se sabe nada todavía. Es también el único sitio
 * que llama a la red, y solo con `fetchAccessRequestStatus(request.id)`.
 *
 * SONDEO: al montar se pregunta una vez, y la siguiente pregunta se programa
 * cuando la anterior ha TERMINADO (`setTimeout` encadenado, no `setInterval`): así
 * nunca hay dos peticiones en vuelo y dejar de preguntar es, simplemente, no
 * programar la siguiente. Se sigue preguntando mientras el estado no sea final
 * (`isFinalState`) o mientras la llamada haya fallado; un fallo es SILENCIOSO
 * (spec §6, *«polling periódico silencioso»*): no se pinta ningún error, la
 * pantalla se queda como estaba y el rodamiento sigue girando. Al desmontar se
 * cancela el temporizador pendiente y una respuesta que llegue después no toca el
 * estado (`cancelled`).
 *
 * Nada de lo que se pinta se decide aquí: los textos, qué estado es final, el
 * resumen de los datos enviados y el país traducido salen de
 * `lib/access-request.ts` (`waitView`, `isFinalState`, `requestSummary`), que se
 * importa tal cual. Lo que el HTML aprobado enseña y el MVP no tiene, y por eso
 * NO se pinta: el panel de VERA y sus mensajes al cambiar de estado (spec §5 —
 * VERA solo responde con sesión), la redirección al FRO y el borrado de la
 * solicitud al cerrar (`clearWaitingRequest` es cosa del wiring en `onClose`).
 */

/**
 * La clase de cada fase. El `?? ''` no es decorativo: las clases del CSS Module
 * llegan con índice (`string | undefined`) bajo `noUncheckedIndexedAccess`, y
 * `Record<WaitPhase, string>` no admite `undefined`.
 */
const BADGE_CLASS: Record<WaitPhase, string> = {
  review: styles.badgeReview ?? '',
  approved: styles.badgeApproved ?? '',
  rejected: styles.badgeRejected ?? '',
};

export function AccessRequestWait({
  request,
  onClose,
}: {
  request: SubmittedAccessRequest;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<AccessRequestStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      let final = false;
      try {
        const next = await fetchAccessRequestStatus(request.id);
        if (cancelled) return;
        setStatus(next);
        final = isFinalState(next.state);
      } catch {
        // Silencioso: ni error visible ni cambio de estado. Se vuelve a preguntar.
        if (cancelled) return;
      }
      if (cancelled || final) return;
      timer = setTimeout(() => {
        void poll();
      }, POLL_INTERVAL_MS);
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [request.id]);

  const view = waitView(status);

  return (
    <div className={styles.page}>
      <div className={styles.brandBar}>
        <div>ZERO KNOWLEDGE ARCHITECTURE · CRYPTOGRAPHIC SECURITY</div>
        <div>CONNECT · TRADE · SECURE</div>
        <div>INDUSTRIAL INTELLIGENCE NETWORK</div>
      </div>

      {/* Cabecera mínima: solo el logo. Sin menú, sin nav, sin sesión que cerrar. */}
      <header className={styles.header}>
        <img className={styles.logo} src="/intentologo.png" alt="Bearingworld.io" />
      </header>

      <div className={styles.body}>
        <div className={styles.card}>
          <p className={styles.eyebrow}>Módulo 01 · Onboarding</p>

          <div className={styles.spinner}>
            {/* El rodamiento gira solo en revisión: en aprobada y rechazada el
                proceso ya terminó y dejarlo girando mentiría. */}
            <svg
              className={[styles.bearing, view.phase === 'review' ? styles.spinning : null]
                .filter(Boolean)
                .join(' ')}
              width="72"
              height="72"
              viewBox="0 0 72 72"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle cx="36" cy="36" r="34" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" opacity="0.6" />
              <circle cx="36" cy="36" r="28" stroke="currentColor" strokeWidth="3" />
              <circle cx="36" cy="36" r="22" stroke="currentColor" strokeWidth="1" opacity="0.25" />
              <circle cx="36" cy="36" r="14" stroke="currentColor" strokeWidth="2.5" />
              <circle cx="36" cy="36" r="8" stroke="currentColor" strokeWidth="1" opacity="0.4" />
              <circle cx="36" cy="8" r="3.5" fill="currentColor" opacity="0.9" />
              <circle cx="60.1" cy="22" r="3.5" fill="currentColor" opacity="0.7" />
              <circle cx="60.1" cy="50" r="3.5" fill="currentColor" opacity="0.5" />
              <circle cx="36" cy="64" r="3.5" fill="currentColor" opacity="0.7" />
              <circle cx="11.9" cy="50" r="3.5" fill="currentColor" opacity="0.9" />
              <circle cx="11.9" cy="22" r="3.5" fill="currentColor" opacity="0.7" />
              <circle cx="36" cy="36" r="4" fill="currentColor" opacity="0.5" />
            </svg>
            <p className={styles.spinnerLabel}>{view.spinnerLabel}</p>
          </div>

          <h1 className={styles.title}>{view.title}</h1>
          <p className={styles.subtitle}>{view.subtitle}</p>

          {/* Sin saltos ni espacios alrededor: el texto del distintivo es `view.badge` y nada más. */}
          <span
            className={[styles.badge, BADGE_CLASS[view.phase]].filter(Boolean).join(' ')}
            data-testid="status-badge"
          ><span className={styles.badgeDot} aria-hidden="true" />{view.badge}</span>

          {/* El aviso solo existe en aprobada y rechazada; en revisión no hay nada
              que contar (el rodamiento es el único feedback, spec §6). */}
          {view.notice !== null && (
            <p
              className={[
                styles.notice,
                view.phase === 'approved' ? styles.noticeApproved : styles.noticeRejected,
              ]
                .filter(Boolean)
                .join(' ')}
              data-testid="status-notice"
            ><strong>{view.notice.strong}</strong>{' '}{view.notice.detail}</p>
          )}

          <section className={styles.summary} aria-label="Datos enviados">
            <p className={styles.summaryHeader}>Datos enviados</p>
            {requestSummary(request.form).map(({ label, value }) => (
              <div key={label} className={styles.summaryRow}>
                <span className={styles.summaryLabel}>{label}</span>
                <span className={styles.summaryValue}>{value}</span>
              </div>
            ))}
          </section>

          <p className={styles.singleUse}><strong>Pantalla de un solo uso.</strong> Una vez cierres el navegador o recibas respuesta por email, no podrás volver a acceder a esta pantalla.</p>

          <button type="button" className={styles.close} onClick={onClose}>
            Cerrar y esperar el email
          </button>
        </div>
      </div>
    </div>
  );
}
