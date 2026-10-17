import { describe, expect, it, vi } from 'vitest';

/**
 * PARCIALES · organization-directory (directory-filtering#1, directory-sorting#1/#2)
 *
 * Escrito desde la spec (`openspec/specs/organization-directory/spec.md`), no
 * desde la implementación. La base falsa APLICA de verdad los `.eq()`, el
 * `.ilike()` y los `.order()` que reciba: si `fetchOrganizations` deja de
 * combinar filtros o de pasar el orden, las filas que salen cambian y el test
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

const org = (id: string, name: string, country: string, favs: number, status = 'APPROVED'): OrgFila => ({
  id,
  name,
  country,
  status,
  contact_phone: null,
  contact_email: null,
  favorite_count: favs,
});

// Desordenadas a propósito: el orden de inserción NO es el alfabético.
const TABLA: OrgFila[] = [
  org('o1', 'Zeta Rodamientos', 'ES', 3),
  org('o2', 'Alfa Rodamientos', 'ES', 9),
  org('o3', 'Rodamientos Norte', 'DE', 1),
  org('o4', 'Beta Cojinetes', 'ES', 5),
  org('o5', 'Rodamientos Sur Suspendida', 'ES', 7, 'SUSPENDED'),
  org('o6', 'Rodamientos Pendiente', 'ES', 2, 'PENDING_REVIEW'),
  org('o7', 'Gamma Rodamientos', 'FR', 4),
];

vi.mock('./supabase', () => {
  function builder(tabla: string) {
    let filas: Record<string, unknown>[] =
      tabla === 'organizations' ? ([...TABLA] as unknown as Record<string, unknown>[]) : [];
    const orders: { col: string; asc: boolean }[] = [];
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
      order: (col: string, opts?: { ascending?: boolean }) => {
        orders.push({ col, asc: opts?.ascending !== false });
        return api;
      },
      range: () => api,
      then: (res: (v: unknown) => void) => {
        const ordenadas = [...filas].sort((a, b) => {
          for (const { col, asc } of orders) {
            const x = a[col] as string | number;
            const y = b[col] as string | number;
            const c =
              typeof x === 'number' && typeof y === 'number'
                ? x - y
                : String(x).localeCompare(String(y), 'es-ES');
            if (c !== 0) return asc ? c : -c;
          }
          return 0;
        });
        res({ data: ordenadas, error: null, count: ordenadas.length });
      },
    };
    return api;
  }
  return { supabase: { from: (t: string) => builder(t) } };
});

const { fetchOrganizations, DEFAULT_SORT, EMPTY_FILTERS, nextSort } = await import('./directory');

describe('organization-directory (parciales)', () => {
  it('organization-directory/directory-filtering#1 · solo salen las ACTIVE que cumplen país Y nombre a la vez', async () => {
    // GIVEN un filtro de país (ES) y, a la vez, texto en el buscador de nombre ("rodamientos")
    // WHEN ambos filtros están activos
    const pagina = await fetchOrganizations({
      filters: { country: 'ES', name: 'rodamientos' },
      sort: DEFAULT_SORT,
      page: 1,
    });

    // THEN la tabla muestra únicamente las ACTIVE que cumplen ambos criterios:
    //  - 'Rodamientos Norte' (DE) cumple el nombre pero no el país
    //  - 'Beta Cojinetes' (ES) cumple el país pero no el nombre
    //  - 'Gamma Rodamientos' (FR) cumple el nombre pero no el país
    //  - la suspendida y la pendiente cumplen ambos pero no están activas
    expect(pagina.rows.map((r) => r.name)).toEqual(['Alfa Rodamientos', 'Zeta Rodamientos']);
    expect(pagina.total).toBe(2);
    expect(pagina.rows.every((r) => r.country === 'ES')).toBe(true);
  });

  it('organization-directory/directory-sorting#1 · sin tocar el orden, las filas salen alfabéticas por nombre', async () => {
    // GIVEN el directorio cargado sin que el usuario haya modificado el orden
    // WHEN se visualiza la tabla
    const pagina = await fetchOrganizations({ filters: EMPTY_FILTERS, sort: DEFAULT_SORT, page: 1 });

    // THEN las organizaciones aparecen ordenadas alfabéticamente por nombre (solo las activas)
    expect(pagina.rows.map((r) => r.name)).toEqual([
      'Alfa Rodamientos',
      'Beta Cojinetes',
      'Gamma Rodamientos',
      'Rodamientos Norte',
      'Zeta Rodamientos',
    ]);
  });

  it('organization-directory/directory-sorting#2 · pulsar Favoritos reordena por esa columna y volver a pulsar invierte', async () => {
    // GIVEN un miembro que pulsa el header de la columna Favoritos
    const primera = nextSort(DEFAULT_SORT, 'favorite_count');
    // WHEN se aplica el nuevo criterio de orden
    const asc = await fetchOrganizations({ filters: EMPTY_FILTERS, sort: primera, page: 1 });

    // THEN la tabla se reordena por esa columna
    expect(asc.rows.map((r) => r.favoriteCount)).toEqual([1, 3, 4, 5, 9]);
    expect(asc.rows[0]?.name).toBe('Rodamientos Norte');

    // AND el usuario puede volver a pulsar para invertir el sentido
    const segunda = nextSort(primera, 'favorite_count');
    const desc = await fetchOrganizations({ filters: EMPTY_FILTERS, sort: segunda, page: 1 });
    expect(desc.rows.map((r) => r.favoriteCount)).toEqual([9, 5, 4, 3, 1]);
  });
});
