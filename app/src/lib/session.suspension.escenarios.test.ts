import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ESCENARIOS · billing-subscription/automatic-suspension#2 y community-forum/active-account-access#2
 *
 * La puerta de entrada de un miembro es `loadProfile`: si su organización está `SUSPENDED`, el estado
 * es `suspended` y `App` pinta la pantalla de suspensión EN LUGAR del shell (y con él, del foro:
 * `App.suspension.escenarios.test.tsx`). Que su inventario no salga en la búsqueda de otros y que lo
 * publicado en el foro siga visible es de la base: `supabase/tests/09_sin_prueba_sql.sql` §3.
 *
 * Lo que se aserta también es la CONSULTA: sin `status` en el embed de `organizations`, la puerta
 * nunca vería la suspensión y todo saldría `authenticated` sin que nada fallara.
 * Escrito por Claude Code; no es contrato del arnés.
 */

let selects: string[] = [];
let fila: Record<string, unknown> | null = null;

vi.mock('./supabase', () => ({
  supabase: {
    from: () => {
      const api: Record<string, unknown> = {
        select: (cols: string) => {
          selects.push(cols);
          return api;
        },
        eq: () => api,
        maybeSingle: () => Promise.resolve({ data: fila, error: null }),
      };
      return api;
    },
    auth: { signOut: vi.fn(), getSession: vi.fn(), onAuthStateChange: vi.fn() },
  },
}));

const { loadProfile, isOrgSuspended } = await import('./session');

function miembro(state: string, orgStatus: string) {
  return {
    id: 'm1',
    email: 'ana@padana.test',
    full_name: 'Ana',
    role: 'ADMIN',
    state,
    org_id: 'o1',
    organizations: { name: 'Cuscinetti Padana', country: 'IT', status: orgStatus },
  };
}

beforeEach(() => {
  selects = [];
  fila = null;
});

describe('billing-subscription/automatic-suspension', () => {
  it('billing-subscription/automatic-suspension#2 · un miembro de una organización SUSPENDED entra en la pantalla de suspensión, no en el shell', async () => {
    // GIVEN una organización en estado SUSPENDED y un miembro ACTIVE de ella
    fila = miembro('ACTIVE', 'SUSPENDED');
    // WHEN inicia sesión
    const estado = await loadProfile('m1', 'ana@padana.test');
    // THEN su estado es `suspended` (pantalla de suspensión), con su organización para nombrarla
    expect(estado.status).toBe('suspended');
    if (estado.status !== 'suspended') throw new Error('no suspendido');
    expect(estado.profile.orgName).toBe('Cuscinetti Padana');
    // AND la puerta pide el estado de la organización en la misma consulta
    expect(selects.join(' ')).toMatch(/organizations!members_org_id_fkey\([^)]*\bstatus\b/);
  });

  it('control · la misma organización APPROVED deja entrar al shell', async () => {
    fila = miembro('ACTIVE', 'APPROVED');
    expect((await loadProfile('m1', 'ana@padana.test')).status).toBe('authenticated');
  });

  it('un miembro revocado de una suspendida sigue saliendo por la revocación, no por la suspensión', async () => {
    // `useSession` le cierra la sesión con REVOKED_MESSAGE: su caso es personal y manda.
    fila = miembro('CANCELLED', 'SUSPENDED');
    expect((await loadProfile('m1', 'ana@padana.test')).status).toBe('authenticated');
  });

  it('solo SUSPENDED suspende', () => {
    expect(isOrgSuspended('SUSPENDED')).toBe(true);
    for (const s of ['APPROVED', 'PENDING_REVIEW', 'REJECTED', null, undefined]) {
      expect(isOrgSuspended(s)).toBe(false);
    }
  });
});
