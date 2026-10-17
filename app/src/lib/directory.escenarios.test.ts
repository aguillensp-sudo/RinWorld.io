import { describe, expect, it, vi } from 'vitest';

/**
 * ESCENARIOS · organization-directory/directory-table
 *
 * Escrito desde la spec (`openspec/specs/organization-directory/spec.md`), no
 * desde la implementación. La spec nombra el estado "ACTIVE"; el esquema lo llama
 * `APPROVED` (CHECK `organizations_status_chk`, 0001). El test siembra una tabla
 * con los cuatro estados y deja que la consulta decida qué filas salen: la base
 * falsa APLICA los `.eq()` que reciba, así que quitar el filtro de estado en
 * `fetchOrganizations` hace salir las filas SUSPENDED / PENDING_REVIEW y el test
 * falla.
 */

interface OrgFila {
  id: string;
  name: string;
  country: string;
  status: string;
  contact_phone: string | null;
  contact_email: string | null;
  favorite_count: number | null;
}

const org = (id: string, name: string, status: string): OrgFila => ({
  id,
  name,
  country: 'ES',
  status,
  contact_phone: null,
  contact_email: null,
  favorite_count: 0,
});

const TABLA: OrgFila[] = [
  org('o1', 'Activa Uno SL', 'APPROVED'),
  org('o2', 'Suspendida SA', 'SUSPENDED'),
  org('o3', 'Pendiente de Revision SL', 'PENDING_REVIEW'),
  org('o4', 'Activa Dos SL', 'APPROVED'),
  org('o5', 'Rechazada SL', 'REJECTED'),
];

vi.mock('./supabase', () => {
  function builder(tabla: string) {
    let filas: Record<string, unknown>[] = tabla === 'organizations' ? ([...TABLA] as unknown as Record<string, unknown>[]) : [];
    const api: Record<string, unknown> = {
      select: () => api,
      eq: (col: string, val: unknown) => {
        filas = filas.filter((f) => f[col] === val);
        return api;
      },
      ilike: (col: string, patron: string) => {
        const needle = patron.replace(/%/g, '').toLowerCase();
        filas = filas.filter((f) => String(f[col]).toLowerCase().includes(needle));
        return api;
      },
      order: () => api,
      range: () => api,
      then: (res: (v: unknown) => void) => res({ data: filas, error: null, count: filas.length }),
    };
    return api;
  }
  return { supabase: { from: (t: string) => builder(t) } };
});

const { fetchOrganizations, DEFAULT_SORT, EMPTY_FILTERS } = await import('./directory');

describe('organization-directory/directory-table', () => {
  it('organization-directory/directory-table#2 · organizaciones no ACTIVE excluidas', async () => {
    // GIVEN organizaciones en estado SUSPENDED o PENDING_REVIEW (y una aprobada de control)
    // WHEN se carga la tabla del directorio
    const pagina = await fetchOrganizations({ filters: EMPTY_FILTERS, sort: DEFAULT_SORT, page: 1 });

    // THEN ninguna de ellas aparece como fila
    const nombres = pagina.rows.map((r) => r.name);
    expect(nombres).not.toContain('Suspendida SA');
    expect(nombres).not.toContain('Pendiente de Revision SL');
    expect(nombres).not.toContain('Rechazada SL');
    // y las activas sí están: el filtro no vacía la tabla
    expect(nombres.sort()).toEqual(['Activa Dos SL', 'Activa Uno SL']);
    expect(pagina.total).toBe(2);
  });
});
