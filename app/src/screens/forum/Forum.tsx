import type { MemberProfile } from '../../lib/session';

/**
 * FORO-01 · Foro de la Comunidad — HUECO CON NOMBRE, NO UNA PANTALLA.
 *
 * Mismo patrón que `Directory.tsx` para DIR-01: da a "Foros" un sitio adonde
 * ir para que la app compile y el e2e de `harness/tasks/FORO-01.json` tenga
 * una ruta real que visitar. Los `outputs` de esa tarea sustituyen ESTE
 * FICHERO ENTERO.
 */
export function Forum(_props: { profile: MemberProfile; now?: Date }) {
  return (
    <div
      data-testid="foro01-placeholder"
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
      <p style={{ margin: 0, fontSize: '13px' }}>El Foro de la Comunidad todavía no está construido.</p>
    </div>
  );
}
