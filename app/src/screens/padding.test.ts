import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Padding de toda pantalla del shell (10-oct-2026, decisión del PO): 24px arriba, 28px a los
 * lados, 40px abajo, por el token `--bw-screen-pad`. El shell (`.bwcnt`) no pone ninguno: lo pone
 * el contenedor raíz de cada pantalla, y antes de esto cinco no lo tenían (0 arriba y a los lados) y
 * el resto usaba 24, 40, 48 o 52. Lee el CSS como texto: no mide el render. Una pantalla nueva con
 * contenedor raíz se añade a la lista. `screens/onboarding` (salvo `Invitations`) queda aparte.
 */
const RAICES: [string, string][] = [
  ['admin/AdminRequests', 'screen'],
  ['admin/AdminBilling', 'screen'],
  ['directory/Directory', 'page'],
  ['directory/OrganizationProfile', 'screen'],
  ['forum/Forum', 'body'],
  ['forum/ForumCategory', 'page'],
  ['forum/ForumThread', 'page'],
  ['inventory/ImportMapping', 'screen'],
  ['inventory/ImportResult', 'screen'],
  ['inventory/Visibility', 'screen'],
  ['inventory/Inventory', 'body'],
  ['onboarding/Invitations', 'screen'],
  ['messages/Messages', 'page'],
  ['panel/Panel', 'body'],
  ['search/SearchResults', 'page'],
  ['search/BatchSearch', 'screen'],
  ['search/Watchers', 'screen'],
  ['selling/SentOffers', 'content'],
  ['settings/ChangePassphrase', 'screen'],
  ['NotAvailable', 'page'],
];

function css(rel: string): string {
  return readFileSync(resolve(process.cwd(), 'src/screens', rel + '.module.css'), 'utf8').replace(/\r\n/g, '\n');
}

/** El valor de `prop` en la primera regla raíz cuyo selector es exactamente `.clase`. */
function declaracion(fuente: string, clase: string, prop: string): string | null {
  const re = new RegExp('(?:^|\\n)\\.' + clase + '\\s*\\{([^}]*)\\}', 'g');
  for (const m of fuente.matchAll(re)) {
    const d = m[1]!.match(new RegExp('(?:^|[\\s;])' + prop + ':\\s*([^;]+);'));
    if (d) return d[1]!.trim();
  }
  return null;
}

describe('padding de las pantallas del shell · 24 / 28 / 40', () => {
  it('el token vale 24px 28px 40px', () => {
    const tokens = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');
    expect(tokens).toMatch(/--bw-screen-pad:\s*24px 28px 40px;/);
  });

  it.each(RAICES)('%s .%s usa --bw-screen-pad', (rel, clase) => {
    expect(declaracion(css(rel), clase, 'padding')).toBe('var(--bw-screen-pad)');
  });

  // MSG-02 tiene cabecera, lista con scroll y compositor fijo abajo: no admite un padding único.
  // Arriba, el 24 del estándar; a los lados, 28 en cada una de sus piezas.
  it('MSG-02: 24px arriba y 28px a los lados en cabecera, lista y compositor', () => {
    expect(declaracion(css('messages/Thread'), 'screen', 'padding-top')).toBe('24px');
    expect(declaracion(css('messages/ThreadHeader'), 'header', 'padding')).toBe('0 28px 12px');
    expect(declaracion(css('messages/ThreadComposer'), 'composer', 'padding')).toBe('12px 28px');
    expect(declaracion(css('messages/ThreadHistory'), 'list', 'padding')).toBe('16px 28px');
  });
});
