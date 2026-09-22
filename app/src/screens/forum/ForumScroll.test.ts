import { describe, expect, it } from 'vitest';
import lista from './Forum.module.css?raw';
import categoria from './ForumCategory.module.css?raw';
import hilo from './ForumThread.module.css?raw';

/**
 * `.bwcnt` (AppShell) es `overflow: hidden`: una pantalla mas alta que la ventana que no
 * declare su propio scroll se recorta SIN barra. Es la cuarta vez (F-088, F-093, F-186,
 * F-189): en la C5 de FORO-02 el ultimo comentario de un hilo de tres respuestas salia
 * cortado, y F-189 reprodujo en un navegador real (no jsdom) el mismo recorte en FORO-01
 * y en ADMIN-02 (ver AdminBillingScroll.test.ts). jsdom no calcula layout, asi que lo
 * unico vigilable aqui es que el CSS lo declare.
 */
function bloqueDe(selector: string, css: string): string {
  // Sin comentarios: uno precede a la clase en los tres ficheros y rompe el ancla.
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const regex = new RegExp(`(?:^|\\})\\s*\\.${selector}\\s*\\{([^}]*)\\}`);
  return regex.exec(limpio)?.[1] ?? '';
}

describe.each([
  ['FORO-01 · Forum', 'body', lista],
  ['FORO-02 · ForumCategory', 'page', categoria],
  ['FORO-03 · ForumThread', 'page', hilo],
])('%s', (_n, selector, css) => {
  it('la pagina tiene scroll propio dentro de .bwcnt', () => {
    const bloque = bloqueDe(selector, css);
    expect(bloque).toMatch(/overflow-y:\s*auto/);
    expect(bloque).toMatch(/min-height:\s*0/);
    expect(bloque).toMatch(/flex:\s*1/);
  });
});
