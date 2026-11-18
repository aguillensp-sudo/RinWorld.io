import { supabase } from './supabase';

/**
 * Hilos sin leer (F-027 a, `0082`). Decisión del PO del 18-nov-2026.
 *
 * «Sin leer» es por miembro: lo que la otra empresa ha creado, o el estado que ha cambiado en lo
 * propio, después de la última vez que el miembro abrió el hilo (o de su alta). Lo calcula la base,
 * bajo la RLS de quien llama, así que nunca cuenta lo que el miembro no puede ver. Solo metadatos.
 */
export interface UnreadThread {
  threadId: string;
  counterpartyName: string;
  /** El estado del hilo, en el texto de la base (`ABIERTO`, `CON OFERTA PENDIENTE`…). */
  threadState: string;
  count: number;
  lastUnreadAt: string;
}

interface UnreadRow {
  thread_id: string;
  counterparty_name: string;
  thread_state: string;
  unread_count: number;
  last_unread_at: string;
}

/** Los hilos con algo sin leer, del más reciente al más antiguo. Lanza si la RPC falla. */
export async function fetchUnreadThreads(): Promise<UnreadThread[]> {
  const { data, error } = await supabase.rpc('unread_threads');
  if (error) throw error;
  return ((data ?? []) as UnreadRow[]).map((r) => ({
    threadId: r.thread_id,
    counterpartyName: r.counterparty_name,
    threadState: r.thread_state,
    count: r.unread_count,
    lastUnreadAt: r.last_unread_at,
  }));
}

/**
 * Marca el hilo como leído para quien lo abre; la hora la pone el servidor. **Nunca lanza**: que no se
 * pueda marcar no puede tumbar la pantalla del hilo. Si falla, el hilo sigue saliendo sin leer, que es
 * el error que menos engaña.
 */
export async function markThreadRead(threadId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('mark_thread_read', { p_thread_id: threadId });
    if (error) console.error('No se pudo marcar el hilo como leído', error.message);
  } catch (e) {
    console.error('No se pudo marcar el hilo como leído', e);
  }
}
