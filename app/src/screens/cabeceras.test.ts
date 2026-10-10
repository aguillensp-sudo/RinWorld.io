import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Tipografía de cabecera de las pantallas del shell (10-oct-2026, decisión del PO): título 28px,
 * eyebrow 14px y subtítulo 14px. Las pantallas de `screens/onboarding` (salvo `Invitations`) quedan
 * aparte a propósito. Lee el CSS como texto: no mide el render, comprueba que la declaración sigue
 * siendo la acordada. Una pantalla nueva con cabecera se añade a la lista.
 */
type Rol = 'title' | 'eyebrow' | 'subtitle';
const ESPERADO: Record<Rol, number> = { title: 28, eyebrow: 14, subtitle: 14 };

const PANTALLAS: [string, string, Rol][] = [
  ['screens/admin/AdminRequests.module.css', 'title', 'title'],
  ['screens/admin/AdminRequests.module.css', 'eyebrow', 'eyebrow'],
  ['screens/admin/AdminRequests.module.css', 'subtitle', 'subtitle'],
  ['screens/admin/AdminBilling.module.css', 'title', 'title'],
  ['screens/admin/AdminBilling.module.css', 'eyebrow', 'eyebrow'],
  ['screens/admin/AdminBilling.module.css', 'subtitle', 'subtitle'],
  ['screens/directory/Directory.module.css', 'title', 'title'],
  ['screens/directory/Directory.module.css', 'eyebrow', 'eyebrow'],
  ['screens/directory/Directory.module.css', 'subtitle', 'subtitle'],
  ['screens/directory/OrganizationProfile.module.css', 'name', 'title'],
  ['screens/directory/OrganizationProfile.module.css', 'eyebrow', 'eyebrow'],
  ['screens/forum/Forum.module.css', 'title', 'title'],
  ['screens/forum/Forum.module.css', 'eyebrow', 'eyebrow'],
  ['screens/forum/Forum.module.css', 'sub', 'subtitle'],
  ['screens/forum/ForumCategory.module.css', 'title', 'title'],
  ['screens/forum/ForumCategory.module.css', 'eyebrow', 'eyebrow'],
  ['screens/forum/ForumCategory.module.css', 'subtitle', 'subtitle'],
  ['screens/forum/ForumThread.module.css', 'title', 'title'],
  ['screens/forum/ForumThread.module.css', 'eyebrow', 'eyebrow'],
  ['screens/inventory/ImportMapping.module.css', 'title', 'title'],
  ['screens/inventory/ImportMapping.module.css', 'eyebrow', 'eyebrow'],
  ['screens/inventory/ImportMapping.module.css', 'subtitle', 'subtitle'],
  ['screens/inventory/ImportResult.module.css', 'title', 'title'],
  ['screens/inventory/ImportResult.module.css', 'eyebrow', 'eyebrow'],
  ['screens/inventory/ImportResult.module.css', 'subtitle', 'subtitle'],
  ['screens/inventory/Visibility.module.css', 'title', 'title'],
  ['screens/inventory/Visibility.module.css', 'eyebrow', 'eyebrow'],
  ['screens/inventory/Visibility.module.css', 'subtitle', 'subtitle'],
  ['screens/inventory/Inventory.module.css', 'title', 'title'],
  ['screens/inventory/Inventory.module.css', 'eyebrow', 'eyebrow'],
  ['screens/inventory/Inventory.module.css', 'sub', 'subtitle'],
  ['screens/onboarding/Invitations.module.css', 'title', 'title'],
  ['screens/onboarding/Invitations.module.css', 'eyebrow', 'eyebrow'],
  ['screens/onboarding/Invitations.module.css', 'subtitle', 'subtitle'],
  ['screens/messages/Messages.module.css', 'title', 'title'],
  ['screens/messages/Messages.module.css', 'eyebrow', 'eyebrow'],
  ['screens/messages/Messages.module.css', 'subtitle', 'subtitle'],
  ['screens/messages/ThreadHeader.module.css', 'orgLink', 'title'],
  ['screens/messages/ThreadHeader.module.css', 'eyebrow', 'eyebrow'],
  ['screens/panel/Panel.module.css', 'title', 'title'],
  ['screens/panel/Panel.module.css', 'eyebrow', 'eyebrow'],
  ['screens/panel/Panel.module.css', 'sub', 'subtitle'],
  ['screens/search/SearchResults.module.css', 'title', 'title'],
  ['screens/search/SearchResults.module.css', 'eyebrow', 'eyebrow'],
  ['screens/search/BatchSearch.module.css', 'title', 'title'],
  ['screens/search/BatchSearch.module.css', 'eyebrow', 'eyebrow'],
  ['screens/search/BatchSearch.module.css', 'subtitle', 'subtitle'],
  ['screens/search/Watchers.module.css', 'title', 'title'],
  ['screens/search/Watchers.module.css', 'eyebrow', 'eyebrow'],
  ['screens/search/Watchers.module.css', 'subtitle', 'subtitle'],
  ['screens/selling/SentOffers.module.css', 'title', 'title'],
  ['screens/selling/SentOffers.module.css', 'eyebrow', 'eyebrow'],
  ['screens/selling/SentOffers.module.css', 'subtitle', 'subtitle'],
  ['screens/settings/ChangePassphrase.module.css', 'title', 'title'],
  ['screens/settings/ChangePassphrase.module.css', 'eyebrow', 'eyebrow'],
  ['screens/settings/ChangePassphrase.module.css', 'subtitle', 'subtitle'],
  ['screens/NotAvailable.module.css', 'title', 'title'],
  ['screens/NotAvailable.module.css', 'eyebrow', 'eyebrow'],
];

const tokens = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');

function px(valor: string): number {
  const v = valor.match(/var\((--[\w-]+)\)/);
  if (v) {
    const t = tokens.match(new RegExp(v[1] + ':\\s*(\\d+)px'));
    if (!t) throw new Error('token sin px: ' + v[1]);
    return Number(t[1]);
  }
  const n = valor.match(/^(\d+)px$/);
  if (!n) throw new Error('tamaño no reconocido: ' + valor);
  return Number(n[1]);
}

function tamano(archivo: string, clase: string): number {
  const css = readFileSync(resolve(process.cwd(), 'src', archivo), 'utf8').replace(/\r\n/g, '\n');
  const re = new RegExp('(?:^|\\n)\\.' + clase + '\\b[^{]*\\{([^}]*)\\}', 'g');
  for (const m of css.matchAll(re)) {
    const f = m[1]!.match(/font-size:\s*([^;]+);/);
    if (f) return px(f[1]!.trim());
  }
  throw new Error(archivo + ' .' + clase + ' no declara font-size');
}

describe('cabeceras del shell · 28 / 14 / 14', () => {
  it.each(PANTALLAS)('%s .%s (%s)', (archivo, clase, rol) => {
    expect(tamano(archivo, clase)).toBe(ESPERADO[rol]);
  });
});
