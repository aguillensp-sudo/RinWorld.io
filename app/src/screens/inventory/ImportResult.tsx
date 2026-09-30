import type { ImportSummary } from '../../lib/import-result';

interface Props {
  /** El resumen ya calculado de una importación. Lo produce INV-02 (que aún no existe). */
  summary: ImportSummary;
  /** `Volver al panel de inventario` (INV-01). */
  onBackToInventory: () => void;
  /** `Subir correcciones` (solo con advertencias): vuelve a INV-01. */
  onUploadCorrections: () => void;
  /** Inyectable para el nombre del CSV de errores; por defecto `new Date()`. */
  now?: Date;
}

/**
 * MARCADOR de INV-03 · Resultado de la Importación. La tarea del arnés
 * (`harness/tasks/INV-03.json`) sustituye este fichero y su `.module.css`. Existe para que
 * `App.tsx` compile y el contrato tenga una ruta real antes de la corrida.
 */
export function ImportResult(_props: Props) {
  return <div data-testid="inv03-placeholder" />;
}
