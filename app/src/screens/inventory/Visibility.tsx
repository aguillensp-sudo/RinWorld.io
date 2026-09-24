import { useEffect, useRef, useState } from 'react';
import type { Zone } from '../../lib/search';
import { errorMessage, type MemberProfile } from '../../lib/session';
import {
  addExclusion,
  canManageVisibility,
  DEFAULT_VISIBILITY_MODE,
  fetchContinentCountries,
  fetchOrgCandidates,
  fetchVisibility,
  filterOrgCandidates,
  groupExclusions,
  IMMEDIATE_EFFECT_NOTICE,
  KEPT_LIST_NOTICE,
  READ_ONLY_NOTICE,
  removeExclusion,
  saveVisibilityMode,
  SAVED_MESSAGE,
  VISIBILITY_MODES,
  type CountryOption,
  type Exclusion,
  type ExclusionTarget,
  type OrgCandidate,
  type VisibilityMode,
} from '../../lib/visibility';
import { ExclusionPanel } from './ExclusionPanel';
import styles from './Visibility.module.css';

const EYEBROW = 'Módulo 02 · Gestión de Inventario';
const TITLE = 'Visibilidad del inventario';
const SUBTITLE =
  'Controla quién puede ver tu stock en Bearingworld.io. El modo se aplica a todo tu inventario de forma inmediata.';

/** Spec §3: el radio group es un `fieldset`; el nombre accesible es el mismo texto. */
const MODE_LEGEND = 'Modo de visibilidad';
const SAVE_LABEL = 'Guardar configuración';

interface Props {
  /** La sesión del miembro. De aquí salen `orgId` (todo se pide por organización) y `role`. */
  profile: MemberProfile;
}

/**
 * INV-07 — Configuración de Visibilidad del Inventario. La pantalla posee TODO el
 * estado: el modo guardado, el modo del radio (borrador), la lista de exclusiones,
 * el directorio de organizaciones para el autocompletado y la geografía elegida.
 *
 * Dos ritmos distintos conviven aquí (spec §3 y §7):
 *  - El MODO solo se escribe al pulsar `Guardar configuración`. Cambiar de radio no
 *    llama a la red: solo mueve el borrador.
 *  - Las EXCLUSIONES se escriben al momento: añadir o quitar una etiqueta es una
 *    llamada de red y, si va bien, se repide la lista entera.
 */
export function Visibility({ profile }: Props) {
  /** Quién escribe lo decide la base (`exclusions_write_admin`, `0002`); la UI solo lo refleja. */
  const canManage = canManageVisibility(profile.role);

  /** El modo GUARDADO: es el punto de partida del borrador y a donde vuelve al guardar. */
  const [savedMode, setSavedMode] = useState<VisibilityMode>(DEFAULT_VISIBILITY_MODE);
  /** El modo del radio: el que viaja a `saveVisibilityMode` y el que decide el panel. */
  const [draft, setDraft] = useState<VisibilityMode>(DEFAULT_VISIBILITY_MODE);

  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [allOrgs, setAllOrgs] = useState<OrgCandidate[]>([]);

  /** Estado del autocompletado y de la geografía — todo presentacional, vive en el panel. */
  const [query, setQuery] = useState('');
  const [continent, setContinent] = useState<Zone | ''>('');
  const [country, setCountry] = useState('');
  const [countries, setCountries] = useState<CountryOption[]>([]);

  const [loadError, setLoadError] = useState<string | null>(null);
  /** Error de una acción sobre la lista: viaja en la prop `error` del panel. */
  const [error, setError] = useState<string | null>(null);
  /** Error de guardado: `role="alert"` de la pantalla, hermano del status. */
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Aviso de éxito del guardado: UN solo `role="status"` a la vez. */
  const [saved, setSaved] = useState(false);
  /** Hay una llamada en vuelo (carga de países incluida). */
  const [busy, setBusy] = useState(false);

  /*
   * La carga inicial llega tarde o temprano. Mientras tanto el miembro ya puede
   * haber movido el radio (el grupo se pinta desde el primer render) o haber
   * añadido una exclusión. Si la respuesta pisara esas dos cosas, el panel podría
   * desaparecer bajo los pies de quien está configurando la lista, así que ambos
   * se marcan como «tocados» y la carga solo rellena lo que nadie ha tocado.
   */
  const modeTouched = useRef(false);
  const listTouched = useRef(false);

  /*
   * Una sola vez al montar: el modo y la lista, más el directorio del
   * autocompletado. El directorio no depende del modo ni de la lista, así que se
   * pide en el mismo golpe y no se vuelve a pedir nunca.
   */
  useEffect(() => {
    let active = true;

    Promise.all([fetchVisibility(profile.orgId), fetchOrgCandidates()])
      .then(([state, candidates]) => {
        if (!active) return;
        setSavedMode(state.mode);
        // `== null` solo cuando nadie ha tocado el radio: entonces el borrador
        // arranca igual que el modo guardado, que es lo que dice la spec §3.
        if (!modeTouched.current) setDraft(state.mode);
        if (!listTouched.current) setExclusions(state.exclusions);
        setAllOrgs(candidates);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setLoadError(errorMessage(e));
      });

    return () => {
      active = false;
    };
  }, [profile.orgId]);

  /** Repide la lista después de una escritura que ha ido bien. El modo NO se toca aquí. */
  async function reload(): Promise<void> {
    const state = await fetchVisibility(profile.orgId);
    setExclusions(state.exclusions);
  }

  /**
   * Cambiar de radio NO guarda: solo mueve el borrador. Si el borrador pasa a
   * `VISIBLE_TODOS` con lista guardada, el aviso brass lo explica (spec §6).
   */
  function handleModeChange(mode: VisibilityMode): void {
    modeTouched.current = true;
    setDraft(mode);
  }

  /** Autocompletado: efecto inmediato, sin pasar por `Guardar configuración`. */
  async function handlePickOrg(candidate: OrgCandidate): Promise<void> {
    listTouched.current = true;
    setBusy(true);
    setError(null);
    try {
      await addExclusion(profile.orgId, { orgId: candidate.id });
      await reload();
      setQuery('');
    } catch (e: unknown) {
      // Sin recargar y sin vaciar el buscador: el mensaje va al panel.
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Elegir continente vacía el país y pide sus países con organización (los únicos
   * que tiene sentido excluir). Con el continente vacío no hay segunda llamada.
   */
  async function handleContinentChange(code: Zone | ''): Promise<void> {
    setContinent(code);
    setCountry('');
    setCountries([]);
    if (code === '') return;

    setBusy(true);
    setError(null);
    try {
      setCountries(await fetchContinentCountries(code));
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  /** El país elegido gana al continente; sin país, se excluye el continente entero. */
  async function handleAddGeo(): Promise<void> {
    const target: ExclusionTarget | null =
      country !== '' ? { country } : continent !== '' ? { continent } : null;
    if (target === null) return;

    listTouched.current = true;
    setBusy(true);
    setError(null);
    try {
      await addExclusion(profile.orgId, target);
      await reload();
      setContinent('');
      setCountry('');
      setCountries([]);
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(exclusion: Exclusion): Promise<void> {
    listTouched.current = true;
    setBusy(true);
    setError(null);
    try {
      await removeExclusion(exclusion.id);
      await reload();
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  /** `Guardar configuración`: solo el modo. La lista ya se escribió al añadir o quitar. */
  async function handleSave(): Promise<void> {
    setBusy(true);
    setSaveError(null);
    // Un status viejo se retira antes de intentarlo: si falla no puede quedar ninguno.
    setSaved(false);
    try {
      await saveVisibilityMode(profile.orgId, draft);
      setSavedMode(draft);
      setSaved(true);
    } catch (e: unknown) {
      setSaveError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const { orgs, geo } = groupExclusions(exclusions);
  const candidates = filterOrgCandidates(allOrgs, query, exclusions, profile.orgId);

  /*
   * Spec §3/§6: el panel se pinta en modo restringido O cuando hay lista guardada
   * (en modo abierto se ve, en gris y sin poder tocarla). Sin lista y en modo
   * abierto no hay ni panel ni aviso.
   */
  const showPanel = draft === 'RESTRINGIDA' || exclusions.length > 0;
  const showKeptNotice = draft === 'VISIBLE_TODOS' && exclusions.length > 0;
  const panelDisabled = draft === 'VISIBLE_TODOS' || !canManage;

  return (
    <div className={styles.screen} data-saved-mode={savedMode}>
      <div className={styles.eyebrow}>{EYEBROW}</div>
      <h1 className={styles.title}>{TITLE}</h1>
      <p className={styles.subtitle}>{SUBTITLE}</p>

      {!canManage && <p className={styles.readOnly}>{READ_ONLY_NOTICE}</p>}

      {/* Fallo de carga: la pantalla queda sin datos, pero dice por qué. */}
      {loadError !== null && (
        <p className={styles.alert} role="alert">
          {loadError}
        </p>
      )}

      {/* UN solo `role="status"` a la vez: el del guardado. */}
      {saved && (
        <p className={styles.status} role="status">
          {SAVED_MESSAGE}
        </p>
      )}

      {saveError !== null && (
        <p className={styles.alert} role="alert">
          {saveError}
        </p>
      )}

      {/* ── Modo de visibilidad: el borrador NO toca la red. ── */}
      <fieldset className={styles.modeGroup} role="radiogroup" aria-label={MODE_LEGEND}>
        <legend className={styles.legend}>{MODE_LEGEND}</legend>
        {VISIBILITY_MODES.map((mode) => (
          <label
            key={mode.value}
            className={
              draft === mode.value ? `${styles.option} ${styles.optionSelected}` : styles.option
            }
          >
            <input
              type="radio"
              className={styles.radio}
              name="visibility-mode"
              value={mode.value}
              checked={draft === mode.value}
              disabled={!canManage}
              onChange={() => handleModeChange(mode.value)}
            />
            <span className={styles.optionText}>
              <span className={styles.optionLabel}>{mode.label}</span>
              <span className={styles.optionDesc}>{mode.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {/* ── Lista conservada al volver a «Visible para todos» (spec §6). ── */}
      {showKeptNotice && <p className={styles.brassNotice}>{KEPT_LIST_NOTICE}</p>}

      {showPanel && (
        <ExclusionPanel
          orgs={orgs}
          geo={geo}
          candidates={candidates}
          query={query}
          continent={continent}
          country={country}
          countries={countries}
          disabled={panelDisabled}
          busy={busy}
          error={error}
          onQueryChange={setQuery}
          onPickOrg={handlePickOrg}
          onContinentChange={handleContinentChange}
          onCountryChange={setCountry}
          onAddGeo={handleAddGeo}
          onRemove={handleRemove}
        />
      )}

      {/* ── Bloque informativo brass: siempre (spec §3). ── */}
      <div className={styles.brassBlock}>
        <p className={styles.brassText}>{IMMEDIATE_EFFECT_NOTICE}</p>
      </div>

      <button
        type="button"
        className={styles.save}
        disabled={!canManage || busy}
        onClick={handleSave}
      >
        {SAVE_LABEL}
      </button>
    </div>
  );
}
