import { describe, expect, it } from 'vitest';
import screen from './ImportMapping.module.css?raw';

/**
 * `.bwcnt` (AppShell) es `overflow: hidden`: una pantalla más alta que la ventana que no
 * declare su propio scroll se recorta SIN barra (F-186 / F-189 / F-190). La regla va
 * escrita en la TAREA del Coder desde SRCH-03 (F-198); este test mide si la cumplió.
 */
function bloqueDe(selector: string, css: string): string {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const regex = new RegExp(`(?:^|\\})\\s*\\.${selector}\\s*\\{([^}]*)\\}`);
  return regex.exec(limpio)?.[1] ?? '';
}

describe('INV-02 · ImportMapping', () => {
  it('la página tiene scroll propio dentro de .bwcnt', () => {
    const bloque = bloqueDe('screen', screen);
    expect(bloque).toMatch(/overflow-y:\s*auto/);
    expect(bloque).toMatch(/min-height:\s*0/);
    expect(bloque).toMatch(/flex:\s*1/);
  });

  /**
   * F-209: el Coder toma el token de tamaño más cercano en vez del tamaño del HTML
   * aprobado. Aquí el HTML dice eyebrow 11 px (`.pg-eyebrow`), título 24 px (`.pg-title`)
   * y subtítulo 14 px (`.pg-sub`).
   */
  it('eyebrow a 11 px, título a 24 px y subtítulo a 14 px, como el HTML aprobado', () => {
    expect(bloqueDe('eyebrow', screen)).toMatch(/font-size:\s*11px/);
    expect(bloqueDe('title', screen)).toMatch(/font-size:\s*24px/);
    expect(bloqueDe('subtitle', screen)).toMatch(/font-size:\s*14px/);
  });
});
