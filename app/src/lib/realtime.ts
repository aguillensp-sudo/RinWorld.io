import { supabase } from './supabase';

/**
 * Realtime · hilos y elementos propagando entre sesiones (`Plan §3`, día 7).
 *
 * La escribe Claude Code a mano (`CLAUDE.md` §3: el wiring de Realtime está en la
 * lista de "coste del fallo alto").
 *
 * ── EL PRINCIPIO, Y ES TODA LA DECISIÓN DE DISEÑO ───────────────────────────
 *
 * **Un evento es una SEÑAL PARA RELEER, nunca una fuente de datos.** Aquí no se
 * mira el `payload`: no se mezcla la fila que llega con la que hay en memoria, no
 * se inserta el elemento nuevo en la lista, no se copia el `state` que trae.
 * Llega un evento y la pantalla vuelve a preguntar.
 *
 * Por qué, y no es purismo:
 *
 *   1. **El estado del hilo lo deriva la base** (0007). Si el cliente mezclara el
 *      `state` del payload con lo que tiene, dos navegadores abiertos sobre el
 *      mismo hilo acabarían con estados distintos y ganaría el último que
 *      escribiera. `ESTADO.md` lo avisaba antes de escribir una línea de esto, y
 *      es F-044 otra vez: un estado que deja de ser función de sus filas.
 *   2. **El orden de llegada no es el orden de los hechos.** Dos eventos de dos
 *      tablas —el `thread_items` que se acepta y el `threads` que el trigger
 *      actualiza— llegan por el mismo socket pero sin garantía de qué primero.
 *      Una relectura no tiene ese problema: la base ya resolvió el orden.
 *   3. **Una relectura pasa por RLS entera y por la costura de descifrado.**
 *      Mezclar un payload a mano se salta las dos.
 *
 * El coste es una consulta de más por evento. A escala de demo —cinco hilos, dos
 * cuentas— eso no es un problema, y a cambio no hay un solo camino por el que la
 * pantalla pueda enseñar algo que la base no diga.
 */

export type Unsubscribe = () => void;

/**
 * Ventana de agrupación. Una sola acción del usuario produce **varios** eventos:
 * aceptar una oferta escribe en `thread_items` y el trigger de 0007 escribe en
 * `threads`, así que llegan dos. Sin agrupar, eso son dos relecturas completas
 * para un solo hecho.
 *
 * 120 ms está muy por debajo de lo que se nota (SP-3 midió 327 ms de media de
 * propagación, así que la agrupación no es lo que domina la latencia) y muy por
 * encima del hueco entre dos eventos de la misma transacción.
 */
const COALESCE_MS = 120;

/** Nombres de canal únicos. Dos suscripciones con el mismo nombre comparten canal
 *  en supabase-js, y al desmontar una se llevaría por delante la otra. */
let contador = 0;
const nombreCanal = (prefijo: string) => `${prefijo}:${++contador}`;

/**
 * Agrupa llamadas seguidas en una, y **devuelve también cómo cancelarla**.
 *
 * Lo segundo no es un extra: sin cancelar el temporizador pendiente, un evento
 * que llega justo antes de desmontar dispara la relectura 120 ms después, cuando
 * el componente ya no está — y eso es un `setState` sobre algo desmontado, que en
 * React 18 no avisa de nada y deja la petición huérfana en vuelo.
 */
function agrupar(fn: () => void): { disparar: () => void; cancelar: () => void } {
  let t: ReturnType<typeof setTimeout> | null = null;
  return {
    disparar: () => {
      if (t !== null) clearTimeout(t);
      t = setTimeout(() => {
        t = null;
        fn();
      }, COALESCE_MS);
    },
    cancelar: () => {
      if (t !== null) clearTimeout(t);
      t = null;
    },
  };
}

/**
 * Cambios en CUALQUIER hilo mío o en sus elementos — para MSG-01.
 *
 * ⚠ VA SIN FILTRO A PROPÓSITO, y conviene que quede escrito porque parece un
 * descuido. El filtro de `postgres_changes` es un único `columna=op.valor`, y lo
 * que hace falta aquí es `org_low_id = yo OR org_high_id = yo` — una disyunción
 * que ese filtro no sabe expresar. Escribir `org_low_id=eq.<yo>` entregaría solo
 * la mitad de mis hilos, que es peor que no filtrar: una lista que se actualiza a
 * veces es indistinguible de una que va bien.
 *
 * **El filtrado real lo hace RLS**, que es donde tiene que estar: Realtime evalúa
 * `threads_select_participant` por fila y no entrega lo que la pantalla no podría
 * leer igualmente. El canal no enseña nada que la consulta no enseñe (0011 §3).
 */
export function onThreadsChanged(onChange: () => void): Unsubscribe {
  const { disparar, cancelar } = agrupar(onChange);

  const canal = supabase
    .channel(nombreCanal('hilos'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' }, disparar)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'thread_items' }, disparar)
    .subscribe();

  return () => {
    cancelar();
    void supabase.removeChannel(canal);
  };
}

/**
 * Cambios en UN hilo concreto y sus elementos — para MSG-02.
 *
 * Aquí el filtro sí es expresable, y las dos suscripciones hacen falta por
 * separado: los elementos nuevos llegan por `thread_items`, y el badge de estado
 * cambia por `threads` **sin que nadie toque esa fila desde el navegador** — la
 * escribe el trigger de 0007 cuando la otra parte acepta una oferta. Sin la
 * segunda suscripción, el historial se actualizaría y la cabecera no.
 */
export function onThreadChanged(threadId: string, onChange: () => void): Unsubscribe {
  const { disparar, cancelar } = agrupar(onChange);

  const canal = supabase
    .channel(nombreCanal(`hilo-${threadId}`))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'thread_items', filter: `thread_id=eq.${threadId}` },
      disparar,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'threads', filter: `id=eq.${threadId}` },
      disparar,
    )
    .subscribe();

  return () => {
    cancelar();
    void supabase.removeChannel(canal);
  };
}
