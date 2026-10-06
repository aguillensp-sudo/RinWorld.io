import styles from './KeysIntro.module.css';

interface Props {
  /** `Entendido, crear mi frase de seguridad`: el wiring pasa a REG-06. */
  onContinue: () => void;
}

/**
 * MARCADOR de REG-05 · Introducción a las claves E2EE. La tarea del arnés
 * (`harness/tasks/REG-05.json`) sustituye este fichero y su `.module.css`. Existe
 * para que `App.tsx` compile y el e2e tenga una ruta real que visitar antes de la
 * corrida.
 */
export function KeysIntro(_props: Props) {
  return <div className={styles.placeholder} data-testid="reg05-placeholder" />;
}
