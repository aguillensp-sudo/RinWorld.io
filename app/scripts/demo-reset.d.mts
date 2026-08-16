/**
 * Tipos de `demo-reset.mjs`.
 *
 * Mismo motivo que `supabase/seed/demo-content.d.mts`: el módulo se queda en
 * `.mjs` porque `node` lo ejecuta directo como comando (`npm run demo:reset`),
 * pero lo importan dos ficheros TypeScript del e2e y con `noImplicitAny` un
 * `any` ahí significaría que nadie comprueba lo que se le pasa a algo que borra
 * filas con `service_role`.
 *
 * Si el `.mjs` cambia de forma y esto no, `tsc` lo dice en el consumidor.
 */

/** Recuento del catálogo entero que devuelve `public.demo_state()`. */
export interface RecuentoCatalogo {
  total: number;
  frescas: number;
  naranja: number;
  roja: number;
  futuro: number;
}

/** Lo mismo acotado a `6205-2RS`. Sin `futuro`: se comprueba sobre el total. */
export interface RecuentoReferencia {
  total: number;
  frescas: number;
  naranja: number;
  roja: number;
}

/** Un hilo de demo, en metadatos. Nunca contenido: va cifrado (CLAUDE.md §4). */
export interface HiloDemoEstado {
  contraparte: string;
  estado: string;
  elementos: number;
}

/** Lo que devuelve `public.demo_state()`: consultado, no recordado. */
export interface EstadoDemo {
  medido_en: string;
  catalogo: RecuentoCatalogo;
  referencia: RecuentoReferencia;
  hilos: HiloDemoEstado[];
}

export interface OpcionesReseteo {
  /** `VITE_SUPABASE_URL`. Se acepta `undefined` y se falla con el nombre dicho. */
  url: string | undefined;
  /** `SUPABASE_SERVICE_KEY` — la única que salta RLS. Vive en el entorno de usuario. */
  serviceKey: string | undefined;
  /** `VITE_DEMO_KEY_SEED`. */
  seed: string | undefined;
  /**
   * Re-anclar además la frescura del catálogo (F-094). Por defecto `true`.
   *
   * El e2e lo pasa en `false` a propósito: desplazar las fechas del catálogo a
   * mitad de suite cambiaría lo que ve SRCH-01 sin que ningún test lo pida, y
   * taparía justo la degradación por calendario que `supabase/tests/05` existe
   * para cazar.
   */
  reanchor?: boolean;
  log?: (linea: string) => void;
}

/**
 * Repone la siembra congelada de demo y **verifica el resultado**: cinco hilos,
 * cinco estados distintos, un elemento cada uno y ninguna fecha en el futuro.
 * Lanza con el motivo dicho si algo de eso no se cumple.
 */
export declare function resetDemo(opciones: OpcionesReseteo): Promise<EstadoDemo>;
