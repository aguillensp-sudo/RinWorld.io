/**
 * Lector mínimo de `.xlsx` (Office Open XML), SIN dependencias: un `.xlsx` es un zip de
 * XMLs y el navegador ya sabe descomprimir (`DecompressionStream`) y leer XML (`DOMParser`).
 *
 * **Qué lee, y es deliberadamente poco:** la PRIMERA hoja, como una matriz de textos.
 * Las celdas de texto (compartido, en línea o de fórmula) tal cual; las numéricas, con el
 * valor guardado por Excel (`36`, `4.2`); las booleanas, `TRUE`/`FALSE`. **No** aplica
 * formatos: una fecha sale como su número de serie y un número muy grande como lo guarde
 * Excel. Para un inventario (referencia, marca, cantidad, país) basta.
 *
 * **Qué NO lee:** `.xls` (el binario antiguo), archivos con contraseña, hojas ocultas
 * distintas de la primera. Un zip corrupto o sin hoja lanza `XlsxError`; quien llama lo
 * trata como «archivo ilegible».
 */

export class XlsxError extends Error {}

interface ZipEntry {
  method: number;
  compressedSize: number;
  localOffset: number;
}

const u16 = (v: DataView, o: number) => v.getUint16(o, true);
const u32 = (v: DataView, o: number) => v.getUint32(o, true);

/** Directorio central del zip: nombre → dónde está. */
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
    const method = u16(v, p + 10);
    const compressedSize = u32(v, p + 20);
    const nameLen = u16(v, p + 28);
    const extraLen = u16(v, p + 30);
    const commentLen = u16(v, p + 32);
    const localOffset = u32(v, p + 42);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, { method, compressedSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Un `ReadableStream` de un solo trozo (jsdom no tiene `Blob.stream()`; esto sirve en todas partes). */
function oneChunk(data: Uint8Array<ArrayBuffer>): ReadableStream<Uint8Array<ArrayBuffer>> {
  return new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array<ArrayBuffer>>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
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

async function inflateRaw(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new XlsxError('Este navegador no sabe descomprimir el archivo.');
  return collect(oneChunk(data).pipeThrough(new DecompressionStream('deflate-raw')));
}

async function extract(bytes: Uint8Array, entries: Map<string, ZipEntry>, name: string): Promise<string | null> {
  const e = entries.get(name);
  if (!e) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = e.localOffset;
  if (at + 30 > bytes.length || u32(v, at) !== 0x04034b50) throw new XlsxError('Cabecera del zip dañada.');
  const start = at + 30 + u16(v, at + 26) + u16(v, at + 28);
  const raw = bytes.slice(start, start + e.compressedSize);
  const data = e.method === 0 ? raw : e.method === 8 ? await inflateRaw(raw) : null;
  if (data === null) throw new XlsxError(`Compresión del zip no soportada (${e.method}).`);
  return new TextDecoder('utf-8').decode(data);
}

function xml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) throw new XlsxError('XML dañado.');
  return doc;
}

const NS = '*';
const all = (root: Document | Element, tag: string): Element[] => Array.from(root.getElementsByTagNameNS(NS, tag));

/** Todo el texto de un `<si>` / `<is>`: junta los `<t>` (también los de texto con formato). */
function textOf(el: Element): string {
  return all(el, 't')
    .map((t) => t.textContent ?? '')
    .join('');
}

/** `B7` → columna 1 (A = 0). */
function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

/** Ruta de la primera hoja según `workbook.xml` y sus relaciones. */
async function firstSheetPath(bytes: Uint8Array, entries: Map<string, ZipEntry>): Promise<string> {
  const wb = await extract(bytes, entries, 'xl/workbook.xml');
  const rels = await extract(bytes, entries, 'xl/_rels/workbook.xml.rels');
  if (wb !== null && rels !== null) {
    const sheet = all(xml(wb), 'sheet')[0];
    const rid = sheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? sheet?.getAttribute('r:id');
    const rel = all(xml(rels), 'Relationship').find((r) => r.getAttribute('Id') === rid);
    const target = rel?.getAttribute('Target');
    if (target) return target.startsWith('/') ? target.slice(1) : `xl/${target}`;
  }
  return 'xl/worksheets/sheet1.xml';
}

/** Primera hoja de un `.xlsx` → filas de textos (las filas vacías incluidas; quien llama las filtra). */
export async function readXlsxRows(buffer: ArrayBuffer): Promise<string[][]> {
  const bytes = new Uint8Array(buffer);
  const entries = readCentralDirectory(bytes);

  const sstXml = await extract(bytes, entries, 'xl/sharedStrings.xml');
  const shared = sstXml === null ? [] : all(xml(sstXml), 'si').map(textOf);

  const sheetXml = await extract(bytes, entries, await firstSheetPath(bytes, entries));
  if (sheetXml === null) throw new XlsxError('El libro no tiene hojas.');

  const rows: string[][] = [];
  for (const row of all(xml(sheetXml), 'row')) {
    const cells: string[] = [];
    let next = 0;
    for (const c of all(row, 'c')) {
      const ref = c.getAttribute('r');
      const col = ref ? columnIndex(ref) : next;
      while (cells.length < col) cells.push('');
      const type = c.getAttribute('t');
      const v = all(c, 'v')[0]?.textContent ?? '';
      let value: string;
      if (type === 's') value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') value = textOf(c);
      else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
      else value = v;
      cells[col] = value;
      next = col + 1;
    }
    rows.push(cells);
  }
  return rows;
}
