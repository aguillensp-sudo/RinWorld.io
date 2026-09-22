import { describe, expect, it } from 'vitest';
import screen from './AdminBilling.module.css?raw';

/**
 * `.bwcnt` (AppShell/OperatorShell, que reutiliza el mismo layout) es `overflow: hidden`:
 * una pantalla mas alta que la ventana que no declare su propio scroll se recorta SIN
 * barra. F-189: sospechado en F-186 y no comprobado hasta hoy, reproducido en un
 * navegador real (no jsdom, que no calcula layout) con contenido de sobra — la tabla de
 * cobros se recortaba sin scroll. Ver ForumScroll.test.ts para el mismo fallo en FORO-01.
 */
function bloqueDe(selector: string, css: string): string {
  // Sin comentarios: uno precede a `.screen` y rompe el ancla.
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const regex = new RegExp(`(?:^|\\})\\s*\\.${selector}\\s*\\{([^}]*)\\}`);
  return regex.exec(limpio)?.[1] ?? '';
}

describe('ADMIN-02 · AdminBilling', () => {
  it('la pagina tiene scroll propio dentro de .bwcnt', () => {
    const bloque = bloqueDe('screen', screen);
    expect(bloque).toMatch(/overflow-y:\s*auto/);
    expect(bloque).toMatch(/min-height:\s*0/);
    expect(bloque).toMatch(/flex:\s*1/);
  });
});
