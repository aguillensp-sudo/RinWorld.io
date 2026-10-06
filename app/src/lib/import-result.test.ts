import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildErrorsCsv,
  downloadCsv,
  errorsCsvFilename,
  errorsPanelLabel,
  formatCount,
  formatSeconds,
  IMPORT_EXAMPLES,
  importExampleFromHash,
  importOutcome,
  newVsExistingSentence,
  moreErrorsLabel,
  outcomeSubtitle,
  outcomeTitle,
  previewErrors,
  receivedLabel,
  sampleHint,
  sampleLines,
  type ImportErrorRow,
  type ImportSampleLine,
  type ImportSummary,
} from './import-result';

const line = (n: number): ImportSampleLine => ({
  partNumber: `R-${n}`,
  brand: 'SKF',
  quantity: n,
  country: 'ES',
  status: 'PUBLISHED',
});
const err = (row: number, over: Partial<ImportErrorRow> = {}): ImportErrorRow => ({
  row,
  column: 'quantity',
  errorType: 'Cantidad negativa',
  received: '-5',
  ...over,
});

describe('importOutcome (spec §3 y §6)', () => {
  it('sin ninguna línea publicada es fallo total, tenga o no errores', () => {
    expect(importOutcome({ published: 0, failed: 0 })).toBe('fail');
    expect(importOutcome({ published: 0, failed: 40 })).toBe('fail');
  });
  it('con líneas publicadas y alguna con error son advertencias', () => {
    expect(importOutcome({ published: 1213, failed: 34 })).toBe('warn');
    expect(importOutcome({ published: 1, failed: 1 })).toBe('warn');
  });
  it('con líneas publicadas y ninguna con error es éxito', () => {
    expect(importOutcome({ published: 1247, failed: 0 })).toBe('ok');
  });
});

describe('outcomeTitle', () => {
  it('los tres títulos de la spec §3, verbatim', () => {
    expect(outcomeTitle('ok')).toBe('Importación completada');
    expect(outcomeTitle('warn')).toBe('Importación completada con advertencias');
    expect(outcomeTitle('fail')).toBe('La importación no ha podido completarse');
  });
});

describe('outcomeSubtitle (HTML aprobado, setState)', () => {
  it('éxito: cuenta las líneas publicadas con punto de millares', () => {
    expect(outcomeSubtitle(IMPORT_EXAMPLES.ok)).toBe(
      '1.247 líneas publicadas correctamente. No se han detectado errores.',
    );
  });
  it('advertencias', () => {
    expect(outcomeSubtitle(IMPORT_EXAMPLES.warn)).toBe(
      'Tu inventario ha sido actualizado. Revisa las líneas que no pudieron importarse y corrígelas.',
    );
  });
  it('fallo total', () => {
    expect(outcomeSubtitle(IMPORT_EXAMPLES.fail)).toBe(
      'El sistema no ha podido procesar el archivo. Ninguna línea ha sido publicada.',
    );
  });
});

describe('formatCount', () => {
  it('agrupa con punto desde cuatro cifras, que es lo que Intl es-ES NO hace', () => {
    expect(formatCount(1247)).toBe('1.247');
    expect(formatCount(1213)).toBe('1.213');
    expect(formatCount(12470)).toBe('12.470');
    expect(formatCount(1234567)).toBe('1.234.567');
  });
  it('no toca los números cortos', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(34)).toBe('34');
    expect(formatCount(999)).toBe('999');
  });
  it('los negativos conservan el signo', () => {
    expect(formatCount(-1500)).toBe('-1.500');
    expect(formatCount(-5)).toBe('-5');
  });
});

describe('formatSeconds', () => {
  it('una decimal con coma y la unidad', () => {
    expect(formatSeconds(4.2)).toBe('4,2 s');
    expect(formatSeconds(3.8)).toBe('3,8 s');
    expect(formatSeconds(12)).toBe('12,0 s');
  });
  it('sin medida es un guion largo', () => {
    expect(formatSeconds(null)).toBe('—');
    expect(formatSeconds(Number.NaN)).toBe('—');
  });
});

describe('sampleLines (spec §7)', () => {
  it('son SIEMPRE las 10 primeras, aunque lleguen 50', () => {
    const many = Array.from({ length: 50 }, (_, i) => line(i + 1));
    const out = sampleLines({ sample: many });
    expect(out).toHaveLength(10);
    expect(out[0]?.partNumber).toBe('R-1');
    expect(out[9]?.partNumber).toBe('R-10');
  });
  it('si llegan menos de 10 se pintan todas, sin rellenar', () => {
    expect(sampleLines({ sample: [line(1), line(2)] })).toHaveLength(2);
    expect(sampleLines({ sample: [] })).toEqual([]);
  });
});

describe('sampleHint (spec §3)', () => {
  it('con 10 líneas o más es la etiqueta de la spec, verbatim', () => {
    const spec = 'Mostrando las primeras 10 líneas importadas como muestra — el inventario completo ya está publicado.';
    expect(sampleHint(10)).toBe(spec);
    expect(sampleHint(50)).toBe(spec);
  });
  it('con menos, cuenta las que hay en vez de decir «las primeras 10»', () => {
    expect(sampleHint(3)).toBe('Mostrando las 3 líneas importadas — el inventario completo ya está publicado.');
    expect(sampleHint(1)).toBe('Mostrando la única línea importada — el inventario completo ya está publicado.');
  });
});

describe('panel de errores', () => {
  const errors = Array.from({ length: 34 }, (_, i) => err(i + 1));

  it('la cabecera cuenta las líneas', () => {
    expect(errorsPanelLabel(34)).toBe('34 líneas no importadas — ver detalle');
    expect(errorsPanelLabel(1247)).toBe('1.247 líneas no importadas — ver detalle');
  });
  it('con una sola línea, en singular', () => {
    expect(errorsPanelLabel(1)).toBe('1 línea no importada — ver detalle');
  });
  it('se pintan las 4 primeras filas', () => {
    expect(previewErrors({ errors }).map((e) => e.row)).toEqual([1, 2, 3, 4]);
  });
  it('la fila final dice cuántas quedan solo en el CSV', () => {
    expect(moreErrorsLabel({ errors })).toBe('… y 30 líneas más en el CSV descargable');
    expect(moreErrorsLabel({ errors: errors.slice(0, 5) })).toBe('… y 1 línea más en el CSV descargable');
  });
  it('si caben todas, no hay fila final', () => {
    expect(moreErrorsLabel({ errors: errors.slice(0, 4) })).toBeNull();
    expect(moreErrorsLabel({ errors: [] })).toBeNull();
  });
  it('una celda vacía se pinta con un guion largo', () => {
    expect(receivedLabel(null)).toBe('—');
    expect(receivedLabel('')).toBe('—');
    expect(receivedLabel('-5')).toBe('-5');
  });
});

describe('buildErrorsCsv', () => {
  it('cabecera y una fila por error, separadas por CRLF, TODAS las líneas (no solo las pintadas)', () => {
    const errors = Array.from({ length: 34 }, (_, i) => err(i + 1));
    const lines = buildErrorsCsv(errors).split('\r\n');
    expect(lines[0]).toBe('Fila,Columna,Tipo de error,Valor recibido');
    expect(lines).toHaveLength(35);
    expect(lines[1]).toBe('1,quantity,Cantidad negativa,-5');
  });
  it('una celda vacía queda vacía en el CSV, no como guion', () => {
    expect(buildErrorsCsv([err(142, { column: 'part_number', errorType: 'Referencia vacía', received: null })])).toBe(
      'Fila,Columna,Tipo de error,Valor recibido\r\n142,part_number,Referencia vacía,',
    );
  });
  it('entrecomilla lo que lleva coma, comillas o salto de línea', () => {
    const csv = buildErrorsCsv([err(1, { received: 'a,b' }), err(2, { received: 'di "hola"' }), err(3, { received: 'x\ny' })]);
    const rows = csv.split('\r\n');
    expect(rows[1]).toBe('1,quantity,Cantidad negativa,"a,b"');
    expect(rows[2]).toBe('2,quantity,Cantidad negativa,"di ""hola"""');
    expect(rows[3]).toBe('3,quantity,Cantidad negativa,"x\ny"');
  });
  it('neutraliza una celda que Excel ejecutaría como fórmula, pero no un número negativo', () => {
    const csv = buildErrorsCsv([err(1, { received: '=1+1' }), err(2, { received: '+34600' }), err(3, { received: '@x' }), err(4, { received: '-5' })]);
    const rows = csv.split('\r\n');
    expect(rows[1]).toBe("1,quantity,Cantidad negativa,'=1+1");
    expect(rows[2]).toBe("2,quantity,Cantidad negativa,'+34600");
    expect(rows[3]).toBe("3,quantity,Cantidad negativa,'@x");
    expect(rows[4]).toBe('4,quantity,Cantidad negativa,-5');
  });
  it('sin errores solo lleva la cabecera', () => {
    expect(buildErrorsCsv([])).toBe('Fila,Columna,Tipo de error,Valor recibido');
  });
});

describe('errorsCsvFilename', () => {
  it('lleva la fecha local con ceros a la izquierda', () => {
    expect(errorsCsvFilename(new Date(2026, 8, 5, 10, 0))).toBe('errores-importacion-2026-09-05.csv');
    expect(errorsCsvFilename(new Date(2026, 11, 30, 23, 59))).toBe('errores-importacion-2026-12-30.csv');
  });
});

describe('downloadCsv', () => {
  afterEach(() => vi.restoreAllMocks());

  it('crea un enlace de descarga con el nombre dado, lo pulsa y libera la URL', async () => {
    const created: Blob[] = [];
    Object.assign(URL, {
      createObjectURL: vi.fn((b: Blob) => {
        created.push(b);
        return 'blob:test';
      }),
      revokeObjectURL: vi.fn(),
    });
    const clicked: { name: string; href: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ name: this.download, href: this.href });
    });
    downloadCsv('errores.csv', 'a,b');
    expect(clicked).toEqual([{ name: 'errores.csv', href: 'blob:test' }]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    // BOM delante: sin él Excel rompe los acentos.
    // (Se leen los bytes: decodificar como texto se comería el BOM. jsdom no trae `Blob.arrayBuffer`.)
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(created[0] as Blob);
    });
    const bytes = new Uint8Array(buffer);
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe('a,b');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});

describe('IMPORT_EXAMPLES (spec §3, «Datos de ejemplo»)', () => {
  it('el de advertencias lleva las cifras de la spec', () => {
    const s: ImportSummary = IMPORT_EXAMPLES.warn;
    expect([s.processed, s.published, s.failed, s.removed, s.seconds]).toEqual([1247, 1213, 34, 127, 4.2]);
    expect(s.errors).toHaveLength(34);
    expect(sampleLines(s).map((l) => l.partNumber).slice(0, 2)).toEqual(['6205-2RS/C3', 'NU2210-E-TVP2']);
  });
  it('cada ejemplo está en el estado que dice su clave', () => {
    expect(importOutcome(IMPORT_EXAMPLES.warn)).toBe('warn');
    expect(importOutcome(IMPORT_EXAMPLES.ok)).toBe('ok');
    expect(importOutcome(IMPORT_EXAMPLES.fail)).toBe('fail');
  });
});

describe('importExampleFromHash', () => {
  it('lee los tres estados', () => {
    expect(importExampleFromHash('#importacion-ejemplo=warn')).toBe(IMPORT_EXAMPLES.warn);
    expect(importExampleFromHash('#importacion-ejemplo=ok')).toBe(IMPORT_EXAMPLES.ok);
    expect(importExampleFromHash('#importacion-ejemplo=fail')).toBe(IMPORT_EXAMPLES.fail);
  });
  it('cualquier otra cosa es null', () => {
    expect(importExampleFromHash('')).toBeNull();
    expect(importExampleFromHash('#importacion-ejemplo=otro')).toBeNull();
    expect(importExampleFromHash('#registro?token=abc')).toBeNull();
    expect(importExampleFromHash('#importacion-ejemplo=warn&x=1')).toBeNull();
  });
});

describe('desglose de nuevas y ya existentes (0046)', () => {
  const base = { processed: 500, published: 500, failed: 0, removed: null, seconds: 1, sample: [], errors: [] };

  it('sin desglose, los subtítulos son los de siempre', () => {
    expect(outcomeSubtitle(base)).toBe('500 líneas publicadas correctamente. No se han detectado errores.');
  });

  it('con desglose, dice cuántas son nuevas y que las existentes se actualizan (no se duplican)', () => {
    expect(outcomeSubtitle({ ...base, created: 54, updated: 446 })).toBe(
      '500 líneas publicadas correctamente. 54 nuevas y 446 que ya existían (actualizadas con los datos del archivo). No se han detectado errores.',
    );
  });

  it('singulares y sin cola si ninguna existía', () => {
    expect(newVsExistingSentence({ created: 1, updated: 1 })).toBe(' 1 nueva y 1 que ya existía (actualizada con los datos del archivo).');
    expect(newVsExistingSentence({ created: 500, updated: 0 })).toBe(' 500 nuevas y 0 que ya existían.');
  });

  it('también en el caso con advertencias', () => {
    expect(outcomeSubtitle({ ...base, published: 10, failed: 2, created: 4, updated: 6 })).toBe(
      'Tu inventario ha sido actualizado. 4 nuevas y 6 que ya existían (actualizadas con los datos del archivo). Revisa las líneas que no pudieron importarse y corrígelas.',
    );
  });
});
