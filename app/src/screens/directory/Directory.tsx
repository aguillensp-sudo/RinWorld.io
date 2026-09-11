import type { MemberProfile } from '../../lib/session';

/**
 * DIR-01 · Directorio de Organizaciones — HUECO CON NOMBRE, NO UNA PANTALLA.
 *
 * Mismo patrón que la rama del Operador en `App.tsx`: "Empresas" necesita un
 * sitio adonde ir para que la app compile y el e2e de `harness/tasks/DIR-01.json`
 * tenga una ruta real que visitar, antes de que exista ni una línea de la
 * pantalla de verdad. Cuando corra la tarea, lo que se sustituye es ESTE
 * FICHERO ENTERO: es uno de sus `outputs`.
 */
export function Directory(_props: { profile: MemberProfile }) {
  return (
    <div
      data-testid="dir01-placeholder"
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
      <p style={{ margin: 0, fontSize: '13px' }}>El Directorio de Organizaciones todavía no está construido.</p>
    </div>
  );
}
