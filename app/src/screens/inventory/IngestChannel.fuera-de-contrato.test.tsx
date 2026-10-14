import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { MemberProfile } from '../../lib/session';

/**
 * FUERA DEL CONTRATO de la tarea INV-04 (F-251). Lo encontró la revisión a mano del
 * artefacto del Coder en `exp/inv-04-fabrica` (14-oct): mientras carga, o si la carga
 * falla, la pantalla pintaba el historial vacío diciendo que no ha llegado ningún correo,
 * un dato que nadie había consultado (CLAUDE.md §7).
 */

const ensureIngestChannel = vi.fn<() => Promise<string>>();

vi.mock('../../lib/ingest', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/ingest')>()),
  ensureIngestChannel: () => ensureIngestChannel(),
  fetchIngestSenders: () => Promise.resolve([]),
  fetchIngestEvents: () => Promise.resolve([]),
}));

const { IngestChannel } = await import('./IngestChannel');

const admin = { id: 'm-1', orgId: 'org-me', role: 'ADMIN' } as unknown as MemberProfile;

describe('INV-04 · no afirma lo que no ha consultado', () => {
  it('si el canal no se puede abrir, no dice que no hay correos ni pinta remitentes', async () => {
    ensureIngestChannel.mockRejectedValue(new Error('Sin permiso.'));
    render(<IngestChannel profile={admin} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin permiso.');
    expect(screen.queryByText(/Todavía no se ha recibido ningún correo/)).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Añadir remitente' })).toBeNull();
  });

  it('mientras carga, tampoco', () => {
    ensureIngestChannel.mockReturnValue(new Promise(() => {}));
    render(<IngestChannel profile={admin} />);
    expect(screen.queryByText(/Todavía no se ha recibido ningún correo/)).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Añadir remitente' })).toBeNull();
  });
});
