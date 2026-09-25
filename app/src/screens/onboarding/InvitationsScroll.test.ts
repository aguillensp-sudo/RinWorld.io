import { describe, expect, it } from 'vitest';
import screen from './Invitations.module.css?raw';

/**
 * `.bwcnt` (AppShell) es `overflow: hidden`: una pantalla más alta que la ventana
 * que no declare su propio scroll se recorta SIN barra (F-186 / F-189 / F-190). La
 * regla va escrita en la TAREA del Coder desde SRCH-03 (F-198); este test mide si
 * el generador la cumplió. Aquí importa: dos tablas, un formulario y un aviso
 * apilados.
 */
function bloqueDe(selector: string, css: string): string {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const regex = new RegExp(`(?:^|\\})\\s*\\.${selector}\\s*\\{([^}]*)\\}`);
  return regex.exec(limpio)?.[1] ?? '';
}

describe('INVT-01 · Invitations', () => {
  it('la página tiene scroll propio dentro de .bwcnt', () => {
    const bloque = bloqueDe('screen', screen);
    expect(bloque).toMatch(/overflow-y:\s*auto/);
    expect(bloque).toMatch(/min-height:\s*0/);
    expect(bloque).toMatch(/flex:\s*1/);
  });
});
