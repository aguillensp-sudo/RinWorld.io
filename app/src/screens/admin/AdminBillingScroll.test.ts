import { describe, expect, it } from 'vitest';
import screen from './AdminBilling.module.css?raw';
import requests from './AdminRequests.module.css?raw';

/**
 * `.bwcnt` (AppShell/OperatorShell, que reutiliza el mismo layout) es `overflow: hidden`:
 * una pantalla mas alta que la ventana que no declare su propio scroll se recorta SIN
 * barra. F-189 (`ADMIN-02`): sospechado en F-186 y confirmado el 22-sep en un navegador
 * real (no jsdom, que no calcula layout). F-190 (`ADMIN-01`): el mismo fallo, esta vez
 * confirmado por el PO en `npm run dev` con la ventana baja -- no habia ni sospecha
 * escrita, `.screen` no tenia ni `min-height: 100%`. Ver ForumScroll.test.ts y
 * DirectoryScroll.test.ts para el mismo fallo en el resto de la corriente B.
 */
function bloqueDe(selector: string, css: string): string {
  // Sin comentarios: uno precede a la clase y rompe el ancla.
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const regex = new RegExp(`(?:^|\\})\\s*\\.${selector}\\s*\\{([^}]*)\\}`);
  return regex.exec(limpio)?.[1] ?? '';
}

describe.each([
  ['ADMIN-01 · AdminRequests', 'screen', requests],
  ['ADMIN-02 · AdminBilling', 'screen', screen],
])('%s', (_n, selector, css) => {
  it('la pagina tiene scroll propio dentro de .bwcnt', () => {
    const bloque = bloqueDe(selector, css);
    expect(bloque).toMatch(/overflow-y:\s*auto/);
    expect(bloque).toMatch(/min-height:\s*0/);
    expect(bloque).toMatch(/flex:\s*1/);
  });
});
