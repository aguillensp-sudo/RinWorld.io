import type { OperatorProfile } from '../../lib/session';

interface Props {
  operator: OperatorProfile;
}

/**
 * ADMIN-02 · Panel de Gestión de Cobros -- MARCADOR.
 *
 * Solo el hueco con nombre que monta `App.tsx` cuando el Operador pulsa `Cobros`
 * (precondición de la tarea, mismo patrón que `ForumThread`/`ForumCategory` antes
 * de su corrida). La tarea del arnés sustituye ESTE fichero entero; ni `App.tsx`
 * ni `OperatorShell` deberían tener que cambiar.
 */
export function AdminBilling(_props: Props) {
  return <div data-testid="admin-billing" />;
}
