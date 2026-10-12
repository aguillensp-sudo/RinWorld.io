/**
 * Reglas de importación de la función `ingest-email` (INV-04, fase 2).
 *
 * ⚠ **ES UNA COPIA, A PROPÓSITO.** Cada función de aquí está tomada tal cual de
 * `app/src/lib/inventory-import.ts`, que es la que ejecuta el navegador. No se importa de
 * allí porque la función se despliega desde `supabase/` y la app (Vercel) desde `app/`:
 * ninguna de las dos ve la carpeta de la otra. Lo que impide que se separen son los tests
 * `app/src/lib/ingest-email.paridad.test.ts`, que pasan los mismos archivos por las dos y
 * exigen el mismo resultado. **Si cambias una, cambia la otra y el test lo dirá.**
 *
 * Sin dependencias y sin `import`s relativos: lo carga Deno (la función) y Node (vitest).
 */

export type PlatformField =
  | 'part_number'
  | 'brand'
  | 'quantity'
  | 'location_country'
  | 'price'
  | 'lead_time_days'
  | 'notes'
  | 'ignore';

export interface ParsedFile {
  name: string;
  headers: string[];
  rows: string[][];
}

export interface ImportColumn {
  index: number;
  header: string;
  example: string;
}

export interface ImportErrorRow {
  row: number;
  column: string;
  errorType: string;
  received: string | null;
}

export interface ImportLinePayload {
  part_number: string;
  brand: string;
  quantity: number;
  location_country: string;
  product_family: string | null;
  lead_time_days: number | null;
  notes: string | null;
}

export interface BuiltLines {
  lines: ImportLinePayload[];
  errors: ImportErrorRow[];
}

export const REQUIRED_FIELDS: readonly PlatformField[] = ['part_number', 'brand', 'quantity', 'location_country'];
/** Los campos que un perfil puede asignar: los de `FIELD_OPTIONS` sin `disabled` (todos menos `price`). */
const ASSIGNABLE: ReadonlySet<string> = new Set([
  'part_number', 'brand', 'quantity', 'location_country', 'lead_time_days', 'notes', 'ignore',
]);
export const MAX_LINES_PER_UPLOAD = 20000;

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

/** Matriz de celdas (de un CSV o de la primera hoja de un XLSX) → `ParsedFile`; `null` sin cabecera. */
export function fromRows(name: string, all: string[][]): ParsedFile | null {
  const nonEmpty = all.filter((r) => r.some((c) => c.trim() !== ''));
  const [headerRow, ...rows] = nonEmpty;
  if (!headerRow) return null;
  const headers = headerRow.map((h) => h.trim());
  if (headers.every((h) => h === '')) return null;
  return { name, headers, rows };
}

/** Texto de un archivo → `ParsedFile`. `null` si no hay cabecera con al menos una celda. */
export function parseImportText(name: string, raw: string): ParsedFile | null {
  const text = raw.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  return fromRows(name, parseDelimited(text, detectDelimiter(firstLine)));
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

/** Minúsculas, sin acentos y sin nada que no sea letra o dígito. */
export function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Estructura de un archivo: cabeceras normalizadas, en orden. Dos archivos con la misma comparten perfil. */
export function headerSignature(headers: string[]): string {
  return headers.map(normalizeHeader).join('|');
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

const COUNTRY_NAMES: Record<string, string> = {
  espana: 'ES', spain: 'ES', alemania: 'DE', germany: 'DE', deutschland: 'DE', francia: 'FR', france: 'FR',
  italia: 'IT', italy: 'IT', portugal: 'PT', reinounido: 'GB', unitedkingdom: 'GB', uk: 'GB',
  paisesbajos: 'NL', holanda: 'NL', netherlands: 'NL', belgica: 'BE', belgium: 'BE', austria: 'AT',
  suiza: 'CH', switzerland: 'CH', polonia: 'PL', poland: 'PL', suecia: 'SE', sweden: 'SE',
  mexico: 'MX', estadosunidos: 'US', usa: 'US', unitedstates: 'US', china: 'CN', japon: 'JP', japan: 'JP',
};

export const ERROR_TYPES = {
  empty: 'Campo obligatorio vacío',
  quantity: 'Cantidad no válida',
  negative: 'Cantidad negativa',
  country: 'País no reconocido',
  leadTime: 'Plazo no válido',
  duplicate: 'Línea duplicada',
  tooLong: 'Valor demasiado largo',
} as const;

/** Un perfil guardado aplicado a estas columnas: misma estructura ⇒ mismo número de columnas. */
export function applyProfileMapping(columns: ImportColumn[], saved: unknown): PlatformField[] | null {
  if (!Array.isArray(saved) || saved.length !== columns.length) return null;
  if (!saved.every((f): f is PlatformField => typeof f === 'string' && ASSIGNABLE.has(f))) return null;
  let mapping: PlatformField[] = columns.map(() => 'ignore');
  saved.forEach((f, i) => {
    mapping = assignField(mapping, i, f);
  });
  return mapping;
}

export function columnsOf(file: ParsedFile): ImportColumn[] {
  const sample = file.rows.slice(0, 10);
  return file.headers.map((header, index) => ({
    index,
    header,
    example: sample.map((r) => (r[index] ?? '').trim()).find((v) => v !== '') ?? '',
  }));
}

/** Obligatorios sin columna. El país lo cubre el de la organización (`usableDefaultCountry`). */
export function missingRequired(mapping: PlatformField[], defaultCountry?: string | null | undefined): PlatformField[] {
  const fallback = usableDefaultCountry(defaultCountry) !== null;
  return REQUIRED_FIELDS.filter((f) => !mapping.includes(f) && !(fallback && f === 'location_country'));
}
