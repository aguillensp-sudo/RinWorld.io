import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BatchResult } from '../../lib/batch';
import type { SearchResultRow } from '../../lib/search';
import type { MemberProfile } from '../../lib/session';

/**
 * CONTRATO DE ACEPTACIÓN · SRCH-02 · pantalla (`BatchSearch`).
 *
 * Escrito antes que el código y por Claude Code. El Coder no lo ve. Se mockean
 * **solo** `fetchBatchResults` (`lib/batch`) y `toggleFavorite` (`lib/search`); el
 * resto -parseo, contador, cabeceras, metabarra, CSV, tabla- es el de verdad.
 *
 * ⚠ Lo que este fichero NO puede cazar, y por eso existe `app/e2e/batch-search.spec.ts`:
 * que cada referencia se busque de verdad contra el inventario ajeno (con los tres
 * filtros silenciosos de `fetchResults`) y que la RLS oculte lo que debe.
 */

const fetchBatchResults = vi.fn<(refs: string[], ctx: { orgId: string; memberId: string }) => Promise<BatchResult[]>>();
const toggleFavorite = vi.fn<(memberId: string, orgId: string, next: boolean) => Promise<void>>();

vi.mock('../../lib/batch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/batch')>()),
  fetchBatchResults: (r: string[], c: { orgId: string; memberId: string }) => fetchBatchResults(r, c),
}));
vi.mock('../../lib/search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/search')>()),
  toggleFavorite: (m: string, o: string, n: boolean) => toggleFavorite(m, o, n),
}));

const { BatchSearch } = await import('./BatchSearch');
const { buildSummaryCsv } = await import('../../lib/batch');

const NOW = new Date('2026-09-24T12:00:00Z');
const profile = { id: 'm-1', orgId: 'org-me' } as unknown as MemberProfile;

function fila(over: Partial<SearchResultRow>): SearchResultRow {
  return {
    id: 'l1',
    partNumber: '6205-2RS',
    brand: 'NSK',
    quantity: 1200,
    leadTimeDays: 5,
    orgId: 'o1',
    orgName: 'Schaeffler Iberia SL',
    country: 'DE',
    lastUploadAt: '2026-09-23T12:00:00Z',
    favoriteCount: 3,
    isFavorite: false,
    consulted: false,
    ...over,
  };
}

const conStock = (reference: string, rows: SearchResultRow[]): BatchResult => ({
  reference,
  page: { rows, total: rows.length, capped: false },
  error: null,
});

/** Spec §3, «Datos de ejemplo»: cinco referencias, cuatro con stock, una sin resultados. */
function ejemplo(): BatchResult[] {
  return [
    conStock('6205-2RS', [
      fila({ id: 'a', partNumber: '6205-2RS', quantity: 1200, orgId: 'o1', orgName: 'Schaeffler Iberia SL', country: 'DE' }),
      fila({ id: 'b', partNumber: '6205-2RS/C3', quantity: 300, orgId: 'o2', orgName: 'Nordwälz Lager', brand: 'FAG', country: 'ES' }),
    ]),
    conStock('NU2210-E-TVP2', [fila({ id: 'c', partNumber: 'NU2210-E-TVP2', quantity: 450, brand: 'FAG', country: 'ES', orgId: 'o3', orgName: 'Cuscinetti Padana' })]),
    conStock('22316-E', [fila({ id: 'd', partNumber: '22316-E', quantity: 75, brand: 'FAG', country: 'ES', orgId: 'o3', orgName: 'Cuscinetti Padana' })]),
    { reference: '6308-ZZ', page: { rows: [], total: 0, capped: false }, error: null },
    conStock('7210-BECBP', [fila({ id: 'e', partNumber: '7210-BECBP', quantity: 45, brand: 'SKF', country: 'ES', orgId: 'o4', orgName: 'Roulements Rhône' })]),
  ];
}

const LISTA = '6205-2RS\nNU2210-E-TVP2\n22316-E\n6308-ZZ\n7210-BECBP';

beforeEach(() => {
  fetchBatchResults.mockReset().mockResolvedValue(ejemplo());
  toggleFavorite.mockReset().mockResolvedValue();
});
afterEach(() => vi.restoreAllMocks());

function montar() {
  render(<BatchSearch profile={profile} now={NOW} />);
}
const area = () => screen.getByLabelText('Lista de referencias');
const pegar = (texto: string) => fireEvent.change(area(), { target: { value: texto } });

async function buscar(texto = LISTA) {
  montar();
  pegar(texto);
  await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  await screen.findByRole('list', { name: 'Resultados por referencia' });
}

describe('BatchSearch · entrada', () => {
  it('eyebrow, título y subtítulo literales de la spec §3', () => {
    montar();
    expect(screen.getByText('Módulo 03 · Búsqueda Conversacional')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Búsqueda por lotes' })).toBeInTheDocument();
    expect(
      screen.getByText('Consulta hasta 50 referencias a la vez. Pega la lista desde tu ERP, Excel o cualquier formato de texto.'),
    ).toBeInTheDocument();
  });

  it('textarea con su etiqueta, su placeholder y su hint', () => {
    montar();
    expect(area().tagName).toBe('TEXTAREA');
    expect(area()).toHaveAttribute(
      'placeholder',
      'Pega aquí tu lista de referencias — una por línea, separadas por comas o tabulaciones',
    );
    expect(screen.getByText('Máx 50 referencias por tanda')).toBeInTheDocument();
  });

  it('el contador cuenta referencias, no líneas: tolera comas, tabulaciones y duplicados', () => {
    montar();
    expect(screen.getByTestId('reference-counter')).toHaveTextContent('0 / 50 referencias');
    pegar('A1, B2\tC3\nA1\n\n');
    expect(screen.getByTestId('reference-counter')).toHaveTextContent('3 / 50 referencias');
  });

  it('Buscar está deshabilitado sin referencias y habilitado con ellas', () => {
    montar();
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled();
    pegar('   \n , ');
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled();
    pegar('6205-2RS');
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled();
  });

  it('sin resultados todavía no hay metabarra ni tarjetas', () => {
    montar();
    expect(screen.queryByRole('list', { name: 'Resultados por referencia' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Exportar resumen' })).not.toBeInTheDocument();
  });
});

describe('BatchSearch · buscar', () => {
  it('llama a fetchBatchResults con las referencias parseadas y la organización y el miembro', async () => {
    await buscar('6205-2RS, 6308-ZZ\t22316-E');
    expect(fetchBatchResults).toHaveBeenCalledTimes(1);
    expect(fetchBatchResults).toHaveBeenCalledWith(['6205-2RS', '6308-ZZ', '22316-E'], { orgId: 'org-me', memberId: 'm-1' });
  });

  it('mientras busca hay un role=status «Buscando...» y aria-busy en la zona de resultados', async () => {
    let resolver: (v: BatchResult[]) => void = () => {};
    fetchBatchResults.mockReturnValue(new Promise((r) => (resolver = r)));
    montar();
    pegar(LISTA);
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Buscando...');
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled();
    resolver(ejemplo());
    await screen.findByRole('list', { name: 'Resultados por referencia' });
    expect(screen.queryByText('Buscando...')).not.toBeInTheDocument();
  });

  it('si toda la búsqueda falla, role=alert con el mensaje y sin tarjetas', async () => {
    fetchBatchResults.mockRejectedValue(new Error('sin red'));
    montar();
    pegar(LISTA);
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('sin red');
    expect(screen.queryByRole('list', { name: 'Resultados por referencia' })).not.toBeInTheDocument();
  });
});

describe('BatchSearch · resultados (spec §3)', () => {
  it('metabarra: «5 referencias · 4 con stock · 1 sin resultados»', async () => {
    await buscar();
    expect(screen.getByText('5 referencias · 4 con stock · 1 sin resultados')).toBeInTheDocument();
  });

  it('una tarjeta por referencia, en el orden de la lista', async () => {
    await buscar();
    const nombres = screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'));
    expect(nombres).toEqual([
      'Referencia 6205-2RS',
      'Referencia NU2210-E-TVP2',
      'Referencia 22316-E',
      'Referencia 6308-ZZ',
      'Referencia 7210-BECBP',
    ]);
  });

  it('la PRIMERA tarjeta está expandida y el resto colapsadas', async () => {
    await buscar();
    expect(screen.getByRole('button', { name: 'Contraer 6205-2RS' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Expandir NU2210-E-TVP2' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('table')).toHaveLength(1);
  });

  it('cada tarjeta se expande y se contrae por su cuenta', async () => {
    await buscar();
    await userEvent.click(screen.getByRole('button', { name: 'Expandir NU2210-E-TVP2' }));
    expect(screen.getAllByRole('table')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Contraer 6205-2RS' }));
    expect(screen.getAllByRole('table')).toHaveLength(1);
  });

  it('las cabeceras de tarjeta son las de la spec', async () => {
    await buscar();
    expect(screen.getByText('Distribuidores: 2 · Máx: 1200 u (NSK, DE)')).toBeInTheDocument();
    expect(screen.getByText('Distribuidores: 1 · Máx: 450 u (FAG, ES)')).toBeInTheDocument();
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });

  it('una referencia fallida no cuenta ni como con stock ni como sin resultados', async () => {
    fetchBatchResults.mockResolvedValue([conStock('A1', [fila({})]), { reference: 'B2', page: null, error: 'boom' }]);
    await buscar('A1\nB2');
    expect(screen.getByText('2 referencias · 1 con stock · 0 sin resultados')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Referencia B2' })).getByRole('alert')).toHaveTextContent('boom');
  });
});

describe('BatchSearch · la tabla de cada tarjeta', () => {
  it('ordenar por cabecera reordena SOLO esa tarjeta', async () => {
    await buscar();
    const antes = screen.getAllByRole('row')[1]!;
    expect(within(antes).getByText('Schaeffler Iberia SL')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('columnheader', { name: /Cantidad/ })).getByRole('button'));
    const despues = screen.getAllByRole('row')[1]!;
    expect(within(despues).getByText('Nordwälz Lager')).toBeInTheDocument();
  });

  it('marcar una fila la deja marcada', async () => {
    await buscar();
    const c = screen.getByRole('checkbox', { name: 'Seleccionar 6205-2RS' });
    expect(c).not.toBeChecked();
    await userEvent.click(c);
    expect(screen.getByRole('checkbox', { name: 'Seleccionar 6205-2RS' })).toBeChecked();
  });

  it('el favorito llama a toggleFavorite(miembro, organización, siguiente) y se refleja en TODAS las tarjetas de esa organización', async () => {
    await buscar();
    await userEvent.click(screen.getByRole('button', { name: 'Expandir NU2210-E-TVP2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Expandir 22316-E' }));
    // `Cuscinetti Padana` (o3) sale en dos tarjetas.
    const botones = screen.getAllByRole('button', { name: 'Marcar favorito de Cuscinetti Padana' });
    expect(botones).toHaveLength(2);
    await userEvent.click(botones[0]!);
    await waitFor(() => expect(toggleFavorite).toHaveBeenCalledWith('m-1', 'o3', true));
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Quitar favorito de Cuscinetti Padana' })).toHaveLength(2));
  });
});

describe('BatchSearch · acciones globales', () => {
  it('Exportar resumen descarga el CSV del resumen con la fecha en el nombre', async () => {
    const urls: Blob[] = [];
    const crear = vi.fn((b: Blob) => (urls.push(b), 'blob:resumen'));
    vi.stubGlobal('URL', { ...URL, createObjectURL: crear, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('resumen-busqueda-por-lotes-2026-09-24.csv');
      expect(this.href).toContain('blob:resumen');
    });
    await buscar();
    await userEvent.click(screen.getByRole('button', { name: 'Exportar resumen' }));
    expect(crear).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(await urls[0]!.text()).toBe(buildSummaryCsv(ejemplo()));
    vi.unstubAllGlobals();
  });

  it('Crear watchers para referencias sin stock está DESHABILITADO y dice por qué', async () => {
    await buscar();
    const b = screen.getByRole('button', { name: 'Crear watchers para referencias sin stock' });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute('title', 'La creación de watchers necesita la confirmación de VERA, que todavía no está conectada.');
  });

  it('el Crear watcher inline de la tarjeta sin resultados también', async () => {
    await buscar();
    expect(screen.getByRole('button', { name: 'Crear watcher — 6308-ZZ' })).toBeDisabled();
  });
});

describe('BatchSearch · más de 50 referencias', () => {
  const sesenta = Array.from({ length: 60 }, (_, i) => `R-${String(i).padStart(2, '0')}`).join('\n');

  it('muestra el aviso brass con el recuento, los dos botones, y deshabilita Buscar', () => {
    montar();
    pegar(sesenta);
    expect(screen.getByTestId('reference-counter')).toHaveTextContent('60 / 50 referencias');
    expect(
      screen.getByText('Tu lista tiene 60 referencias. Procesaremos las primeras 50. ¿Quieres continuar con el resto en una segunda tanda?'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar con las primeras 50' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dividir en tandas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled();
  });

  it('con 50 o menos no hay aviso', () => {
    montar();
    pegar(sesenta.split('\n').slice(0, 50).join('\n'));
    expect(screen.queryByRole('button', { name: 'Continuar con las primeras 50' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled();
  });

  it('Continuar con las primeras 50 busca solo esas 50 y descarta el resto', async () => {
    fetchBatchResults.mockResolvedValue([conStock('R-00', [fila({})])]);
    montar();
    pegar(sesenta);
    await userEvent.click(screen.getByRole('button', { name: 'Continuar con las primeras 50' }));
    await screen.findByRole('list', { name: 'Resultados por referencia' });
    const refs = fetchBatchResults.mock.calls[0]![0];
    expect(refs).toHaveLength(50);
    expect(refs[0]).toBe('R-00');
    expect(refs[49]).toBe('R-49');
    expect(screen.queryByRole('button', { name: 'Procesar la siguiente tanda' })).not.toBeInTheDocument();
  });

  it('Dividir en tandas busca las 50 primeras y ofrece procesar la siguiente tanda con las 10 que quedan', async () => {
    fetchBatchResults.mockResolvedValue([conStock('R-00', [fila({})])]);
    montar();
    pegar(sesenta);
    await userEvent.click(screen.getByRole('button', { name: 'Dividir en tandas' }));
    await screen.findByRole('list', { name: 'Resultados por referencia' });
    expect(fetchBatchResults.mock.calls[0]![0]).toHaveLength(50);
    expect(screen.getByText('Quedan 10 referencias por procesar.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Procesar la siguiente tanda' }));
    await waitFor(() => expect(fetchBatchResults).toHaveBeenCalledTimes(2));
    expect(fetchBatchResults.mock.calls[1]![0]).toEqual(Array.from({ length: 10 }, (_, i) => `R-${50 + i}`));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Procesar la siguiente tanda' })).not.toBeInTheDocument());
  });
});
