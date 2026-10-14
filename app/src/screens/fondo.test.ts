import { describe, expect, it } from 'vitest';
import searchResults from './search/SearchResults.module.css?raw';
import batchSearch from './search/BatchSearch.module.css?raw';
import directory from './directory/Directory.module.css?raw';
import ingestChannel from './inventory/IngestChannel.module.css?raw';
import visibility from './inventory/Visibility.module.css?raw';
import adminRequests from './admin/AdminRequests.module.css?raw';

/**
 * El fondo de contenido de estas seis pantallas es `#F1F3F6` (`--bw-cold-white`): sus
 * HTML aprobados lo fijan en `.bwcnt`. El `.bwcnt` del shell React no pone fondo -y no
 * debe: INVT-01, SET-SEC-01 y REG-09 son blancas en su aprobado-, así que lo pone la
 * raíz de cada pantalla, como ya hacían MSG-01 o PANEL-01. Medido el 14-oct con
 * Playwright: las seis salían en blanco puro (255,255,255).
 */
function bloqueDe(selector: string, css: string): string {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const regex = new RegExp(`(?:^|\\})\\s*\\.${selector}\\s*\\{([^}]*)\\}`);
  return regex.exec(limpio)?.[1] ?? '';
}

const RAICES: [string, string, string][] = [
  ['SRCH-01', 'page', searchResults],
  ['SRCH-02', 'screen', batchSearch],
  ['DIR-01', 'page', directory],
  ['INV-04', 'screen', ingestChannel],
  ['INV-07', 'screen', visibility],
  ['ADMIN-01', 'screen', adminRequests],
];

describe('fondo de contenido de los HTML aprobados', () => {
  it.each(RAICES)('%s pinta su raíz con --bw-cold-white', (_pantalla, selector, css) => {
    expect(bloqueDe(selector, css)).toMatch(/background:\s*var\(--bw-cold-white\)/);
  });
});
