import { describe, expect, it } from 'vitest';
import inquiries from './InquiriesTable.module.css?raw';
import offers from './OffersTable.module.css?raw';

/**
 * CONTRATO · MSG-03 v1.2 · el CSS de las dos tablas. Escrito antes de la corrida.
 *
 * Diez columnas no caben en un móvil ni en un panel de hilo estrecho: sin scroll
 * horizontal propio, la tabla desborda el panel y se recorta (`.bwcnt` es
 * `overflow: hidden`, F-186). Y los colores, solo con tokens (C3 lo mide aparte).
 */
function bloqueDe(selector: string, css: string): string {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const regex = new RegExp(`(?:^|\\})\\s*\\.${selector}\\s*\\{([^}]*)\\}`);
  return regex.exec(limpio)?.[1] ?? '';
}

describe('MSG-03 · CSS de las tablas', () => {
  for (const [nombre, css] of [
    ['InquiriesTable', inquiries],
    ['OffersTable', offers],
  ] as const) {
    it(`${nombre}: el contenedor .wrap tiene scroll horizontal propio`, () => {
      expect(bloqueDe('wrap', css)).toMatch(/overflow-x:\s*auto/);
    });
    it(`${nombre}: la referencia va en IBM Plex Mono (token de fuente mono)`, () => {
      expect(bloqueDe('ref', css)).toMatch(/font-family:\s*var\(--bw-font-mono\)/);
    });
  }
  it('OffersTable: la fecha de una oferta expirada va en el color de peligro', () => {
    expect(bloqueDe('expiredDate', offers)).toMatch(/color:\s*var\(--bw-danger\)/);
  });
});
