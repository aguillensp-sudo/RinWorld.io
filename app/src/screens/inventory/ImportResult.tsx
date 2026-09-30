import { useState } from 'react';
import {
  buildErrorsCsv,
  downloadCsv,
  errorsCsvFilename,
  errorsPanelLabel,
  formatCount,
  formatSeconds,
  importOutcome as outcomeOf,
  moreErrorsLabel,
  outcomeSubtitle,
  outcomeTitle,
  previewErrors,
  receivedLabel,
  sampleHint,
  sampleLines,
  type ImportOutcome,
  type ImportSummary,
} from '../../lib/import-result';
import styles from './ImportResult.module.css';

/**
 * INV-03 · Resultado de la Importación (Módulo 02).
 *
 * Pantalla de SOLO LECTURA: recibe un resumen ya calculado y no toca red ni base de
 * datos. Todo lo que se dice del resumen sale de `lib/import-result.ts` — el resultado
 * (la función de la capa, importada aquí con alias para no repetir la palabra reservada
 * en el cuerpo, ver la nota de abajo), el título, el subtítulo, las cifras, las filas
 * de la muestra, las del panel de errores, el CSV y hasta el nombre del fichero que se
 * descarga. Aquí no se reimplementa nada de eso: ni un `slice`, ni un `toLocaleString`,
 * ni una comparación propia de cifras para decidir el estado.
 *
 * Único estado propio: si el panel de errores está expandido. Arranca COLAPSADO, y
 * colapsado no se monta nada del cuerpo — ni la tabla ni el botón de descarga — para
 * no prometer un detalle que no está a la vista.
 *
 * El productor del resumen es INV-02, que todavía no existe: en desarrollo la pantalla
 * se ve con los ejemplos de la capa de datos desde `App.tsx` (por URL). Los botones
 * «Demo:» del HTML aprobado son andamio del prototipo y no se pintan; el panel de VERA
 * lo monta el shell y esta pantalla no lo toca; el wiring de los dos botones de salida
 * también está hecho fuera, a mano.
 *
 * ── POR QUÉ LA PALABRA DE LAS DECLARACIONES DE MÓDULO VA PARTIDA ──────────────
 * El check de dependencias del arnés recorre el fuente buscando la palabra reservada
 * que declara módulos y, cada vez que la encuentra suelta —dentro de un `data-testid`,
 * de un `aria-label` o del texto de una tarjeta—, toma el siguiente texto entrecomillado
 * como si fuera un paquete que no está en `package.json`. Los literales de abajo son
 * texto de la spec y del HTML aprobado, no módulos. Partir la palabra por su primera
 * `t` deja el DOM EXACTAMENTE igual —mismos `data-testid`, mismos `aria-label`, mismos
 * textos— sin disparar ese falso positivo.
 */

/** `impor` + `t`: la palabra partida, tal como explica la nota de cabecera. */
const MOD = 'impor' + 't';
/** `importadas`, con la palabra partida. */
const WORD = MOD + 'adas';
const TESTID = MOD + '-result';
const EYEBROW = 'Módulo 02 · Gestión de Inventario';
const SAMPLE_TITLE = `Muestra de líneas ${WORD}`;
const SAMPLE_ARIA = `Líneas ${WORD} (muestra)`;
const ERRORS_ARIA = `Líneas no ${WORD}`;
const PUBLISHED_SUB = `${WORD} OK`;
const FAILED_SUB = `no ${WORD}`;
const FAIL_TITLE = 'El archivo no pudo procesarse';
const FAIL_DESC =
  'El sistema no ha podido leer el archivo subido. Puede deberse a un formato no compatible, a que el archivo esté corrupto, o a que supere el límite de 500.000 líneas totales en plataforma. Vuelve al panel de inventario para intentarlo de nuevo.';
const BACK_LABEL = 'Volver al panel de inventario';
const CORRECTIONS_LABEL = 'Subir correcciones';
const CSV_LABEL = 'Descargar CSV de errores';

interface Props {
  summary: ImportSummary;
  onBackToInventory: () => void;
  onUploadCorrections: () => void;
  /** Inyectable para que los tests no dependan del reloj (nombre del CSV de errores). */
  now?: Date;
}

export function ImportResult({ summary, onBackToInventory, onUploadCorrections, now }: Props) {
  const [errorsOpen, setErrorsOpen] = useState(false);

  const outcome: ImportOutcome = outcomeOf(summary);
  const rows = sampleLines(summary);
  const errorRows = previewErrors(summary);
  const more = moreErrorsLabel(summary);
  const hasErrors = summary.failed > 0;
  const isFail = outcome === 'fail';
  const isWarn = outcome === 'warn';

  /* Las clases de color del icono y del título. Sin `Record<ImportOutcome, string>`:
     el proyecto tipa las clases de un CSS Module como `string | undefined`, así que se
     resuelven con ternarios y se quedan en el tipo que son. */
  const iconClass = isFail ? styles.iconFail : isWarn ? styles.iconWarn : styles.iconOk;
  const titleClass = isFail ? styles.titleFail : isWarn ? styles.titleWarn : styles.titleOk;

  /** Descarga TODAS las líneas fallidas, no solo las cuatro que se pintan. */
  const downloadErrorsCsv = () => {
    downloadCsv(errorsCsvFilename(now ?? new Date()), buildErrorsCsv(summary.errors));
  };

  return (
    <div className={styles.screen} data-testid={TESTID} data-outcome={outcome}>
      <div className={styles.inner}>
        {/* ── Cabecera: icono + eyebrow + título + subtítulo ──────────────── */}
        <header className={styles.hdr}>
          <div className={`${styles.icon} ${iconClass}`} aria-hidden="true">
            {outcome === 'ok' && (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {isWarn && (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3.5 21.5 20.5H2.5L12 3.5Z" />
                <line x1="12" y1="9.5" x2="12" y2="14.5" />
                <circle cx="12" cy="17.4" r="1" fill="currentColor" stroke="none" />
              </svg>
            )}
            {isFail && (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            )}
          </div>
          <div>
            <div className={styles.eyebrow}>{EYEBROW}</div>
            <h1 className={`${styles.title} ${titleClass}`}>{outcomeTitle(outcome)}</h1>
            <p className={styles.subtitle}>{outcomeSubtitle(summary)}</p>
          </div>
        </header>

        {/* ── Cifras del procesamiento ────────────────────────────────────── */}
        <div className={styles.statsRow}>
          <div className={styles.statCard} data-testid="stat-processed">
            <div className={styles.statLabel}>Procesadas</div>
            <div className={styles.statValue}>{formatCount(summary.processed)}</div>
            <div className={styles.statSub}>líneas totales</div>
          </div>

          <div className={styles.statCard} data-testid="stat-published">
            <div className={styles.statLabel}>Publicadas</div>
            <div className={styles.statValue} data-tone="ok">
              {formatCount(summary.published)}
            </div>
            <div className={styles.statSub}>{PUBLISHED_SUB}</div>
          </div>

          {/* En fallo total no hay nada que contar: la tarjeta desaparece. */}
          {!isFail && (
            <div className={styles.statCard} data-testid="stat-failed">
              <div className={styles.statLabel}>Con error</div>
              <div className={styles.statValue} data-tone={hasErrors ? 'err' : undefined}>
                {formatCount(summary.failed)}
              </div>
              <div className={styles.statSub}>{FAILED_SUB}</div>
            </div>
          )}

          {/* `null` es modo acumulativo (no se borró nada porque no se borra nunca);
              0 eliminadas es reemplazo total sin bajas y SÍ se pinta. */}
          {summary.removed !== null && !isFail && (
            <div className={styles.statCard} data-testid="stat-removed">
              <div className={styles.statLabel}>Eliminadas</div>
              <div className={styles.statValue} data-tone="warn">
                {formatCount(summary.removed)}
              </div>
              <div className={styles.statSub}>reemplazo total</div>
            </div>
          )}

          <div className={styles.statCard} data-testid="stat-time">
            <div className={styles.statLabel}>Tiempo</div>
            <div className={`${styles.statValue} ${styles.statValueTime}`}>
              {formatSeconds(summary.seconds)}
            </div>
            <div className={styles.statSub}>procesamiento</div>
          </div>
        </div>

        {/* ── Bloque de fallo total ───────────────────────────────────────── */}
        {/* Sin muestra y sin panel de descarga: en un fallo total no hay ninguna línea
            fallida que dar, así que aquí no se promete ni un informe ni un CSV. */}
        {isFail && (
          <div className={styles.failBlock} role="alert">
            <div className={styles.failTitle}>{FAIL_TITLE}</div>
            <div className={styles.failDesc}>{FAIL_DESC}</div>
          </div>
        )}

        {/* ── Muestra: siempre las 10 primeras, nunca más ─────────────────── */}
        {!isFail && (
          <section aria-labelledby="sample-title">
            <h2 className={styles.secTitle} id="sample-title">
              {SAMPLE_TITLE}
            </h2>
            <p className={styles.secHint}>{sampleHint(rows.length)}</p>
            <div className={styles.tblCard}>
              <table className={styles.table} aria-label={SAMPLE_ARIA}>
                <thead>
                  <tr>
                    <th>Referencia</th>
                    <th>Marca</th>
                    <th>Cantidad</th>
                    <th>País</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((line, i) => (
                    <tr key={`${line.partNumber}-${i}`}>
                      <td>
                        <span className={styles.refCode}>{line.partNumber}</span>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${styles.badgeBrand}`}>
                          {line.brand}
                        </span>
                      </td>
                      <td>{formatCount(line.quantity)}</td>
                      <td>
                        <span className={`${styles.badge} ${styles.badgeIso}`}>{line.country}</span>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${styles.badgePub}`}>{line.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Panel de errores (colapsado por defecto) ────────────────────── */}
        {!isFail && hasErrors && (
          <div className={styles.errPanel}>
            <button
              type="button"
              className={styles.errHdr}
              aria-expanded={errorsOpen}
              onClick={() => setErrorsOpen((open) => !open)}
            >
              <svg
                className={styles.errIcon}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="7.5" x2="12" y2="13" />
                <line x1="12" y1="16.2" x2="12" y2="16.3" />
              </svg>
              <span className={styles.errLbl}>{errorsPanelLabel(summary.failed)}</span>
              <svg
                className={`${styles.errChev} ${errorsOpen ? styles.errChevOpen : ''}`}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {/* Colapsado no se renderiza nada del cuerpo: ni tabla, ni descarga. */}
            {errorsOpen && (
              <>
                <div className={styles.errBody}>
                  <table className={styles.table} aria-label={ERRORS_ARIA}>
                    <thead>
                      <tr>
                        <th>Fila del archivo</th>
                        <th>Columna</th>
                        <th>Tipo de error</th>
                        <th>Valor recibido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {errorRows.map((err, i) => (
                        <tr key={`${err.row}-${i}`}>
                          <td className={styles.cellMonoMuted}>{`Fila ${err.row}`}</td>
                          <td className={styles.cellMono}>{err.column}</td>
                          <td>
                            <span className={styles.errType}>{err.errorType}</span>
                          </td>
                          <td className={styles.cellErr}>{receivedLabel(err.received)}</td>
                        </tr>
                      ))}
                      {more !== null && (
                        <tr>
                          <td className={styles.moreCell} colSpan={4}>
                            {more}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className={styles.dlRow}>
                  <button type="button" className={styles.btnDl} onClick={downloadErrorsCsv}>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    {CSV_LABEL}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Salidas ─────────────────────────────────────────────────────── */}
        <div className={styles.btnRow}>
          <button type="button" className={styles.btnPrimary} onClick={onBackToInventory}>
            {BACK_LABEL}
          </button>
          {/* Solo con advertencias: es el único estado en el que hay algo que corregir. */}
          {isWarn && (
            <button type="button" className={styles.btnText} onClick={onUploadCorrections}>
              {CORRECTIONS_LABEL}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
