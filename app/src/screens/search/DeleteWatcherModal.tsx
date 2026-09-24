interface Props {
  partNumber: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * SRCH-03 · modal de confirmación de borrado (spec §6) -- MARCADOR. Se prueba
 * entero a través de `Watchers.test.tsx`. La tarea del arnés sustituye este
 * fichero entero.
 */
export function DeleteWatcherModal(_props: Props) {
  return <div data-testid="delete-watcher-modal" />;
}
