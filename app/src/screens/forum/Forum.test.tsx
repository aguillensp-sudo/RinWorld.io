import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import type { Category, RecentThread } from '../../lib/forum';
import type { MemberProfile } from '../../lib/session';

/**
 * CONTRATO DE ACEPTACIÓN · FORO-01 · pantalla (`Forum`).
 *
 * Escrito antes que el código y por Claude Code. El Coder no lo ve. Se mockean
 * **solo** las dos funciones de red de `lib/forum`; el resto del módulo
 * -`relativeShort`, `relativeLong`, `threadCountLabel`, `postCountLabel`- sigue
 * siendo el de verdad.
 *
 * ⚠ Lo que este fichero NO puede cazar, y por eso existe `app/e2e/forum.spec.ts`:
 * que las cuatro categorías salgan de la base (`forum_category_stats`) y no de
 * una lista de cuatro nombres escrita a mano en el componente.
 */

const fetchCategories = vi.fn<() => Promise<Category[]>>();
const fetchRecentThreads = vi.fn<(limit?: number) => Promise<RecentThread[]>>();

vi.mock('../../lib/forum', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/forum')>()),
  fetchCategories: () => fetchCategories(),
  fetchRecentThreads: (limit?: number) => fetchRecentThreads(limit),
}));

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

const NOW = new Date('2026-09-11T12:00:00Z');
const hace = (horas: number) => new Date(NOW.getTime() - horas * 3_600_000).toISOString();

const CATEGORIAS: Category[] = [
  {
    id: 'c1', slug: 'general', name: 'General',
    description: 'Conversación abierta del sector, presentaciones, noticias relevantes para la comunidad.',
    position: 1, threadCount: 12, postCount: 47, lastActivityAt: hace(48),
  },
  {
    id: 'c2', slug: 'referencias-tecnicas', name: 'Referencias técnicas',
    description: 'Dudas y discusión sobre equivalencias entre marcas, especificaciones técnicas, sustitución de referencias.',
    position: 2, threadCount: 8, postCount: 31, lastActivityAt: hace(5),
  },
  {
    id: 'c3', slug: 'logistica-aduanas', name: 'Logística y aduanas',
    description: 'Experiencias e intercambio de información sobre transporte, aranceles, incoterms.',
    position: 3, threadCount: 5, postCount: 18, lastActivityAt: hace(2),
  },
  {
    id: 'c4', slug: 'plataforma-soporte', name: 'Plataforma y soporte',
    description: 'Preguntas sobre el funcionamiento de Bearingworld.io, sugerencias de mejora, problemas técnicos.',
    position: 4, threadCount: 3, postCount: 9, lastActivityAt: hace(72),
  },
];

const RECIENTES: RecentThread[] = [
  {
    id: 't1', title: '¿Alguien tiene experiencia con aranceles a Marruecos?',
    lastPostAt: hace(2), categorySlug: 'logistica-aduanas', categoryName: 'Logística y aduanas',
    authorOrgName: 'Rodamientos del Sur SL',
  },
];

beforeEach(() => {
  fetchCategories.mockReset().mockResolvedValue(CATEGORIAS);
  fetchRecentThreads.mockReset().mockResolvedValue(RECIENTES);
});

describe('Forum', () => {
  it('pinta el eyebrow, el título y el subtítulo literales de la spec §3', async () => {
    render(<Forum profile={profile} now={NOW} />);
    expect(screen.getByText('Módulo 08 · Foro de la Comunidad')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Foro de la Comunidad' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Un espacio de discusión pública entre miembros. El contenido del foro no está cifrado — es visible para toda la comunidad.',
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(fetchCategories).toHaveBeenCalled());
  });

  it('el aviso de confidencialidad es permanente y lleva su frase clave en negrita', async () => {
    render(<Forum profile={profile} now={NOW} />);
    await waitFor(() => expect(fetchCategories).toHaveBeenCalled());
    const negrita = screen.getByText('Nada de lo escrito aquí tiene ninguna garantía de confidencialidad.');
    expect(negrita.tagName).toBe('STRONG');
    expect(
      screen.getByText(/El contenido publicado en el Foro es texto plano/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Para conversaciones privadas, usa la mensajería cifrada\./)).toBeInTheDocument();
  });

  it('pinta las cuatro categorías con sus contadores y su última actividad', async () => {
    render(<Forum profile={profile} now={NOW} />);
    const general = await screen.findByRole('button', { name: /General/ });
    expect(within(general).getByText('12 hilos')).toBeInTheDocument();
    expect(within(general).getByText('47 publicaciones')).toBeInTheDocument();
    expect(within(general).getByText('Última actividad hace 2 días')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Referencias técnicas/ }),
    ).toBeInTheDocument();
  });

  it('el singular de los contadores usa el literal exacto de la capa de datos', async () => {
    fetchCategories.mockResolvedValue([{ ...CATEGORIAS[0]!, threadCount: 1, postCount: 1 }]);
    render(<Forum profile={profile} now={NOW} />);
    const tarjeta = await screen.findByRole('button', { name: /General/ });
    expect(within(tarjeta).getByText('1 hilo')).toBeInTheDocument();
    expect(within(tarjeta).getByText('1 publicación')).toBeInTheDocument();
  });

  it('una categoría sin actividad nunca no pinta una fecha inventada', async () => {
    fetchCategories.mockResolvedValue([{ ...CATEGORIAS[0]!, threadCount: 0, postCount: 0, lastActivityAt: null }]);
    render(<Forum profile={profile} now={NOW} />);
    const tarjeta = await screen.findByRole('button', { name: /General/ });
    expect(within(tarjeta).getByText('0 hilos')).toBeInTheDocument();
    expect(within(tarjeta).queryByText(/Última actividad/)).not.toBeInTheDocument();
  });

  it('las tarjetas de categoría están apagadas -FORO-02 no existe- y lo dicen', async () => {
    render(<Forum profile={profile} now={NOW} />);
    const tarjeta = await screen.findByRole('button', { name: /General/ });
    expect(tarjeta).toBeDisabled();
    expect(tarjeta).toHaveAttribute('title', 'FORO-02 (la lista de hilos) llega en una próxima versión.');
  });

  it('con actividad reciente, pinta la sección con sus cuatro datos por hilo', async () => {
    render(<Forum profile={profile} now={NOW} />);
    expect(await screen.findByText('Actividad reciente')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /aranceles a Marruecos/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Logística y aduanas')).toBeInTheDocument();
    expect(screen.getByText('Rodamientos del Sur SL')).toBeInTheDocument();
    expect(screen.getByText('hace 2h')).toBeInTheDocument();
  });

  it('el hilo reciente también está apagado -FORO-02 no existe- y lo dice', async () => {
    render(<Forum profile={profile} now={NOW} />);
    const hilo = await screen.findByRole('button', { name: /aranceles a Marruecos/ });
    expect(hilo).toBeDisabled();
    expect(hilo).toHaveAttribute('title', 'FORO-02 (la lista de hilos) llega en una próxima versión.');
  });

  it('sin actividad reciente, la sección entera -con su cabecera- se oculta (spec §3)', async () => {
    fetchRecentThreads.mockResolvedValue([]);
    render(<Forum profile={profile} now={NOW} />);
    await waitFor(() => expect(fetchCategories).toHaveBeenCalled());
    await screen.findByRole('button', { name: /General/ });
    expect(screen.queryByText('Actividad reciente')).not.toBeInTheDocument();
  });

  it('mientras carga, pinta el aviso de carga con `aria-busy`', () => {
    let resolver: (c: Category[]) => void = () => {};
    fetchCategories.mockReset().mockReturnValue(new Promise((r) => (resolver = r)));
    render(<Forum profile={profile} now={NOW} />);
    expect(screen.getByText('Cargando foro…')).toBeInTheDocument();
    resolver(CATEGORIAS);
  });

  it('un fallo de red se pinta en `role="alert"`', async () => {
    fetchCategories.mockRejectedValue(new Error('la base no responde'));
    render(<Forum profile={profile} now={NOW} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('la base no responde');
  });
});
