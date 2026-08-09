import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ThreadPage, ThreadQuery, ThreadSummary } from '../../lib/threads';
import type { MemberProfile } from '../../lib/session';

/**
 * CONTRATO DE ACEPTACIÓN · MSG-01 · pantalla.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 *
 * Se mockea **solo** la función que toca red. La lógica pura de `lib/threads`
 * (vista previa, tono del badge, tiempo relativo, paginación) sigue siendo la de
 * verdad: mockearla convertiría esto en una comprobación de los mocks.
 *
 * ⚠ Y por eso mismo estos tests **no pueden ver** un fallo de RLS o un embed mal
 * escrito. `threads` tiene tres claves ajenas hacia `organizations`, así que un
 * embed sin nombrar devuelve `PGRST201` y la pantalla se queda en blanco — con
 * estos 20 tests en verde. Eso lo caza `app/e2e/messages.spec.ts` contra la base
 * real, y es la lección de F-020 y del aviso de RLS de INV-01.
 */

const fetchThreadPage = vi.fn<(q: ThreadQuery) => Promise<ThreadPage>>();

vi.mock('../../lib/threads', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/threads')>()),
  fetchThreadPage: (q: ThreadQuery) => fetchThreadPage(q),
}));

const { Messages } = await import('./Messages');

const NOW = new Date('2026-08-08T12:00:00Z');

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

function thread(over: Partial<ThreadSummary> = {}): ThreadSummary {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    counterpartyName: 'Nordwälz Lager',
    counterpartyCountry: 'DE',
    state: 'CON OFERTA PENDIENTE',
    lastItemAt: new Date(NOW.getTime() - 2 * 3600_000).toISOString(),
    lastItem: { type: 'OFERTA', partNumber: '6205-2RS' },
    ...over,
  };
}

function page(threads: ThreadSummary[], total = threads.length): ThreadPage {
  return { threads, total };
}

beforeEach(() => {
  fetchThreadPage.mockReset();
  fetchThreadPage.mockResolvedValue(page([thread()]));
});

function pintar() {
  return render(<Messages profile={profile} now={NOW} />);
}

describe('MSG-01 · pantalla', () => {
  describe('cabecera', () => {
    it('lleva el eyebrow, el título y el subtítulo de la spec §3', async () => {
      pintar();
      expect(screen.getByText('Módulo 04 · Mensajería E2EE')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Hilos' })).toBeInTheDocument();
      expect(
        screen.getByText(
          'Tus conversaciones con otros distribuidores. Todo el contenido está cifrado de extremo a extremo.',
        ),
      ).toBeInTheDocument();
      await waitFor(() => expect(fetchThreadPage).toHaveBeenCalled());
    });
  });

  describe('carga', () => {
    it('pide los hilos de mi organización', async () => {
      pintar();
      await waitFor(() =>
        expect(fetchThreadPage).toHaveBeenCalledWith(
          expect.objectContaining({ orgId: profile.orgId, page: 1 }),
        ),
      );
    });

    it('pinta lo que devuelve la consulta', async () => {
      fetchThreadPage.mockResolvedValue(
        page([thread(), thread({ id: 'b', counterpartyName: 'Cuscinetti Padana' })]),
      );
      pintar();
      await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    });

    it('si la consulta falla lo dice, y no se queda en blanco', async () => {
      // F-020: `useSession` hacía `e instanceof Error ? … : String(e)` y un error
      // de PostgREST es un objeto plano, así que la pantalla enseñaba
      // `[object Object]` en rojo mientras el PGRST201 explicaba el fallo entero.
      fetchThreadPage.mockRejectedValue({ code: 'PGRST201', message: 'more than one relationship' });
      pintar();
      const aviso = await screen.findByRole('alert');
      expect(aviso).toBeInTheDocument();
      expect(aviso.textContent).not.toContain('[object Object]');
      expect(aviso.textContent).toMatch(/PGRST201|more than one relationship/);
    });

    it('sin hilos enseña el estado vacío y no una lista vacía', async () => {
      fetchThreadPage.mockResolvedValue(page([]));
      pintar();
      expect(await screen.findByText(/Todavía no tienes ninguna conversación/)).toBeInTheDocument();
    });
  });

  describe('barra de acciones', () => {
    it('busca por nombre de organización al pulsar Enter', async () => {
      pintar();
      await waitFor(() => expect(fetchThreadPage).toHaveBeenCalledTimes(1));

      const input = screen.getByPlaceholderText('Buscar por nombre de organización...');
      await userEvent.type(input, 'Nordwälz{Enter}');

      await waitFor(() =>
        expect(fetchThreadPage).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: 'Nordwälz', page: 1 }),
        ),
      );
    });

    it('la búsqueda vuelve a la página 1', async () => {
      // Buscar desde la página 3 y quedarse en la 3 devuelve una página vacía
      // sobre resultados que sí existen: vacío falso, indistinguible del cierto.
      fetchThreadPage.mockResolvedValue(page([thread()], 90));
      pintar();
      await waitFor(() => expect(fetchThreadPage).toHaveBeenCalled());

      await userEvent.click(screen.getByRole('button', { name: '3' }));
      await waitFor(() =>
        expect(fetchThreadPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 })),
      );

      await userEvent.type(
        screen.getByPlaceholderText('Buscar por nombre de organización...'),
        'Padana{Enter}',
      );
      await waitFor(() =>
        expect(fetchThreadPage).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: 'Padana', page: 1 }),
        ),
      );
    });

    it('"Nuevo contacto" está deshabilitado y dice por qué', async () => {
      // DIR-01 no está entre las 8 pantallas del alcance (Plan §9). Mismo trato
      // que el botón de subida de INV-01: se queda en su sitio para no dejar la
      // barra a medias, deshabilitado y con el motivo también en texto, que un
      // `title` no lo lee un lector de pantalla (F-023 e).
      pintar();
      const boton = screen.getByRole('button', { name: /Nuevo contacto/ });
      expect(boton).toBeDisabled();
      expect(screen.getByTestId('directorio-scope').textContent).toMatch(/fuera del MVP/i);
    });
  });

  describe('paginación', () => {
    it('con 30 hilos o menos no se pinta', async () => {
      fetchThreadPage.mockResolvedValue(page([thread()], 30));
      pintar();
      await waitFor(() => expect(screen.getByRole('listitem')).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
    });

    it('con más de 30 sí, y cambiar de página vuelve a preguntar', async () => {
      fetchThreadPage.mockResolvedValue(page([thread()], 31));
      pintar();
      await waitFor(() => expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument());

      await userEvent.click(screen.getByRole('button', { name: '2' }));
      await waitFor(() =>
        expect(fetchThreadPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })),
      );
    });

    it('el recuento se formatea con Intl, no a mano', async () => {
      // F-024: el pie de INV-01 en el mock decía "1.247" y el español correcto es
      // "1247" — el CLDR de `es` no agrupa cuatro cifras. Se compara contra la
      // función de formato, nunca contra la cifra del mock.
      fetchThreadPage.mockResolvedValue(page([thread()], 1247));
      pintar();
      const info = await screen.findByTestId('pag-info');
      expect(info.textContent).toContain((1247).toLocaleString('es-ES'));
    });
  });

  describe('frontera E2EE', () => {
    it('no enseña ninguna cifra de la negociación', async () => {
      // Precio, cantidad y plazo viven en `content_ciphertext`. MSG-01 no los
      // descifra: si aparecieran, la frontera estaría rota en la pantalla de
      // entrada a la mensajería.
      fetchThreadPage.mockResolvedValue(page([thread()]));
      pintar();
      const fila = await screen.findByRole('listitem');
      expect(within(fila).getByText('Tarjeta de oferta · 6205-2RS')).toBeInTheDocument();
      expect(within(fila).queryByText(/€|EUR|unidades/)).not.toBeInTheDocument();
    });

    it('no pinta datos de ejemplo del HTML aprobado', async () => {
      // Las cinco organizaciones del bloque "Datos de ejemplo" de la spec §3 no
      // existen en la base: son fabricantes, no distribuidoras del catálogo. Si
      // salen, la pantalla está pintando el mock en vez de la consulta.
      pintar();
      await waitFor(() => expect(screen.getByRole('listitem')).toBeInTheDocument());
      for (const inventada of [
        'NSK Europe Ltd',
        'Schaeffler Iberia SL',
        'SKF Nordic AB',
        'Timken Europe GmbH',
        'NTN-SNR Roulements',
      ]) {
        expect(screen.queryByText(inventada)).not.toBeInTheDocument();
      }
    });
  });
});
