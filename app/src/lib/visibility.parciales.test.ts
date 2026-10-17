import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PARCIALES · inventory-management/visibility-control (#2 y #3), capa de datos del cliente.
 *
 * #2 GIVEN un miembro en INV-07 que selecciona un continente para excluir
 *    WHEN confirma la exclusión
 *    THEN la exclusión del continente queda registrada (todas sus organizaciones)
 *    AND el miembro puede refinar a un país concreto dentro del continente
 *
 * #3 GIVEN un miembro que cambia el modo de RESTRINGIDA a VISIBLE_TODOS
 *    WHEN confirma el cambio
 *    THEN la lista de exclusión queda inactiva pero no se borra
 *    AND si reactiva el modo restringido, la lista previa se recupera
 */

const insert = vi.fn();
const tablasTocadas: string[] = [];
let modo = 'RESTRINGIDA';
const EXCLUSIONES = [
  { id: 'e1', excluded_org_id: null, excluded_country: null, excluded_continent: 'AS', organizations: null },
  { id: 'e2', excluded_org_id: null, excluded_country: 'RU', excluded_continent: null, organizations: null },
];

vi.mock('./supabase', () => ({
  supabase: {
    from: (tabla: string) => {
      tablasTocadas.push(tabla);
      const api: Record<string, unknown> = {
        insert: (row: unknown) => {
          insert(tabla, row);
          return Promise.resolve({ error: null });
        },
        update: (v: { inventory_visibility_mode: string }) => {
          modo = v.inventory_visibility_mode;
          return api;
        },
        select: () => api,
        eq: () => api,
        order: () => Promise.resolve({ data: EXCLUSIONES, error: null }),
        maybeSingle: () => Promise.resolve({ data: { inventory_visibility_mode: modo }, error: null }),
        then: (res: (v: unknown) => void) => res({ data: [{ inventory_visibility_mode: modo }], error: null }),
      };
      return api;
    },
  },
}));

const { addExclusion, fetchContinentCountries, fetchVisibility, saveVisibilityMode } = await import('./visibility');

beforeEach(() => {
  insert.mockReset();
  tablasTocadas.length = 0;
  modo = 'RESTRINGIDA';
});

describe('inventory-management/visibility-control (parciales)', () => {
  it('inventory-management/visibility-control#2 · excluir un continente registra la regla de continente, y se puede refinar a un país de ese continente', async () => {
    await addExclusion('org-me', { continent: 'AS' });
    expect(insert).toHaveBeenLastCalledWith('inventory_exclusions', { owner_org_id: 'org-me', excluded_continent: 'AS' });

    // refinar a un país concreto del mismo continente: la regla es de país, no de continente
    const paises = await fetchContinentCountries('AS');
    expect(paises.map((p) => p.code)).toContain('JP');
    await addExclusion('org-me', { country: 'jp' });
    expect(insert).toHaveBeenLastCalledWith('inventory_exclusions', { owner_org_id: 'org-me', excluded_country: 'JP' });
  });

  it('inventory-management/visibility-control#3 · cambiar a VISIBLE_TODOS solo toca el modo, y al volver a RESTRINGIDA la lista previa sigue entera', async () => {
    const antes = await fetchVisibility('org-me');
    expect(antes.mode).toBe('RESTRINGIDA');
    expect(antes.exclusions).toHaveLength(2);

    tablasTocadas.length = 0;
    await saveVisibilityMode('org-me', 'VISIBLE_TODOS');
    // THEN no se borra nada de la lista: la única tabla tocada es organizations
    expect(new Set(tablasTocadas)).toEqual(new Set(['organizations']));

    // con el modo abierto la lista se sigue leyendo entera (inactiva, no borrada)
    const abierto = await fetchVisibility('org-me');
    expect(abierto.mode).toBe('VISIBLE_TODOS');
    expect(abierto.exclusions.map((e) => e.id)).toEqual(['e1', 'e2']);

    // AND al reactivar el modo restringido, la lista previa se recupera idéntica
    await saveVisibilityMode('org-me', 'RESTRINGIDA');
    const vuelta = await fetchVisibility('org-me');
    expect(vuelta.mode).toBe('RESTRINGIDA');
    expect(vuelta.exclusions).toEqual(antes.exclusions);
  });
});
