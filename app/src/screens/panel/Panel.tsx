import type { MemberProfile } from '../../lib/session';
import styles from './Panel.module.css';

/**
 * ESQUELETO de PANEL-01. Lo rellena el Coder.
 *
 * La firma es la que fija el contrato de aceptación, que el Coder NO ve
 * (`CLAUDE.md` §3): por eso va declarada en `component_api` de la tarea.
 */
export interface PanelProps {
  profile: MemberProfile;
  now?: Date;
  onNavigate: (screen: 'Vendiendo' | 'Comprando' | 'Inventario' | 'Hilos') => void;
}

export function Panel(_props: PanelProps) {
  return <div className={styles.panel} />;
}
