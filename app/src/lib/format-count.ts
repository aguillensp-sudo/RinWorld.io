/**
 * Entero con punto de millares desde cuatro cifras (`1247` -> `1.247`).
 *
 * `toLocaleString('es-ES')` NO agrupa los numeros de cuatro cifras (la regla de
 * agrupacion minima de es-ES pide dos digitos antes del primer punto), y las specs
 * escriben `1.247`. Decision del PO del 9-oct-2026 (F-231): se agrupa a mano, siempre.
 */
export function formatCount(n: number): string {
  const int = Math.trunc(Math.abs(n)).toString();
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return n < 0 ? `-${grouped}` : grouped;
}
