import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseImportText, type ParsedFile, type PlatformField } from '../../lib/inventory-import';

/**
 * PARCIALES · inventory-management/inventory-line-lifecycle#2
 *
 * GIVEN un archivo que contiene líneas con errores (cantidad negativa, país inválido)
 * WHEN el sistema procesa el archivo
 * THEN las líneas válidas se publican
 * AND las líneas con error se muestran en un panel expandible con fila, columna y tipo de error
 * AND el miembro puede descargar el CSV de errores para corregir y re-subir
 *
 * Una sola cadena con datos reales: `runImport` (base mockeada) -> resumen -> pantalla INV-03
 * -> panel -> descarga. Nada se calcula a mano en el test.
 */

const rpc = vi.fn();
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const downloadCsv = vi.fn<(filename: string, text: string) => void>();
vi.mock('../../lib/import-result', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/import-result')>()),
  downloadCsv: (f: string, t: string) => downloadCsv(f, t),
}));

const { runImport } = await import('../../lib/inventory-import');
const { ImportResult } = await import('./ImportResult');

const CSV = [
  'Ref;Marca;Uds;País',
  '6205-2RS;SKF;10;ES', // válida
  'NU216;FAG;-5;DE', // cantidad negativa  (fila 3 del archivo)
  '7208B;NSK;3;Atlantida', // país inválido (fila 4)
  '32010X;NTN;7;FR', // válida
].join('\n');
const FILE = parseImportText('mixto.csv', CSV) as ParsedFile;
const MAPPING: PlatformField[] = ['part_number', 'brand', 'quantity', 'location_country'];

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: { published: 2, removed: 0 }, error: null });
  downloadCsv.mockReset();
});

describe('inventory-management/inventory-line-lifecycle (parciales)', () => {
  it('inventory-management/inventory-line-lifecycle#2 · las válidas se publican, las erróneas salen en el panel con fila, columna y tipo, y el CSV de errores se descarga', async () => {
    const summary = await runImport(FILE, { mapping: MAPPING, policy: 'REPLACE', profileName: null });

    // THEN solo las dos válidas viajan a la base para publicarse
    const enviadas = rpc.mock.calls[0]?.[1].p_lines as { part_number: string }[];
    expect(enviadas.map((l) => l.part_number)).toEqual(['6205-2RS', '32010X']);
    expect(summary.published).toBe(2);
    expect(summary.failed).toBe(2);

    // AND el panel expandible muestra fila, columna y tipo de cada error
    const user = userEvent.setup();
    render(<ImportResult summary={summary} onBackToInventory={vi.fn()} onUploadCorrections={vi.fn()} now={new Date(2026, 8, 30)} />);
    expect(screen.queryByRole('table', { name: 'Líneas no importadas' })).not.toBeInTheDocument(); // colapsado
    await user.click(screen.getByRole('button', { name: '2 líneas no importadas — ver detalle' }));
    const tabla = screen.getByRole('table', { name: 'Líneas no importadas' });
    const filas = within(tabla).getAllByRole('row').slice(1);
    expect(filas.map((f) => within(f).getAllByRole('cell').map((c) => c.textContent))).toEqual([
      ['Fila 3', 'Uds', 'Cantidad negativa', '-5'],
      ['Fila 4', 'País', 'País no reconocido', 'Atlantida'],
    ]);

    // AND se puede descargar el CSV de errores, con esas mismas líneas
    await user.click(screen.getByRole('button', { name: 'Descargar CSV de errores' }));
    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const texto = downloadCsv.mock.calls[0]![1];
    expect(texto.split('\r\n')).toEqual([
      'Fila,Columna,Tipo de error,Valor recibido',
      '3,Uds,Cantidad negativa,-5',
      '4,País,País no reconocido,Atlantida',
    ]);
  });
});
