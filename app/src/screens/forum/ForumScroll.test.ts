import { describe, expect, it } from 'vitest';
import categoria from './ForumCategory.module.css?raw';
import hilo from './ForumThread.module.css?raw';

/**
 * `.bwcnt` (AppShell) es `overflow: hidden`: una pantalla mas alta que la ventana que no
 * declare su propio scroll se recorta SIN barra. Es la tercera vez (F-088, F-093, F-186):
 * en la C5 de FORO-02 el ultimo comentario de un hilo de tres respuestas salia cortado.
 * jsdom no calcula layout, asi que lo unico vigilable es que el CSS lo declare.
 */
function pagina(css: string): string {
  // Sin comentarios: uno precede a `.page` en los dos ficheros y rompe el ancla.
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return /(?:^|\})\s*\.page\s*\{([^}]*)\}/.exec(limpio)?.[1] ?? '';
}

describe.each([['FORO-02 · ForumCategory', categoria], ['FORO-03 · ForumThread', hilo]])('%s', (_n, css) => {
  it('la pagina tiene scroll propio dentro de .bwcnt', () => {
    const bloque = pagina(css);
    expect(bloque).toMatch(/overflow-y:\s*auto/);
    expect(bloque).toMatch(/min-height:\s*0/);
    expect(bloque).toMatch(/flex:\s*1/);
  });
});
