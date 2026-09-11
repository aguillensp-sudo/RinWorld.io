import { describe, expect, it } from 'vitest';
import {
  postCountLabel,
  RECENT_LIMIT,
  relativeLong,
  relativeShort,
  threadCountLabel,
  toCategory,
  toRecentThread,
  type CategoryRaw,
} from './forum';

/**
 * La lógica pura de FORO-01. Sin base y sin React.
 *
 * Esta capa la escribe Claude Code, no el Coder (`CLAUDE.md` §3), así que estos
 * tests **no son el contrato del arnés**: son los míos.
 */

const AHORA = new Date('2026-09-11T12:00:00Z');
const hace = (ms: number) => new Date(AHORA.getTime() - ms).toISOString();
const HORA = 3_600_000;
const DIA = 24 * HORA;

function categoria(over: Partial<CategoryRaw> = {}): CategoryRaw {
  return {
    id: '33330000-0000-4000-8000-000000000001',
    slug: 'general',
    name: 'General',
    description: 'Conversación abierta del sector.',
    position: 1,
    thread_count: 12,
    post_count: 47,
    last_activity_at: hace(2 * DIA),
    ...over,
  };
}

describe('tiempo relativo, en sus dos formatos', () => {
  it('el compacto es el de la lista de recientes', () => {
    expect(relativeShort(hace(2 * HORA), AHORA)).toBe('hace 2h');
    expect(relativeShort(hace(5 * HORA), AHORA)).toBe('hace 5h');
    expect(relativeShort(hace(3 * DIA), AHORA)).toBe('hace 3 días');
  });

  it('y el largo es el de la tarjeta', () => {
    expect(relativeLong(hace(2 * HORA), AHORA)).toBe('hace 2 horas');
    expect(relativeLong(hace(5 * HORA), AHORA)).toBe('hace 5 horas');
    expect(relativeLong(hace(2 * DIA), AHORA)).toBe('hace 2 días');
  });

  it('⚠ los dos formatos existen a propósito y NO se unifican', () => {
    // Salen los dos del bloque de datos de ejemplo de la misma spec: los hilos
    // recientes en compacto y la última actividad de la tarjeta en largo. Si
    // alguien los unifica "por coherencia", una de las dos secciones deja de
    // parecerse a su diseño aprobado.
    const mismoInstante = hace(5 * HORA);
    expect(relativeShort(mismoInstante, AHORA)).toBe('hace 5h');
    expect(relativeLong(mismoInstante, AHORA)).toBe('hace 5 horas');
  });

  it('el singular no dice "1 días"', () => {
    expect(relativeShort(hace(DIA), AHORA)).toBe('hace 1 día');
    expect(relativeLong(hace(DIA), AHORA)).toBe('hace 1 día');
    expect(relativeLong(hace(HORA), AHORA)).toBe('hace 1 hora');
  });

  it('por debajo de una hora cada formato dice lo suyo', () => {
    expect(relativeShort(hace(10 * 60_000), AHORA)).toBe('hace un momento');
    expect(relativeLong(hace(10 * 60_000), AHORA)).toBe('hace 10 minutos');
    expect(relativeLong(hace(60_000), AHORA)).toBe('hace 1 minuto');
  });

  it('y una fecha ilegible o futura no saca un número negativo', () => {
    expect(relativeShort('no es una fecha', AHORA)).toBe('hace un momento');
    const futuro = new Date(AHORA.getTime() + DIA).toISOString();
    expect(relativeLong(futuro, AHORA)).toBe('hace 1 minuto');
  });
});

describe('los contadores de la tarjeta', () => {
  it('se leen como los escribe la spec', () => {
    expect(threadCountLabel(12)).toBe('12 hilos');
    expect(postCountLabel(47)).toBe('47 publicaciones');
  });

  it('una categoría recién abierta cuenta cero, no se calla', () => {
    expect(threadCountLabel(0)).toBe('0 hilos');
    expect(postCountLabel(0)).toBe('0 publicaciones');
  });

  it('y el singular lleva su tilde', () => {
    expect(threadCountLabel(1)).toBe('1 hilo');
    expect(postCountLabel(1)).toBe('1 publicación');
  });
});

describe('el mapeo de la categoría', () => {
  it('trae lo que pinta la tarjeta', () => {
    const c = toCategory(categoria());
    expect(c.slug).toBe('general');
    expect(c.threadCount).toBe(12);
    expect(c.postCount).toBe(47);
    expect(c.lastActivityAt).toBe(hace(2 * DIA));
  });

  it('una categoría vacía cuenta cero y no trae fecha', () => {
    // La vista hace `left join`, así que una categoría sin hilos devuelve
    // contadores a cero y `last_activity_at` a null. La tarjeta sigue en la
    // rejilla: el día del lanzamiento las cuatro están así.
    const c = toCategory(categoria({ thread_count: 0, post_count: 0, last_activity_at: null }));
    expect(c.threadCount).toBe(0);
    expect(c.postCount).toBe(0);
    expect(c.lastActivityAt).toBeNull();
  });

  it('los contadores llegan como número aunque PostgREST los mande como texto', () => {
    // `count()` en Postgres es `bigint`, y un `bigint` no cabe en un `number` de
    // JavaScript, así que PostgREST lo puede serializar como cadena. Sin el
    // `Number()`, `47` se compararía con `'47'` y el `+` concatenaría.
    const c = toCategory(categoria({ thread_count: '8' as unknown as number }));
    expect(c.threadCount).toBe(8);
    expect(typeof c.threadCount).toBe('number');
  });
});

describe('los hilos recientes', () => {
  it('son cinco por defecto', () => {
    expect(RECENT_LIMIT).toBe(5);
  });

  it('traen categoría y organización autora, que es lo que pinta la fila', () => {
    const t = toRecentThread({
      id: '22220000-0000-4000-8000-000000000001',
      title: '¿Alguien tiene experiencia con aranceles a Marruecos?',
      last_post_at: hace(2 * HORA),
      forum_categories: { slug: 'logistica-y-aduanas', name: 'Logística y aduanas' },
      organizations: { name: 'Rodamientos Ibéricos' },
    });
    expect(t.categoryName).toBe('Logística y aduanas');
    expect(t.authorOrgName).toBe('Rodamientos Ibéricos');
  });

  it('y un embed que no vino no rompe la fila', () => {
    // PostgREST devuelve `null` en el embed si la RLS de la tabla enlazada no
    // deja ver la fila. Preferimos una fila con un hueco a una pantalla en
    // blanco por un `undefined.name`.
    const t = toRecentThread({
      id: '22220000-0000-4000-8000-000000000002',
      title: 'Hilo sin embeds',
      last_post_at: hace(HORA),
      forum_categories: null,
      organizations: null,
    });
    expect(t.categoryName).toBe('');
    expect(t.authorOrgName).toBe('');
  });
});
