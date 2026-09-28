import { describe, expect, it } from 'vitest';
import screen from './AccessRequest.module.css?raw';

/**
 * REG-00 no va dentro del shell: es una página entera sin sesión, hija directa de
 * `#root`, que es `position: fixed; inset: 0` y NO declara overflow
 * (`styles/global.css`). Una página más alta que la ventana que no declare su
 * propio scroll se recorta SIN barra (la misma trampa de F-186/F-198, un nivel más
 * arriba). La regla va escrita en la tarea del Coder; este test mide si la cumplió.
 */
function bloqueDe(selector: string, css: string): string {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const regex = new RegExp(`(?:^|\\})\\s*\\.${selector}\\s*\\{([^}]*)\\}`);
  return regex.exec(limpio)?.[1] ?? '';
}

describe('REG-00 · AccessRequest', () => {
  it('la página ocupa el alto de #root y tiene scroll propio', () => {
    const bloque = bloqueDe('page', screen);
    expect(bloque).toMatch(/(?:^|[;\s])height:\s*100%/);
    expect(bloque).toMatch(/overflow-y:\s*auto/);
  });

  /**
   * F-209: tres veces el Coder puso el eyebrow y el título con los tokens (14 y
   * 28 px) en vez de con los tamaños del HTML aprobado. Aquí el HTML dice 11 px y
   * 22 px (`.regcard-eyebrow`/`.regcard-title` y `.wc-eyebrow`/`.wc-title`).
   */
  it('eyebrow a 11 px y título a 22 px, como el HTML aprobado', () => {
    expect(bloqueDe('eyebrow', screen)).toMatch(/font-size:\s*11px/);
    expect(bloqueDe('title', screen)).toMatch(/font-size:\s*22px/);
  });
});
