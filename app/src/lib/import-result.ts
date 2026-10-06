/**
 * Capa de datos de INV-03 · Resultado de la Importación.
 *
 * TODO es lógica pura: la pantalla es de solo lectura y no toca red. Recibe un
 * `ImportSummary` ya calculado y esta capa decide qué se dice de él (título, cifras,
 * qué filas se enseñan, el CSV de errores). El *productor* del resumen es INV-02
 * (importación), que no existe todavía: hasta entonces la pantalla solo se ve con los
 * ejemplos de `IMPORT_EXAMPLES`, en desarrollo.
 *
 * ⚠ `toLocaleString('es-ES')` NO agrupa los números de cuatro cifras (`1247`, no
 * `1.247`: la regla de agrupación mínima de es-ES pide dos dígitos antes del primer
 * punto), y la spec de INV-03 escribe `1.247`. Por eso `formatCount` agrupa a mano.
 */

/** Una línea del archivo que no se importó (spec §3, tabla del panel de errores). */
export interface ImportErrorRow {
  /** Número de fila en el archivo original (1 = la primera de datos). */
  row: number;
  /** Columna de la plataforma que falló: `quantity`, `location_country`, `part_number`… */
  column: string;
  /** `Cantidad negativa` · `País inválido` · `Referencia vacía`… */
  errorType: string;
  /** Lo que llegó en el archivo; `null` si la celda estaba vacía. */
  received: string | null;
}

/** Una línea importada que se enseña en la muestra (spec §3). */
export interface ImportSampleLine {
  partNumber: string;
  brand: string;
  quantity: number;
  /** ISO 3166-1 alfa-2. */
  country: string;
  status: string;
}

export interface ImportSummary {
  processed: number;
  published: number;
  failed: number;
  /** Solo con la política «Reemplazo total»; `null` en modo acumulativo (spec §7). */
  removed: number | null;
  /** Segundos de procesamiento; `null` si no se midió. */
  seconds: number | null;
  /**
   * De las `published`: cuántas son líneas NUEVAS y cuántas YA EXISTÍAN y se han actualizado
   * con los datos del archivo (0046). Opcionales: el resumen de ejemplo y el de un archivo
   * ilegible no los tienen, y entonces el subtítulo no dice nada de ellas.
   */
  created?: number | undefined;
  updated?: number | undefined;
  /** Las líneas importadas, en orden de archivo. La pantalla enseña SIEMPRE solo las 10 primeras. */
  sample: ImportSampleLine[];
  /** Todas las líneas fallidas, en orden de archivo. */
  errors: ImportErrorRow[];
}

export type ImportOutcome = 'ok' | 'warn' | 'fail';

/** Spec §3: la muestra es SIEMPRE de 10 líneas, se importen las que se importen. */
export const SAMPLE_SIZE = 10;
/** Filas del panel de errores que se pintan; el resto va solo en el CSV (HTML aprobado). */
export const ERROR_PREVIEW_ROWS = 4;

/**
 * Sin ninguna línea publicada es fallo total (spec §6); con líneas publicadas y alguna
 * con error, advertencias; si no, éxito.
 */
export function importOutcome(s: Pick<ImportSummary, 'published' | 'failed'>): ImportOutcome {
  if (s.published <= 0) return 'fail';
  return s.failed > 0 ? 'warn' : 'ok';
}

const TITLES: Record<ImportOutcome, string> = {
  ok: 'Importación completada',
  warn: 'Importación completada con advertencias',
  fail: 'La importación no ha podido completarse',
};

export function outcomeTitle(outcome: ImportOutcome): string {
  return TITLES[outcome];
}

/** Entero con punto de millares desde cuatro cifras (`1247` → `1.247`). */
export function formatCount(n: number): string {
  const int = Math.trunc(Math.abs(n)).toString();
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return n < 0 ? `-${grouped}` : grouped;
}

/** `4,2 s`; una sola decimal, coma decimal. Sin medida: `—`. */
export function formatSeconds(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  return `${seconds.toFixed(1).replace('.', ',')} s`;
}

/**
 * « N nuevas y M que ya existían (actualizadas con los datos del archivo).» (con un espacio
 * delante), o `''` si el resumen no trae el desglose. Lo que explica que subir de nuevo un archivo
 * con «Acumulativo» no duplica: lo ya existente se actualiza.
 */
export function newVsExistingSentence(s: Pick<ImportSummary, 'created' | 'updated'>): string {
  if (s.created === undefined || s.updated === undefined) return '';
  const nuevas = `${formatCount(s.created)} ${s.created === 1 ? 'nueva' : 'nuevas'}`;
  const existian = `${formatCount(s.updated)} ${s.updated === 1 ? 'que ya existía' : 'que ya existían'}`;
  const tail = s.updated === 0 ? '' : ` (${s.updated === 1 ? 'actualizada' : 'actualizadas'} con los datos del archivo)`;
  return ` ${nuevas} y ${existian}${tail}.`;
}

/** El subtítulo bajo el título: cambia con el resultado (HTML aprobado, `setState`). */
export function outcomeSubtitle(s: ImportSummary): string {
  const split = newVsExistingSentence(s);
  switch (importOutcome(s)) {
    case 'ok':
      return `${formatCount(s.published)} líneas publicadas correctamente.${split} No se han detectado errores.`;
    case 'warn':
      return `Tu inventario ha sido actualizado.${split} Revisa las líneas que no pudieron importarse y corrígelas.`;
    case 'fail':
      return 'El sistema no ha podido procesar el archivo. Ninguna línea ha sido publicada.';
  }
}

/** Las 10 primeras líneas importadas, nunca más (spec §7). */
export function sampleLines(s: Pick<ImportSummary, 'sample'>): ImportSampleLine[] {
  return s.sample.slice(0, SAMPLE_SIZE);
}

/** Las filas fallidas que se pintan al expandir el panel. */
export function previewErrors(s: Pick<ImportSummary, 'errors'>): ImportErrorRow[] {
  return s.errors.slice(0, ERROR_PREVIEW_ROWS);
}

/**
 * La etiqueta sobre la muestra (spec §3). Con 10 líneas o más es la de la spec, verbatim; con
 * menos, decir «las primeras 10» sería falso, así que cuenta las que hay.
 */
export function sampleHint(count: number): string {
  if (count >= SAMPLE_SIZE) {
    return 'Mostrando las primeras 10 líneas importadas como muestra — el inventario completo ya está publicado.';
  }
  const shown = count === 1 ? 'la única línea importada' : `las ${count} líneas importadas`;
  return `Mostrando ${shown} — el inventario completo ya está publicado.`;
}

/** Cabecera del panel de errores: `34 líneas no importadas — ver detalle`. */
export function errorsPanelLabel(failed: number): string {
  const noun = failed === 1 ? 'línea no importada' : 'líneas no importadas';
  return `${formatCount(failed)} ${noun} — ver detalle`;
}

/** Última fila del panel: `… y 30 líneas más en el CSV descargable`; `null` si no sobra ninguna. */
export function moreErrorsLabel(s: Pick<ImportSummary, 'errors'>): string | null {
  const rest = s.errors.length - previewErrors(s).length;
  if (rest <= 0) return null;
  return `… y ${formatCount(rest)} ${rest === 1 ? 'línea más' : 'líneas más'} en el CSV descargable`;
}

/** La celda «Valor recibido»: una celda vacía se pinta `—`. */
export function receivedLabel(received: string | null): string {
  return received === null || received === '' ? '—' : received;
}

const CSV_HEADER = ['Fila', 'Columna', 'Tipo de error', 'Valor recibido'];

/**
 * Una celda de CSV (RFC 4180): entre comillas si lleva coma, comillas o salto de línea. Y
 * una celda que empieza por `=`, `+`, `@`, tabulador o retorno lleva delante una comilla
 * simple, para que Excel no la ejecute como fórmula; `-` NO se toca porque `-5` es el valor
 * real de un error de cantidad negativa y el usuario lo va a corregir y a re-subir.
 */
function csvCell(value: string): string {
  const safe = /^[=+@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** El CSV de todas las líneas fallidas (no solo las que se pintan), con cabecera y `\r\n`. */
export function buildErrorsCsv(errors: ImportErrorRow[]): string {
  const rows = errors.map((e) => [String(e.row), e.column, e.errorType, e.received ?? ''].map(csvCell).join(','));
  return [CSV_HEADER.join(','), ...rows].join('\r\n');
}

/** `errores-importacion-2026-09-30.csv` (fecha local). */
export function errorsCsvFilename(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `errores-importacion-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.csv`;
}

/**
 * Descarga un texto como fichero. Lleva BOM UTF-8 delante: sin él, Excel abre `País
 * inválido` con los acentos rotos. Es la única función de esta capa que toca el navegador.
 */
export function downloadCsv(filename: string, text: string): void {
  const blob = new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const EXAMPLE_SAMPLE: ImportSampleLine[] = [
  ['6205-2RS/C3', 'SKF', 850],
  ['NU2210-E-TVP2', 'FAG', 120],
  ['6305-ZZ', 'NSK', 340],
  ['22316-E', 'FAG', 75],
  ['6206-2RS', 'SKF', 200],
  ['7210-BECBP', 'SKF', 45],
  ['23026-E1', 'FAG', 12],
  ['NU318-E-M1', 'FAG', 8],
  ['6004-RSH', 'SKF', 560],
  ['7311-BECBP', 'SKF', 33],
].map(([partNumber, brand, quantity]) => ({
  partNumber: partNumber as string,
  brand: brand as string,
  quantity: quantity as number,
  country: 'ES',
  status: 'PUBLISHED',
}));

const EXAMPLE_ERRORS: ImportErrorRow[] = [
  { row: 15, column: 'quantity', errorType: 'Cantidad negativa', received: '-5' },
  { row: 23, column: 'quantity', errorType: 'Cantidad negativa', received: '-12' },
  { row: 88, column: 'location_country', errorType: 'País inválido', received: 'ESP' },
  { row: 142, column: 'part_number', errorType: 'Referencia vacía', received: null },
  ...Array.from({ length: 30 }, (_, i): ImportErrorRow => ({
    row: 200 + i * 7,
    column: i % 5 === 0 ? 'location_country' : 'quantity',
    errorType: i % 5 === 0 ? 'País inválido' : 'Cantidad negativa',
    received: i % 5 === 0 ? 'ESP' : `-${i + 1}`,
  })),
];

/**
 * Los tres estados de la spec, con las cifras de su «Datos de ejemplo». Solo para
 * desarrollo (`#importacion-ejemplo=…` en `App.tsx`): INV-02 todavía no produce nada real.
 */
export const IMPORT_EXAMPLES: Record<ImportOutcome, ImportSummary> = {
  warn: {
    processed: 1247,
    published: 1213,
    failed: 34,
    removed: 127,
    seconds: 4.2,
    sample: EXAMPLE_SAMPLE,
    errors: EXAMPLE_ERRORS,
  },
  ok: {
    processed: 1247,
    published: 1247,
    failed: 0,
    removed: 127,
    seconds: 3.8,
    sample: EXAMPLE_SAMPLE,
    errors: [],
  },
  fail: {
    processed: 0,
    published: 0,
    failed: 0,
    removed: null,
    seconds: null,
    sample: [],
    errors: [],
  },
};

/** `#importacion-ejemplo=warn|ok|fail` → el estado de ejemplo, o `null`. */
export function importExampleFromHash(hash: string): ImportSummary | null {
  const m = /^#importacion-ejemplo=(ok|warn|fail)$/.exec(hash);
  return m ? IMPORT_EXAMPLES[m[1] as ImportOutcome] : null;
}
