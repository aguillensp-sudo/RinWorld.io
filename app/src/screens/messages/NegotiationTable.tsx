import { useState } from 'react';
import {
  STATUS_LABELS,
  STATUSES_BY_ROLE,
  TAB_TEXTS,
  currenciesOf,
  filterRows,
  sortRows,
  type NegotiationAction,
  type NegotiationRow,
  type NegotiationStatus,
  type Role,
  type RowFilters,
  type SortDir,
  type SortKey,
} from '../../lib/negotiation-rows';
import { NEGOTIATION_TEXTS, type BadgeTone } from '../../lib/negotiation-tables';
import styles from './NegotiationTable.module.css';

/**
 * El texto de cada acción, verbatim de MSG-03. El `Record` está tipado contra
 * `NegotiationAction`: si la base ganara una acción, TS obliga a decidir su texto
 * en vez de dejar un botón mudo.
 */
const ACTION_LABELS: Record<NegotiationAction, string> = {
  responder: NEGOTIATION_TEXTS.respond,
  'sin-stock': NEGOTIATION_TEXTS.outOfStock,
  aceptar: NEGOTIATION_TEXTS.accept,
  'aceptar-igualmente': NEGOTIATION_TEXTS.acceptAnyway,
  contraofertar: NEGOTIATION_TEXTS.counter,
  rechazar: NEGOTIATION_TEXTS.reject,
};

/**
 * La clase de cada tono de badge. Valores `string | undefined` porque los CSS
 * Modules tipados con `noUncheckedIndexedAccess` devuelven `string | undefined`
 * (F-143); el `?? ''` va en el único sitio donde se consume.
 */
const BADGE_CLASS: Record<BadgeTone, string | undefined> = {
  pendiente: styles.badgePendiente,
  respondida: styles.badgeRespondida,
  'sin-stock': styles.badgeSinStock,
  aceptada: styles.badgeAceptada,
  rechazada: styles.badgeRechazada,
  superada: styles.badgeSuperada,
  expirada: styles.badgeExpirada,
  espera: styles.badgeEspera,
};

function parseNumber(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

interface NegotiationTableProps {
  role: Role;
  rows: NegotiationRow[];
  onAction: (row: NegotiationRow, action: NegotiationAction) => void;
  onWrite: (row: NegotiationRow) => void;
}

/**
 * La tabla de una de las dos pestañas de negociación (Soy cliente / Soy proveedor).
 *
 * Presentacional: recibe las filas ya calculadas por `negotiation-rows.ts` y solo
 * aplica los filtros (`filterRows`) y el orden (`sortRows`) que la propia pieza
 * mantiene como estado local. No calcula ni el estado de una fila, ni sus acciones,
 * ni ningún texto. La tabla se pinta siempre, también sin filas: las dos pestañas
 * tienen las mismas columnas (spec `negotiation-tables-by-role`).
 */
export function NegotiationTable({ role, rows, onAction, onWrite }: NegotiationTableProps) {
  const [filters, setFilters] = useState<RowFilters>({});
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'date', dir: 'desc' });

  const visible = sortRows(filterRows(rows, filters), sort.key, sort.dir);
  const currencies = currenciesOf(rows);
  const headers = TAB_TEXTS.headers;

  function handleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
  }

  return (
    <div className={styles.tableOuter}>
      <table
        className={styles.table}
        aria-label={role === 'cliente' ? TAB_TEXTS.cliente : TAB_TEXTS.proveedor}
      >
        <thead>
          <tr>
            {TAB_TEXTS.sortKeys.map((key, i) => {
              const isActive = sort.key === key;
              const ariaSort: 'ascending' | 'descending' =
                sort.dir === 'asc' ? 'ascending' : 'descending';
              return (
                <th
                  key={key}
                  scope="col"
                  className={styles.th}
                  {...(isActive ? { 'aria-sort': ariaSort } : {})}
                >
                  <button type="button" className={styles.sortButton} onClick={() => handleSort(key)}>
                    {headers[i] ?? ''}
                  </button>
                </th>
              );
            })}
            <th scope="col" className={styles.th}>
              {headers[8]}
            </th>
          </tr>
          <tr className={styles.filterRow}>
            {/* Referencia */}
            <td className={styles.filterCell}>
              <input
                type="text"
                aria-label={TAB_TEXTS.filterReference}
                value={filters.reference ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, reference: e.target.value }))}
              />
            </td>
            {/* Cantidad */}
            <td className={styles.filterCell}>
              <div className={styles.filterRange}>
                <input
                  type="number"
                  aria-label={TAB_TEXTS.filterFrom(headers[1])}
                  value={filters.quantity?.min ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      quantity: { ...(f.quantity ?? {}), min: parseNumber(e.target.value) },
                    }))
                  }
                />
                <input
                  type="number"
                  aria-label={TAB_TEXTS.filterTo(headers[1])}
                  value={filters.quantity?.max ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      quantity: { ...(f.quantity ?? {}), max: parseNumber(e.target.value) },
                    }))
                  }
                />
              </div>
            </td>
            {/* Precio */}
            <td className={styles.filterCell}>
              <div className={styles.filterRange}>
                <input
                  type="number"
                  aria-label={TAB_TEXTS.filterFrom(headers[2])}
                  value={filters.price?.min ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      price: { ...(f.price ?? {}), min: parseNumber(e.target.value) },
                    }))
                  }
                />
                <input
                  type="number"
                  aria-label={TAB_TEXTS.filterTo(headers[2])}
                  value={filters.price?.max ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      price: { ...(f.price ?? {}), max: parseNumber(e.target.value) },
                    }))
                  }
                />
                {currencies.length > 1 && (
                  <select
                    aria-label={TAB_TEXTS.priceCurrency}
                    value={filters.price?.currency ?? ''}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        price: {
                          ...(f.price ?? {}),
                          currency: e.target.value === '' ? null : e.target.value,
                        },
                      }))
                    }
                  >
                    <option value="">{TAB_TEXTS.filterAnyStatus}</option>
                    {currencies.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </td>
            {/* Estado */}
            <td className={styles.filterCell}>
              <select
                aria-label={TAB_TEXTS.filterStatus}
                value={filters.statuses?.[0] ?? ''}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    statuses: e.target.value === '' ? [] : [e.target.value as NegotiationStatus],
                  }))
                }
              >
                <option value="">{TAB_TEXTS.filterAnyStatus}</option>
                {STATUSES_BY_ROLE[role].map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </td>
            {/* Fecha */}
            <td className={styles.filterCell}>
              <div className={styles.filterRange}>
                <input
                  type="date"
                  aria-label={TAB_TEXTS.filterFrom(headers[4])}
                  value={filters.date?.from ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      date: { ...(f.date ?? {}), from: e.target.value === '' ? null : e.target.value },
                    }))
                  }
                />
                <input
                  type="date"
                  aria-label={TAB_TEXTS.filterTo(headers[4])}
                  value={filters.date?.to ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      date: { ...(f.date ?? {}), to: e.target.value === '' ? null : e.target.value },
                    }))
                  }
                />
              </div>
            </td>
            {/* Plazo */}
            <td className={styles.filterCell}>
              <div className={styles.filterRange}>
                <input
                  type="number"
                  aria-label={TAB_TEXTS.filterFrom(headers[5])}
                  value={filters.leadTime?.min ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      leadTime: { ...(f.leadTime ?? {}), min: parseNumber(e.target.value) },
                    }))
                  }
                />
                <input
                  type="number"
                  aria-label={TAB_TEXTS.filterTo(headers[5])}
                  value={filters.leadTime?.max ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      leadTime: { ...(f.leadTime ?? {}), max: parseNumber(e.target.value) },
                    }))
                  }
                />
              </div>
            </td>
            {/* Transporte */}
            <td className={styles.filterCell}>
              <div className={styles.filterRange}>
                <input
                  type="number"
                  aria-label={TAB_TEXTS.filterFrom(headers[6])}
                  value={filters.shipping?.min ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      shipping: { ...(f.shipping ?? {}), min: parseNumber(e.target.value) },
                    }))
                  }
                />
                <input
                  type="number"
                  aria-label={TAB_TEXTS.filterTo(headers[6])}
                  value={filters.shipping?.max ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      shipping: { ...(f.shipping ?? {}), max: parseNumber(e.target.value) },
                    }))
                  }
                />
              </div>
            </td>
            {/* Válida hasta */}
            <td className={styles.filterCell}>
              <div className={styles.filterRange}>
                <input
                  type="date"
                  aria-label={TAB_TEXTS.filterFrom(headers[7])}
                  value={filters.validUntil?.from ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      validUntil: {
                        ...(f.validUntil ?? {}),
                        from: e.target.value === '' ? null : e.target.value,
                      },
                    }))
                  }
                />
                <input
                  type="date"
                  aria-label={TAB_TEXTS.filterTo(headers[7])}
                  value={filters.validUntil?.to ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      validUntil: {
                        ...(f.validUntil ?? {}),
                        to: e.target.value === '' ? null : e.target.value,
                      },
                    }))
                  }
                />
              </div>
            </td>
            {/* Acciones */}
            <td className={styles.filterCell} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className={`${styles.td ?? ''} ${styles.emptyCell ?? ''}`.trim()}>
                {TAB_TEXTS.emptyTable}
              </td>
            </tr>
          ) : visible.length === 0 ? (
            <tr>
              <td colSpan={9} className={`${styles.td ?? ''} ${styles.emptyCell ?? ''}`.trim()}>
                {TAB_TEXTS.noFilterMatches}
              </td>
            </tr>
          ) : (
            visible.map((row) => (
              <tr
                key={row.key}
                className={styles.row}
                data-testid="negotiation-row"
                {...(row.notes ? { title: row.notes } : {})}
              >
                <td className={styles.td}>
                  <button type="button" className={styles.refButton} onClick={() => onWrite(row)}>
                    {row.reference}
                  </button>
                </td>
                <td className={styles.td}>{row.quantity}</td>
                <td className={styles.td}>{row.price}</td>
                <td className={styles.td}>
                  <span
                    data-testid="badge"
                    className={`${styles.badge ?? ''} ${BADGE_CLASS[row.badge.tone] ?? ''}`.trim()}
                  >
                    {row.badge.label}
                  </span>
                </td>
                <td className={styles.td}>{row.date}</td>
                <td className={styles.td}>{row.leadTime}</td>
                <td className={styles.td}>{row.shipping}</td>
                <td className={styles.td}>{row.validUntil}</td>
                <td className={styles.td}>
                  <div className={styles.actions}>
                    {row.actions.map((action) => {
                      const counterBlocked =
                        action === 'contraofertar' && row.counterDisabledReason !== null;
                      return (
                        <button
                          key={action}
                          type="button"
                          className={styles.actionButton}
                          onClick={() => onAction(row, action)}
                          {...(counterBlocked ? { disabled: true } : {})}
                          {...(counterBlocked && row.counterDisabledReason
                            ? { title: row.counterDisabledReason }
                            : {})}
                        >
                          {ACTION_LABELS[action]}
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
