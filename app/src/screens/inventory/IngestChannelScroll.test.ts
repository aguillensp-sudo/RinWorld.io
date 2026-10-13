import { describe, expect, it } from 'vitest';
import screen from './IngestChannel.module.css?raw';

/** `.bwcnt` es `overflow: hidden`: la pantalla declara su propio scroll (F-186 / F-198), como `Visibility`. */
function bloqueDe(selector: string, css: string): string {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const regex = new RegExp(`(?:^|\\})\\s*\\.${selector}\\s*\\{([^}]*)\\}`);
  return regex.exec(limpio)?.[1] ?? '';
}

describe('INV-04 · IngestChannel', () => {
  it('la pagina tiene scroll propio dentro de .bwcnt', () => {
    const bloque = bloqueDe('screen', screen);
    expect(bloque).toMatch(/overflow-y:\s*auto/);
    expect(bloque).toMatch(/min-height:\s*0/);
    expect(bloque).toMatch(/flex:\s*1/);
  });
});
