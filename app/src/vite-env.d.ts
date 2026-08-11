/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /**
   * Claves de demo deterministas (D-08-01, opción (a)). **Opcional**: ausente es
   * el camino real del MVP —par X25519 aleatorio por sesión, que se pierde al
   * recargar (`CLAUDE.md` §4)—. Presente, las claves salen siempre iguales y la
   * siembra cifrada del día 11 se puede leer. Quien tenga la semilla tiene todas
   * las privadas de la demo: no es ADR-001 y no debe existir en V1.
   */
  readonly VITE_DEMO_KEY_SEED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
