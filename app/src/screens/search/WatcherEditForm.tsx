import type { WatcherDraft } from '../../lib/watchers';

interface Props {
  partNumber: string;
  draft: WatcherDraft;
  busy: boolean;
  error: string | null;
  onChange: (draft: WatcherDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * SRCH-03 · formulario inline `Editar watcher` (spec §4) -- MARCADOR
 * (`WatcherEditForm.test.tsx` es el contrato, en rojo a propósito hasta la
 * corrida). La tarea del arnés sustituye este fichero entero.
 */
export function WatcherEditForm(_props: Props) {
  return <div data-testid="watcher-edit-form" />;
}
