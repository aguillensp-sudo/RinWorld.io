import { describe, expect, it } from 'vitest';
import { readXlsxRows, XlsxError } from './xlsx-reader';
import { fromRows, readImportFile } from './inventory-import';

/**
 * Lector de XLSX. Dos orígenes para no probar el lector solo contra su propio espejo:
 *  · un zip que construye la propia prueba (sin comprimir y con deflate-raw, como Excel);
 *  · un .xlsx hecho con el `zipfile` de Python (`PYTHON_XLSX`), con texto compartido con
 *    formato, números, texto en línea, fórmula con texto y una celda saltada.
 */

const PYTHON_XLSX = 'UEsDBBQAAAAIAI9oRl3muHRrXgAAAGIAAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbBXMyw2DMAwA0FVQ7sSBQw8VnyVYIIpcQMR2FFsobI/6BnjT2ih3N1Y9hWc3+ODWZdqegto1yqyzO8zKF0DTgRTVS0FulH9SKZp6qTuUmK64I4whfCAJG7L19j8cLC9QSwMEFAAAAAgAj2hGXRwwtSOzAAAADgEAAA8AAAB4bC93b3JrYm9vay54bWyNj81qwzAQhF9F7D2W3UMpxnIupeB7+wCKtY5FtLtmV039+IX83HMa+GC+YYbjTsVdUS0LB+iaFhzyLCnzOcDP99fhA47j8Cd6OYlc3E6FLcBa69Z7b/OKFK2RDXmnsohSrNaInr1tijHZilip+Le2ffcUM8Pd0OsrDlmWPOOnzL+EXO8SxRJrFrY1bwbjcFuwRzqOhAEmviLXqFnA3fiUAnTgtM8pgE6pAz8O/ln1z3fjP1BLAwQUAAAACACPaEZd9o1lO4cAAAC6AAAAGgAAAHhsL19yZWxzL3dvcmtib29rLnhtbC5yZWxzVc49DoMwDEDhq0Q+QBw6dKgIzKwVF4jAJYj8yY5oevtKncr0tk+vH1sM6iSWPScLnTYwDv2Tgqt7TuL3IqrFkMSCr7U8EGXxFJ3oXCi1GF6Zo6uiM29Y3HK4jfBmzB3534CrqabVAk9rB2r+FLLQQM2ON6oW3pkP8URV8JdOtxgAhx4vV8MXUEsDBBQAAAAIAI9oRl1JhI8dtAAAAB0BAAAUAAAAeGwvc2hhcmVkU3RyaW5ncy54bWxdzN0KgjAYxvFbGTvPmZBEzHkQdBJBVF7A0FcduM32voY31VV0YxH2hYf/HzyPzEfbsRsENN5lfBnFnIErfWVck/Hislusea4kIrHRdg4z3hL1GyGwbMFqjHwPbrRd7YPVhJEPjcA+gK6wBSDbiSSOU2G1cZyVfnCU8ZSzwZnrANtPK4lGSVInqKUgJcUrJzroUOo5FhXO6agf9xmGl6dJvJo4vGWRnM5f+Xs473e/vUAk9QRQSwMEFAAAAAgAj2hGXRzKF5b/AAAAGQIAABgAAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWxlkU1uhDAMRq+CvOiuGMK06o/xqC30AtMeIGLCgEoSlETA8SuYCjF05/jF+Z5iOk66iwblfGtNDmmcQKRMZc+tueTw/fV5/wRHptG6H98oFaJJd8bn0ITQvyD6qlFa+tj2yky6q63TMvjYugv63il5XoZ0hyJJHlHL1gDT0itkkEzOjpHLIQWmai7eUohCDh6YBk4IByas/tj7lqW37GPLxC0rtixbGTo7rgJiFRCby4edwJY97ATmFwbOnnfZ15HWdK1Rp+CAqfVMgcsTYWDC+fTPJltt5mpgIUSyz7uSQ7zrF9nVcYmqGQq4k7p/hRII63miKHc/gJt14Lpn/gVQSwECFAAUAAAACACPaEZd5rh0a14AAABiAAAAEwAAAAAAAAAAAAAAgAEAAAAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLAQIUABQAAAAIAI9oRl0cMLUjswAAAA4BAAAPAAAAAAAAAAAAAACAAY8AAAB4bC93b3JrYm9vay54bWxQSwECFAAUAAAACACPaEZd9o1lO4cAAAC6AAAAGgAAAAAAAAAAAAAAgAFvAQAAeGwvX3JlbHMvd29ya2Jvb2sueG1sLnJlbHNQSwECFAAUAAAACACPaEZdSYSPHbQAAAAdAQAAFAAAAAAAAAAAAAAAgAEuAgAAeGwvc2hhcmVkU3RyaW5ncy54bWxQSwECFAAUAAAACACPaEZdHMoXlv8AAAAZAgAAGAAAAAAAAAAAAAAAgAEUAwAAeGwvd29ya3NoZWV0cy9zaGVldDEueG1sUEsFBgAAAAAFAAUATgEAAEkEAAAAAA==';

const b64 = (s: string): ArrayBuffer => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer;

function crc32(d: Uint8Array): number {
  let c = ~0;
  for (const b of d) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

async function deflateRaw(d: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(c) {
      c.enqueue(d);
      c.close();
    },
  })
    .pipeThrough(new CompressionStream('deflate-raw'))
    .getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** Zip mínimo: `method` 0 = sin comprimir, 8 = deflate. */
async function zip(files: Record<string, string>, method: 0 | 8): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = enc.encode(text);
    const data = method === 8 ? await deflateRaw(raw) : raw;
    const nm = enc.encode(name);
    const local = new Uint8Array(30 + nm.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, method, true);
    lv.setUint32(14, crc32(raw), true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, nm.length, true);
    local.set(nm, 30);
    const cd = new Uint8Array(46 + nm.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, method, true);
    cv.setUint32(16, crc32(raw), true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, nm.length, true);
    cv.setUint32(42, offset, true);
    cd.set(nm, 46);
    parts.push(local, data);
    central.push(cd);
    offset += local.length + data.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of all) {
    out.set(p, o);
    o += p.length;
  }
  return out.buffer;
}

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const SIMPLE = {
  'xl/sharedStrings.xml': `<sst ${NS}><si><t>Ref</t></si><si><t>Marca</t></si><si><t>Uds</t></si><si><t>SKF</t></si></sst>`,
  'xl/worksheets/sheet1.xml': `<worksheet ${NS}><sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
    <row r="2"><c r="A2"><v>6205</v></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>39</v></c></row>
  </sheetData></worksheet>`,
};

describe('readXlsxRows', () => {
  it('lee un zip sin comprimir', async () => {
    expect(await readXlsxRows(await zip(SIMPLE, 0))).toEqual([['Ref', 'Marca', 'Uds'], ['6205', 'SKF', '39']]);
  });

  it('lee un zip con deflate (como lo guarda Excel)', async () => {
    expect(await readXlsxRows(await zip(SIMPLE, 8))).toEqual([['Ref', 'Marca', 'Uds'], ['6205', 'SKF', '39']]);
  });

  it('lee el .xlsx de control hecho con Python: primera hoja por workbook.xml, texto con formato, números, texto en línea y fórmula', async () => {
    expect(await readXlsxRows(b64(PYTHON_XLSX))).toEqual([
      ['Ref', 'Marca', 'Uds', 'País'],
      ['6205-2RS', 'SKF', '39', 'ES'],
      ['22205', '', '4.5', 'DE'], // B3 no existe: celda vacía en su sitio
    ]);
  });

  it('un archivo que no es un zip lanza XlsxError', async () => {
    await expect(readXlsxRows(new TextEncoder().encode('Ref;Marca\n1;2').buffer)).rejects.toBeInstanceOf(XlsxError);
  });

  it('un zip sin hoja lanza XlsxError', async () => {
    await expect(readXlsxRows(await zip({ 'xl/otra.xml': '<a/>' }, 0))).rejects.toBeInstanceOf(XlsxError);
  });
});

describe('readImportFile con .xlsx', () => {
  it('un .xlsx se lee igual que un CSV: cabeceras y filas', async () => {
    const r = await readImportFile(new File([b64(PYTHON_XLSX)], 'inventario.xlsx'));
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.file.headers).toEqual(['Ref', 'Marca', 'Uds', 'País']);
      expect(r.file.rows).toHaveLength(2);
    }
  });

  it('un .xlsx dañado es «empty» (INV-03 en fallo), no una excepción', async () => {
    expect((await readImportFile(new File(['no soy un zip'], 'roto.xlsx'))).kind).toBe('empty');
  });

  it('el .xls binario antiguo sigue sin leerse', async () => {
    expect((await readImportFile(new File(['x'], 'viejo.xls'))).kind).toBe('unsupported');
  });

  it('fromRows descarta filas vacías y exige cabecera', () => {
    expect(fromRows('x', [['', ''], ['Ref'], ['6205'], ['']])).toEqual({ name: 'x', headers: ['Ref'], rows: [['6205']] });
    expect(fromRows('x', [[''], ['']])).toBeNull();
  });
});
