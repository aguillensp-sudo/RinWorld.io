import type { ColumnProposal, ImportChoice, ParsedFile, PlatformField } from '../../lib/inventory-import';

interface Props {
  /** El archivo ya leído por `readImportFile` (cabeceras y filas de datos). */
  file: ParsedFile;
  /** La propuesta por columna: su `confidence` es lo que pinta la columna `Confianza`. */
  proposal: ColumnProposal[];
  /** El mapeo con el que arrancan los desplegables (la propuesta, o un perfil guardado). */
  initialMapping: PlatformField[];
  /** Nombre del perfil aplicado automáticamente, o `null`. */
  appliedProfile: string | null;
  /** La importación está en marcha. */
  busy: boolean;
  /** Mensaje de la base si rechazó el lote, o `null`. */
  error: string | null;
  /** `Confirmar e importar`. */
  onConfirm: (choice: ImportChoice) => void;
  /** `Cancelar y volver al inventario` (INV-01). */
  onCancel: () => void;
}

/**
 * MARCADOR de INV-02 · Procesamiento y Mapeo de Columnas. La tarea del arnés
 * (`harness/tasks/INV-02.json`) sustituye este fichero y su `.module.css`. Existe para que
 * `App.tsx` compile y el contrato tenga una ruta real antes de la corrida.
 */
export function ImportMapping(_props: Props) {
  return <div data-testid="inv02-placeholder" />;
}
