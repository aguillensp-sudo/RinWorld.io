import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MemberProfile } from '../../lib/session';
import css from './IngestChannel.module.css?raw';

/**
 * FUERA DEL CONTRATO (F-251). C5 del PO del 16-oct sobre INV-04 en producción: todo
 * aprobado salvo el «Cancelar» del alta de remitente, que no cumplía el estándar. Iba
 * pintado como enlace azul -la misma clase que «+ Añadir remitente»-, así que se leía como
 * una acción más. El HTML aprobado lo define como botón secundario con borde
 * (`.btn-add-cancel`: fondo transparente, borde #D1D5DB, texto #6B7A99; al pasar, borde
 * #9BA4B0 y texto #374151).
 */

vi.mock('../../lib/ingest', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/ingest')>()),
  ensureIngestChannel: () => Promise.resolve('5ahwrsg5e7xx'),
  fetchIngestSenders: () => Promise.resolve([]),
  fetchIngestEvents: () => Promise.resolve([]),
}));

const { IngestChannel } = await import('./IngestChannel');

const admin = { id: 'm-1', orgId: 'org-me', role: 'ADMIN' } as unknown as MemberProfile;

function bloqueDe(selector: string): string {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const regex = new RegExp(`(?:^|\\})\\s*\\.${selector}\\s*\\{([^}]*)\\}`);
  return regex.exec(limpio)?.[1] ?? '';
}

describe('INV-04 · el «Cancelar» del alta es el secundario del aprobado', () => {
  it('no usa la clase de enlace de «+ Añadir remitente», sino la suya', async () => {
    render(<IngestChannel profile={admin} />);
    await userEvent.click(await screen.findByRole('button', { name: '+ Añadir remitente' }));
    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    expect(cancelar.className).toMatch(/addCancel/);
    expect(cancelar.className).not.toMatch(/linkBtn/);
  });

  it('botón con borde: fondo transparente, borde de control y texto secundario, con tokens', () => {
    const bloque = bloqueDe('addCancel');
    expect(bloque).toMatch(/background:\s*transparent/);
    expect(bloque).toMatch(/border:\s*1px solid var\(--bw-line-steel-strong\)/);
    expect(bloque).toMatch(/color:\s*var\(--bw-steel-mist\)/);
  });
});
