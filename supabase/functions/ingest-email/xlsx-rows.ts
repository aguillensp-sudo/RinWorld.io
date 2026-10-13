/**
 * Lector de `.xlsx` para la función de borde (INV-04, fase 3): primera hoja → matriz de textos.
 *
 * Hermano de `app/src/lib/xlsx-reader.ts`, que usa `DOMParser` y en Deno no existe. Este recorre el
 * XML con `indexOf`, sin DOM y sin dependencias: el zip se descomprime con `DecompressionStream`
 * (Deno, Node y navegador lo traen). Medido en `openspec/v1/inv04-medidas-xlsx.md`: 100.000 filas
 * ≈ 0,4 s de CPU y ~130 MB.
 *
 * **Qué lee:** la primera hoja según `workbook.xml`; textos compartidos, en línea y de fórmula; el
 * valor guardado de los números (sin formato: una fecha sale como su número de serie); booleanos.
 * **Qué no lee:** `.xls` binario, zips cifrados o zip64, hojas que no sean la primera.
 *
 * **Defensas (el archivo viene de Internet):**
 *   · tope de bytes DESCOMPRIMIDOS por entrada, contado mientras se descomprime y no por lo que el
 *     zip declare: un zip de 2 MB puede esconder gigas (zip bomb);
 *   · tope de filas y de columnas por fila: una celda en `XFD1` no reserva 16.384 posiciones.
 * Todo fallo es `XlsxError`; el que pasa de un tope es `XlsxTooLarge`, que el pipeline cuenta como
 * `TAMANO` y no como formato.
 */

export class XlsxError extends Error {}
export class XlsxTooLarge extends XlsxError {}

/** Bytes descomprimidos que se admiten por entrada del zip (la hoja de 100.000 filas pesa ~21 MB). */
export const MAX_XLSX_ENTRY_BYTES = 100 * 1024 * 1024;
/** Columnas que se leen por fila; las de más a la derecha se descartan. */
export const MAX_XLSX_COLUMNS = 200;

export interface XlsxLimits {
  maxRows: number;
  maxEntryBytes?: number;
}

interface ZipEntry {
  method: number;
  compressedSize: number;
  localOffset: number;
}

const u16 = (v: DataView, o: number) => v.getUint16(o, true);
const u32 = (v: DataView, o: number) => v.getUint32(o, true);

function readCentralDirectory(bytes: Uint8Array): Map<string, ZipEntry> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (u32(v, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new XlsxError('No es un archivo zip.');
  const count = u16(v, eocd + 10);
  let p = u32(v, eocd + 16);
  const entries = new Map<string, ZipEntry>();
  for (let n = 0; n < count; n++) {
    if (p + 46 > bytes.length || u32(v, p) !== 0x02014b50) throw new XlsxError('Directorio del zip dañado.');
    if ((u16(v, p + 8) & 1) !== 0) throw new XlsxError('El archivo está cifrado.');
    const method = u16(v, p + 10);
    const compressedSize = u32(v, p + 20);
    const nameLen = u16(v, p + 28);
    const extraLen = u16(v, p + 30);
    const commentLen = u16(v, p + 32);
    const localOffset = u32(v, p + 42);
    if (compressedSize === 0xffffffff || localOffset === 0xffffffff) throw new XlsxError('Zip64 no soportado.');
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, { method, compressedSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflateRaw(data: Uint8Array, maxBytes: number): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new XlsxError('No hay descompresor disponible.');
  const source = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(data as Uint8Array<ArrayBuffer>);
      controller.close();
    },
  });
  const reader = source.pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        await reader.cancel();
        throw new XlsxTooLarge('El archivo descomprimido es demasiado grande.');
      }
      chunks.push(value);
    }
  } catch (e) {
    if (e instanceof XlsxError) throw e;
    throw new XlsxError('Zip dañado.');
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

async function extract(bytes: Uint8Array, entries: Map<string, ZipEntry>, name: string, maxBytes: number): Promise<string | null> {
  const e = entries.get(name);
  if (!e) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = e.localOffset;
  if (at + 30 > bytes.length || u32(v, at) !== 0x04034b50) throw new XlsxError('Cabecera del zip dañada.');
  const start = at + 30 + u16(v, at + 26) + u16(v, at + 28);
  if (start + e.compressedSize > bytes.length) throw new XlsxError('Zip truncado.');
  const raw = bytes.subarray(start, start + e.compressedSize);
  let data: Uint8Array;
  if (e.method === 0) {
    if (raw.length > maxBytes) throw new XlsxTooLarge('El archivo descomprimido es demasiado grande.');
    data = raw;
  } else if (e.method === 8) {
    data = await inflateRaw(raw, maxBytes);
  } else {
    throw new XlsxError(`Compresión del zip no soportada (${e.method}).`);
  }
  return new TextDecoder('utf-8').decode(data);
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function unescapeXml(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (m, g: string) => {
    if (g[0] !== '#') return ENTITIES[g] ?? m;
    const code = g[1] === 'x' || g[1] === 'X' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
  });
}

/** `<tag`, `<tag ` o `<tag>`: que lo que sigue al nombre cierre el nombre (no `<tr` por `<t`). */
function nextTag(x: string, name: string, from: number): number {
  const open = `<${name}`;
  let p = x.indexOf(open, from);
  while (p >= 0) {
    const ch = x.charCodeAt(p + open.length);
    if (ch === 62 /* > */ || ch === 32 /* ' ' */ || ch === 47 /* / */ || ch === 10 || ch === 13 || ch === 9) return p;
    p = x.indexOf(open, p + 1);
  }
  return -1;
}

/** Todo el texto de un `<si>`/`<is>`: junta los `<t>` (también los de texto con formato) y salta los `<rPh>`. */
function textOf(fragment: string): string {
  const x = fragment.includes('<rPh') ? fragment.replace(/<rPh[\s\S]*?<\/rPh>/g, '') : fragment;
  let out = '';
  let p = 0;
  while ((p = nextTag(x, 't', p)) >= 0) {
    const gt = x.indexOf('>', p);
    if (gt < 0) break;
    if (x.charCodeAt(gt - 1) === 47) {
      p = gt;
      continue;
    }
    const end = x.indexOf('</t>', gt);
    if (end < 0) break;
    out += x.slice(gt + 1, end);
    p = end;
  }
  return unescapeXml(out);
}

function sharedStrings(x: string): string[] {
  const out: string[] = [];
  let p = 0;
  while ((p = nextTag(x, 'si', p)) >= 0) {
    const gt = x.indexOf('>', p);
    if (gt < 0) break;
    if (x.charCodeAt(gt - 1) === 47) {
      out.push('');
      p = gt;
      continue;
    }
    const end = x.indexOf('</si>', gt);
    if (end < 0) break;
    out.push(textOf(x.slice(gt + 1, end)));
    p = end;
  }
  return out;
}

/** Valor de un atributo dentro de una etiqueta de apertura (`r`, `t`), sin confundir `r` con `rId`. */
function attr(tag: string, name: string): string | null {
  const key = ` ${name}="`;
  const i = tag.indexOf(key);
  if (i < 0) return null;
  const s = i + key.length;
  return tag.slice(s, tag.indexOf('"', s));
}

/** `B7` → columna 1 (A = 0). */
function columnIndex(ref: string): number {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

function firstSheetPath(workbook: string | null, rels: string | null): string {
  if (workbook !== null && rels !== null) {
    const s = nextTag(workbook, 'sheet', 0);
    if (s >= 0) {
      const tag = workbook.slice(s, workbook.indexOf('>', s));
      const rid = /\sr:id="([^"]*)"/.exec(tag)?.[1];
      if (rid) {
        for (let p = nextTag(rels, 'Relationship', 0); p >= 0; p = nextTag(rels, 'Relationship', p + 1)) {
          const t = rels.slice(p, rels.indexOf('>', p));
          if (attr(t, 'Id') === rid) {
            const target = attr(t, 'Target');
            if (target) return target.startsWith('/') ? target.slice(1) : `xl/${target}`;
          }
        }
      }
    }
  }
  return 'xl/worksheets/sheet1.xml';
}

function parseSheet(x: string, shared: string[], maxRows: number): string[][] {
  const rows: string[][] = [];
  let p = 0;
  while ((p = nextTag(x, 'row', p)) >= 0) {
    const gt = x.indexOf('>', p);
    if (gt < 0) break;
    if (x.charCodeAt(gt - 1) === 47) {
      rows.push([]);
      p = gt;
    } else {
      const end = x.indexOf('</row>', gt);
      if (end < 0) break;
      rows.push(parseRow(x, gt + 1, end, shared));
      p = end;
    }
    if (rows.length > maxRows + 1) throw new XlsxTooLarge('Demasiadas filas.');
  }
  return rows;
}

function parseRow(x: string, from: number, to: number, shared: string[]): string[] {
  const cells: string[] = [];
  let next = 0;
  let q = from;
  while ((q = nextTag(x, 'c', q)) >= 0 && q < to) {
    const gt = x.indexOf('>', q);
    if (gt < 0 || gt > to) break;
    const tag = x.slice(q, gt);
    const ref = attr(tag, 'r');
    const col = ref ? columnIndex(ref) : next;
    next = col + 1;
    if (x.charCodeAt(gt - 1) === 47) {
      q = gt;
      continue;
    }
    const end = x.indexOf('</c>', gt);
    if (end < 0 || end > to) break;
    if (col >= 0 && col < MAX_XLSX_COLUMNS) {
      const body = x.slice(gt + 1, end);
      const type = attr(tag, 't');
      let value: string;
      if (type === 'inlineStr') {
        value = textOf(body);
      } else {
        const vs = body.indexOf('<v>');
        const raw = vs < 0 ? '' : body.slice(vs + 3, body.indexOf('</v>', vs));
        if (type === 's') value = shared[Number(raw)] ?? '';
        else if (type === 'b') value = raw === '1' ? 'TRUE' : 'FALSE';
        else value = unescapeXml(raw);
      }
      while (cells.length < col) cells.push('');
      cells[col] = value;
    }
    q = end;
  }
  return cells;
}

/** Primera hoja de un `.xlsx` → filas de textos (las filas vacías incluidas; quien llama las filtra). */
export async function readXlsxRows(bytes: Uint8Array, limits: XlsxLimits): Promise<string[][]> {
  const cap = limits.maxEntryBytes ?? MAX_XLSX_ENTRY_BYTES;
  const entries = readCentralDirectory(bytes);

  const sstXml = await extract(bytes, entries, 'xl/sharedStrings.xml', cap);
  const shared = sstXml === null ? [] : sharedStrings(sstXml);

  const workbook = await extract(bytes, entries, 'xl/workbook.xml', cap);
  const rels = await extract(bytes, entries, 'xl/_rels/workbook.xml.rels', cap);
  const sheetXml = await extract(bytes, entries, firstSheetPath(workbook, rels), cap);
  if (sheetXml === null) throw new XlsxError('El libro no tiene hojas.');
  return parseSheet(sheetXml, shared, limits.maxRows);
}
