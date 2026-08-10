import { ThreadList, type Thread } from './ThreadList';
import styles from './Messages.module.css';

export interface MessagesProps {
  threads?: Thread[];
  page?: number;
  totalPages?: number;
  now?: Date;
  onOpenThread?: (thread: Thread) => void;
  onPageChange?: (page: number) => void;
}

export function Messages({
  threads = [],
  page,
  totalPages,
  now,
  onOpenThread,
  onPageChange,
}: MessagesProps) {
  const handleOpenThread = onOpenThread ?? (() => {});
  const handlePageChange = onPageChange ?? (() => {});

  return (
    <section className={styles.content} aria-labelledby="messages-title">
      <p className={styles.eyebrow}>Módulo 04 · Mensajería E2EE</p>
      <h1 id="messages-title" className={styles.title}>
        Hilos
      </h1>
      <p className={styles.subtitle}>
        Tus conversaciones con otros distribuidores. Todo el contenido está cifrado de extremo a
        extremo.
      </p>

      <ThreadList
        threads={threads}
        page={page}
        totalPages={totalPages}
        now={now}
        onOpenThread={handleOpenThread}
        onPageChange={handlePageChange}
      />
    </section>
  );
}

export default Messages;

export type { Thread, ThreadState } from './ThreadList';
