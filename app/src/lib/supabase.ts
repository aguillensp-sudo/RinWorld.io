import { createClient } from '@supabase/supabase-js';

// CLAUDE.md §1: ninguna credencial en ningún fichero. Entran por entorno; ver
// .env.example. `VITE_` es lo que Vite expone al navegador — la clave publicable
// está pensada para eso, y RLS es lo que protege los datos, no el secreto.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY. Copia .env.example a .env y rellénalas.',
  );
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: {
    // F-007: el default de 10 descartó 6/20 mensajes en ráfaga en SP-3.
    // No se deja el default en ningún entorno.
    params: { eventsPerSecond: 50 },
  },
});
