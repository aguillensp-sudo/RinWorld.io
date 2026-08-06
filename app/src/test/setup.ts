import '@testing-library/jest-dom/vitest';

// El cliente de Supabase se construye al importarse y aborta si faltan las
// variables. Los tests de unidad no llegan a la red, pero sí importan módulos
// que lo importan, así que se les da un valor de mentira explícito.
if (!import.meta.env.VITE_SUPABASE_URL) {
  (import.meta.env as Record<string, string>).VITE_SUPABASE_URL = 'http://localhost:54321';
}
if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  (import.meta.env as Record<string, string>).VITE_SUPABASE_PUBLISHABLE_KEY = 'test-key';
}
