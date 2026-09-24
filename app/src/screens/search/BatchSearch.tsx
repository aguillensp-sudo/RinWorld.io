import type { MemberProfile } from '../../lib/session';

interface Props {
  profile: MemberProfile;
  /** Inyectable para que los tests no dependan del reloj. */
  now?: Date;
}

/**
 * SRCH-02 · Panel Consolidado de Búsqueda por Lotes -- MARCADOR.
 *
 * Solo el hueco con nombre que monta `App.tsx` cuando el miembro pulsa `Búsqueda
 * por lotes` en SRCH-01 (precondición de la tarea, mismo patrón que `Watchers`
 * antes de su corrida). La tarea del arnés sustituye ESTE fichero entero.
 */
export function BatchSearch(_props: Props) {
  return <div data-testid="batch-search" />;
}
