import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OffersPage, OffersQuery, PartKeysPage, PartSearchCriteria } from '../../lib/part-search';
import { type SearchResultRow } from '../../lib/search';
import type { MemberProfile } from '../../lib/session';

/**
 * FUERA DE CONTRATO · SRCH-01 · «Consultar» abre un formulario por fila, en cola (F-249, MSG-03 §3.2).
 *
 * Los cuerpos vienen de los tests de `SearchResults.tsx`, retirada el 25-oct-2026 con la búsqueda en dos fases
 * (`amend-srch01-busqueda-en-dos-fases`, tarea 5.3): `PartSearch` copia de ella las acciones de la tabla de ofertas
 * y estos tests las siguen midiendo. Cambia solo la preparación (`pintar` busca y abre la tabla de ofertas) y
 * `fetchResults` es ahora el doble de `fetchOffers`, que es quien lee la tabla. Escrito por Claude Code.
 */

const fetchOffers = vi.fn<(q: OffersQuery) => Promise<OffersPage>>();
const fetchPartKeys = vi.fn<(c: PartSearchCriteria, page?: number) => Promise<PartKeysPage>>();
const toggleFavorite = vi.fn<(m: string, o: string, n: boolean) => Promise<void>>();

vi.mock('../../lib/part-search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/part-search')>()),
  fetchPartKeys: (c: PartSearchCriteria, page?: number) => fetchPartKeys(c, page),
  fetchOffers: (q: OffersQuery) => fetchOffers(q),
}));
vi.mock('../../lib/search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/search')>()),
  toggleFavorite: (m: string, o: string, n: boolean) => toggleFavorite(m, o, n),
}));
const sendInquiries =
  vi.fn<(lines: { lineId: string; distributorOrgId: string; quantity: number }[], ownOrgId: string) => Promise<
    { lineId: string; distributorOrgId: string; ok: boolean; error?: string }[]
  >>();
vi.mock('../../lib/thread-detail', () => ({
  sendInquiries: (lines: unknown, ownOrgId: unknown) => sendInquiries(lines as never, ownOrgId as string),
}));

const { PartSearch } = await import('./PartSearch');

/** Quien lee la tabla de ofertas. Se llama así para que los cuerpos de los tests viejos digan lo mismo que decían. */
const fetchResults = fetchOffers;

const NOW = new Date('2026-08-11T12:00:00Z');
const hace = (dias: number) => new Date(NOW.getTime() - dias * 86_400_000).toISOString();

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

function row(over: Partial<SearchResultRow> = {}): SearchResultRow {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    partNumber: '6205-2RS',
    brand: 'SKF',
    quantity: 850,
    leadTimeDays: 3,
    orgId: 'b2000000-0000-4000-8000-000000000002',
    orgName: 'Nordwälz Lager',
    country: 'DE',
    lastUploadAt: hace(1),
    favoriteCount: 12,
    isFavorite: false,
    consulted: false,
    ...over,
  };
}

function page(rows: SearchResultRow[], over: Partial<OffersPage> = {}): OffersPage {
  return { rows, total: rows.length, page: 1, pageCount: 1, ...over };
}

beforeEach(() => {
  fetchOffers.mockReset();
  fetchPartKeys.mockReset();
  toggleFavorite.mockReset();
  fetchOffers.mockResolvedValue(page([row()]));
  fetchPartKeys.mockResolvedValue({
    keys: [{ key: '62052RS', offers: 1 }],
    totalKeys: 1,
    totalOffers: 1,
    matchedRef: '62052RS',
    truncated: false,
    page: 1,
    pageCount: 1,
  });
  toggleFavorite.mockResolvedValue();
  sendInquiries.mockReset();
  sendInquiries.mockImplementation(async (lines) =>
    lines.map((l) => ({ lineId: l.lineId, distributorOrgId: l.distributorOrgId, ok: true })),
  );
});

/** Monta SRCH-01, busca una referencia y abre la tabla de ofertas de todas sus claves (fases A y C). */
async function pintar() {
  const r = render(<PartSearch profile={profile} now={NOW} />);
  await userEvent.type(screen.getByRole('searchbox', { name: 'Referencia' }), '6205-2RS');
  await userEvent.click(screen.getByRole('button', { name: 'Buscar referencia' }));
  await userEvent.click(await screen.findByRole('button', { name: /Ver ofertas de todas/ }));
  return r;
}

const filas = () => screen.getAllByRole('row').slice(1);

// -----------------------------------------------------------------------------
describe('SRCH-01 · Consultar abre un formulario por fila (F-249)', () => {
  /**
   * F-249 (12-oct-2026, decisión del PO). Antes, `Consultar seleccionados` enviaba directamente por la
   * cantidad publicada y sin abrir ningún formulario (`results-row-actions`, capability cerrada). Ahora
   * sigue `MSG-03` §3.2: UN FORMULARIO POR FILA, EN COLA. La cantidad la teclea el comprador y las
   * notas son opcionales. Estos tests son los de antes, reescritos para eso; lo que cada uno medía
   * (qué se envía, qué se omite y se dice, el resumen literal, el fallo parcial, no navegar, limpiar la
   * selección, no mandar dos tandas) se conserva.
   *
   * GAP-004: el boundary sigue igual —esta pantalla dispara la acción y `sendInquiries` se mockea como
   * `fetchResults`; el cifrado y hallar-o-crear el hilo viven en `thread-detail.test.ts` y
   * `01_schema_smoke.sql`.
   */
  const formulario = () => screen.findByRole('dialog');
  const enviarConsulta = async (cantidad: string, notas?: string) => {
    const dialogo = await formulario();
    await userEvent.type(within(dialogo).getByLabelText(/Cantidad solicitada/i), cantidad);
    if (notas) await userEvent.type(within(dialogo).getByLabelText('Notas adicionales'), notas);
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Enviar consulta' }));
  };
  const marcar = async (...indices: number[]) => {
    for (const i of indices) await userEvent.click(within(filas()[i]!).getByRole('checkbox'));
  };

  it('abre un formulario por fila marcada, en cola, y no envía nada hasta que se rellena', async () => {
    fetchResults.mockResolvedValue(
      page([row({ id: 'a', orgId: 'org-a', partNumber: '6205-2RS' }), row({ id: 'b', orgId: 'org-b', partNumber: '22316-E' })], {
        total: 2,
      }),
    );
    await pintar();
    await waitFor(() => expect(filas()).toHaveLength(2));
    await marcar(0, 1);
    await userEvent.click(screen.getByRole('button', { name: 'Consultar seleccionados' }));

    const primero = await formulario();
    expect(within(primero).getByRole('heading', { level: 2, name: 'Nueva tarjeta de consulta' })).toBeInTheDocument();
    expect(within(primero).getByLabelText(/Referencia/)).toHaveValue('6205-2RS');
    expect(within(primero).getByLabelText(/País del distribuidor/)).toHaveValue('Alemania');
    expect(within(primero).getByText('Consulta 1 de 2')).toBeInTheDocument();
    expect(sendInquiries).not.toHaveBeenCalled();

    await enviarConsulta('100');
    await waitFor(() => expect(sendInquiries).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Consulta 2 de 2')).toBeInTheDocument();
    expect(within(await formulario()).getByLabelText(/Referencia/)).toHaveValue('22316-E');
  });

  it('envía cada fila con la cantidad y las notas que tecleó el comprador, no con el stock publicado', async () => {
    fetchResults.mockResolvedValue(
      page([row({ id: 'a', orgId: 'org-a', quantity: 850 }), row({ id: 'b', orgId: 'org-b', quantity: 350 })], {
        total: 2,
      }),
    );
    await pintar();
    await waitFor(() => expect(filas()).toHaveLength(2));
    await marcar(0, 1);
    await userEvent.click(screen.getByRole('button', { name: 'Consultar seleccionados' }));

    await enviarConsulta('100');
    await waitFor(() => expect(sendInquiries).toHaveBeenCalledTimes(1));
    await screen.findByText('Consulta 2 de 2');
    await enviarConsulta('40', ' Entrega en dos semanas ');
    await waitFor(() => expect(sendInquiries).toHaveBeenCalledTimes(2));

    expect(sendInquiries.mock.calls[0]![0]).toEqual([{ lineId: 'a', distributorOrgId: 'org-a', quantity: 100, notes: null }]);
    expect(sendInquiries.mock.calls[1]![0]).toEqual([
      { lineId: 'b', distributorOrgId: 'org-b', quantity: 40, notes: 'Entrega en dos semanas' },
    ]);
    // Mi propia organización, no la del distribuidor: sin ella, `sendInquiries` no puede envolver la
    // CEK para quien escribe (bug real, cazado en el navegador).
    expect(sendInquiries.mock.calls[0]![1]).toBe(profile.orgId);
    expect(sendInquiries.mock.calls[1]![1]).toBe(profile.orgId);
  });

  it('el «Consultar» de una fila abre solo el formulario de esa fila', async () => {
    fetchResults.mockResolvedValue(page([row({ id: 'a', partNumber: '6205-2RS' }), row({ id: 'b', partNumber: '22316-E' })], { total: 2 }));
    await pintar();
    await waitFor(() => expect(filas()).toHaveLength(2));
    await marcar(1);
    await userEvent.click(within(filas()[1]!).getByRole('button', { name: 'Consultar' }));

    const dialogo = await formulario();
    expect(within(dialogo).getByLabelText(/Referencia/)).toHaveValue('22316-E');
    expect(within(dialogo).queryByText(/Consulta \d de \d/)).not.toBeInTheDocument();
    expect(sendInquiries).not.toHaveBeenCalled();
  });

  it('deja fuera de la cola las filas con consulta pendiente, aunque estén marcadas', async () => {
    // `Seleccionar todos` marca cualquier fila, incluidas las ya consultadas (F-039 lo anota: el botón
    // de la fila las deshabilita, la casilla no). create_inquiry las rechazaría igual.
    fetchResults.mockResolvedValue(
      page(
        [
          row({ id: 'a', orgId: 'org-a', consulted: false }),
          row({ id: 'b', orgId: 'org-b', consulted: true }),
        ],
        { total: 2 },
      ),
    );
    await pintar();
    await waitFor(() => expect(filas()).toHaveLength(2));
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar todos' }));
    await userEvent.click(screen.getByRole('button', { name: 'Consultar seleccionados' }));

    expect(within(await formulario()).queryByText(/Consulta \d de \d/)).not.toBeInTheDocument();
    await enviarConsulta('10');
    await waitFor(() => expect(sendInquiries).toHaveBeenCalledTimes(1));
    expect(sendInquiries.mock.calls[0]![0]).toEqual([{ lineId: 'a', distributorOrgId: 'org-a', quantity: 10, notes: null }]);
  });

  it('y AVISA de cuántas dejó fuera: la selección mixta no se calla (F-087)', async () => {
    fetchResults.mockResolvedValue(
      page(
        [
          row({ id: 'a', orgId: 'org-a', consulted: false }),
          row({ id: 'b', orgId: 'org-b', consulted: true }),
          row({ id: 'c', orgId: 'org-c', consulted: true }),
        ],
        { total: 3 },
      ),
    );
    await pintar();
    await waitFor(() => expect(filas()).toHaveLength(3));
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar todos' }));
    await userEvent.click(screen.getByRole('button', { name: 'Consultar seleccionados' }));
    await enviarConsulta('10');

    expect(
      await screen.findByText(/2 filas de la selección ya estaban consultadas y no se han vuelto a enviar\./),
    ).toBeInTheDocument();
  });

  it('si TODO lo marcado ya tenía una consulta pendiente, no abre ningún formulario ni llama a sendInquiries y lo dice', async () => {
    fetchResults.mockResolvedValue(
      page([row({ id: 'a', consulted: true }), row({ id: 'b', consulted: true })], { total: 2 }),
    );
    await pintar();
    await waitFor(() => expect(filas()).toHaveLength(2));
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar todos' }));
    await userEvent.click(screen.getByRole('button', { name: 'Consultar seleccionados' }));

    expect(sendInquiries).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText(/ya estaban consultadas/i)).toBeInTheDocument();
  });

  it('el mensaje de éxito es el literal de la spec, con el recuento de DISTRIBUIDORES', async () => {
    fetchResults.mockResolvedValue(
      page([row({ id: 'a', orgId: 'org-mismo' }), row({ id: 'b', orgId: 'org-mismo' })], { total: 2 }),
    );
    await pintar();
    await waitFor(() => expect(filas()).toHaveLength(2));
    await marcar(0, 1);
    await userEvent.click(screen.getByRole('button', { name: 'Consultar seleccionados' }));
    await enviarConsulta('10');
    await screen.findByText('Consulta 2 de 2');
    await enviarConsulta('20');

    // Dos LÍNEAS del mismo distribuidor cuentan como UN distribuidor.
    expect(
      await screen.findByText('Consultas enviadas a 1 distribuidor. Las respuestas llegarán a tu bandeja de Hilos.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('un fallo se dice en el propio formulario y no se esconde detrás de un éxito', async () => {
    fetchResults.mockResolvedValue(
      page([row({ id: 'a', orgId: 'org-a' }), row({ id: 'b', orgId: 'org-b' })], { total: 2 }),
    );
    sendInquiries.mockImplementation(async (lines) =>
      lines.map((l) =>
        l.lineId === 'b'
          ? { lineId: l.lineId, distributorOrgId: l.distributorOrgId, ok: false, error: 'Límite diario alcanzado' }
          : { lineId: l.lineId, distributorOrgId: l.distributorOrgId, ok: true },
      ),
    );
    await pintar();
    await waitFor(() => expect(filas()).toHaveLength(2));
    await marcar(0, 1);
    await userEvent.click(screen.getByRole('button', { name: 'Consultar seleccionados' }));
    await enviarConsulta('10');
    await screen.findByText('Consulta 2 de 2');
    await enviarConsulta('20');

    // Fallo: el formulario sigue abierto con el motivo y el comprador conserva lo que tecleó.
    const dialogo = await formulario();
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Límite diario alcanzado');
    expect(within(dialogo).getByLabelText(/Cantidad solicitada/i)).toHaveValue(20);

    // Si cancela, el fallo consta en el resumen junto al éxito de la primera.
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText(/Consultas enviadas a 1 distribuidor/)).toBeInTheDocument();
    expect(screen.getByText(/Límite diario alcanzado/)).toBeInTheDocument();
  });

  it('si el servidor dice que ya hay una consulta pendiente, el formulario enseña el aviso de la spec y no deja reenviar', async () => {
    sendInquiries.mockResolvedValue([
      {
        lineId: '10000000-0000-4000-8000-000000000001',
        distributorOrgId: 'b2000000-0000-4000-8000-000000000002',
        ok: false,
        error: 'Ya tienes una consulta pendiente para esta referencia con este distribuidor.',
      },
    ]);
    await pintar();
    await waitFor(() => expect(filas()).toHaveLength(1));
    await marcar(0);
    await userEvent.click(within(filas()[0]!).getByRole('button', { name: 'Consultar' }));
    await enviarConsulta('10');

    const dialogo = await formulario();
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
      'Ya tienes una consulta pendiente para esta referencia con este distribuidor.',
    );
    expect(within(dialogo).getAllByRole('alert')).toHaveLength(1);
    expect(within(dialogo).getByRole('button', { name: 'Enviar consulta' })).toBeDisabled();
  });

  it('Cancelar descarta SOLO esa fila y sigue con la siguiente; lo no preguntado no consta', async () => {
    fetchResults.mockResolvedValue(
      page([row({ id: 'a', orgId: 'org-a' }), row({ id: 'b', orgId: 'org-b' })], { total: 2 }),
    );
    await pintar();
    await waitFor(() => expect(filas()).toHaveLength(2));
    await marcar(0, 1);
    await userEvent.click(screen.getByRole('button', { name: 'Consultar seleccionados' }));

    await userEvent.click(within(await formulario()).getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Consulta 2 de 2')).toBeInTheDocument();
    await enviarConsulta('7');

    await waitFor(() => expect(sendInquiries).toHaveBeenCalledTimes(1));
    expect(sendInquiries.mock.calls[0]![0]).toEqual([{ lineId: 'b', distributorOrgId: 'org-b', quantity: 7, notes: null }]);
  });

  it('cancelar todos los formularios no envía nada ni deja ningún aviso', async () => {
    await pintar();
    await waitFor(() => expect(filas()).toHaveLength(1));
    await marcar(0);
    await userEvent.click(screen.getByRole('button', { name: 'Consultar seleccionados' }));
    await userEvent.click(within(await formulario()).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(sendInquiries).not.toHaveBeenCalled();
    expect(screen.queryByText(/Consultas enviadas/)).not.toBeInTheDocument();
  });

  it('Escape equivale a Cancelar', async () => {
    await pintar();
    await waitFor(() => expect(filas()).toHaveLength(1));
    await marcar(0);
    await userEvent.click(screen.getByRole('button', { name: 'Consultar seleccionados' }));
    await formulario();
    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(sendInquiries).not.toHaveBeenCalled();
  });

  it('el usuario permanece en SRCH-01: al terminar vuelve a leer la tabla, no navega a ningún sitio', async () => {
    fetchResults.mockResolvedValue(page([row({ id: 'a' }), row({ id: 'b' })], { total: 2 }));
    await pintar();
    await waitFor(() => expect(fetchResults).toHaveBeenCalledTimes(1));
    await marcar(0, 1);
    await userEvent.click(screen.getByRole('button', { name: 'Consultar seleccionados' }));
    await enviarConsulta('10');
    await screen.findByText('Consulta 2 de 2');
    await enviarConsulta('20');

    // La relectura es de dónde sale de verdad "ya consultada" (F-023): una marca puesta a mano en
    // cliente sin volver a la base sería la misma clase de fallo silencioso que ya costó en INV-01.
    await waitFor(() => expect(fetchResults).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('heading', { level: 1, name: 'Búsqueda de referencias' })).toBeInTheDocument();
  });

  it('la selección se limpia después de enviar', async () => {
    fetchResults.mockResolvedValue(page([row({ id: 'a' }), row({ id: 'b' })], { total: 2 }));
    await pintar();
    await waitFor(() => expect(filas()).toHaveLength(2));
    await marcar(0, 1);
    await userEvent.click(screen.getByRole('button', { name: 'Consultar seleccionados' }));
    await enviarConsulta('10');
    await screen.findByText('Consulta 2 de 2');
    await enviarConsulta('20');

    await waitFor(() => expect(sendInquiries).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      for (const f of filas()) expect(within(f).getByRole('checkbox')).not.toBeChecked();
    });
  });

  it('una fila cancelada se queda marcada: solo se deselecciona lo enviado', async () => {
    fetchResults.mockResolvedValue(page([row({ id: 'a' }), row({ id: 'b' })], { total: 2 }));
    await pintar();
    await waitFor(() => expect(filas()).toHaveLength(2));
    await marcar(0, 1);
    await userEvent.click(screen.getByRole('button', { name: 'Consultar seleccionados' }));
    await userEvent.click(within(await formulario()).getByRole('button', { name: 'Cancelar' }));
    await screen.findByText('Consulta 2 de 2');
    await enviarConsulta('20');

    await waitFor(() => expect(sendInquiries).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(filas()[1]!).getByRole('checkbox')).not.toBeChecked());
    expect(within(filas()[0]!).getByRole('checkbox')).toBeChecked();
  });

  it('con la cola abierta el botón de lote está bloqueado y un envío en curso no admite un segundo', async () => {
    let resolver: (v: { lineId: string; distributorOrgId: string; ok: boolean }[]) => void = () => {};
    sendInquiries.mockReturnValue(new Promise((r) => (resolver = r)));
    fetchResults.mockResolvedValue(page([row({ id: 'a' }), row({ id: 'b' })], { total: 2 }));
    await pintar();
    await waitFor(() => expect(filas()).toHaveLength(2));
    await marcar(0, 1);

    const boton = screen.getByRole('button', { name: 'Consultar seleccionados' });
    await userEvent.click(boton);
    expect(boton).toBeDisabled();
    await userEvent.click(boton);

    await enviarConsulta('10');
    const dialogo = await formulario();
    expect(within(dialogo).getByRole('button', { name: /Enviando/ })).toBeDisabled();
    expect(sendInquiries).toHaveBeenCalledTimes(1);
    resolver([]);
  });
});
