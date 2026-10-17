import { describe, expect, it, vi } from 'vitest';

/**
 * PARCIALES · organization-directory/open-public-contact-data#1
 *
 * GIVEN una organización con su inventario en VISIBILIDAD RESTRINGIDA hacia un
 *       miembro concreto (el miembro que consulta está en su lista de exclusión)
 * WHEN ese miembro consulta la ficha pública de la organización
 * THEN ve igualmente email y teléfono de contacto público, sin restricción
 * AND las reglas de exclusión de inventario no afectan a esos datos
 *
 * La base falsa guarda la organización RESTRINGIDA y una exclusión contra el
 * visor. Si `fetchOrganizationProfile` empezara a consultar visibilidad o
 * exclusiones y a ocultar el contacto, el test falla.
 */

const tablasTocadas: string[] = [];
const selects: string[] = [];

const ORG_RESTRINGIDA = {
  id: 'org-restringida',
  name: 'Distribuidora Restringida SL',
  country: 'ES',
  status: 'APPROVED',
  created_at: '2024-02-10T10:00:00Z',
  address: 'Calle Mayor 1',
  city: 'Madrid',
  postal_code: '28001',
  contact_phone: '+34 910 000 000',
  contact_email: 'contacto@restringida.example',
  favorite_count: 4,
  inventory_visibility_mode: 'RESTRINGIDA',
};
const EXCLUSIONES = [{ org_id: 'org-restringida', excluded_org_id: 'org-visor' }];

vi.mock('./supabase', () => {
  function builder(tabla: string) {
    tablasTocadas.push(tabla);
    let fila: Record<string, unknown> | null = tabla === 'organizations' ? { ...ORG_RESTRINGIDA } : null;
    const api: Record<string, unknown> = {
      select: (cols: string) => {
        selects.push(cols);
        return api;
      },
      eq: (col: string, val: unknown) => {
        if (fila && fila[col] !== val) fila = null;
        return api;
      },
      maybeSingle: async () => ({ data: fila, error: null }),
    };
    return api;
  }
  return { supabase: { from: (t: string) => builder(t) } };
});

const { fetchOrganizationProfile } = await import('./organization');

describe('organization-directory (parciales)', () => {
  it('organization-directory/open-public-contact-data#1 · la ficha de una organización con inventario restringido trae email y teléfono sin consultar exclusiones', async () => {
    expect(EXCLUSIONES).toHaveLength(1); // el visor SÍ está excluido del inventario
    const ficha = await fetchOrganizationProfile('org-restringida');

    expect(ficha).not.toBeNull();
    expect(ficha!.email).toBe('contacto@restringida.example');
    expect(ficha!.phone).toBe('+34 910 000 000');
    // las reglas de inventario no intervienen: ni se lee el modo ni otra tabla
    expect(new Set(tablasTocadas)).toEqual(new Set(['organizations']));
    expect(selects.join(',')).not.toMatch(/visib|exclu/i);
  });
});
