import React from 'react';
import styles from './InventoryTable.module.css';

export type InventoryStatus = 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';

export interface InventoryRow {
  id: string;
  reference: string;
  brand: string;
  quantity: number;
  country: string;
  status: InventoryStatus;
  ageDays: number;
}

export interface InventoryPagination {
  totalLines: number;
  currentPage: number;
  totalPages: number;
}

export interface InventoryTableProps {
  rows: InventoryRow[];
  onArchive?: (row: InventoryRow) => void;
  onDelete?: (row: InventoryRow) => void;
  pagination?: InventoryPagination;
  onPageChange?: (page: number) => void;
}

const STATUS_META: Record<InventoryStatus, { label: string; badgeClass: string }> = {
  PUBLISHED: { label: 'Published', badgeClass: styles.badgePublished },
  DRAFT: { label: 'Draft', badgeClass: styles.badgeDraft },
  ARCHIVED: { label: 'Archived', badgeClass: styles.badgeArchived },
};

function formatAge(days: number): string {
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Hace 1 día';
  return `Hace ${days} días`;
}

function ageClass(days: number): string {
  if (days > 30) return styles.ageDanger;
  if (days > 7) return styles.ageWarn;
  return styles.ageNormal;
}

function getPageItems(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 3) {
    return [1, 2, 3, 'ellipsis', total];
  }
  if (current >= total - 2) {
    return [1, 'ellipsis', total - 2, total - 1, total];
  }
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
}

const ArchiveIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
    <path d="M10 12h4" />
  </svg>
);

const TrashIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

export function InventoryTable({
  rows,
  onArchive,
  onDelete,
  pagination,
  onPageChange,
}: InventoryTableProps) {
  return (
    <div className={styles.card}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Referencia</th>
            <th className={styles.th}>Marca</th>
            <th className={styles.th}>Cantidad</th>
            <th className={styles.th}>País</th>
            <th className={styles.th}>Estado</th>
            <th className={styles.th}>Antigüedad</th>
            <th className={styles.th}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const status = STATUS_META[row.status];
            return (
              <tr key={row.id} className={styles.row}>
                <td className={styles.td}>
                  <span className={styles.refCode}>{row.reference}</span>
                </td>
                <td className={styles.td}>
                  <span className={`${styles.badge} ${styles.badgeBrand}`}>{row.brand}</span>
                </td>
                <td className={styles.td}>{row.quantity}</td>
                <td className={styles.td}>
                  <span className={`${styles.badge} ${styles.badgeIso}`}>{row.country}</span>
                </td>
                <td className={styles.td}>
                  <span className={`${styles.badge} ${status.badgeClass}`}>{status.label}</span>
                </td>
                <td className={styles.td}>
                  <span className={`${styles.age} ${ageClass(row.ageDays)}`}>
                    {formatAge(row.ageDays)}
                  </span>
                </td>
                <td className={styles.td}>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.rowAction}
                      title="Archivar"
                      aria-label={`Archivar ${row.reference}`}
                      onClick={() => onArchive?.(row)}
                    >
                      <ArchiveIcon />
                    </button>
                    <button
                      type="button"
                      className={`${styles.rowAction} ${styles.rowActionDelete}`}
                      title="Eliminar"
                      aria-label={`Eliminar ${row.reference}`}
                      onClick={() => onDelete?.(row)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td className={styles.td} colSpan={7}>
                <div className={styles.emptyState}>
                  Todavía no tienes ninguna línea de inventario publicada.
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {pagination && (
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>
            {pagination.totalLines.toLocaleString('es-ES')} líneas · pág.{' '}
            {pagination.currentPage}/{pagination.totalPages}
          </span>
          <button
            type="button"
            className={`${styles.pageButton} ${styles.pageNav}`}
            aria-label="Página anterior"
            disabled={pagination.currentPage <= 1}
            onClick={() => onPageChange?.(pagination.currentPage - 1)}
          >
            ‹
          </button>
          {getPageItems(pagination.currentPage, pagination.totalPages).map((item, idx) =>
            item === 'ellipsis' ? (
              <span key={`ellipsis-${idx}`} className={styles.pageEllipsis}>
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className={`${styles.pageButton} ${
                  item === pagination.currentPage ? styles.pageButtonActive : ''
                }`}
                aria-current={item === pagination.currentPage ? 'page' : undefined}
                onClick={() => onPageChange?.(item)}
              >
                {item}
              </button>
            )
          )}
          <button
            type="button"
            className={`${styles.pageButton} ${styles.pageNav}`}
            aria-label="Página siguiente"
            disabled={pagination.currentPage >= pagination.totalPages}
            onClick={() => onPageChange?.(pagination.currentPage + 1)}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}

export default InventoryTable;