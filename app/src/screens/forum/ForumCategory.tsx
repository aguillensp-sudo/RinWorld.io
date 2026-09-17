import type { MemberProfile } from '../../lib/session';

/**
 * MARCADOR de FORO-02 · Lista de Hilos de una Categoría.
 *
 * Escrito a mano por Claude Code como precondición de la tarea
 * (`harness/tasks/FORO-02.json`), mismo patrón que `Directory.tsx` para DIR-01:
 * FORO-01 ya navega hasta aquí y el e2e necesita un sitio al que llegar. Lo
 * sustituye entero el artefacto del Coder, con esta misma firma.
 */
interface Props {
  profile: MemberProfile;
  /** El `slug` de la categoría que abrió la tarjeta de FORO-01. */
  slug: string;
  /** Vuelve a FORO-01 (el enlace "Foros" del breadcrumb). */
  onBack: () => void;
  now?: Date;
}

export function ForumCategory({ slug }: Props) {
  return <div data-testid="forum-category" data-slug={slug} />;
}
