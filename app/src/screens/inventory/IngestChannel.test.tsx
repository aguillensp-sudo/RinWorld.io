import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IngestEventRow, IngestSender } from '../../lib/ingest';
import type { MemberProfile } from '../../lib/session';

/**
 * INV-04 · pantalla `IngestChannel`. Escrita a mano por Claude Code (no es una pantalla del arnés).
 * Se mockean solo las seis funciones de `lib/ingest` que tocan red.
 *
 * ⚠ Lo que este fichero NO puede cazar: que la RLS y las funciones SQL dejen gestionar el canal
 * solo al ADMIN (`supabase/tests/01_schema_smoke.sql` lo cubre) ni que un correo real llegue.
 */

const ensureIngestChannel = vi.fn<() => Promise<string>>();
const rotateIngestAddress = vi.fn<() => Promise<string>>();
const fetchIngestSenders = vi.fn<() => Promise<IngestSender[]>>();
const addIngestSender = vi.fn<(email: string) => Promise<void>>();
const removeIngestSender = vi.fn<(id: string) => Promise<void>>();
const fetchIngestEvents = vi.fn<() => Promise<IngestEventRow[]>>();

vi.mock('../../lib/ingest', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/ingest')>()),
  ensureIngestChannel: () => ensureIngestChannel(),
  rotateIngestAddress: () => rotateIngestAddress(),
  fetchIngestSenders: () => fetchIngestSenders(),
  addIngestSender: (e: string) => addIngestSender(e),
  removeIngestSender: (id: string) => removeIngestSender(id),
  fetchIngestEvents: () => fetchIngestEvents(),
}));

const { IngestChannel } = await import('./IngestChannel');

const admin = { id: 'm-1', orgId: 'org-me', role: 'ADMIN' } as unknown as MemberProfile;
const editor = { id: 'm-2', orgId: 'org-me', role: 'EDITOR' } as unknown as MemberProfile;

const SENDERS: IngestSender[] = [
  { id: 's1', email: 'admin@empresa.com', isProtected: true },
  { id: 's2', email: 'erp@empresa.com', isProtected: false },
];

const EVENTS: IngestEventRow[] = [
  { id: 'e1', receivedAt: '2026-10-13T08:02:53Z', senderEmail: 'erp@empresa.com', fileName: 'inventario.csv', result: 'PROCESADO', reason: null, rowsImported: 12470 },
  { id: 'e2', receivedAt: '2026-10-12T10:00:00Z', senderEmail: 'unknown@spam.com', fileName: null, result: 'RECHAZADO', reason: 'REMITENTE_NO_AUTORIZADO', rowsImported: null },
  { id: 'e3', receivedAt: '2026-10-11T10:00:00Z', senderEmail: 'erp@empresa.com', fileName: 'x.csv', result: 'RECHAZADO', reason: 'FORMATO_NO_RECONOCIDO', rowsImported: null },
];

beforeEach(() => {
  ensureIngestChannel.mockReset().mockResolvedValue('5ahwrsg5e7xx');
  rotateIngestAddress.mockReset().mockResolvedValue('nuevo2token3');
  fetchIngestSenders.mockReset().mockResolvedValue(SENDERS);
  addIngestSender.mockReset().mockResolvedValue();
  removeIngestSender.mockReset().mockResolvedValue();
  fetchIngestEvents.mockReset().mockResolvedValue(EVENTS);
});

const fmt = (iso: string) => `F(${iso})`;

async function montar(profile = admin) {
  render(<IngestChannel profile={profile} formatDate={fmt} />);
  if (profile.role === 'ADMIN') await screen.findByTestId('ingest-address');
}

describe('INV-04 · IngestChannel', () => {
  it('cabecera de la spec', async () => {
    await montar();
    expect(screen.getByText('Módulo 02 · Gestión de Inventario')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Canal de ingestión por email' })).toBeInTheDocument();
    expect(screen.getByText(/Envía tu archivo de inventario directamente por email/)).toBeInTheDocument();
  });

  it('al entrar abre el canal (idempotente) y pinta la dirección con el token que devuelve la base', async () => {
    await montar();
    expect(ensureIngestChannel).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ingest-address')).toHaveValue('ingest-5ahwrsg5e7xx@ingest.nortexsys.com');
  });

  it('dice lo que el canal admite de verdad: CSV/TSV/TXT, 5 MB, perfil guardado', async () => {
    await montar();
    expect(screen.getByText(/CSV, TSV y TXT/)).toBeInTheDocument();
    expect(screen.getByText(/5 MB/)).toBeInTheDocument();
    expect(screen.getByText(/perfil de columnas/)).toBeInTheDocument();
    expect(screen.queryByText(/XLSX|50 MB/)).toBeNull();
  });

  it('la lista de remitentes enseña la etiqueta del administrador y no deja eliminarlo', async () => {
    await montar();
    expect(screen.getByText('Administrador — no eliminable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar admin@empresa.com' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Eliminar erp@empresa.com' })).toBeEnabled();
  });

  it('eliminar un remitente llama a la base y repide la lista', async () => {
    await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar erp@empresa.com' }));
    await waitFor(() => expect(removeIngestSender).toHaveBeenCalledWith('s2'));
    await waitFor(() => expect(fetchIngestSenders).toHaveBeenCalledTimes(2));
  });

  it('añadir un remitente: valida el formato antes de ir a la red', async () => {
    await montar();
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir remitente' }));
    await userEvent.type(screen.getByLabelText('Email del remitente'), 'esto-no-es-un-email');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(addIngestSender).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('El email del remitente no es válido.');
  });

  it('añadir un remitente válido lo manda a la base, repide la lista y cierra el campo', async () => {
    await montar();
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir remitente' }));
    await userEvent.type(screen.getByLabelText('Email del remitente'), 'nuevo@empresa.com');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    await waitFor(() => expect(addIngestSender).toHaveBeenCalledWith('nuevo@empresa.com'));
    await waitFor(() => expect(screen.queryByLabelText('Email del remitente')).toBeNull());
    expect(fetchIngestSenders).toHaveBeenCalledTimes(2);
  });

  it('un error de la base al añadir se enseña tal cual', async () => {
    addIngestSender.mockRejectedValue(new Error('Se ha alcanzado el máximo de 20 remitentes autorizados.'));
    await montar();
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir remitente' }));
    await userEvent.type(screen.getByLabelText('Email del remitente'), 'otro@empresa.com');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('máximo de 20');
  });

  it('el hint de rechazo silencioso es el de la spec', async () => {
    await montar();
    expect(screen.getByText('EMAILS QUE NO ESTÁN EN LA LISTA SE RECHAZAN SILENCIOSAMENTE POR NUESTRO SISTEMA')).toBeInTheDocument();
  });

  it('rotar pide confirmación y NO rota hasta confirmar', async () => {
    await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Rotar dirección' }));
    const dialog = screen.getByRole('dialog', { name: '¿Seguro que quieres rotar la dirección?' });
    expect(within(dialog).getByText(/quedará anulada de forma inmediata/)).toBeInTheDocument();
    expect(rotateIngestAddress).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(rotateIngestAddress).not.toHaveBeenCalled();
    expect(screen.getByTestId('ingest-address')).toHaveValue('ingest-5ahwrsg5e7xx@ingest.nortexsys.com');
  });

  it('confirmar la rotación pinta la dirección nueva y avisa de que la anterior ya no vale', async () => {
    await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Rotar dirección' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sí, rotar' }));
    await waitFor(() => expect(rotateIngestAddress).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('ingest-address')).toHaveValue('ingest-nuevo2token3@ingest.nortexsys.com'));
    expect(screen.getByRole('status')).toHaveTextContent('La anterior ya no es válida');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('el historial lleva las cinco columnas, el motivo de cada rechazo y guion donde no hay dato', async () => {
    await montar();
    const tabla = screen.getByRole('table');
    for (const c of ['Fecha y hora', 'Remitente', 'Archivo', 'Resultado', 'Filas importadas']) {
      expect(within(tabla).getByRole('columnheader', { name: c })).toBeInTheDocument();
    }
    const filas = within(tabla).getAllByRole('row').slice(1);
    expect(filas).toHaveLength(3);
    expect(filas[0]).toHaveTextContent('Procesado con éxito');
    expect(filas[0]).toHaveTextContent('12.470');
    expect(filas[1]).toHaveTextContent('Rechazado');
    expect(filas[1]).toHaveTextContent('El remitente no está en la lista');
    expect(filas[1]).toHaveTextContent('—');
    expect(filas[2]).toHaveTextContent('súbelo a mano una vez');
  });

  it('sin correos recibidos, lo dice en vez de pintar una tabla vacía', async () => {
    fetchIngestEvents.mockResolvedValue([]);
    await montar();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText(/Todavía no se ha recibido ningún correo/)).toBeInTheDocument();
  });

  it('un EDITOR ve el aviso y la pantalla no pide NADA a la base', async () => {
    await montar(editor);
    expect(screen.getByText('Solo un administrador de tu organización gestiona el canal de ingestión por email.')).toBeInTheDocument();
    expect(ensureIngestChannel).not.toHaveBeenCalled();
    expect(fetchIngestSenders).not.toHaveBeenCalled();
    expect(fetchIngestEvents).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ingest-address')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rotar dirección' })).toBeNull();
  });

  it('si el canal no se puede abrir, enseña el error y NINGUNA dirección', async () => {
    ensureIngestChannel.mockRejectedValue(new Error('Solo el administrador de la organización gestiona el canal de ingestión.'));
    render(<IngestChannel profile={admin} formatDate={fmt} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo el administrador');
    expect(screen.queryByTestId('ingest-address')).toBeNull();
  });
});
