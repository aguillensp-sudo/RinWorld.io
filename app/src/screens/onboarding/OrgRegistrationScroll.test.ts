import { describe, expect, it } from 'vitest';
import screen from './OrgRegistration.module.css?raw';

/**
 * REG-01 no va dentro del shell: es una página entera sin sesión, hija directa de
 * `#root`, que es `position: fixed; inset: 0` y NO declara overflow
 * (`styles/global.css`). Un formulario de 17 campos, mucho más alto que la ventana, que
 * no declare su propio scroll se recorta SIN barra (la misma trampa de F-186/F-198, un
 * nivel más arriba). La regla va escrita en la tarea del Coder; este test mide si la
 * cumplió.
 */
function bloqueDe(selector: string, css: string): string {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const regex = new RegExp(`(?:^|\\})\\s*\\.${selector}\\s*\\{([^}]*)\\}`);
  return regex.exec(limpio)?.[1] ?? '';
}

describe('REG-01 · OrgRegistration', () => {
  it('la página ocupa el alto de #root y tiene scroll propio', () => {
    const bloque = bloqueDe('page', screen);
    expect(bloque).toMatch(/(?:^|[;\s])height:\s*100%/);
    expect(bloque).toMatch(/overflow-y:\s*auto/);
  });

  /**
   * F-209: el Coder puso el título con el token (28 px) y el eyebrow con el de 14 en vez de
   * con los tamaños del HTML aprobado. Aquí el HTML dice título 24 px (`.reg-title`),
   * subtítulo 13 px (`.reg-subtitle`), etiqueta 12 px (`.fl`) y ayuda 10 px (`.fh`).
   * NO `var(--bw-size-title)`. (No hay eyebrow: la spec dice que no va en producción.)
   */
  it('título a 24 px, subtítulo a 13 px, etiqueta a 12 px y ayuda a 10 px, como el HTML aprobado', () => {
    expect(bloqueDe('title', screen)).toMatch(/font-size:\s*24px/);
    expect(bloqueDe('subtitle', screen)).toMatch(/font-size:\s*13px/);
    expect(bloqueDe('label', screen)).toMatch(/font-size:\s*12px/);
    expect(bloqueDe('hint', screen)).toMatch(/font-size:\s*10px/);
  });
});
