import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * ESCENARIOS DE SPEC de `conversational-search` (nivel unit). Salen de
 * `openspec/specs/conversational-search/spec.md`; cada `it` empieza por el id del escenario de
 * `openspec/v1/trazabilidad.csv`.
 */

// Vitest corre desde `app/` (jsdom no da una `import.meta.url` de fichero): la raíz del repo es su padre.
const RAIZ = resolve(process.cwd(), '..');

function ficheros(dir: string, ext: RegExp, salida: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    if (nombre === 'node_modules' || nombre === '.git') continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) ficheros(ruta, ext, salida);
    else if (ext.test(nombre)) salida.push(ruta);
  }
  return salida;
}

const rel = (ruta: string) => relative(RAIZ, ruta).replace(/\\/g, '/');
const esTest = (ruta: string) => /\.(test|spec)\.[tj]sx?$/.test(ruta) || /[\\/]e2e[\\/]/.test(ruta);

describe('conversational-search/favorites-system', () => {
  /*
   * Escenario «inmutabilidad de favoritos por algoritmo» (favorites-system#2)
   *   GIVEN cualquier evento de actividad en la plataforma (acuerdo alcanzado, volumen de
   *         transacciones, antigüedad del miembro)
   *   WHEN  el sistema procesa el evento
   *   THEN  ningún favorito es creado, modificado ni eliminado automáticamente
   *   AND   solo la acción explícita del usuario puede modificar su lista de favoritos
   *
   * No hay un «evento» que simular en cliente: la propiedad es que NINGÚN camino automático escribe
   * en `favorite_distributors`. Se prueba como invariante estructural sobre el código del repo:
   * (1) en la app, las únicas escrituras están en `toggleFavorite` y solo la llaman los manejadores
   * del clic del usuario; (2) ni las migraciones, ni las Edge Functions, ni las siembras contienen
   * una sentencia que inserte/actualice/borre favoritos (los triggers de 0005/0006 solo mantienen
   * el recuento derivado `organizations.favorite_count`). La prueba dinámica (disparar un acuerdo
   * y comprobar que `favorite_distributors` no cambia) es SQL y no está aquí.
   */
  it('conversational-search/favorites-system#2 · solo la acción explícita del usuario (toggleFavorite) escribe favoritos y ningún proceso automático lo hace', () => {
    // (1) Escrituras desde la app: solo dentro de `toggleFavorite`, en lib/search.ts.
    const fuentesApp = ficheros(join(RAIZ, 'app', 'src'), /\.tsx?$/).filter((f) => !esTest(f));
    const patronEscritura = /from\(\s*['"]favorite_distributors['"]\s*\)\s*\.(insert|update|upsert|delete)\b/g;
    const escritores = fuentesApp
      .map((f) => ({ f: rel(f), n: [...readFileSync(f, 'utf8').matchAll(patronEscritura)].length }))
      .filter((x) => x.n > 0);
    expect(escritores).toEqual([{ f: 'app/src/lib/search.ts', n: 2 }]); // insert (marcar) + delete (desmarcar)
    const search = readFileSync(join(RAIZ, 'app/src/lib/search.ts'), 'utf8');
    const inicioToggle = search.indexOf('export async function toggleFavorite');
    expect(inicioToggle).toBeGreaterThan(-1);
    for (const m of search.matchAll(patronEscritura)) expect(m.index!).toBeGreaterThan(inicioToggle);

    // ...y `toggleFavorite` solo se invoca desde el manejador del clic del usuario.
    const llamadas = fuentesApp.flatMap((f) => {
      const t = readFileSync(f, 'utf8');
      return [...t.matchAll(/\btoggleFavorite\(/g)]
        .filter((m) => !t.slice(Math.max(0, m.index! - 40), m.index!).includes('function '))
        .map((m) => ({ f: rel(f), enManejador: t.slice(0, m.index!).lastIndexOf('handleToggleFavorite = useCallback') > -1 }));
    });
    expect(llamadas.length).toBeGreaterThan(0);
    expect(llamadas.filter((l) => !l.enManejador)).toEqual([]);

    // (2) Ningún SQL ni Edge Function escribe favoritos.
    const lados = [
      ...ficheros(join(RAIZ, 'supabase', 'migrations'), /\.sql$/),
      ...ficheros(join(RAIZ, 'supabase', 'seed'), /\.(sql|mjs|js)$/),
      ...ficheros(join(RAIZ, 'supabase', 'functions'), /\.[tj]s$/),
    ];
    expect(lados.length).toBeGreaterThan(60); // ancla: se está leyendo el repo de verdad
    const sentencia = /(insert\s+into|delete\s+from|update|truncate(\s+table)?)\s+(only\s+)?(public\.)?"?favorite_distributors"?\b/i;
    const culpables = lados.filter((f) => sentencia.test(readFileSync(f, 'utf8'))).map(rel);
    expect(culpables).toEqual([]);
  });
});
