import { describe, expect, it } from 'vitest';
import screen from './ImportResult.module.css?raw';

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

describe('INV-03 · ImportResult', () => {
  it('la página tiene scroll propio dentro de .bwcnt', () => {
    const bloque = bloqueDe('screen', screen);
    expect(bloque).toMatch(/overflow-y:\s*auto/);
    expect(bloque).toMatch(/min-height:\s*0/);
    expect(bloque).toMatch(/flex:\s*1/);
  });

  /**
   * F-209: el Coder toma el token de tamaño más cercano en vez del tamaño del HTML
   * aprobado. Aquí el HTML dice eyebrow 11 px (`.pg-eyebrow`), título 24 px (`.pg-title`),
   * subtítulo 14 px (`.pg-sub`), etiqueta de cifra 10 px (`.stat-card-lbl`) y valor de
   * cifra 22 px (`.stat-card-val`). NO `var(--bw-size-title)` ni ningún otro token.
   */
  it('(decisión del PO, 10-oct-2026: cabeceras a 14 / 28 / 14, no las del HTML aprobado) eyebrow a 14 px, título a 28 px, subtítulo a 14 px, etiqueta de cifra a 10 px y valor a 22 px', () => {
    expect(bloqueDe('eyebrow', screen)).toMatch(/font-size:\s*var\(--bw-size-eyebrow\)/);
    expect(bloqueDe('title', screen)).toMatch(/font-size:\s*var\(--bw-size-title\)/);
    expect(bloqueDe('subtitle', screen)).toMatch(/font-size:\s*14px/);
    expect(bloqueDe('statLabel', screen)).toMatch(/font-size:\s*10px/);
    expect(bloqueDe('statValue', screen)).toMatch(/font-size:\s*22px/);
  });
});
