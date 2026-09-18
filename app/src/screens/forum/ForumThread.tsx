import type { MemberProfile } from '../../lib/session';

interface Props {
  profile: MemberProfile;
  threadId: string;
  onBackToForum: () => void;
  onBackToCategory: () => void;
  now?: Date;
}

/**
 * FORO-03 · Vista de un Hilo.
 *
 * MARCADOR: la construye la tarea del arnés (`harness/tasks/FORO-03.json`),
 * mismo patrón que `ForumCategory.tsx` antes de la tarea de FORO-02. La
 * precondición de wiring (el título de una fila de FORO-02 ya llama a
 * `onOpenThread`, y `App.tsx` monta este componente con `threadId`,
 * `onBackToForum` y `onBackToCategory`) está hecha; lo que falta es el panel
 * de contenido en sí.
 */
export function ForumThread({ profile, threadId, onBackToForum, onBackToCategory, now = new Date() }: Props) {
  void profile;
  void onBackToForum;
  void onBackToCategory;
  void now;
  return <div data-testid="forum-thread" data-thread-id={threadId} />;
}
