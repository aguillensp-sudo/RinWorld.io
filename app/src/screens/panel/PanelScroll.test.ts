import { describe, expect, it } from 'vitest';
import panel from './Panel.module.css?raw';

/**
 * `.bwcnt` (AppShell) es `overflow: hidden`: una pantalla mas alta que la ventana que no
 * declare su propio scroll se recorta SIN barra. Mismo fallo que F-186/F-189/F-190, ahora
 * en PANEL-01: `.body` tenia `min-height: 100%` y nada mas. Medido el 14-oct con
 * Playwright contra `bearingworld-e2e`: 1321 px de contenido en 716 de alto a 375x812, y
 * 733 en 554 a 1280x650 -- las tarjetas de abajo no se podian alcanzar. A 1440x900 cabia
 * justo, por eso nadie lo habia visto. Ver DirectoryScroll.test.ts.
 */
function bloqueDe(selector: string, css: string): string {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const regex = new RegExp(`(?:^|\\})\\s*\\.${selector}\\s*\\{([^}]*)\\}`);
  return regex.exec(limpio)?.[1] ?? '';
}

describe('PANEL-01 · Panel', () => {
  it('la pagina tiene scroll propio dentro de .bwcnt', () => {
    const bloque = bloqueDe('body', panel);
    expect(bloque).toMatch(/overflow-y:\s*auto/);
    expect(bloque).toMatch(/min-height:\s*0/);
    expect(bloque).toMatch(/flex:\s*1/);
  });
});
