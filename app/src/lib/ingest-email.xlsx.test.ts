/**
 * Lector de `.xlsx` de la función de borde (`supabase/functions/ingest-email/xlsx-rows.ts`, INV-04 fase 3)
 * y su sitio en el pipeline. El lector no usa DOM: se compara con el del navegador (`xlsx-reader.ts`)
 * sobre el mismo libro para que no se separen, y se prueban las defensas (zip bomb, topes de filas).
 */
import { describe, expect, it } from 'vitest';
import { readXlsxRows as readWeb } from './xlsx-reader';
import { readXlsxRows, XlsxError, XlsxTooLarge } from '../../../supabase/functions/ingest-email/xlsx-rows';
import { processNotification, type Deps, type IngestEvent } from '../../../supabase/functions/ingest-email/pipeline';
import { MAX_XLSX_ROWS, type SesNotification } from '../../../supabase/functions/ingest-email/mail-rules';

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

/** Zip mínimo con deflate (como Excel). */
async function zip(files: Record<string, string>): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = enc.encode(text);
    const data = await deflateRaw(raw);
    const nm = enc.encode(name);
    const local = new Uint8Array(30 + nm.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, 8, true);
    lv.setUint32(14, crc32(raw), true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, nm.length, true);
    local.set(nm, 30);
    const cd = new Uint8Array(46 + nm.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, 8, true);
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
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, central.reduce((n, c) => n + c.length, 0), true);
  ev.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of all) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const libro = (sheet: string, sst = '') =>
  zip({
    'xl/workbook.xml': `<workbook ${NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Hoja1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<worksheet ${NS}><sheetData>${sheet}</sheetData></worksheet>`,
    ...(sst ? { 'xl/sharedStrings.xml': `<sst ${NS}>${sst}</sst>` } : {}),
  });

const SST =
  '<si><t>Referencia</t></si><si><t>Marca</t></si><si><t>Cantidad</t></si><si><t>Notas</t></si>' +
  '<si><t>6205-2RS</t></si><si><r><t>SK</t></r><r><rPr><b/></rPr><t xml:space="preserve">F </t></r></si>' +
  '<si><t>A &amp; B &lt;x&gt; &#241;</t></si><si/>';
const HOJA =
  '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>' +
  '<row r="2" spans="1:4"><c r="A2" t="s"><v>4</v></c><c r="B2" t="s"><v>5</v></c><c r="C2" s="3"><v>1200</v></c><c r="D2" t="inlineStr"><is><t>en línea &amp; más</t></is></c></row>' +
  '<row r="3"><c r="A3" t="s"><v>6</v></c><c r="B3"/><c r="C3" t="b"><v>1</v></c><c r="D3" t="str"><f>A3</f><v>texto de fórmula</v></c></row>' +
  '<row r="4"/>' +
  '<row r="5"><c r="A5" t="s"><v>4</v></c><c r="C5"><v>7</v></c><c r="F5" t="s"><v>7</v></c></row>';

describe('lector de xlsx de la función de borde', () => {
  it('lee lo mismo que el lector del navegador (textos con formato, entidades, celdas vacías, en línea, fórmulas)', async () => {
    const bytes = await libro(HOJA, SST);
    const web = await readWeb(bytes.buffer.slice(0) as ArrayBuffer);
    const fn = await readXlsxRows(bytes, { maxRows: 100 });
    // La cola de celdas vacías de una fila puede diferir en longitud: se compara sin ella.
    const sinCola = (m: string[][]) =>
      m.map((r) => {
        const c = [...r];
        while (c.length > 0 && c[c.length - 1] === '') c.pop();
        return c;
      });
    expect(sinCola(fn)).toEqual(sinCola(web));
    expect(fn[1]).toEqual(['6205-2RS', 'SKF ', '1200', 'en línea & más']);
    expect(fn[2]).toEqual(['A & B <x> ñ', '', 'TRUE', 'texto de fórmula']);
  });

  it('el texto fonético (rPh) no se mezcla con el valor de la celda, como en Excel', async () => {
    const sst = '<si><t>Nippon</t><rPh sb="0" eb="1"><t>ニッポン</t></rPh></si>';
    const m = await readXlsxRows(await libro('<row r="1"><c r="A1" t="s"><v>0</v></c></row>', sst), { maxRows: 10 });
    expect(m[0]).toEqual(['Nippon']);
  });

  it('no es un zip: XlsxError', async () => {
    await expect(readXlsxRows(new TextEncoder().encode('Referencia;Marca\n1;2'), { maxRows: 10 })).rejects.toBeInstanceOf(XlsxError);
  });

  it('un zip que descomprime a más del tope (zip bomb) se corta: XlsxTooLarge', async () => {
    const bomba = await libro('<row r="1"><c r="A1"><v>' + '1'.repeat(300_000) + '</v></c></row>');
    expect(bomba.length).toBeLessThan(5_000);
    await expect(readXlsxRows(bomba, { maxRows: 10, maxEntryBytes: 100_000 })).rejects.toBeInstanceOf(XlsxTooLarge);
  });

  it('más filas que el tope: XlsxTooLarge', async () => {
    const filas = Array.from({ length: 12 }, (_, i) => `<row r="${i + 1}"><c r="A${i + 1}"><v>${i}</v></c></row>`).join('');
    await expect(readXlsxRows(await libro(filas), { maxRows: 10 })).rejects.toBeInstanceOf(XlsxTooLarge);
    await expect(readXlsxRows(await libro(filas), { maxRows: 11 })).resolves.toHaveLength(12);
  });

  it('una celda en la columna XFD no reserva 16.384 posiciones', async () => {
    const m = await readXlsxRows(await libro('<row r="1"><c r="A1"><v>1</v></c><c r="XFD1"><v>9</v></c></row>'), { maxRows: 10 });
    expect(m[0]).toEqual(['1']);
  });
});

describe('un .xlsx por el pipeline', () => {
  const TOKEN = 'a3f7k9m2q8wz';
  const ORG = '00000000-0000-0000-0000-0000000000a1';
  const aviso: SesNotification = {
    notificationType: 'Received',
    mail: { messageId: 'msg-x', source: 'erp@sur.es', commonHeaders: { from: ['erp@sur.es'] } },
    receipt: {
      recipients: [`ingest-${TOKEN}@ingest.nortexsys.com`],
      spfVerdict: { status: 'PASS' },
      dkimVerdict: { status: 'PASS' },
      dmarcVerdict: { status: 'PASS' },
      virusVerdict: { status: 'PASS' },
      action: { type: 'S3', bucketName: 'b', objectKey: 'inbox/x' },
    },
  };
  const hoja = (n: number) =>
    '<row r="1"><c r="A1" t="inlineStr"><is><t>Referencia</t></is></c><c r="B1" t="inlineStr"><is><t>Marca</t></is></c><c r="C1" t="inlineStr"><is><t>Cantidad</t></is></c></row>' +
    Array.from(
      { length: n },
      (_, i) =>
        `<row r="${i + 2}"><c r="A${i + 2}" t="inlineStr"><is><t>R${i}</t></is></c><c r="B${i + 2}" t="inlineStr"><is><t>SKF</t></is></c><c r="C${i + 2}"><v>${(i % 50) + 1}</v></c></row>`,
    ).join('');

  function banco(adjunto: Uint8Array, nombre = 'inventario.xlsx', falla?: number) {
    const eventos: IngestEvent[] = [];
    const lotes: number[] = [];
    const deps: Deps = {
      domain: 'ingest.nortexsys.com',
      resolve: async (t) =>
        t === TOKEN
          ? {
              address_id: 'a',
              org_id: ORG,
              org_country: 'ES',
              senders: ['erp@sur.es'],
              profiles: [{ header_signature: 'referencia|marca|cantidad', mapping: ['part_number', 'brand', 'quantity'] }],
            }
          : null,
      objectSize: async () => 1000,
      getObject: async () => new Uint8Array(),
      attachmentsOf: async () => [{ filename: nombre, content: adjunto }],
      importLines: async (_o, lines) => {
        if (falla !== undefined && lotes.length === falla) throw new Error('rpc');
        lotes.push(lines.length);
        return lines.length;
      },
      alreadyHandled: async () => false,
      record: async (e) => {
        eventos.push(e);
      },
    };
    return { deps, eventos, lotes };
  }

  it('45.000 líneas se importan en lotes de 20.000 y el historial suma todas', async () => {
    const b = banco(await libro(hoja(45_000)));
    const r = await processNotification(aviso, b.deps);
    expect(r).toEqual({ result: 'PROCESADO', reason: null, rows: 45_000 });
    expect(b.lotes).toEqual([20_000, 20_000, 5_000]);
    expect(b.eventos[0]).toMatchObject({ file_name: 'inventario.xlsx', result: 'PROCESADO', rows_imported: 45_000 });
  }, 60_000);

  it('si falla el segundo lote: ERROR_INTERNO sin filas (lo ya importado no se deshace, repetir lo deja igual)', async () => {
    const b = banco(await libro(hoja(45_000)), 'inventario.xlsx', 1);
    const r = await processNotification(aviso, b.deps);
    expect(r).toEqual({ result: 'ERROR', reason: 'ERROR_INTERNO', rows: null });
    expect(b.lotes).toEqual([20_000]);
  }, 60_000);

  it('un xlsx dañado: FORMATO_NO_RECONOCIDO; con más filas que el tope: TAMANO', async () => {
    expect((await processNotification(aviso, banco(new TextEncoder().encode('no soy un zip')).deps)).reason).toBe('FORMATO_NO_RECONOCIDO');
    const filas = Array.from({ length: MAX_XLSX_ROWS + 2 }, (_, i) => `<row><c><v>${i}</v></c></row>`).join('');
    expect((await processNotification(aviso, banco(await libro(filas)).deps)).reason).toBe('TAMANO');
  }, 60_000);

  it('un CSV sigue con su tope de 20.000 líneas', async () => {
    const grande = 'Referencia;Marca;Cantidad\n' + Array.from({ length: 20_001 }, (_, i) => `R${i};SKF;1`).join('\n');
    expect((await processNotification(aviso, banco(new TextEncoder().encode(grande), 'a.csv').deps)).reason).toBe('TAMANO');
  });
});
