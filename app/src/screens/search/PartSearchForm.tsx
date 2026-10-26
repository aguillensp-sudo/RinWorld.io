import { useEffect, useId, useState, type ChangeEvent } from 'react';
import { SearchField } from '../../components/SearchField';
import {
  activePartChips,
  areaFromValue,
  areaOptions,
  areaValue,
  canSearch,
  type PartChipKey,
  type PartSearchCriteria,
} from '../../lib/part-search';
import chipStyles from './FilterChips.module.css';
import styles from './PartSearchForm.module.css';

interface Props {
  /** Los criterios aplicados: de ellos salen los chips. */
  criteria: PartSearchCriteria;
  /** Buscar con lo que hay en el formulario (Enter o la lupa). */
  onSubmit: (next: PartSearchCriteria) => void;
  /** Quitar un chip. La pantalla decide si relanza la búsqueda. */
  onRemoveChip: (key: PartChipKey) => void;
}

const AREA_OPTIONS = areaOptions();

/**
 * El formulario de SRCH-01 (`search-form`, `SRCH-01_cambios.md` §2):
 *   · línea 1, siempre visible: REF con la lupa, la casilla *Filtros* y los chips;
 *   · línea 2, solo con *Filtros* marcada y a todo el ancho: «Contiene», Marca, Cantidad ≥, Incluir, Excluir
 *     y Zona.
 *
 * Lo que se teclea es un borrador: nada consulta hasta Enter o la lupa (`F-172`, búsqueda server-side). Los chips
 * son de los criterios APLICADOS, no del borrador, y por eso desmarcar *Filtros* oculta la línea 2 sin quitar
 * nada: lo puesto sigue aplicándose y se ve en los chips.
 */
export function PartSearchForm({ criteria, onSubmit, onRemoveChip }: Props) {
  const [draft, setDraft] = useState<PartSearchCriteria>(criteria);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [refError, setRefError] = useState(false);
  const id = useId();

  // Lo aplicado manda: un chip quitado o unos criterios de VERA vuelven al borrador.
  useEffect(() => {
    setDraft(criteria);
  }, [criteria]);

  const set = <K extends keyof PartSearchCriteria>(key: K, value: PartSearchCriteria[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    if (!canSearch(draft)) {
      setRefError(true);
      return;
    }
    setRefError(false);
    onSubmit(draft);
  };

  const handleQuantity = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.trim();
    const n = Number(raw);
    set('minQuantity', raw === '' || !Number.isInteger(n) || n <= 0 ? null : n);
  };

  const chips = activePartChips(criteria);

  return (
    <div className={styles.form}>
      <div className={styles.lineOne}>
        <div className={styles.ref}>
          <SearchField
            value={draft.ref}
            onChange={(v) => {
              set('ref', v);
              if (refError) setRefError(false);
            }}
            onSubmit={submit}
            placeholder="p. ej. NU214"
            inputLabel="Referencia"
            submitLabel="Buscar referencia"
          />
        </div>

        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={filtersOpen}
            onChange={(e) => setFiltersOpen(e.target.checked)}
            aria-controls={`${id}-filtros`}
          />
          Filtros
        </label>

        {chips.length > 0 && (
          <div className={chipStyles.chipsRow} aria-label="Filtros activos">
            {chips.map((chip) => (
              <span key={chip.key} className={chipStyles.chip}>
                <span className={chipStyles.chipLabel}>{chip.label}</span>
                <span className={chipStyles.chipValue}>{chip.value}</span>
                {chip.removable && (
                  <button
                    type="button"
                    className={chipStyles.chipX}
                    aria-label={`Quitar filtro ${chip.label}`}
                    onClick={() => onRemoveChip(chip.key)}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {refError && (
        <p className={styles.refError} role="alert">
          La referencia es obligatoria.
        </p>
      )}

      {filtersOpen && (
        <div className={styles.lineTwo} id={`${id}-filtros`}>
          <label className={styles.toggle}>
            <input type="checkbox" checked={draft.contains} onChange={(e) => set('contains', e.target.checked)} />
            Contiene
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Marca</span>
            <input
              className={styles.input}
              value={draft.brand}
              placeholder="p. ej. SKF"
              onChange={(e) => set('brand', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Cantidad ≥</span>
            <input
              className={`${styles.input} ${styles.narrow}`}
              type="number"
              min={1}
              step={1}
              value={draft.minQuantity ?? ''}
              onChange={handleQuantity}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Incluir</span>
            <input
              className={`${styles.input} ${styles.narrow}`}
              value={draft.include}
              placeholder="p. ej. C3"
              onChange={(e) => set('include', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Excluir</span>
            <input
              className={`${styles.input} ${styles.narrow}`}
              value={draft.exclude}
              placeholder="p. ej. C3"
              onChange={(e) => set('exclude', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Zona</span>
            <select
              className={styles.input}
              value={areaValue(draft.area)}
              onChange={(e) => set('area', areaFromValue(e.target.value))}
            >
              <option value="">Cualquiera</option>
              <optgroup label="Continentes">
                {AREA_OPTIONS.filter((o) => o.group === 'Continentes').map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Países">
                {AREA_OPTIONS.filter((o) => o.group === 'Países').map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
