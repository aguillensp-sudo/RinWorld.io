import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * El prompt de VERA vive en una Edge Function (Deno) y no se puede importar desde aquí; se lee
 * como texto. No prueba qué responde el modelo —eso solo lo prueba una llamada real—, prueba que
 * las reglas que cerraron un fallo siguen escritas.
 *
 * INV-01 (10-oct-2026): VERA contestó «pulsa el botón de nueva línea (normalmente un +)» en una
 * pantalla que no tiene ese botón. El prompt tenía la regla primera para los DATOS y nada para la
 * INTERFAZ, de la que VERA solo conoce el nombre de la pantalla.
 */
const prompt = readFileSync(resolve(process.cwd(), '../supabase/functions/vera/index.ts'), 'utf8');
const tools = readFileSync(resolve(process.cwd(), '../supabase/functions/vera/tools.json'), 'utf8');

describe('VERA · no inventa la interfaz', () => {
  it('el prompt dice que no conoce los controles de la pantalla y prohíbe describirlos', () => {
    expect(prompt).toContain('LA INTERFAZ DE LA APLICACIÓN NO LA CONOCES');
    expect(prompt).toContain('NUNCA expliques cómo se hace algo en la interfaz');
  });

  it('el contexto dinámico recuerda que solo sabe el nombre de la pantalla', () => {
    expect(prompt).toContain('solo sabes su nombre');
  });

  it('no afirma que solo existan cinco pantallas (Empresas y Foros ya están construidas)', () => {
    expect(prompt).not.toContain('Solo hay cinco construidas');
    expect(tools).not.toContain('únicas pantallas que existen');
    expect(tools).not.toContain('NO están construidas');
  });
});
