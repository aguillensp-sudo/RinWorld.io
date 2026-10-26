import styles from './Pager.module.css';

interface Props {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  /** Para el lector de pantalla: «Páginas de referencias», «Páginas de ofertas». */
  label: string;
}

/**
 * Paginador de SRCH-01: anterior, «Página X de Y» y siguiente. Con una sola página no se pinta: un paginador sin
 * a dónde ir es ruido.
 */
export function Pager({ page, pageCount, onPage, label }: Props) {
  if (pageCount <= 1) return null;
  return (
    <nav className={styles.pager} aria-label={label}>
      <button type="button" className={styles.button} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ‹ Anterior
      </button>
      <span className={styles.status}>
        Página {page} de {pageCount}
      </span>
      <button type="button" className={styles.button} disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
        Siguiente ›
      </button>
    </nav>
  );
}
