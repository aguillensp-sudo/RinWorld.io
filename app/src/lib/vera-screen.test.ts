import { describe, expect, it } from 'vitest';
import { NAV_ITEMS } from '../shell/AppShell';
import { veraScreenName, type NavLabel, type ScreenState } from './vera-screen';

/**
 * El nombre de la pantalla que se le dice a VERA. Hasta el 14-oct-2026, en Empresas y en Foros se le
 * decía «Panel» (`App.tsx`, `NAV_SCREEN[nav] ?? 'Panel'`).
 */

const BASE: ScreenState = {
  nav: 'Panel',
  securityOpen: false,
  settingsOpen: false,
  threadOpen: false,
  watchersOpen: false,
  batchOpen: false,
  importSummary: false,
  importDraft: false,
  visibilityOpen: false,
  ingestOpen: false,
  orgProfileOpen: false,
  forumCategoryOpen: false,
  forumThreadOpen: false,
};

const en = (p: Partial<ScreenState>) => veraScreenName({ ...BASE, ...p });

describe('VERA · sabe en qué pantalla está el usuario', () => {
  it('cada ítem del menú tiene su nombre, y solo el Panel se llama Panel', () => {
    for (const { label } of NAV_ITEMS) {
      const nombre = en({ nav: label as NavLabel });
      expect(nombre.startsWith(label)).toBe(true);
      if (label !== 'Panel') expect(nombre).not.toContain('Panel');
    }
  });

  it('Empresas y Foros ya no se cuentan como Panel (el fallo del 14-oct)', () => {
    expect(en({ nav: 'Empresas' })).toBe('Empresas (Directorio de Organizaciones)');
    expect(en({ nav: 'Foros' })).toBe('Foros (la lista de categorías)');
  });

  it('distingue las subpantallas, con los nombres de la guía verificada', () => {
    expect(en({ nav: 'Comprando', watchersOpen: true })).toContain('Mis watchers');
    expect(en({ nav: 'Comprando', batchOpen: true })).toContain('Búsqueda por lotes');
    expect(en({ nav: 'Comprando' })).toContain('Resultados de búsqueda');
    expect(en({ nav: 'Inventario', visibilityOpen: true })).toContain('Visibilidad del inventario');
    expect(en({ nav: 'Inventario', ingestOpen: true })).toContain('Canal de ingestión por email');
    expect(en({ nav: 'Empresas', orgProfileOpen: true })).toContain('ficha de una empresa');
    expect(en({ nav: 'Foros', forumCategoryOpen: true })).toContain('dentro de una categoría');
    expect(en({ nav: 'Foros', forumCategoryOpen: true, forumThreadOpen: true })).toContain('hilo del Foro');
    expect(en({ nav: 'Hilos', threadOpen: true })).toContain('con un hilo abierto');
  });

  it('Seguridad y Configuración mandan sobre el ítem del menú, como en el render de App', () => {
    expect(en({ nav: 'Comprando', settingsOpen: true })).toContain('Gestión de invitaciones');
    expect(en({ nav: 'Hilos', securityOpen: true, settingsOpen: true })).toContain('Cambiar backup passphrase');
  });

  it('el resultado de una importación manda sobre el emparejado, como en el render', () => {
    expect(en({ nav: 'Inventario', importSummary: true, importDraft: true })).toContain('resultado de una importación');
  });
});
