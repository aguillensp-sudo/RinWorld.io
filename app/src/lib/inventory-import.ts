import { supabase } from './supabase';
import { errorMessage } from './session';
import { SAMPLE_SIZE, formatCount, type ImportErrorRow, type ImportSampleLine, type ImportSummary } from './import-result';

/**
 * Capa de datos de INV-02 · Procesamiento y Mapeo de Columnas.
 *
 * **La escribe Claude Code a mano, no el Coder** (`CLAUDE.md` §3). INV-02 es la
 * pantalla que confirma el mapeo; todo lo que hay detrás —leer el archivo,
 * proponer el mapeo, validar cada línea, inferir la familia, escribir y resumir—
 * vive aquí, probado sin React. Lo que toca red, al final.
 *
 * El recorrido: INV-01 entrega un `File` → `readImportFile` lo lee en el navegador
 * → `proposeMapping` propone un campo por columna (o aplica un perfil guardado,
 * `fetchProfile`) → INV-02 deja corregirlo → `runImport` valida cada línea, manda
 * las válidas a `import_inventory` (0044) en una transacción y devuelve el
 * `ImportSummary` que pinta INV-03.
 *
 * ⚠ **CINCO COSAS QUE LA SPEC NO DICE COMO EL CÓDIGO**:
 *
 * 1. **El mapeo no lo propone una IA.** Lo propone una tabla de sinónimos de
 *    cabecera con una confianza fija por tipo de coincidencia (exacta, sinónimo,
 *    parcial). Es determinista y se puede probar; la spec dice «propuesto por IA»
 *    y la pantalla no lo dice en ningún texto.
 * 2. **`price` no se puede elegir.** El precio de catálogo es E2EE (0002) y hoy
 *    nadie tiene una clave con la que cifrarlo para su lector. La opción sale
 *    deshabilitada, con su etiqueta del HTML aprobado.
 * 3. **Solo CSV, TSV y TXT.** XLSX/XLS necesitan una dependencia que no está; un
 *    archivo así acaba en el estado de fallo de INV-03 («formato no compatible»).
 * 4. **`product_family` es opcional (0045, decisión del PO del 6-oct) y no está en el
 *    desplegable.** Se rellena solo si `inferFamily` reconoce la referencia; si no,
 *    la línea entra igual con `null`. Antes era obligatoria y 54 líneas de la
 *    primera importación real se quedaron fuera por eso.
 * 5. **Máximo 20.000 líneas por subida** (`MAX_LINES_PER_UPLOAD`): es lo que cabe
 *    en una petición. El de 500.000 líneas publicadas lo sigue poniendo la base.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Campos de la plataforma
// ─────────────────────────────────────────────────────────────────────────────

export type PlatformField =
  | 'part_number'
  | 'brand'
  | 'quantity'
  | 'location_country'
  | 'price'
  | 'lead_time_days'
  | 'notes'
  | 'ignore';

export interface FieldOption {
  value: PlatformField;
  /** Texto de la opción, verbatim del HTML aprobado. */
  label: string;
  required: boolean;
  /** `price`: no se puede elegir (ver cabecera, punto 2). */
  disabled: boolean;
}

/** Las opciones del desplegable, en el orden del HTML aprobado. */
export const FIELD_OPTIONS: readonly FieldOption[] = [
  { value: 'part_number', label: 'part_number — Referencia del rodamiento *', required: true, disabled: false },
  { value: 'brand', label: 'brand — Marca / Fabricante *', required: true, disabled: false },
  { value: 'quantity', label: 'quantity — Cantidad disponible *', required: true, disabled: false },
  { value: 'location_country', label: 'location_country — País de stock *', required: true, disabled: false },
  { value: 'price', label: 'price — Precio (E2EE)', required: false, disabled: true },
  { value: 'lead_time_days', label: 'lead_time_days — Plazo de entrega', required: false, disabled: false },
  { value: 'notes', label: 'notes — Notas adicionales', required: false, disabled: false },
  { value: 'ignore', label: '— Ignorar esta columna —', required: false, disabled: false },
];

export const REQUIRED_FIELDS: readonly PlatformField[] = ['part_number', 'brand', 'quantity', 'location_country'];

export type ImportPolicy = 'REPLACE' | 'ACCUMULATE';

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_LINES_PER_UPLOAD = 20000;
/** Filas de las que sale el «Ejemplo de valor» (la pill `Muestra: 10 filas`). */
export const ANALYSED_SAMPLE_ROWS = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Lectura del archivo
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedFile {
  name: string;
  headers: string[];
  /** Solo las filas de datos (sin cabecera), sin las totalmente vacías. */
  rows: string[][];
}

export type ReadResult =
  | { kind: 'ok'; file: ParsedFile }
  | { kind: 'unsupported'; name: string }
  | { kind: 'empty'; name: string }
  | { kind: 'too_big'; name: string };

const TEXT_EXTENSIONS = ['csv', 'tsv', 'txt'];
/** Lo que la dropzone de INV-01 admite (su `dzHint`). XLSX/XLS se admiten y caen en el fallo de INV-03. */
const UPLOAD_EXTENSIONS = [...TEXT_EXTENSIONS, 'xlsx', 'xls'];

/** `accept` del `<input type="file">` de INV-01. */
export const UPLOAD_ACCEPT = UPLOAD_EXTENSIONS.map((e) => `.${e}`).join(',');

/** Error de la dropzone de INV-01, verbatim de su HTML aprobado (`#dzErr`). */
export const UPLOAD_REJECTED = 'Formato no admitido. Sube un CSV, XLSX, XLS, TSV o TXT de máx. 50 MB.';

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/** ¿Lo admite la dropzone de INV-01? Extensión de la lista y como mucho 50 MB. */
export function isAcceptedUpload(file: Pick<File, 'name' | 'size'>): boolean {
  return UPLOAD_EXTENSIONS.includes(fileExtension(file.name)) && file.size <= MAX_FILE_BYTES;
}

/** Delimitador de un archivo de texto: el que más aparece en la cabecera, fuera de comillas. */
export function detectDelimiter(firstLine: string): string {
  const candidates = ['\t', ';', ',', '|'];
  let best = ',';
  let bestCount = 0;
  for (const d of candidates) {
    let count = 0;
    let quoted = false;
    for (const ch of firstLine) {
      if (ch === '"') quoted = !quoted;
      else if (ch === d && !quoted) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/** CSV con comillas a la RFC 4180 (comillas dobladas, saltos de línea dentro de comillas). */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Texto de un archivo → `ParsedFile`. `null` si no hay cabecera con al menos una celda. */
export function parseImportText(name: string, raw: string): ParsedFile | null {
  const text = raw.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const all = parseDelimited(text, detectDelimiter(firstLine));
  const nonEmpty = all.filter((r) => r.some((c) => c.trim() !== ''));
  const [headerRow, ...rows] = nonEmpty;
  if (!headerRow) return null;
  const headers = headerRow.map((h) => h.trim());
  if (headers.every((h) => h === '')) return null;
  return { name, headers, rows };
}

/**
 * Bytes → texto. UTF-8 si lo es; si no, Windows-1252, que es como exporta Excel
 * un CSV en un Windows en español («País» llega como `Pa\xEDs`).
 */
export function decodeText(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

function readBytes(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('No se ha podido leer el archivo.'));
    reader.readAsArrayBuffer(file);
  });
}

/** Lee el `File` de INV-01. Solo texto; XLSX/XLS y lo demás, `unsupported`. */
export async function readImportFile(file: File): Promise<ReadResult> {
  if (!TEXT_EXTENSIONS.includes(fileExtension(file.name))) return { kind: 'unsupported', name: file.name };
  if (file.size > MAX_FILE_BYTES) return { kind: 'too_big', name: file.name };
  const parsed = parseImportText(file.name, decodeText(await readBytes(file)));
  if (!parsed) return { kind: 'empty', name: file.name };
  return { kind: 'ok', file: parsed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Columnas y propuesta de mapeo
// ─────────────────────────────────────────────────────────────────────────────

export interface ImportColumn {
  index: number;
  header: string;
  /** Primer valor no vacío de las primeras `ANALYSED_SAMPLE_ROWS` filas; `''` si no hay. */
  example: string;
}

export interface ColumnProposal {
  field: PlatformField;
  /** 0–100. */
  confidence: number;
}

export function columnsOf(file: ParsedFile): ImportColumn[] {
  const sample = file.rows.slice(0, ANALYSED_SAMPLE_ROWS);
  return file.headers.map((header, index) => ({
    index,
    header,
    example: sample.map((r) => (r[index] ?? '').trim()).find((v) => v !== '') ?? '',
  }));
}

/** Minúsculas, sin acentos y sin nada que no sea letra o dígito. */
export function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Sinónimos (ya normalizados) por campo elegible. `price` no está: no se propone. */
const SYNONYMS: Record<Exclude<PlatformField, 'ignore' | 'price'>, string[]> = {
  part_number: [
    'ref', 'referencia', 'reference', 'partnumber', 'partno', 'partnum', 'part', 'pn', 'codigo', 'code',
    'designacion', 'designation', 'articulo', 'modelo', 'model', 'sku', 'itemnumber', 'itemno', 'item',
    'material', 'materialnumber', 'nparte', 'numeroparte', 'numerodeparte', 'artikel', 'artikelnummer',
  ],
  brand: ['marca', 'brand', 'fabricante', 'manufacturer', 'make', 'mfr', 'proveedor'],
  quantity: ['cantidad', 'qty', 'quantity', 'uds', 'unidades', 'units', 'stock', 'existencias', 'cant'],
  location_country: ['pais', 'country', 'locationcountry', 'paisdestock', 'origen', 'ubicacion', 'location'],
  lead_time_days: ['plazo', 'leadtime', 'leadtimedays', 'plazodeentrega', 'dias', 'entrega', 'diasentrega'],
  notes: ['notas', 'notes', 'observaciones', 'comentarios', 'comments', 'nota'],
};

/** Confianza por tipo de coincidencia. Verde > 85, amarillo 60–85, rojo < 60 (spec §3). */
export const CONFIDENCE = { canonical: 99, synonym: 92, partial: 70, none: 10 } as const;

function scoreHeader(header: string, field: Exclude<PlatformField, 'ignore' | 'price'>): number {
  const h = normalizeHeader(header);
  if (h === '') return 0;
  if (h === normalizeHeader(field)) return CONFIDENCE.canonical;
  const syn = SYNONYMS[field];
  if (syn.includes(h)) return CONFIDENCE.synonym;
  if (syn.some((s) => s.length >= 3 && (h.startsWith(s) || s.startsWith(h) && h.length >= 3))) return CONFIDENCE.partial;
  return 0;
}

/**
 * Un campo por columna. Cada campo va como mucho a UNA columna: si dos compiten,
 * se lo queda la de más confianza (a igualdad, la primera) y la otra va a `ignore`.
 */
export function proposeMapping(columns: ImportColumn[]): ColumnProposal[] {
  const fields = Object.keys(SYNONYMS) as Array<keyof typeof SYNONYMS>;
  const best = columns.map((c) => {
    let field: PlatformField = 'ignore';
    let confidence = 0;
    for (const f of fields) {
      const s = scoreHeader(c.header, f);
      if (s > confidence) {
        field = f;
        confidence = s;
      }
    }
    return { field, confidence };
  });
  const out: ColumnProposal[] = best.map((b) =>
    b.field === 'ignore' ? { field: 'ignore', confidence: CONFIDENCE.none } : { ...b },
  );
  out.forEach((_, i) => {
    out.forEach((_, j) => {
      const a = out[i];
      const b = out[j];
      if (!a || !b || j === i || a.field === 'ignore' || b.field !== a.field) return;
      const loser = b.confidence > a.confidence || (b.confidence === a.confidence && j < i) ? i : j;
      out[loser] = { field: 'ignore', confidence: CONFIDENCE.none };
    });
  });
  return out;
}

export type ConfidenceTone = 'hi' | 'mid' | 'lo';

/** `.conf.hi` / `.mid` / `.lo` del HTML aprobado. */
export function confidenceTone(confidence: number): ConfidenceTone {
  if (confidence > 85) return 'hi';
  if (confidence >= 60) return 'mid';
  return 'lo';
}

export function confidenceLabel(confidence: number): string {
  return `${Math.round(confidence)}%`;
}

/**
 * Asigna `field` a la columna `index`. Un campo no va a dos columnas: si otra lo
 * tenía, esa pasa a `ignore`. `ignore` puede repetirse.
 */
export function assignField(mapping: PlatformField[], index: number, field: PlatformField): PlatformField[] {
  return mapping.map((f, i) => {
    if (i === index) return field;
    if (field !== 'ignore' && f === field) return 'ignore';
    return f;
  });
}

/**
 * El país por defecto que se puede usar: el de la organización, si es un ISO-2.
 * `profile.orgCountry` vale `—` cuando no se conoce, y eso no es un país.
 */
export function usableDefaultCountry(country: string | null | undefined): string | null {
  const c = (country ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

/**
 * Obligatorios sin columna, en el orden de `REQUIRED_FIELDS`. Con `defaultCountry`
 * (el de la organización) el país deja de ser obligatorio EN EL ARCHIVO: un archivo de
 * un almacén propio no suele traerlo. Es una desviación de la spec §3 (decisión del PO,
 * 6-oct): sin el segundo argumento, la regla es la de la spec.
 */
export function missingRequired(mapping: PlatformField[], defaultCountry?: string | null | undefined): PlatformField[] {
  const fallback = usableDefaultCountry(defaultCountry) !== null;
  return REQUIRED_FIELDS.filter((f) => !mapping.includes(f) && !(fallback && f === 'location_country'));
}

/** Tooltip y aviso del botón deshabilitado (spec §6). `null` si no falta ninguno. */
export function missingRequiredMessage(mapping: PlatformField[], defaultCountry?: string | null | undefined): string | null {
  const missing = missingRequired(mapping, defaultCountry);
  return missing.length === 0 ? null : `Debes mapear las columnas: ${missing.join(', ')}`;
}

/**
 * Aviso de que el país sale de la organización, o `null` si el archivo trae su
 * columna de país (o no hay país de organización que usar).
 */
export function defaultCountryNotice(mapping: PlatformField[], defaultCountry?: string | null | undefined): string | null {
  const c = usableDefaultCountry(defaultCountry);
  if (c === null || mapping.includes('location_country')) return null;
  return `Tu archivo no trae país: todas las líneas se importarán con ${c}, el país de tu organización.`;
}

/** Spec §4: nombre del perfil, mín. 3 y máx. 50 caracteres (sin contar espacios de los bordes). */
export function isValidProfileName(name: string): boolean {
  const n = name.trim().length;
  return n >= 3 && n <= 50;
}

/** El aviso que bloquea el botón por tamaño (spec §7). `null` si cabe. */
export function lineLimitWarning(rowCount: number): string | null {
  if (rowCount <= MAX_LINES_PER_UPLOAD) return null;
  return `El archivo tiene ${formatCount(rowCount)} filas y el máximo por subida es ${formatCount(MAX_LINES_PER_UPLOAD)}. Divídelo en varios archivos.`;
}

/** ¿Se puede pulsar «Confirmar e importar»? */
export function canConfirm(args: {
  mapping: PlatformField[];
  saveProfile: boolean;
  profileName: string;
  rowCount: number;
  defaultCountry?: string | null | undefined;
}): boolean {
  if (missingRequired(args.mapping, args.defaultCountry).length > 0) return false;
  if (args.saveProfile && !isValidProfileName(args.profileName)) return false;
  return lineLimitWarning(args.rowCount) === null;
}

/** La pill `1.247 filas` / `6 columnas` / `Muestra: 10 filas` del bloque del archivo. */
export function fileStats(file: Pick<ParsedFile, 'headers' | 'rows'>): { rows: string; columns: string; sample: string } {
  const n = file.rows.length;
  const c = file.headers.length;
  return {
    rows: `${formatCount(n)} ${n === 1 ? 'fila' : 'filas'}`,
    columns: `${formatCount(c)} ${c === 1 ? 'columna' : 'columnas'}`,
    sample: `Muestra: ${Math.min(n, ANALYSED_SAMPLE_ROWS)} ${Math.min(n, ANALYSED_SAMPLE_ROWS) === 1 ? 'fila' : 'filas'}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Perfiles de mapeo
// ─────────────────────────────────────────────────────────────────────────────

/** Estructura de un archivo: cabeceras normalizadas, en orden. Dos archivos con la misma comparten perfil. */
export function headerSignature(headers: string[]): string {
  return headers.map(normalizeHeader).join('|');
}

/** Un perfil guardado aplicado a estas columnas: misma estructura ⇒ mismo número de columnas. */
export function applyProfileMapping(columns: ImportColumn[], saved: unknown): PlatformField[] | null {
  if (!Array.isArray(saved) || saved.length !== columns.length) return null;
  const valid = new Set(FIELD_OPTIONS.filter((o) => !o.disabled).map((o) => o.value));
  if (!saved.every((f): f is PlatformField => typeof f === 'string' && valid.has(f as PlatformField))) return null;
  let mapping: PlatformField[] = columns.map(() => 'ignore');
  saved.forEach((f, i) => {
    mapping = assignField(mapping, i, f);
  });
  return mapping;
}

/** Banner de perfil aplicado (spec §6). */
export function profileBannerText(name: string): string {
  return `Hemos aplicado automáticamente el perfil "${name}". Revisa que todo sea correcto.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validación de líneas
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que viaja a `import_inventory` por línea (nombres de la base). */
export interface ImportLinePayload {
  part_number: string;
  brand: string;
  quantity: number;
  location_country: string;
  /** Opcional desde 0045: la que se reconozca por la referencia, o `null`. Nunca bloquea una línea. */
  product_family: string | null;
  lead_time_days: number | null;
  notes: string | null;
}

export const ERROR_TYPES = {
  empty: 'Campo obligatorio vacío',
  quantity: 'Cantidad no válida',
  negative: 'Cantidad negativa',
  country: 'País no reconocido',
  leadTime: 'Plazo no válido',
  duplicate: 'Línea duplicada',
  tooLong: 'Valor demasiado largo',
} as const;

/** Familia de rodamiento por la forma de la referencia. Los nombres son los de la siembra. */
export function inferFamily(partNumber: string): string | null {
  const p = partNumber.trim().toUpperCase().replace(/\s+/g, '');
  if (/^(NU|NJ|NUP|NN|NF|N)\d/.test(p)) return 'Rodamiento de rodillos cilindricos';
  if (/^(3[0-3]\d{3})/.test(p)) return 'Rodamiento de rodillos conicos';
  if (/^(2[1-4]\d{3})/.test(p)) return 'Rodamiento de rodillos a rotula';
  if (/^5[1-4]\d{3}/.test(p)) return 'Rodamiento axial de bolas';
  if (/^(16\d{3}|6[0-4]\d{2}|6[0-4]\d{3}|618\d{2}|619\d{2})/.test(p)) return 'Rodamiento rigido de bolas';
  if (/^7[0-3]\d{2}/.test(p)) return 'Rodamiento de bolas de contacto angular';
  if (/^(1[0-3]\d{2}|2[2-3]\d{2})(?!\d)/.test(p)) return 'Rodamiento de bolas a rotula';
  return null;
}

const COUNTRY_NAMES: Record<string, string> = {
  espana: 'ES', spain: 'ES', alemania: 'DE', germany: 'DE', deutschland: 'DE', francia: 'FR', france: 'FR',
  italia: 'IT', italy: 'IT', portugal: 'PT', reinounido: 'GB', unitedkingdom: 'GB', uk: 'GB',
  paisesbajos: 'NL', holanda: 'NL', netherlands: 'NL', belgica: 'BE', belgium: 'BE', austria: 'AT',
  suiza: 'CH', switzerland: 'CH', polonia: 'PL', poland: 'PL', suecia: 'SE', sweden: 'SE',
  mexico: 'MX', estadosunidos: 'US', usa: 'US', unitedstates: 'US', china: 'CN', japon: 'JP', japan: 'JP',
};

/** `ES`, `es`, `España`, `Spain` → `ES`. `null` si no se reconoce. */
export function normalizeCountry(value: string): string | null {
  const v = value.trim();
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  return COUNTRY_NAMES[normalizeHeader(v)] ?? null;
}

/** Entero ≥ 0 con punto de millares opcional (`1.200`). `NaN` si no lo es; negativo si lleva signo. */
export function parseQuantity(value: string): number {
  const v = value.trim().replace(/\s/g, '');
  if (/^-?\d+$/.test(v)) return Number(v);
  if (/^-?\d{1,3}(\.\d{3})+$/.test(v)) return Number(v.replace(/\./g, ''));
  return Number.NaN;
}

export interface BuiltLines {
  lines: ImportLinePayload[];
  errors: ImportErrorRow[];
}

/**
 * Valida cada fila contra el mapeo. Una fila con cualquier error no viaja y deja
 * UNA fila de error (la primera que encuentra). `row` es la fila del archivo: la
 * cabecera es la 1, así que la primera de datos es la 2.
 */
export function buildLines(file: ParsedFile, mapping: PlatformField[], defaultCountry?: string | null | undefined): BuiltLines {
  const fallbackCountry = usableDefaultCountry(defaultCountry);
  const col = (f: PlatformField) => mapping.indexOf(f);
  const iPart = col('part_number');
  const iBrand = col('brand');
  const iQty = col('quantity');
  const iCountry = col('location_country');
  const iLead = col('lead_time_days');
  const iNotes = col('notes');
  const lines: ImportLinePayload[] = [];
  const errors: ImportErrorRow[] = [];
  const seen = new Set<string>();

  file.rows.forEach((r, k) => {
    const row = k + 2;
    const cell = (i: number) => (i < 0 ? '' : (r[i] ?? '').trim());
    const fail = (i: number, errorType: string, received: string | null) =>
      errors.push({ row, column: file.headers[i] ?? '', errorType, received });

    for (const i of [iPart, iBrand, iQty, iCountry]) {
      if (i === iCountry && iCountry < 0 && fallbackCountry !== null) continue;
      if (cell(i) === '') return fail(i, ERROR_TYPES.empty, null);
    }
    const part = cell(iPart);
    const brand = cell(iBrand);
    if (part.length > 64) return fail(iPart, ERROR_TYPES.tooLong, part);
    if (brand.length > 64) return fail(iBrand, ERROR_TYPES.tooLong, brand);
    const qty = parseQuantity(cell(iQty));
    if (Number.isNaN(qty)) return fail(iQty, ERROR_TYPES.quantity, cell(iQty));
    if (qty < 0) return fail(iQty, ERROR_TYPES.negative, cell(iQty));
    if (qty > 2147483647) return fail(iQty, ERROR_TYPES.quantity, cell(iQty));
    const country = iCountry < 0 && fallbackCountry !== null ? fallbackCountry : normalizeCountry(cell(iCountry));
    if (!country) return fail(iCountry, ERROR_TYPES.country, cell(iCountry));
    let lead: number | null = null;
    if (cell(iLead) !== '') {
      lead = parseQuantity(cell(iLead));
      if (Number.isNaN(lead) || lead < 0 || lead > 3650) return fail(iLead, ERROR_TYPES.leadTime, cell(iLead));
    }
    const notes = cell(iNotes) === '' ? null : cell(iNotes);
    if (notes !== null && notes.length > 500) return fail(iNotes, ERROR_TYPES.tooLong, `${notes.slice(0, 40)}…`);
    const family = inferFamily(part);
    const key = `${part.toUpperCase()}|${brand.toUpperCase()}|${country}`;
    if (seen.has(key)) return fail(iPart, ERROR_TYPES.duplicate, part);
    seen.add(key);
    lines.push({
      part_number: part,
      brand,
      quantity: qty,
      location_country: country,
      product_family: family,
      lead_time_days: lead,
      notes,
    });
  });
  return { lines, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resúmenes para INV-03
// ─────────────────────────────────────────────────────────────────────────────

/** Un archivo que no se ha podido leer (formato, vacío, tamaño): INV-03 en estado de fallo. */
export function unreadableSummary(): ImportSummary {
  return { processed: 0, published: 0, failed: 0, removed: null, seconds: null, sample: [], errors: [] };
}

export function sampleOf(lines: ImportLinePayload[]): ImportSampleLine[] {
  return lines.slice(0, SAMPLE_SIZE).map((l) => ({
    partNumber: l.part_number,
    brand: l.brand,
    quantity: l.quantity,
    country: l.location_country,
    status: 'PUBLISHED',
  }));
}

/**
 * Por qué no se ha importado nada cuando NINGUNA línea es válida. INV-03 en fallo solo
 * sabe decir «no ha podido leer el archivo» (su spec), y eso es falso aquí: el archivo se
 * leyó y lo que falla son sus líneas. Se enseña en INV-02, con los motivos y un ejemplo.
 * `null` si hay alguna línea publicada o ninguna fila con error.
 */
export function noValidLinesMessage(summary: Pick<ImportSummary, 'published' | 'errors'>): string | null {
  if (summary.published > 0 || summary.errors.length === 0) return null;
  const counts = new Map<string, number>();
  for (const e of summary.errors) counts.set(e.errorType, (counts.get(e.errorType) ?? 0) + 1);
  const reasons = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, n]) => `${type} (${formatCount(n)})`)
    .join(', ');
  const first = summary.errors[0];
  const example = first
    ? ` Ejemplo: fila ${first.row}, columna «${first.column || '—'}», valor «${first.received ?? '—'}».`
    : '';
  return `Ninguna línea del archivo es válida, así que no se ha importado nada. Motivos: ${reasons}.${example}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Red
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El perfil guardado para esta estructura, si lo hay. **Tolerante a propósito**:
 * un perfil es una comodidad, y si la lectura falla (red, o una base sin 0044) la
 * importación sigue con la propuesta por sinónimos, sin banner.
 */
export async function fetchProfile(signature: string): Promise<{ name: string; mapping: unknown } | null> {
  try {
    const { data, error } = await supabase
      .from('inventory_import_profiles')
      .select('name, mapping')
      .eq('header_signature', signature)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return { name: String(data.name), mapping: data.mapping };
  } catch {
    return null;
  }
}

export interface ImportChoice {
  mapping: PlatformField[];
  policy: ImportPolicy;
  /** `null` si no se marca «Guardar este mapeo como perfil». */
  profileName: string | null;
  /** País de la organización, para el archivo sin columna de país (ver `missingRequired`). */
  defaultCountry?: string | null | undefined;
}

/** Inyectable para los tests (sin reloj real). */
type Clock = () => number;

/**
 * Valida, importa y resume. Si ninguna línea es válida no llama a la base: el
 * resumen sale con 0 publicadas (INV-03 en fallo) y con los errores de cada fila.
 * Si la base rechaza el lote, lanza con su mensaje: INV-02 lo enseña y no se
 * importa nada (una transacción).
 */
export async function runImport(file: ParsedFile, choice: ImportChoice, now: Clock = () => performance.now()): Promise<ImportSummary> {
  const t0 = now();
  const { lines, errors } = buildLines(file, choice.mapping, choice.defaultCountry);
  const base = { processed: file.rows.length, failed: errors.length, errors, sample: sampleOf(lines) };
  if (lines.length === 0) {
    return { ...base, published: 0, removed: null, seconds: (now() - t0) / 1000, sample: [] };
  }
  const { data, error } = await supabase.rpc('import_inventory', {
    p_lines: lines,
    p_policy: choice.policy,
    p_profile_name: choice.profileName,
    p_header_signature: choice.profileName === null ? null : headerSignature(file.headers),
    p_mapping: choice.profileName === null ? null : choice.mapping,
  });
  if (error) throw new Error(errorMessage(error));
  const result = (data ?? {}) as { published?: number; removed?: number | null; inserted?: number; updated?: number };
  const hasSplit = typeof result.inserted === 'number' && typeof result.updated === 'number';
  return {
    ...base,
    ...(hasSplit ? { created: Number(result.inserted), updated: Number(result.updated) } : {}),
    published: Number(result.published ?? lines.length),
    removed: result.removed === null || result.removed === undefined ? null : Number(result.removed),
    seconds: (now() - t0) / 1000,
  };
}
