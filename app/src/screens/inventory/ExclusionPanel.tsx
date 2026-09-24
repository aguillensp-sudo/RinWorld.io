import type { Zone } from '../../lib/search';
import {
  CONTINENT_OPTIONS,
  type CountryOption,
  type Exclusion,
  type OrgCandidate,
} from '../../lib/visibility';
import styles from './ExclusionPanel.module.css';

const SEARCH_PLACEHOLDER = 'Buscar organización por nombre...';
const ORG_HINT = 'EFECTO INMEDIATO AL AÑADIR';

const CONTINENT_LABEL = 'Excluir por continente';
const CONTINENT_PLACEHOLDER = 'Selecciona un continente';
const COUNTRY_LABEL = 'Refinar por país';
const COUNTRY_PLACEHOLDER = 'Todos los países del continente';
const ADD_GEO_LABEL = 'Añadir exclusión geográfica';
const GEO_HINT = 'EXCLUYE TODAS LAS ORGANIZACIONES CON SEDE EN ESA GEOGRAFÍA';

const CONTINENT_SELECT_ID = 'visibility-continent';
const COUNTRY_SELECT_ID = 'visibility-country';

interface Props {
  /** Exclusiones por organización, ya agrupadas y ordenadas por `groupExclusions`. */
  orgs: Exclusion[];
  /** Exclusiones geográficas (continentes y países juntos), ya agrupadas. */
  geo: Exclusion[];
  /** Los candidatos del autocompletado, ya calculados por `filterOrgCandidates`. */
  candidates: OrgCandidate[];
  /** Lo escrito en el buscador. Estado de la pantalla, no del panel. */
  query: string;
  /** Continente elegido; `''` = ninguno. */
  continent: Zone | '';
  /** País elegido; `''` = todo el continente. */
  country: string;
  /** Los países del continente que tienen alguna organización. */
  countries: CountryOption[];
  /** `true` en modo abierto o cuando el miembro no puede gestionar: todo en gris. */
  disabled: boolean;
  /** Hay una llamada en vuelo. */
  busy: boolean;
  /** Error de la última acción sobre la lista; `role="alert"` dentro del panel. */
  error: string | null;
  onQueryChange: (q: string) => void;
  onPickOrg: (c: OrgCandidate) => void;
  onContinentChange: (c: Zone | '') => void;
  onCountryChange: (code: string) => void;
  onAddGeo: () => void;
  onRemove: (e: Exclusion) => void;
}

/**
 * INV-07 — Panel de lista de exclusión. Presentacional puro: no toca la red y no
 * tiene estado propio. `query`, `continent` y `country` llegan por props porque la
 * pantalla los necesita para calcular candidatos y para limpiarlos tras una
 * escritura que ha ido bien.
 */
export function ExclusionPanel({
  orgs,
  geo,
  candidates,
  query,
  continent,
  country,
  countries,
  disabled,
  busy,
  error,
  onQueryChange,
  onPickOrg,
  onContinentChange,
  onCountryChange,
  onAddGeo,
  onRemove,
}: Props) {
  return (
    <div
      className={styles.panel}
      data-testid="exclusion-panel"
      data-active={disabled ? 'false' : 'true'}
    >
      {error !== null && (
        <p className={styles.alert} role="alert">
          {error}
        </p>
      )}

      {/* ── Exclusión por organización ── */}
      <section className={styles.section} aria-label="Exclusión por organización">
        <input
          type="text"
          className={styles.search}
          placeholder={SEARCH_PLACEHOLDER}
          value={query}
          disabled={disabled}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <p className={styles.hint}>{ORG_HINT}</p>

        {/* Solo se pinta la lista si hay candidatos: sin coincidencias, nada. */}
        {candidates.length > 0 && (
          <ul className={styles.candidates}>
            {candidates.map((candidate) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  className={styles.candidate}
                  disabled={disabled || busy}
                  onClick={() => onPickOrg(candidate)}
                >
                  {candidate.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        <ul className={styles.tagList}>
          {orgs.map((exclusion) => (
            <li key={exclusion.id} className={styles.tag}>
              <span className={styles.tagLabel}>{exclusion.label}</span>
              <button
                type="button"
                className={styles.tagRemove}
                aria-label={`Quitar ${exclusion.label}`}
                disabled={disabled || busy}
                onClick={() => onRemove(exclusion)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Exclusión por geografía ── */}
      <section className={styles.section} aria-label="Exclusión por geografía">
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={CONTINENT_SELECT_ID}>
            {CONTINENT_LABEL}
          </label>
          <select
            id={CONTINENT_SELECT_ID}
            className={styles.select}
            value={continent}
            disabled={disabled}
            onChange={(e) => onContinentChange(e.target.value as Zone | '')}
          >
            <option value="">{CONTINENT_PLACEHOLDER}</option>
            {CONTINENT_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* El refinamiento por país solo existe tras elegir continente. */}
        {continent !== '' && (
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={COUNTRY_SELECT_ID}>
              {COUNTRY_LABEL}
            </label>
            <select
              id={COUNTRY_SELECT_ID}
              className={styles.select}
              value={country}
              disabled={disabled}
              onChange={(e) => onCountryChange(e.target.value)}
            >
              <option value="">{COUNTRY_PLACEHOLDER}</option>
              {countries.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.geoRow}>
          <button
            type="button"
            className={styles.addGeo}
            disabled={disabled || busy || continent === ''}
            onClick={onAddGeo}
          >
            {ADD_GEO_LABEL}
          </button>
        </div>
        <p className={styles.hint}>{GEO_HINT}</p>

        <ul className={styles.tagList}>
          {geo.map((exclusion) => (
            <li key={exclusion.id} className={`${styles.tag} ${styles.tagGeo}`}>
              <span className={styles.tagLabel}>{exclusion.label}</span>
              <button
                type="button"
                className={styles.tagRemove}
                aria-label={`Quitar ${exclusion.label}`}
                disabled={disabled || busy}
                onClick={() => onRemove(exclusion)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
