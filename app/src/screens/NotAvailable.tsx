import styles from './NotAvailable.module.css';

interface Props {
  /** El nombre del ítem de menú que se ha pulsado (`Contacto`, `Sistema`…). */
  section: string;
}

/**
 * Un ítem del menú aprobado que todavía no tiene pantalla. Antes caía en otra
 * (`Contacto` pintaba el Panel; `Panel`, `Organizaciones`, `Log de auditoría` y `Sistema`
 * del Operador pintaban la cola de solicitudes): un enlace que miente sobre dónde estás.
 * Ahora lo dice con el nombre del ítem y no lleva a ninguna parte.
 */
export function NotAvailable({ section }: Props) {
  return (
    <div className={styles.page} data-testid="not-available">
      <div className={styles.eyebrow}>Sección</div>
      <h1 className={styles.title}>{section}</h1>
      <p className={styles.card}>Esta sección todavía no está disponible.</p>
    </div>
  );
}
