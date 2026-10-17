import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { MemberProfile } from '../../lib/session';

/**
 * ESCENARIOS · community-forum/category-structure
 *
 * Escrito desde la spec, no desde la implementación. "Sin despliegue" significa:
 * lo único que cambia entre el antes y el después es una FILA en la tabla de
 * categorías. Por eso aquí NO se mockea `lib/forum`: se mockea solo el cliente de
 * base de datos, con una tabla en memoria, y se deja correr la capa de datos y la
 * pantalla reales. Si la lista de categorías estuviera escrita a mano en el
 * componente o en la consulta, la categoría nueva no saldría y el test falla.
 */

interface CatFila {
  id: string;
  slug: string;
  name: string;
  description: string;
  position: number;
  thread_count: number;
  post_count: number;
  last_activity_at: string | null;
}

const cat = (n: number, slug: string, name: string): CatFila => ({
  id: `c${n}`,
  slug,
  name,
  description: `Descripción de ${name}`,
  position: n,
  thread_count: 0,
  post_count: 0,
  last_activity_at: null,
});

// La "base de datos" del foro. El test la modifica con un INSERT, sin tocar código.
const categorias: CatFila[] = [
  cat(1, 'general', 'General'),
  cat(2, 'referencias-tecnicas', 'Referencias técnicas'),
  cat(3, 'logistica-aduanas', 'Logística y aduanas'),
  cat(4, 'plataforma-soporte', 'Plataforma y soporte'),
];

vi.mock('../../lib/supabase', () => {
  function builder(tabla: string) {
    const api: Record<string, unknown> = {
      select: () => api,
      order: () => api,
      limit: () => api,
      then: (res: (v: unknown) => void) =>
        res({
          data:
            tabla === 'forum_category_stats'
              ? [...categorias].sort((a, b) => a.position - b.position)
              : [],
          error: null,
        }),
    };
    return api;
  }
  return { supabase: { from: (t: string) => builder(t) } };
});

const { Forum } = await import('./Forum');

const profile: MemberProfile = {
  id: 'a1000000-0000-4000-8000-00000000000a',
  email: 'alpha@bearingworld.test',
  fullName: 'Alvaro Alpha',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: 'a1000000-0000-4000-8000-000000000001',
  orgName: 'Rodamientos Ibéricos',
  orgCountry: 'ES',
};

describe('community-forum/category-structure', () => {
  it('community-forum/category-structure#2 · añadir categoría sin despliegue', async () => {
    // GIVEN el equipo de producto que decide añadir una nueva categoría
    // WHEN la crea desde la configuración (aquí: una fila nueva en la tabla)
    categorias.push(cat(5, 'normativa-ce', 'Normativa y certificaciones'));

    // THEN la nueva categoría aparece en FORO-01 (mismo código, sin cambios)
    render(<Forum profile={profile} onOpenCategory={() => {}} />);
    const nueva = await screen.findByRole('button', { name: /Normativa y certificaciones/ });
    expect(nueva).toBeInTheDocument();
    // y las de lanzamiento siguen ahí, no se ha sustituido la lista
    expect(screen.getByRole('button', { name: /General/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Plataforma y soporte/ })).toBeInTheDocument();
  });
});
