import type { OperatorProfile } from '../../lib/session';

/**
 * ADMIN-01 · Cola de Solicitudes de Registro — HUECO CON NOMBRE, NO UNA PANTALLA.
 *
 * Mismo patrón que `Directory.tsx` para DIR-01: da a `OperatorShell` un
 * `<main>` real con el que compilar antes de que exista una línea de la
 * pantalla de verdad. Los `outputs` de `harness/tasks/ADMIN-01.json` sustituyen
 * ESTE FICHERO ENTERO.
 */
export function AdminRequests(_props: { operator: OperatorProfile }) {
  return (
    <div
      data-testid="admin01-placeholder"
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '32px',
        textAlign: 'center',
      }}
    >
      <p style={{ margin: 0, fontSize: '13px' }}>La cola de solicitudes todavía no está construida.</p>
    </div>
  );
}
