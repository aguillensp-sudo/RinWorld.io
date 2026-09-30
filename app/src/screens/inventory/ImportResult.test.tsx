import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  buildErrorsCsv,
  IMPORT_EXAMPLES,
  type ImportErrorRow,
  type ImportSampleLine,
  type ImportSummary,
} from '../../lib/import-result';

/**
 * CONTRATO DE ACEPTACIÓN · INV-03 · pantalla (`ImportResult`).
 *
 * Escrito antes que el código y por Claude Code. El Coder no lo ve. Se mockea **solo**
 * `downloadCsv` (lo único de `lib/import-result` que toca el navegador); el resto -el
 * resultado, los títulos, el formato de cifras, el CSV- sigue siendo el de verdad, así que
 * la pantalla que lo reimplemente por su cuenta acaba comparando contra la capa de datos.
 *
 * La pantalla es de solo lectura y no toca red (spec §4): por eso no hay mock de Supabase.
 */

const downloadCsv = vi.fn<(filename: string, text: string) => void>();

vi.mock('../../lib/import-result', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/import-result')>()),
  downloadCsv: (f: string, t: string) => downloadCsv(f, t),
}));

const { ImportResult } = await import('./ImportResult');

const NOW = new Date(2026, 8, 30, 12, 0);

const onBack = vi.fn();
const onUploadCorrections = vi.fn();

beforeEach(() => {
  downloadCsv.mockReset();
  onBack.mockReset();
  onUploadCorrections.mockReset();
});

function montar(summary: ImportSummary) {
  return render(
    <ImportResult summary={summary} onBackToInventory={onBack} onUploadCorrections={onUploadCorrections} now={NOW} />,
  );
}

const WARN = IMPORT_EXAMPLES.warn;
const OK = IMPORT_EXAMPLES.ok;
const FAIL = IMPORT_EXAMPLES.fail;

function lines(n: number): ImportSampleLine[] {
  return Array.from({ length: n }, (_, i) => ({
    partNumber: `REF-${i + 1}`,
    brand: 'SKF',
    quantity: i + 1,
    country: 'ES',
    status: 'PUBLISHED',
  }));
}

describe('INV-03 · cabecera', () => {
  it('eyebrow, título y subtítulo de las advertencias', () => {
    montar(WARN);
    expect(screen.getByText('Módulo 02 · Gestión de Inventario')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Importación completada con advertencias' })).toBeInTheDocument();
    expect(
      screen.getByText('Tu inventario ha sido actualizado. Revisa las líneas que no pudieron importarse y corrígelas.'),
    ).toBeInTheDocument();
  });

  it('éxito: título sin advertencias y el subtítulo cuenta las líneas publicadas', () => {
    montar(OK);
    expect(screen.getByRole('heading', { level: 1, name: 'Importación completada' })).toBeInTheDocument();
    expect(screen.getByText('1.247 líneas publicadas correctamente. No se han detectado errores.')).toBeInTheDocument();
  });

  it('fallo total: título y subtítulo propios', () => {
    montar(FAIL);
    expect(screen.getByRole('heading', { level: 1, name: 'La importación no ha podido completarse' })).toBeInTheDocument();
    expect(
      screen.getByText('El sistema no ha podido procesar el archivo. Ninguna línea ha sido publicada.'),
    ).toBeInTheDocument();
  });

  it('la raíz declara el resultado en data-outcome (ok · warn · fail)', () => {
    const { unmount } = montar(WARN);
    expect(screen.getByTestId('import-result')).toHaveAttribute('data-outcome', 'warn');
    unmount();
    const ok = montar(OK);
    expect(screen.getByTestId('import-result')).toHaveAttribute('data-outcome', 'ok');
    ok.unmount();
    montar(FAIL);
    expect(screen.getByTestId('import-result')).toHaveAttribute('data-outcome', 'fail');
  });

  it('no pinta los botones «Demo:» del HTML aprobado, que son andamio del prototipo', () => {
    montar(WARN);
    expect(screen.queryByText('Demo:')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Con advertencias' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sin errores' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fallo total' })).not.toBeInTheDocument();
  });
});

describe('INV-03 · cifras (spec §3)', () => {
  it('cinco tarjetas con etiqueta, valor y subtítulo, con punto de millares', () => {
    montar(WARN);
    const proc = screen.getByTestId('stat-processed');
    expect(within(proc).getByText('Procesadas')).toBeInTheDocument();
    expect(within(proc).getByText('1.247')).toBeInTheDocument();
    expect(within(proc).getByText('líneas totales')).toBeInTheDocument();

    const pub = screen.getByTestId('stat-published');
    expect(within(pub).getByText('Publicadas')).toBeInTheDocument();
    expect(within(pub).getByText('1.213')).toBeInTheDocument();
    expect(within(pub).getByText('importadas OK')).toBeInTheDocument();

    const failed = screen.getByTestId('stat-failed');
    expect(within(failed).getByText('Con error')).toBeInTheDocument();
    expect(within(failed).getByText('34')).toBeInTheDocument();
    expect(within(failed).getByText('no importadas')).toBeInTheDocument();

    const removed = screen.getByTestId('stat-removed');
    expect(within(removed).getByText('Eliminadas')).toBeInTheDocument();
    expect(within(removed).getByText('127')).toBeInTheDocument();
    expect(within(removed).getByText('reemplazo total')).toBeInTheDocument();

    const time = screen.getByTestId('stat-time');
    expect(within(time).getByText('Tiempo')).toBeInTheDocument();
    expect(within(time).getByText('4,2 s')).toBeInTheDocument();
    expect(within(time).getByText('procesamiento')).toBeInTheDocument();
  });

  it('el tono de cada valor: publicadas en verde, con error en rojo, eliminadas en naranja', () => {
    montar(WARN);
    expect(within(screen.getByTestId('stat-published')).getByText('1.213')).toHaveAttribute('data-tone', 'ok');
    expect(within(screen.getByTestId('stat-failed')).getByText('34')).toHaveAttribute('data-tone', 'err');
    expect(within(screen.getByTestId('stat-removed')).getByText('127')).toHaveAttribute('data-tone', 'warn');
    expect(within(screen.getByTestId('stat-processed')).getByText('1.247')).not.toHaveAttribute('data-tone');
    expect(within(screen.getByTestId('stat-time')).getByText('4,2 s')).not.toHaveAttribute('data-tone');
  });

  it('sin errores, «Con error» vale 0 y NO va en rojo', () => {
    montar(OK);
    const failed = screen.getByTestId('stat-failed');
    expect(within(failed).getByText('0')).not.toHaveAttribute('data-tone');
    expect(within(screen.getByTestId('stat-published')).getByText('1.247')).toHaveAttribute('data-tone', 'ok');
  });

  it('en modo acumulativo (removed = null) no hay tarjeta «Eliminadas» (spec §7)', () => {
    montar({ ...WARN, removed: null });
    expect(screen.queryByTestId('stat-removed')).not.toBeInTheDocument();
    expect(screen.queryByText('Eliminadas')).not.toBeInTheDocument();
    expect(screen.getByTestId('stat-failed')).toBeInTheDocument();
  });

  it('con removed = 0 la tarjeta SÍ está: 0 eliminadas no es «no aplica»', () => {
    montar({ ...WARN, removed: 0 });
    expect(within(screen.getByTestId('stat-removed')).getByText('0')).toBeInTheDocument();
  });

  it('fallo total: sin «Con error» ni «Eliminadas», procesadas y publicadas a 0 y tiempo con guion', () => {
    montar(FAIL);
    expect(screen.queryByTestId('stat-failed')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stat-removed')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('stat-processed')).getByText('0')).toBeInTheDocument();
    expect(within(screen.getByTestId('stat-published')).getByText('0')).toBeInTheDocument();
    expect(within(screen.getByTestId('stat-time')).getByText('—')).toBeInTheDocument();
  });
});

describe('INV-03 · muestra de líneas importadas (spec §3 y §7)', () => {
  it('título de sección, etiqueta explícita y tabla con sus cinco columnas', () => {
    montar(WARN);
    expect(screen.getByRole('heading', { level: 2, name: 'Muestra de líneas importadas' })).toBeInTheDocument();
    expect(
      screen.getByText('Mostrando las primeras 10 líneas importadas como muestra — el inventario completo ya está publicado.'),
    ).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Líneas importadas (muestra)' });
    for (const col of ['Referencia', 'Marca', 'Cantidad', 'País', 'Estado']) {
      expect(within(table).getByRole('columnheader', { name: col })).toBeInTheDocument();
    }
  });

  it('SIEMPRE 10 filas de datos aunque lleguen 50', () => {
    montar({ ...WARN, sample: lines(50) });
    const table = screen.getByRole('table', { name: 'Líneas importadas (muestra)' });
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    expect(within(table).getByText('REF-10')).toBeInTheDocument();
    expect(within(table).queryByText('REF-11')).not.toBeInTheDocument();
  });

  it('primera fila: referencia, marca, cantidad, país y estado tal cual llegan', () => {
    montar(WARN);
    const table = screen.getByRole('table', { name: 'Líneas importadas (muestra)' });
    const first = within(table).getAllByRole('row')[1]!;
    const cells = within(first).getAllByRole('cell');
    expect(cells.map((c) => c.textContent)).toEqual(['6205-2RS/C3', 'SKF', '850', 'ES', 'PUBLISHED']);
  });

  it('la cantidad lleva punto de millares', () => {
    montar({ ...WARN, sample: [{ partNumber: 'X-1', brand: 'FAG', quantity: 1200, country: 'DE', status: 'PUBLISHED' }] });
    const table = screen.getByRole('table', { name: 'Líneas importadas (muestra)' });
    expect(within(table).getByText('1.200')).toBeInTheDocument();
  });

  it('con menos de 10 líneas la etiqueta cuenta las que hay, no dice «las primeras 10»', () => {
    montar({ ...WARN, sample: lines(3) });
    expect(screen.getByText('Mostrando las 3 líneas importadas — el inventario completo ya está publicado.')).toBeInTheDocument();
    expect(screen.queryByText(/primeras 10/)).not.toBeInTheDocument();
  });

  it('fallo total: ni sección ni tabla de muestra', () => {
    montar(FAIL);
    expect(screen.queryByRole('heading', { name: 'Muestra de líneas importadas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  });
});

describe('INV-03 · panel de errores (spec §3)', () => {
  const cabecera = () => screen.getByRole('button', { name: '34 líneas no importadas — ver detalle' });

  it('arranca colapsado: la cabecera cuenta las líneas y aún no hay tabla de errores', () => {
    montar(WARN);
    expect(cabecera()).toHaveAttribute('aria-expanded', 'false');
    expect(cabecera()).toHaveAttribute('type', 'button');
    expect(screen.queryByRole('table', { name: 'Líneas no importadas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Descargar CSV de errores' })).not.toBeInTheDocument();
  });

  it('al pulsar se expande, con su tabla de cuatro columnas, y al volver a pulsar se colapsa', async () => {
    const user = userEvent.setup();
    montar(WARN);
    await user.click(cabecera());
    expect(cabecera()).toHaveAttribute('aria-expanded', 'true');
    const table = screen.getByRole('table', { name: 'Líneas no importadas' });
    for (const col of ['Fila del archivo', 'Columna', 'Tipo de error', 'Valor recibido']) {
      expect(within(table).getByRole('columnheader', { name: col })).toBeInTheDocument();
    }
    await user.click(cabecera());
    expect(cabecera()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('table', { name: 'Líneas no importadas' })).not.toBeInTheDocument();
  });

  it('enseña las 4 primeras filas y una última que dice cuántas quedan solo en el CSV', async () => {
    const user = userEvent.setup();
    montar(WARN);
    await user.click(cabecera());
    const table = screen.getByRole('table', { name: 'Líneas no importadas' });
    const rows = within(table).getAllByRole('row');
    // cabecera + 4 filas + la fila final
    expect(rows).toHaveLength(6);
    expect(within(rows[1]!).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      'Fila 15',
      'quantity',
      'Cantidad negativa',
      '-5',
    ]);
    expect(within(rows[3]!).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      'Fila 88',
      'location_country',
      'País inválido',
      'ESP',
    ]);
    expect(within(rows[5]!).getByText('… y 30 líneas más en el CSV descargable')).toBeInTheDocument();
  });

  it('una celda «Valor recibido» vacía se pinta con guion largo', async () => {
    const user = userEvent.setup();
    montar(WARN);
    await user.click(cabecera());
    const table = screen.getByRole('table', { name: 'Líneas no importadas' });
    const fila142 = within(table).getAllByRole('row')[4]!;
    expect(within(fila142).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      'Fila 142',
      'part_number',
      'Referencia vacía',
      '—',
    ]);
  });

  it('si todas las filas caben (≤ 4) no hay fila final', async () => {
    const user = userEvent.setup();
    const errors: ImportErrorRow[] = WARN.errors.slice(0, 2);
    montar({ ...WARN, failed: 2, errors });
    await user.click(screen.getByRole('button', { name: '2 líneas no importadas — ver detalle' }));
    const table = screen.getByRole('table', { name: 'Líneas no importadas' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).queryByText(/en el CSV descargable/)).not.toBeInTheDocument();
  });

  it('con una sola línea, la cabecera va en singular', () => {
    montar({ ...WARN, failed: 1, errors: WARN.errors.slice(0, 1) });
    expect(screen.getByRole('button', { name: '1 línea no importada — ver detalle' })).toBeInTheDocument();
  });

  it('«Descargar CSV de errores» vive dentro del panel y baja el CSV de TODAS las líneas fallidas', async () => {
    const user = userEvent.setup();
    montar(WARN);
    await user.click(cabecera());
    const button = screen.getByRole('button', { name: 'Descargar CSV de errores' });
    expect(button).toHaveAttribute('type', 'button');
    await user.click(button);
    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const [filename, text] = downloadCsv.mock.calls[0]!;
    expect(filename).toBe('errores-importacion-2026-09-30.csv');
    expect(text).toBe(buildErrorsCsv(WARN.errors));
    expect(text.split('\r\n')).toHaveLength(35);
  });

  it('sin errores no hay panel', () => {
    montar(OK);
    expect(screen.queryByRole('button', { name: /no importadas? — ver detalle/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Descargar CSV de errores' })).not.toBeInTheDocument();
  });

  it('fallo total: tampoco hay panel de errores', () => {
    montar(FAIL);
    expect(screen.queryByRole('button', { name: /ver detalle/ })).not.toBeInTheDocument();
  });
});

describe('INV-03 · fallo total (spec §6)', () => {
  it('bloque de error prominente con su motivo, en un role=alert', () => {
    montar(FAIL);
    const block = screen.getByRole('alert');
    expect(within(block).getByText('El archivo no pudo procesarse')).toBeInTheDocument();
    expect(block).toHaveTextContent('límite de 500.000 líneas totales en plataforma');
    expect(block).toHaveTextContent('Vuelve al panel de inventario para intentarlo de nuevo.');
  });

  it('el motivo NO promete un «informe de error» que la pantalla no puede dar', () => {
    montar(FAIL);
    expect(screen.getByRole('alert')).not.toHaveTextContent(/informe/i);
  });

  it('con éxito o con advertencias no hay bloque de error', () => {
    const { unmount } = montar(WARN);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    unmount();
    montar(OK);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('INV-03 · botones de acción', () => {
  it('advertencias: «Volver al panel de inventario» y «Subir correcciones»', async () => {
    const user = userEvent.setup();
    montar(WARN);
    const back = screen.getByRole('button', { name: 'Volver al panel de inventario' });
    const fix = screen.getByRole('button', { name: 'Subir correcciones' });
    expect(back).toHaveAttribute('type', 'button');
    expect(fix).toHaveAttribute('type', 'button');
    await user.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onUploadCorrections).not.toHaveBeenCalled();
    await user.click(fix);
    expect(onUploadCorrections).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('éxito: solo «Volver al panel de inventario» (no hay nada que corregir)', () => {
    montar(OK);
    expect(screen.getByRole('button', { name: 'Volver al panel de inventario' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Subir correcciones' })).not.toBeInTheDocument();
  });

  it('fallo total: solo «Volver al panel de inventario» (spec §6)', () => {
    montar(FAIL);
    expect(screen.getByRole('button', { name: 'Volver al panel de inventario' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Subir correcciones' })).not.toBeInTheDocument();
  });
});
