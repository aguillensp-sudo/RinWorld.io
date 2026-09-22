import { describe, expect, it } from 'vitest';
import page from './Directory.module.css?raw';

/**
 * `.bwcnt` (AppShell) es `overflow: hidden`: una pantalla mas alta que la ventana que no
 * declare su propio scroll se recorta SIN barra. F-190: confirmado por el PO en
 * `npm run dev` con la ventana baja el 22-sep -- `.page` no tenia ni `min-height: 100%`,
 * a diferencia de `F-186`/`F-189` que al menos partian de esa forma. Ver
 * ForumScroll.test.ts y AdminBillingScroll.test.ts para el mismo fallo en el resto de
 * la corriente B.
 */
function bloqueDe(selector: string, css: string): string {
  // Sin comentarios: uno precede a `.page` y rompe el ancla.
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const regex = new RegExp(`(?:^|\\})\\s*\\.${selector}\\s*\\{([^}]*)\\}`);
  return regex.exec(limpio)?.[1] ?? '';
}

describe('DIR-01 · Directory', () => {
  it('la pagina tiene scroll propio dentro de .bwcnt', () => {
    const bloque = bloqueDe('page', page);
    expect(bloque).toMatch(/overflow-y:\s*auto/);
    expect(bloque).toMatch(/min-height:\s*0/);
    expect(bloque).toMatch(/flex:\s*1/);
  });
});
