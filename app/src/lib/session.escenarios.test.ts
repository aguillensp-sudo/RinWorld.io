import { describe, expect, it, vi } from 'vitest';

/**
 * ESCENARIOS · billing-subscription/trial-period
 *
 * Escrito desde la spec: una organización recién aprobada (en periodo de prueba,
 * 90 días) da a sus usuarios acceso completo y NO les presenta ningún
 * requerimiento de pago ni bloqueo.
 *
 * Alcance honesto del unit: la puerta de entrada de la app para un miembro es la
 * carga de su perfil (`loadProfile`) y la regla de revocación (`isRevoked`). Se
 * comprueba que, para un miembro ACTIVE de una organización APPROVED recién
 * aprobada, esa puerta lo deja pasar (estado `authenticated`, sin cierre de
 * sesión) y que no consulta ninguna tabla de cobro. "Todas las funcionalidades"
 * y el cálculo del estado EN PRUEBA son de la base y de e2e, no de este nivel.
 */

const tablasConsultadas: string[] = [];

vi.mock('./supabase', () => ({
  supabase: {
    from: (tabla: string) => {
      tablasConsultadas.push(tabla);
      const api: Record<string, unknown> = {
        select: () => api,
        eq: () => api,
        maybeSingle: () =>
          Promise.resolve({
            data: {
              id: 'm1',
              email: 'alta@nueva-org.test',
              full_name: 'Admin Recién Aprobada',
              role: 'ADMIN',
              state: 'ACTIVE',
              org_id: 'o1',
              organizations: { name: 'Nueva Org SL', country: 'ES' },
            },
            error: null,
          }),
      };
      return api;
    },
    auth: { signOut: vi.fn(), getSession: vi.fn(), onAuthStateChange: vi.fn() },
  },
}));

const { loadProfile, isRevoked } = await import('./session');

describe('billing-subscription/trial-period', () => {
  it('billing-subscription/trial-period#1 · acceso pleno durante el periodo de prueba', async () => {
    // GIVEN una organización recién aprobada y un usuario ACTIVE de ella
    // WHEN accede a la plataforma
    const estado = await loadProfile('m1', 'alta@nueva-org.test');

    // THEN entra: perfil cargado, sin bloqueo
    expect(estado.status).toBe('authenticated');
    if (estado.status !== 'authenticated') throw new Error('no autenticado');
    expect(estado.profile.state).toBe('ACTIVE');
    expect(isRevoked(estado.profile.state)).toBe(false);
    expect(estado.profile.orgName).toBe('Nueva Org SL');

    // AND no se le presenta requerimiento de pago: la puerta de entrada no
    // consulta ninguna tabla de cobro
    expect(tablasConsultadas.length).toBeGreaterThan(0);
    for (const t of tablasConsultadas) expect(t).not.toMatch(/billing|payment|subscription/i);
  });
});
