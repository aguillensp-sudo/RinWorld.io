import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { metaCounterLabel, quantityLabel, type SearchPage, type SearchQuery, type SearchResultRow } from '../../lib/search';
import type { MemberProfile } from '../../lib/session';

/**
 * CONTRATO DE ACEPTACIÓN · SRCH-01 · pantalla.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 *
 * Se mockean **solo** las dos funciones que tocan red. La lógica pura de
 * `lib/search` (chips, ordenación, formato) sigue siendo la de verdad: mockearla
 * convertiría esto en una comprobación de los mocks.
 *
 * ⚠ Y por eso mismo estos tests **no pueden ver** que la consulta se traiga el
 * inventario equivocado. SRCH-01 es la única pantalla del MVP que lee catálogo
 * **ajeno**, y una consulta sin `.neq('org_id', …)` me devolvería a mí mismo
 * entre los proveedores con estos tests en verde. Eso lo caza
 * `app/e2e/search.spec.ts` contra la base real.
 */

const fetchResults = vi.fn<(q: SearchQuery) => Promise<SearchPage>>();
const toggleFavorite = vi.fn<(m: string, o: string, n: boolean) => Promise<void>>();
const sendInquiries =
  vi.fn<(lines: { lineId: string; distributorOrgId: string; quantity: number }[], ownOrgId: string) => Promise<
    { lineId: string; distributorOrgId: string; ok: boolean; error?: string }[]
  >>();

vi.mock('../../lib/search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/search')>()),
  fetchResults: (q: SearchQuery) => fetchResults(q),
  toggleFavorite: (m: string, o: string, n: boolean) => toggleFavorite(m, o, n),
}));

vi.mock('../../lib/thread-detail', () => ({
  sendInquiries: (lines: unknown, ownOrgId: unknown) => sendInquiries(lines as never, ownOrgId as string),
}));

const { SearchResults } = await import('./SearchResults');

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

function page(rows: SearchResultRow[], over: Partial<SearchPage> = {}): SearchPage {
  return { rows, total: rows.length, capped: false, ...over };
}

beforeEach(() => {
  fetchResults.mockReset();
  toggleFavorite.mockReset();
  sendInquiries.mockReset();
  fetchResults.mockResolvedValue(page([row()]));
  toggleFavorite.mockResolvedValue();
  sendInquiries.mockImplementation(async (lines) =>
    lines.map((l) => ({ lineId: l.lineId, distributorOrgId: l.distributorOrgId, ok: true })),
  );
});

function pintar() {
  return render(<SearchResults profile={profile} now={NOW} />);
}

const filas = () => screen.getAllByRole('row').slice(1);

// -----------------------------------------------------------------------------

describe('SRCH-01 · cabecera', () => {
  it('lleva el eyebrow y el título de la spec §3', async () => {
    pintar();
    expect(screen.getByText('Módulo 03 · Búsqueda Conversacional')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Resultados de búsqueda' })).toBeInTheDocument(),
    );
  });

  it('el título es el del spec, no el del mock', () => {
    // El HTML aprobado escribe "Mis consultas" en el `page-title`. La spec §3 dice
    // "Resultados de búsqueda", y manda el spec: el mock es un mock (Dia-04 §4).
    pintar();
    expect(screen.queryByText('Mis consultas')).not.toBeInTheDocument();
  });
});

describe('SRCH-01 · carga de datos', () => {
  it('busca con mi organización y mi miembro', async () => {
    pintar();
    await waitFor(() => expect(fetchResults).toHaveBeenCalled());
    expect(fetchResults.mock.calls[0]![0]).toMatchObject({
      orgId: profile.orgId,
      memberId: profile.id,
    });
  });

  it('mientras carga lo dice, y los chips siguen visibles (spec §6)', async () => {
    let resolver: (p: SearchPage) => void = () => {};
    fetchResults.mockReturnValue(new Promise<SearchPage>((r) => (resolver = r)));
    pintar();
    expect(screen.getByRole('button', { name: /filtro/i })).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    resolver(page([row()]));
    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
  });

  it('ante un error de red da el mensaje de la spec §6 y un Reintentar que reintenta', async () => {
    fetchResults.mockRejectedValueOnce(new Error('fetch failed'));
    pintar();
    await waitFor(() =>
      expect(
        screen.getByText('No se pudieron cargar los resultados. Inténtalo de nuevo.'),
      ).toBeInTheDocument(),
    );
    fetchResults.mockResolvedValue(page([row()]));
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(filas()).toHaveLength(1));
  });

  it('si el resultado viene recortado lo dice en vez de enseñarlo como completo', async () => {
    fetchResults.mockResolvedValue(page([row()], { total: 640, capped: true }));
    pintar();
    await waitFor(() => expect(screen.getByText(/afina/i)).toBeInTheDocument());
  });
});

describe('SRCH-01 · metabarra', () => {
  it('el contador sale de la función de formato', async () => {
    fetchResults.mockResolvedValue(
      page([row({ id: 'a', quantity: 850 }), row({ id: 'b', quantity: 350 })], { total: 2 }),
    );
    pintar();
    await waitFor(() => expect(screen.getByText(metaCounterLabel(2, 2, null))).toBeInTheDocument());
  });

  it('con chip de cantidad mínima cuenta cuántas lo superan', async () => {
    fetchResults.mockResolvedValue(
      page([row({ id: 'a', quantity: 850 }), row({ id: 'b', quantity: 350 })], { total: 2 }),
    );
    pintar();
    await waitFor(() => expect(filas()).toHaveLength(2));

    await userEvent.click(screen.getByRole('button', { name: /filtro/i }));
    await userEvent.selectOptions(screen.getByLabelText('Campo'), 'Qty mín');
    await userEvent.type(screen.getByLabelText('Valor'), '500');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }));

    await waitFor(() => expect(screen.getByText(metaCounterLabel(2, 1, 500))).toBeInTheDocument());
  });

  it('Seleccionar todos marca todo y cambia a Deseleccionar todos', async () => {
    fetchResults.mockResolvedValue(page([row({ id: 'a' }), row({ id: 'b' })], { total: 2 }));
    pintar();
    await waitFor(() => expect(filas()).toHaveLength(2));

    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar todos' }));
    for (const f of filas()) expect(within(f).getByRole('checkbox')).toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: 'Deseleccionar todos' }));
    for (const f of filas()) expect(within(f).getByRole('checkbox')).not.toBeChecked();
  });
});

describe('SRCH-01 · Consultar seleccionados', () => {
  /**
   * ⚠ EL UMBRAL BAJA A **UNO** EL 17-AGO. DECISIÓN DEL PO, `F-100`.
   *
   * Lo que había aquí hasta hoy: `Rinworld_spec_SRCH-01.md` §3 escribe *"se
   * habilita con ≥ 1 checkbox marcado"* y `conversational-search ·
   * results-row-actions` decía *"al menos DOS filas marcadas"*. Mandaba la
   * capability (`CLAUDE.md` §2) y el ≥2 se justificaba además por coherencia:
   * *"con una sola fila marcada ya está el botón `Consultar` de esa fila"*.
   *
   * **Ese botón nunca hizo nada** (`F-100`): `SearchResults` le pasaba una
   * función vacía. La coherencia que sostenía el ≥2 apuntaba a un hueco, así que
   * el ≥2 dejaba «consultar una sola línea» sin ningún camino en toda la
   * aplicación. Apagado el botón de fila, el umbral vuelve al ≥1 de la spec §3.
   *
   * El comentario anterior decía *"si el PO decide ≥ 1, cambia este test y solo
   * este"*. Se cumplió: esto y la línea del `disabled`.
   */
  it('deshabilitado sin selección', async () => {
    pintar();
    await waitFor(() => expect(filas()).toHaveLength(1));
    expect(screen.getByRole('button', { name: 'Consultar seleccionados' })).toBeDisabled();
  });

  it('se habilita con UNA sola fila marcada, que es el caso que F-100 dejaba huérfano', async () => {
    fetchResults.mockResolvedValue(page([row({ id: 'a' }), row({ id: 'b' })], { total: 2 }));
    pintar();
    await waitFor(() => expect(filas()).toHaveLength(2));
    await userEvent.click(within(filas()[0]!).getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Consultar seleccionados' })).toBeEnabled();
  });

  it('sigue habilitado con dos', async () => {
    fetchResults.mockResolvedValue(page([row({ id: 'a' }), row({ id: 'b' })], { total: 2 }));
    pintar();
    await waitFor(() => expect(filas()).toHaveLength(2));
    await userEvent.click(within(filas()[0]!).getByRole('checkbox'));
    await userEvent.click(within(filas()[1]!).getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Consultar seleccionados' })).toBeEnabled();
  });

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
    pintar();
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
    pintar();
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
    pintar();
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
    pintar();
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
    pintar();
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
    pintar();
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
    pintar();
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
    pintar();
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
    pintar();
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
    pintar();
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
    pintar();
    await waitFor(() => expect(filas()).toHaveLength(1));
    await marcar(0);
    await userEvent.click(screen.getByRole('button', { name: 'Consultar seleccionados' }));
    await userEvent.click(within(await formulario()).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(sendInquiries).not.toHaveBeenCalled();
    expect(screen.queryByText(/Consultas enviadas/)).not.toBeInTheDocument();
  });

  it('Escape equivale a Cancelar', async () => {
    pintar();
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
    pintar();
    await waitFor(() => expect(fetchResults).toHaveBeenCalledTimes(1));
    await marcar(0, 1);
    await userEvent.click(screen.getByRole('button', { name: 'Consultar seleccionados' }));
    await enviarConsulta('10');
    await screen.findByText('Consulta 2 de 2');
    await enviarConsulta('20');

    // La relectura es de dónde sale de verdad "ya consultada" (F-023): una marca puesta a mano en
    // cliente sin volver a la base sería la misma clase de fallo silencioso que ya costó en INV-01.
    await waitFor(() => expect(fetchResults).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('heading', { level: 1, name: 'Resultados de búsqueda' })).toBeInTheDocument();
  });

  it('la selección se limpia después de enviar', async () => {
    fetchResults.mockResolvedValue(page([row({ id: 'a' }), row({ id: 'b' })], { total: 2 }));
    pintar();
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
    pintar();
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
    pintar();
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

describe('SRCH-01 · lo que el MVP no tiene', () => {
  it('el watcher se pinta deshabilitado y con el motivo, no funcionando', async () => {
    // SRCH-03 está fuera del alcance (`Plan §9`) y no hay ninguna tabla de
    // watchers en el esquema. El mock lanza un toast que promete "te avisaremos
    // cuando haya stock": es una promesa que el MVP no puede cumplir, y delante
    // del socio engaña más que en el chat porque parece verificable
    // (`CLAUDE.md` §7). Mismo trato que el botón de subida de INV-01 (F-023 e).
    pintar();
    const boton = screen.getByRole('button', { name: /watcher/i });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAccessibleDescription(/./);
  });

  it('no promete un aviso futuro por ninguna vía', async () => {
    pintar();
    await waitFor(() => expect(filas()).toHaveLength(1));
    expect(screen.queryByText(/te avisaremos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/caduca en 30 días/i)).not.toBeInTheDocument();
  });
});

describe('SRCH-01 · chips y consulta', () => {
  it('añadir un chip vuelve a buscar con el criterio nuevo', async () => {
    pintar();
    await waitFor(() => expect(fetchResults).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('button', { name: /filtro/i }));
    await userEvent.selectOptions(screen.getByLabelText('Campo'), 'Marca');
    await userEvent.type(screen.getByLabelText('Valor'), 'FAG');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }));

    await waitFor(() => {
      const ultima = fetchResults.mock.calls.at(-1)![0];
      expect(ultima.criteria.brand).toBe('FAG');
    });
  });

  it('quitar un chip vuelve a buscar sin él', async () => {
    pintar();
    await userEvent.click(screen.getByRole('button', { name: /filtro/i }));
    await userEvent.selectOptions(screen.getByLabelText('Campo'), 'Marca');
    await userEvent.type(screen.getByLabelText('Valor'), 'FAG');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    await waitFor(() => expect(screen.getByText('FAG')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtro Marca' }));
    await waitFor(() => {
      const ultima = fetchResults.mock.calls.at(-1)![0];
      expect(ultima.criteria.brand).toBe('');
    });
  });
});

describe('SRCH-01 · ordenación', () => {
  it('ordena el conjunto entero, no lo que ya está pintado', async () => {
    fetchResults.mockResolvedValue(
      page(
        [
          row({ id: 'a', partNumber: 'ALTA', quantity: 1200 }),
          row({ id: 'b', partNumber: 'BAJA', quantity: 200 }),
        ],
        { total: 2 },
      ),
    );
    pintar();
    // Por defecto, cantidad descendente.
    await waitFor(() => expect(within(filas()[0]!).getByText('ALTA')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Cantidad' }));
    // Primer clic: ascendente.
    expect(within(filas()[0]!).getByText('BAJA')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cantidad' }));
    expect(within(filas()[0]!).getByText('ALTA')).toBeInTheDocument();
  });

  it('ordenar no vuelve a consultar la base', async () => {
    // El conjunto ya está entero en cliente. Una consulta por clic de cabecera
    // sobre una pantalla que promete resultados en menos de 1,5 s es gasto y
    // parpadeo para nada.
    pintar();
    await waitFor(() => expect(fetchResults).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole('button', { name: 'Marca' }));
    expect(fetchResults).toHaveBeenCalledTimes(1);
  });
});

describe('SRCH-01 · favoritos', () => {
  it('marcar avisa a la capa de datos con mi miembro y la distribuidora', async () => {
    fetchResults.mockResolvedValue(page([row({ orgId: 'org-9', isFavorite: false })]));
    pintar();
    await waitFor(() => expect(filas()).toHaveLength(1));

    await userEvent.click(within(filas()[0]!).getByRole('button', { pressed: false }));
    expect(toggleFavorite).toHaveBeenCalledWith(profile.id, 'org-9', true);
  });

  it('desmarcar pasa false, no vuelve a marcar', async () => {
    fetchResults.mockResolvedValue(page([row({ orgId: 'org-9', isFavorite: true })]));
    pintar();
    await waitFor(() => expect(filas()).toHaveLength(1));

    // Aquí la fila llega YA marcada, así que el botón está `pressed: true`.
    await userEvent.click(within(filas()[0]!).getByRole('button', { pressed: true }));
    expect(toggleFavorite).toHaveBeenCalledWith(profile.id, 'org-9', false);
  });

  it('el recuento se relee de la base, no se incrementa a ojo', async () => {
    // `organizations.favorite_count` lo mantiene un trigger y es agregado de toda
    // la plataforma: sumarle uno en cliente enseña un número que puede no ser el
    // que hay. Ver la migración 0006.
    fetchResults.mockResolvedValue(page([row({ orgId: 'org-9', favoriteCount: 12 })]));
    pintar();
    await waitFor(() => expect(fetchResults).toHaveBeenCalledTimes(1));

    fetchResults.mockResolvedValue(page([row({ orgId: 'org-9', favoriteCount: 13, isFavorite: true })]));
    await userEvent.click(within(filas()[0]!).getByRole('button', { pressed: false }));

    await waitFor(() => expect(fetchResults).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(within(filas()[0]!).getByText(quantityLabel(13))).toBeInTheDocument());
  });
});

describe('SRCH-01 · cargas que llegan desordenadas', () => {
  /**
   * Hallado en el e2e de negociación (12-oct-2026): al entrar en `Comprando` y añadir un filtro enseguida
   * hay DOS cargas en vuelo, y si la inicial (sin filtro) llegaba después, pisaba a la del filtro: el chip
   * `Ref 32007` sobre 183 resultados sin filtrar. Solo la última carga lanzada puede escribir.
   */
  it('una respuesta vieja que llega la última no pisa la de los criterios nuevos', async () => {
    const { EMPTY_CRITERIA } = await import('../../lib/search');
    let resolverInicial: (p: SearchPage) => void = () => {};
    fetchResults
      .mockReset()
      .mockReturnValueOnce(new Promise<SearchPage>((r) => (resolverInicial = r)))
      .mockResolvedValueOnce(page([row({ id: 'filtrada', partNumber: '32007' })]));

    const { rerender } = render(<SearchResults profile={profile} now={NOW} />);
    await waitFor(() => expect(fetchResults).toHaveBeenCalledTimes(1));

    // El filtro llega mientras la carga inicial sigue en vuelo.
    rerender(<SearchResults profile={profile} now={NOW} veraCriteria={{ ...EMPTY_CRITERIA, partNumber: '32007' }} />);
    await waitFor(() => expect(filas()).toHaveLength(1));
    expect(within(filas()[0]!).getByText('32007')).toBeInTheDocument();

    // Ahora llega la inicial, con todo el catálogo: no debe tocar nada.
    resolverInicial(page([row({ id: 'a' }), row({ id: 'b' }), row({ id: 'c' })], { total: 3 }));
    await new Promise((r) => setTimeout(r, 30));
    expect(filas()).toHaveLength(1);
    expect(within(filas()[0]!).getByText('32007')).toBeInTheDocument();
  });

  it('un fallo de una carga vieja tampoco pisa los resultados nuevos', async () => {
    const { EMPTY_CRITERIA } = await import('../../lib/search');
    let rechazarInicial: (e: Error) => void = () => {};
    fetchResults
      .mockReset()
      .mockReturnValueOnce(new Promise<SearchPage>((_, rej) => (rechazarInicial = rej)))
      .mockResolvedValueOnce(page([row({ id: 'filtrada' })]));

    const { rerender } = render(<SearchResults profile={profile} now={NOW} />);
    await waitFor(() => expect(fetchResults).toHaveBeenCalledTimes(1));
    rerender(<SearchResults profile={profile} now={NOW} veraCriteria={{ ...EMPTY_CRITERIA, partNumber: '32007' }} />);
    await waitFor(() => expect(filas()).toHaveLength(1));

    rechazarInicial(new Error('red'));
    await new Promise((r) => setTimeout(r, 30));
    expect(filas()).toHaveLength(1);
    expect(screen.queryByText('No se pudieron cargar los resultados. Inténtalo de nuevo.')).not.toBeInTheDocument();
  });
});
