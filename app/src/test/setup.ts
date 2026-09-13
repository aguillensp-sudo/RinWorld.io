import '@testing-library/jest-dom/vitest';

// F-162: `Intl.DateTimeFormat` sin `timeZone` formatea en la hora de la
// maquina. La CI corre en un contenedor Linux (UTC), pero el paso 5 del H1
// obliga a correr esta suite tambien en la maquina local del PO -no siempre
// UTC-, y ese cambio de maquina es justo lo que hizo fallar `admin-requests.
// test.ts` sin que nadie tocara el codigo. Fijar `TZ` aqui, compartido por
// `vitest.config.ts` y `vitest.config.arnes.ts` via `setupFiles`, hace la
// suite reproducible sin importar en que huso corra quien la lance.
process.env.TZ = 'UTC';

// El cliente de Supabase se construye al importarse y aborta si faltan las
// variables. Los tests de unidad no llegan a la red, pero sí importan módulos
// que lo importan, así que se les da un valor de mentira explícito.
if (!import.meta.env.VITE_SUPABASE_URL) {
  (import.meta.env as Record<string, string>).VITE_SUPABASE_URL = 'http://localhost:54321';
}
if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  (import.meta.env as Record<string, string>).VITE_SUPABASE_PUBLISHABLE_KEY = 'test-key';
}
