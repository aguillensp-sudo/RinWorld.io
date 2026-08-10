import { useState } from 'react';
import {
  ZONES,
  ZONE_LABELS,
  activeChips,
  withoutChip,
  type ChipKey,
  type SearchCriteria,
  type Zone,
} from '../../lib/search';
import styles from './FilterChips.module.css';

interface Props {
  criteria: SearchCriteria;
  onChange(next: SearchCriteria): void;
}

const FIELD_OPTIONS: { key: ChipKey; label: string }[] = [
  { key: 'partNumber', label: 'Ref' },
  { key: 'brand', label: 'Marca' },
  { key: 'minQuantity', label: 'Qty min' },
  { key: 'zone', label: 'Zona' },
  { key: 'maxLeadTimeDays', label: 'Lead time max' },
];

/**
 * Chips de filtro de SRCH-01, totalmente controlados.
 *
 * No guarda criterios: los recibe por prop y emite los nuevos enteros. El único
 * estado propio son el formulario desplegado y lo que hay tecleado en él.
 */
export function FilterChips({ criteria, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<ChipKey>('partNumber');
  const [raw, setRaw] = useState('');

  const chips = activeChips(criteria);
  const numeric = field === 'minQuantity' || field === 'maxLeadTimeDays';
  const canSubmit = raw.trim() !== '' && (!numeric || Number.isFinite(Number(raw)));

  const handleAdd = () => {
    if (!canSubmit) return;
    const value = raw.trim();
    const next = { ...criteria };

    switch (field) {
      case 'partNumber':
        next.partNumber = value;
        break;
      case 'brand':
        next.brand = value;
        break;
      case 'minQuantity':
        next.minQuantity = Number(value);
        break;
      case 'zone':
        next.zone = value as Zone;
        break;
      case 'maxLeadTimeDays':
        next.maxLeadTimeDays = Number(value);
        break;
    }

    onChange(next);
    setOpen(false);
    setRaw('');
  };

  return (
    <div className={styles.row}>
      {chips.map((chip) => (
        <span key={chip.key} className={styles.chip}>
          <span className={styles.label}>{chip.label}</span>
          <span className={styles.value}>{chip.value}</span>
          <button
            type="button"
            className={styles.remove}
            aria-label={`Quitar filtro ${chip.label}`}
            title={chip.value}
            onClick={() => onChange(withoutChip(criteria, chip.key))}
          >
            ×
          </button>
        </span>
      ))}

      <button
        type="button"
        className={styles.add}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span aria-hidden="true">+</span> Filtro
      </button>

      {open ? (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd();
          }}
        >
          <select
            className={styles.select}
            aria-label="Campo"
            value={field}
            onChange={(e) => {
              setField(e.target.value as ChipKey);
              setRaw('');
            }}
          >
            {FIELD_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>

          {field === 'zone' ? (
            <select
              className={styles.select}
              aria-label="Valor"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            >
              <option value="">Zona…</option>
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {ZONE_LABELS[z]}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={styles.input}
              aria-label="Valor"
              type={numeric ? 'number' : 'text'}
              min={numeric ? 0 : undefined}
              placeholder={field === 'partNumber' ? '6205-2RS' : field === 'brand' ? 'SKF' : field === 'minQuantity' ? '500' : '7'}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />
          )}

          <button type="submit" className={styles.submit} disabled={!canSubmit}>
            Anadir
          </button>
        </form>
      ) : null}
    </div>
  );
}
