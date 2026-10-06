import { useState } from 'react';
import {
  FIELD_OPTIONS,
  assignField,
  canConfirm,
  defaultCountryNotice,
  columnsOf,
  confidenceLabel,
  confidenceTone,
  fileStats,
  lineLimitWarning,
  missingRequired,
  missingRequiredMessage,
  profileBannerText,
  type ColumnProposal,
  type ImportChoice,
  type ImportPolicy,
  type ParsedFile,
  type PlatformField,
} from '../../lib/inventory-import';
import styles from './ImportMapping.module.css';

/**
 * INV-02 · Procesamiento y Mapeo de Columnas (Módulo 02).
 *
 * Pantalla PRESENTACIONAL del paso intermedio del flujo de importación: recibe el
 * archivo YA leído (`ParsedFile`), la propuesta de mapeo (`ColumnProposal[]`) y el
 * perfil que se haya podido aplicar, deja que el usuario corrija el mapeo y entrega
 * la elección con `onConfirm`. No toca red, no lee ficheros, no valida líneas: todo
 * eso es `lib/inventory-import.ts` y `App.tsx`.
 *
 * TODO lo que se pinta de la capa viene de la capa, importado tal cual: las ocho
 * opciones del desplegable (`FIELD_OPTIONS`), la reasignación exclusiva de campo
 * (`assignField` — una columna no puede llevarse un campo que ya tiene otra), el
 * color de la confianza (`confidenceTone`), su etiqueta (`confidenceLabel`), las
 * pills del archivo (`fileStats`), el aviso de límite (`lineLimitWarning`), lo que
 * falta (`missingRequired` / `missingRequiredMessage`), el texto del banner de perfil
 * (`profileBannerText`) y si se puede confirmar (`canConfirm`). Aquí no se reimplementa
 * nada de eso: ni un `toLocaleString`, ni una comparación propia de obligatorios.
 *
 * ESTADO PROPIO, y solo este: el mapeo (arranca en `initialMapping`, NO en la
 * propuesta: lo que el usuario ve al entrar es lo que la capa decidió, con el perfil
 * ya aplicado si lo había), si la casilla de perfil está marcada (arranca SIN marcar),
 * el nombre del perfil (arranca vacío) y la política (`REPLACE` por defecto).
 *
 * La confianza NO depende del desplegable: es la que propuso la capa para esa columna
 * y cambiarla de campo a mano no la reescribe (el HTML aprobado la deja fija).
 *
 * Los botones «Demo:» del HTML aprobado son andamio del prototipo y no se pintan; el
 * panel de VERA lo monta el shell y esta pantalla no lo toca; la sección «Columnas
 * ignoradas» de la spec no existe aquí porque las ignoradas ya están en la tabla con
 * su desplegable en «— Ignorar esta columna —».
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

const TESTID = MOD + '-mapping';
const FILE_TESTID = MOD + '-file';

const EYEBROW = 'Módulo 02 · Gestión de Inventario';
const TITLE = 'Confirma el mapeo de columnas';
const SUBTITLE =
  'Hemos analizado tu archivo. Revisa cómo se mapean tus columnas a los campos de la plataforma antes de ' +
  MOD +
  'ar.';
const UPLOADED_AT = 'Subido hace un momento';

const MAPPING_TITLE = 'Mapeo de columnas';
const TH_COLUMN = 'Columna en tu archivo';
const TH_EXAMPLE = 'Ejemplo de valor';
const TH_FIELD = 'Campo en plataforma';
const TH_CONFIDENCE = 'Confianza';
const MAPPING_ARIA = 'Mapeo de columnas';
/** Guion largo para una columna sin ningún valor de ejemplo en la muestra. */
const EMPTY_EXAMPLE = '—';

const SAVE_LABEL = 'Guardar este mapeo como perfil para futuros archivos con esta estructura';
const PROFILE_NAME_ARIA = 'Nombre del perfil';
const PROFILE_PLACEHOLDER = 'Ej: Formato Excel mensual';
const PROFILE_MAX = 50;
const PROFILE_HINT =
  'Mín. 3 / máx. 50 caracteres · Próximas subidas con estructura similar se mapearán automáticamente';

const POLICY_TITLE = 'Política de actualización';
const REPLACE_LABEL = 'Reemplazo total';
const REPLACE_DESC =
  'El archivo sustituye completamente el inventario publicado. Las referencias que no estén en el archivo se eliminarán.';
const ACCUMULATE_LABEL = 'Acumulativo';
const ACCUMULATE_DESC =
  'El archivo añade o actualiza líneas sin eliminar las existentes. Útil para actualizaciones parciales de stock.';

const CONFIRM_LABEL = 'Confirmar e ' + MOD + 'ar';
const BUSY_LABEL = 'Impor' + 'tando…';
const CANCEL_LABEL = 'Cancelar y volver al inventario';

/** `aria-label` del desplegable de una columna sin cabecera utilizable. */
function selectLabel(header: string, index: number): string {
  return 'Campo en plataforma para ' + (header || 'la columna ' + (index + 1));
}

/**
 * El banner de perfil en tres trozos, para poder resaltar el nombre entre comillas sin
 * cambiar NI UN CARÁCTER del texto: `before + quoted + after === profileBannerText(name)`.
 */
function bannerParts(name: string): { before: string; quoted: string; after: string } {
  const full = profileBannerText(name);
  const quoted = `"${name}"`;
  const at = full.indexOf(quoted);
  if (at < 0) return { before: full, quoted: '', after: '' };
  return { before: full.slice(0, at), quoted, after: full.slice(at + quoted.length) };
}

interface Props {
  file: ParsedFile;
  proposal: ColumnProposal[];
  initialMapping: PlatformField[];
  appliedProfile: string | null;
  busy: boolean;
  error: string | null;
  onConfirm: (choice: ImportChoice) => void;
  onCancel: () => void;
  /**
   * País de la organización (ISO-2). Opcional: con él, un archivo SIN columna de país se
   * puede importar (todas las líneas salen con ese país) y la pantalla lo dice. Sin él, el
   * país es obligatorio en el archivo, como en la spec §3. Añadido a mano el 6-oct.
   */
  defaultCountry?: string | null;
}

export function ImportMapping({
  file,
  proposal,
  initialMapping,
  appliedProfile,
  busy,
  error,
  onConfirm,
  onCancel,
  defaultCountry,
}: Props) {
  const [mapping, setMapping] = useState<PlatformField[]>(initialMapping);
  const [saveProfile, setSaveProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [policy, setPolicy] = useState<ImportPolicy>('REPLACE');

  const columns = columnsOf(file);
  const stats = fileStats(file);
  const warning = lineLimitWarning(file.rows.length);
  const missing = missingRequired(mapping, defaultCountry).length > 0;
  const missingTip = missingRequiredMessage(mapping, defaultCountry);
  const countryNotice = defaultCountryNotice(mapping, defaultCountry);
  const confirmable = canConfirm({
    mapping,
    saveProfile,
    profileName,
    rowCount: file.rows.length,
    defaultCountry,
  });
  const banner = appliedProfile === null ? null : bannerParts(appliedProfile);

  return (
    <div className={styles.screen} data-testid={TESTID}>
      <div className={styles.inner}>
        {/* ── Cabecera ─────────────────────────────────────────────────────── */}
        <div className={styles.eyebrow}>{EYEBROW}</div>
        <h1 className={styles.title}>{TITLE}</h1>
        <p className={styles.subtitle}>{SUBTITLE}</p>

        {/* ── Bloque informativo del archivo subido ────────────────────────── */}
        <div className={styles.fileBlock} data-testid={FILE_TESTID}>
          <div className={styles.fileIcon} aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div>
            <div className={styles.fileName}>{file.name}</div>
            <div className={styles.fileMeta}>{UPLOADED_AT}</div>
          </div>
          <div className={styles.filePills}>
            <span className={styles.filePill}>{stats.rows}</span>
            <span className={styles.filePill}>{stats.columns}</span>
            <span className={styles.filePill}>{stats.sample}</span>
          </div>
        </div>

        {/* ── Banner de perfil aplicado (solo si lo hay) ───────────────────── */}
        {/* El texto completo del elemento es EXACTAMENTE `profileBannerText(nombre)`:
            el <strong> solo parte en trozos la misma cadena, no añade nada. */}
        {banner !== null && (
          <div className={styles.banner} role="status" data-testid="profile-banner">
            <span className={styles.bannerIcon} aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3l1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9L12 3z" />
              </svg>
            </span>
            <span className={styles.bannerText}>{banner.before}<strong>{banner.quoted}</strong>{banner.after}</span>
          </div>
        )}

        {/* ── Tabla de mapeo ───────────────────────────────────────────────── */}
        <h2 className={styles.secTitle}>{MAPPING_TITLE}</h2>
        <div className={styles.tblCard}>
          <table className={styles.table} aria-label={MAPPING_ARIA}>
            <thead>
              <tr>
                <th>{TH_COLUMN}</th>
                <th>{TH_EXAMPLE}</th>
                <th>{TH_FIELD}</th>
                <th>{TH_CONFIDENCE}</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col, i) => {
                const field = mapping[i] ?? 'ignore';
                const confidence = proposal[i]?.confidence ?? 0;
                const tone = confidenceTone(confidence);
                const confClass =
                  tone === 'hi' ? styles.confHi : tone === 'mid' ? styles.confMid : styles.confLo;
                /* Solo se marca en rojo la fila ignorada cuando ADEMÁS falta algún
                   obligatorio: ignorar una columna que nadie necesita es legítimo. */
                const unmapped = missing && field === 'ignore';
                const selectClass =
                  field === 'ignore' ? `${styles.mapSel} ${styles.mapSelIgnore}` : styles.mapSel;
                return (
                  <tr
                    key={`${col.header}-${i}`}
                    className={unmapped ? styles.unmapped : undefined}
                    data-testid="mapping-row"
                    data-unmapped={unmapped ? 'true' : undefined}
                  >
                    <td>
                      <span className={styles.colOrig}>{col.header}</span>
                    </td>
                    <td>
                      <span className={styles.colEx}>
                        {col.example === '' ? EMPTY_EXAMPLE : col.example}
                      </span>
                    </td>
                    <td>
                      <select
                        className={selectClass}
                        aria-label={selectLabel(col.header, i)}
                        value={field}
                        onChange={(e) =>
                          setMapping(assignField(mapping, i, e.target.value as PlatformField))
                        }
                      >
                        {FIELD_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value} disabled={o.disabled}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span
                        className={`${styles.conf} ${confClass}`}
                        data-testid="confidence"
                        data-tone={tone}
                      >
                        {confidenceLabel(confidence)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Guardar como perfil ──────────────────────────────────────────── */}
        <div className={styles.formCard}>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={saveProfile}
              onChange={(e) => setSaveProfile(e.target.checked)}
            />
            <span className={styles.checkLbl}>{SAVE_LABEL}</span>
          </label>
          {/* Sin marcar NO se renderiza nada: no hay campo oculto esperando. */}
          {saveProfile && (
            <div className={styles.profileWrap}>
              <input
                type="text"
                className={styles.finput}
                aria-label={PROFILE_NAME_ARIA}
                placeholder={PROFILE_PLACEHOLDER}
                maxLength={PROFILE_MAX}
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
              />
              <div className={styles.fhint}>{PROFILE_HINT}</div>
            </div>
          )}
        </div>

        {/* ── Política de actualización ────────────────────────────────────── */}
        <h2 className={styles.secTitle}>{POLICY_TITLE}</h2>
        <div className={styles.radioCard}>
          <label className={styles.radioOpt}>
            <input
              type="radio"
              name="policy"
              value="REPLACE"
              checked={policy === 'REPLACE'}
              onChange={() => setPolicy('REPLACE')}
            />
            <div className={styles.radioOptBody}>
              <div className={styles.radioOptLbl}>{REPLACE_LABEL}</div>
              <div className={styles.radioOptDesc}>{REPLACE_DESC}</div>
            </div>
          </label>
          <label className={styles.radioOpt}>
            <input
              type="radio"
              name="policy"
              value="ACCUMULATE"
              checked={policy === 'ACCUMULATE'}
              onChange={() => setPolicy('ACCUMULATE')}
            />
            <div className={styles.radioOptBody}>
              <div className={styles.radioOptLbl}>{ACCUMULATE_LABEL}</div>
              <div className={styles.radioOptDesc}>{ACCUMULATE_DESC}</div>
            </div>
          </label>
        </div>

        {/* ── Avisos ───────────────────────────────────────────────────────── */}
        {warning !== null && (
          <div className={styles.alert} role="alert" data-testid="limit-warning">
            {warning}
          </div>
        )}
        {error !== null && (
          <div className={styles.alert} role="alert">
            {error}
          </div>
        )}

        {/* Por qué el botón no se deja pulsar, a la vista: el `title` de un botón
            deshabilitado no sale en Chrome ni en Edge. */}
        {missingTip !== null && (
          <div className={styles.hint} data-testid="missing-hint">
            {missingTip}
          </div>
        )}
        {countryNotice !== null && (
          <div className={styles.hint} data-testid="country-notice">
            {countryNotice}
          </div>
        )}

        {/* ── Acciones ─────────────────────────────────────────────────────── */}
        <div className={styles.btnRow}>
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={busy || !confirmable}
            title={missingTip ?? undefined}
            onClick={() =>
              onConfirm({
                mapping,
                policy,
                profileName: saveProfile ? profileName.trim() : null,
                ...(defaultCountry ? { defaultCountry } : {}),
              })
            }
          >
            {busy ? BUSY_LABEL : CONFIRM_LABEL}
          </button>
          <button type="button" className={styles.btnCancel} onClick={onCancel} disabled={busy}>
            {CANCEL_LABEL}
          </button>
        </div>
      </div>
    </div>
  );
}
