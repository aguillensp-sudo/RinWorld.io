import { describe, expect, it } from 'vitest';
import screen from './Watchers.module.css?raw';

/**
 * `.bwcnt` (AppShell) es `overflow: hidden`: una pantalla mas alta que la ventana
 * que no declare su propio scroll se recorta SIN barra. Es el septimo caso de la
 * serie F-186 / F-189 / F-190 -- seis de seis pantallas de la corriente B lo
 * tuvieron y hubo que arreglarlas a mano-, asi que esta vez la exigencia esta en la
 * TAREA del Coder y este test mide si el generador la cumplio por si solo.
 */
function bloqueDe(selector: string, css: string): string {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const regex = new RegExp(`(?:^|\\})\\s*\\.${selector}\\s*\\{([^}]*)\\}`);
  return regex.exec(limpio)?.[1] ?? '';
}

describe('SRCH-03 · Watchers', () => {
  it('la pagina tiene scroll propio dentro de .bwcnt', () => {
    const bloque = bloqueDe('screen', screen);
    expect(bloque).toMatch(/overflow-y:\s*auto/);
    expect(bloque).toMatch(/min-height:\s*0/);
    expect(bloque).toMatch(/flex:\s*1/);
  });
});
