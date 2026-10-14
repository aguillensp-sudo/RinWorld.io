import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImportResult } from './ImportResult';
import { IMPORT_EXAMPLES } from '../../lib/import-result';
import { unreadableReason, unreadableSummary } from '../../lib/inventory-import';

/**
 * Fuera del contrato de INV-03 (`F-251`): la spec solo pide el texto genérico del fallo total.
 * Un `.xls`, un archivo de más de 50 MB o uno vacío acababan ahí sin decir cuál era el motivo.
 */
const noop = () => {};

describe('INV-03 · motivo de un archivo ilegible', () => {
  it('con motivo, el fallo total lo enseña además del texto de la spec', () => {
    const summary = unreadableSummary('«stock.xls» es un Excel antiguo (.xls) y no se puede leer.');
    render(<ImportResult summary={summary} onBackToInventory={noop} onUploadCorrections={noop} />);
    expect(screen.getByTestId('fail-reason')).toHaveTextContent('«stock.xls» es un Excel antiguo');
    expect(screen.getByText('El archivo no pudo procesarse')).toBeInTheDocument();
  });

  it('sin motivo, la pantalla es la de siempre', () => {
    render(<ImportResult summary={IMPORT_EXAMPLES.fail} onBackToInventory={noop} onUploadCorrections={noop} />);
    expect(screen.queryByTestId('fail-reason')).not.toBeInTheDocument();
  });

  it('cada clase de archivo ilegible dice su motivo, y el .xls dice cómo arreglarlo', () => {
    expect(unreadableReason({ kind: 'unsupported', name: 'stock.xls' })).toContain('guárdalo como .xlsx');
    expect(unreadableReason({ kind: 'unsupported', name: 'foto.png' })).toContain('CSV, TSV, TXT o XLSX');
    expect(unreadableReason({ kind: 'too_big', name: 'enorme.csv' })).toContain('50 MB');
    expect(unreadableReason({ kind: 'empty', name: 'vacio.xlsx' })).toContain('vacío, dañado');
  });

  it('un archivo leído no tiene motivo de fallo', () => {
    const file = { name: 'a.csv', headers: ['a'], rows: [] };
    expect(unreadableReason({ kind: 'ok', file })).toBeNull();
  });

  it('el resumen sin motivo sigue siendo el de siempre', () => {
    expect(unreadableSummary()).toEqual({ processed: 0, published: 0, failed: 0, removed: null, seconds: null, sample: [], errors: [] });
  });
});
