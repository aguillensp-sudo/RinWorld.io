import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * La capa de suscripción. Se prueba contra un canal falso porque lo que hay que
 * verificar no es que Supabase propague —eso lo midió SP-3 el día 1, 20/20 sin
 * perder ninguno— sino **a qué nos suscribimos y qué hacemos con el evento**.
 *
 * Escrito por Claude Code; no es contrato del arnés.
 */

interface Suscripcion {
  tabla: string;
  filtro: string | undefined;
  handler: () => void;
}

const canales: { nombre: string; subs: Suscripcion[]; removido: boolean }[] = [];

function canalFalso(nombre: string) {
  const registro = { nombre, subs: [] as Suscripcion[], removido: false };
  canales.push(registro);
  const api = {
    on: (
      _tipo: string,
      opts: { table: string; filter?: string },
      handler: () => void,
    ) => {
      registro.subs.push({ tabla: opts.table, filtro: opts.filter, handler });
      return api;
    },
    subscribe: () => api,
    __registro: registro,
  };
  return api;
}

vi.mock('./supabase', () => ({
  supabase: {
    channel: (nombre: string) => canalFalso(nombre),
    removeChannel: (canal: { __registro: { removido: boolean } }) => {
      canal.__registro.removido = true;
      return Promise.resolve('ok');
    },
  },
}));

const { onThreadChanged, onThreadsChanged } = await import('./realtime');

beforeEach(() => {
  canales.length = 0;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Dispara todos los handlers del último canal creado. */
function emitir(veces = 1, indiceSub = 0) {
  const canal = canales[canales.length - 1]!;
  for (let i = 0; i < veces; i++) canal.subs[indiceSub]!.handler();
}

describe('onThreadsChanged · MSG-01', () => {
  it('escucha las DOS tablas: los hilos y sus elementos', () => {
    onThreadsChanged(() => {});
    const subs = canales[0]!.subs;
    expect(subs.map((s) => s.tabla).sort()).toEqual(['thread_items', 'threads']);
  });

  it('⚠ va SIN filtro, y es deliberado', () => {
    // El filtro de postgres_changes es un único `columna=op.valor` y aquí hace
    // falta `org_low_id = yo OR org_high_id = yo`. Poner `org_low_id=eq.<yo>`
    // entregaría solo la mitad de mis hilos — y una lista que se actualiza a
    // veces no se distingue de una que va bien. Filtra RLS.
    onThreadsChanged(() => {});
    for (const sub of canales[0]!.subs) expect(sub.filtro).toBeUndefined();
  });
});

describe('onThreadChanged · MSG-02', () => {
  it('filtra los elementos por su hilo y el hilo por su id', () => {
    onThreadChanged('t-1', () => {});
    const subs = canales[0]!.subs;
    expect(subs.find((s) => s.tabla === 'thread_items')?.filtro).toBe('thread_id=eq.t-1');
    expect(subs.find((s) => s.tabla === 'threads')?.filtro).toBe('id=eq.t-1');
  });

  it('⚠ escucha `threads` aunque el navegador no escriba esa fila nunca', () => {
    // El badge de estado lo mueve el trigger de 0007 cuando la OTRA parte acepta
    // una oferta. Sin esta suscripción el historial se actualizaría y la cabecera
    // se quedaría con el estado viejo.
    onThreadChanged('t-1', () => {});
    expect(canales[0]!.subs.some((s) => s.tabla === 'threads')).toBe(true);
  });

  it('dos hilos distintos no comparten canal', () => {
    // Dos suscripciones con el mismo nombre comparten canal en supabase-js, y al
    // desmontar una se llevaría la otra por delante.
    onThreadChanged('t-1', () => {});
    onThreadChanged('t-2', () => {});
    expect(canales[0]!.nombre).not.toBe(canales[1]!.nombre);
  });
});

describe('agrupación de eventos', () => {
  it('tres eventos seguidos releen UNA vez', () => {
    // Aceptar una oferta escribe en `thread_items` y el trigger escribe en
    // `threads`: dos eventos para un solo hecho. Sin agrupar son dos relecturas.
    const releer = vi.fn();
    onThreadsChanged(releer);

    emitir(3);
    expect(releer).not.toHaveBeenCalled(); // aún dentro de la ventana

    vi.advanceTimersByTime(200);
    expect(releer).toHaveBeenCalledTimes(1);
  });

  it('eventos separados en el tiempo releen cada uno', () => {
    const releer = vi.fn();
    onThreadsChanged(releer);

    emitir();
    vi.advanceTimersByTime(200);
    emitir();
    vi.advanceTimersByTime(200);

    expect(releer).toHaveBeenCalledTimes(2);
  });

  it('un evento en la otra tabla agrupa con el primero, no aparte', () => {
    const releer = vi.fn();
    onThreadsChanged(releer);

    emitir(1, 0); // threads
    emitir(1, 1); // thread_items
    vi.advanceTimersByTime(200);

    expect(releer).toHaveBeenCalledTimes(1);
  });
});

describe('darse de baja', () => {
  it('quita el canal', () => {
    const baja = onThreadsChanged(() => {});
    expect(canales[0]!.removido).toBe(false);
    baja();
    expect(canales[0]!.removido).toBe(true);
  });

  it('⚠ CANCELA la relectura pendiente, y esto es lo que de verdad se rompe', () => {
    // Un evento que llega justo antes de desmontar dispararía la relectura 120 ms
    // después, con el componente ya fuera: un `setState` sobre algo desmontado,
    // que en React 18 no avisa de nada y deja una petición huérfana en vuelo.
    const releer = vi.fn();
    const baja = onThreadsChanged(releer);

    emitir();
    baja();
    vi.advanceTimersByTime(500);

    expect(releer).not.toHaveBeenCalled();
  });
});
