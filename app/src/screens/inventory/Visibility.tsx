import type { MemberProfile } from '../../lib/session';

interface Props {
  profile: MemberProfile;
}

/**
 * INV-07 · Configuración de Visibilidad del Inventario -- MARCADOR.
 *
 * Solo el hueco con nombre que monta `App.tsx` cuando el miembro pulsa
 * `Visibilidad` en INV-01 (precondición de la tarea, mismo patrón que `Watchers`
 * antes de su corrida). La tarea del arnés sustituye ESTE fichero entero; ni
 * `App.tsx` ni el shell deberían tener que cambiar.
 */
export function Visibility(_props: Props) {
  return <div data-testid="visibility" />;
}
