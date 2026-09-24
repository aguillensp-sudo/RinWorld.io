import type { MemberProfile } from '../../lib/session';
import type { SearchCriteria } from '../../lib/search';

interface Props {
  profile: MemberProfile;
  /** Inyectable para que los tests no dependan del reloj. */
  now?: Date;
  /** «Ver resultados»: lleva a SRCH-01 con los criterios del watcher precargados. */
  onViewResults: (criteria: SearchCriteria) => void;
}

/**
 * SRCH-03 · Gestión de Watchers -- MARCADOR.
 *
 * Solo el hueco con nombre que monta `App.tsx` cuando el miembro abre `Mis
 * watchers` desde Comprando (precondición de la tarea, mismo patrón que
 * `AdminBilling` antes de su corrida). La tarea del arnés sustituye ESTE fichero
 * entero; ni `App.tsx` ni el shell deberían tener que cambiar.
 */
export function Watchers(_props: Props) {
  return <div data-testid="watchers" />;
}
