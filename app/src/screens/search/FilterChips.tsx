import { useState, type FormEvent } from 'react';
import {
  activeChips,
  CHIP_LABELS,
  withoutChip,
  ZONES,
  ZONE_LABELS,
  type ChipKey,
  type SearchCriteria,
  type Zone,
} from '../../lib/search';
import styles from './FilterChips.module.css';

interface Props {
  criteria: SearchCriteria;
  onChange: (next: SearchCriteria) => void;
}

/**
 * Las cinco opciones de Campo, en el orden fijo de la tabla de chips de la
 * spec §3: Ref · Marca · Qty mín · Zona · Lead time máx.
 */
const FIELD_OPTIONS: ChipKey[] = ['partNumber', 'brand', 'minQuantity', 'zone', 'maxLeadTimeDays'];

/**
 * Chips de filtro de SRCH-01.
 *
 * Presentacional y totalmente controlado: no guarda criterios, los recibe y
 * emite los nuevos enteros. El único estado propio es el del formulario en
 * línea (`+ Filtro`): si está abierto y qué hay tecleado en él.
 */
export function FilterChips({ criteria, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<ChipKey>('partNumber');
  const [value, setValue] = useState('');

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    const next: SearchCriteria = { ...criteria };
    switch (field) {
      case 'partNumber':
        next.partNumber = trimmed;
        break;
      case 'brand':
        next.brand = trimmed;
        break;
      case 'minQuantity': {
        const n = Number(trimmed);
        if (Number.isNaN(n) || n <= 0) return;
        next.minQuantity = n;
        break;
      }
      case 'zone': {
        const z = trimmed as Zone;
        if (!ZONES.includes(z)) return;
        next.zone = z;
        break;
      }
      case 'maxLeadTimeDays': {
        const n = Number(trimmed);
        if (Number.isNaN(n) || n <= 0) return;
        next.maxLeadTimeDays = n;
        break;
      }
    }

    onChange(next);
    setOpen(false);
    setField('partNumber');
    setValue('');
  };

  return (
    <div className={styles.chipsRow}>
      {activeChips(criteria).map((chip) => (
        <span key={chip.key} className={styles.chip}>
          <span className={styles.chipLabel}>{chip.label}</span>
          <span className={styles.chipValue}>{chip.value}</span>
          <button
            type="button"
            className={styles.chipX}
            aria-label={`Quitar filtro ${chip.label}`}
            onClick={() => onChange(withoutChip(criteria, chip.key))}
          >
            ×
          </button>
        </span>
      ))}

      <button type="button" className={styles.chipAdd} aria-label="Añadir filtro" onClick={() => setOpen((o) => !o)}>
        <i className="ti ti-plus" aria-hidden="true" /> Filtro
      </button>

      {open && (
        <form className={styles.filterForm} onSubmit={handleAdd}>
          <select
            className={styles.fieldSelect}
            aria-label="Campo"
            value={field}
            onChange={(e) => setField(e.target.value as ChipKey)}
          >
            {FIELD_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {CHIP_LABELS[k]}
              </option>
            ))}
          </select>

          {field === 'zone' ? (
            <select
              className={styles.fieldSelect}
              aria-label="Valor"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            >
              <option value="">Selecciona zona...</option>
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {ZONE_LABELS[z]}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={styles.valueInput}
              aria-label="Valor"
              type={field === 'minQuantity' || field === 'maxLeadTimeDays' ? 'number' : 'text'}
              min={field === 'minQuantity' || field === 'maxLeadTimeDays' ? 1 : undefined}
              placeholder={
                field === 'partNumber'
                  ? '6205-2RS'
                  : field === 'brand'
                    ? 'SKF'
                    : field === 'minQuantity'
                      ? '500'
                      : '7'
              }
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          )}

          <button type="submit" className={styles.addButton}>
            Añadir
          </button>
        </form>
      )}
    </div>
  );
}
