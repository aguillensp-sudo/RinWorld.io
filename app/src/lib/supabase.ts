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

/**
 * La clave viaja en una cabecera HTTP, y una cabecera solo admite ISO-8859-1.
 *
 * Si se cuela un carácter fuera de ese rango —comilla tipográfica, espacio duro,
 * un salto de línea al pegar— el navegador no falla al autenticar: falla al
 * **construir la petición**, con `Failed to read the 'headers' property from
 * 'RequestInit': String contains non ISO-8859-1 code point`. Ese mensaje no
 * menciona a Supabase ni a la clave, así que en pantalla parece un fallo de
 * login y en CI parece que las credenciales de prueba están mal.
 *
 * Es lo que tuvo la CI roja desde el día 2: el secret de GitHub tenía un
 * carácter así y ninguna corrida de Playwright llegó nunca a autenticarse. Se
 * comprueba aquí, en el arranque, porque una clave mal pegada es indistinguible
 * de una clave buena mirándola. Ver F-037.
 */
const NO_LATIN1 = [...String(key)].filter((c) => c.codePointAt(0)! > 0xff);
if (NO_LATIN1.length > 0) {
  const puntos = NO_LATIN1.map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase()}`);
  throw new Error(
    `VITE_SUPABASE_PUBLISHABLE_KEY tiene ${NO_LATIN1.length} carácter(es) fuera de ISO-8859-1 ` +
      `(${[...new Set(puntos)].join(', ')}) y no cabe en una cabecera HTTP. ` +
      'Suele ser una comilla tipográfica o un espacio duro al copiar y pegar: ' +
      'vuelve a copiar el valor desde el panel de Supabase en texto plano.',
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
