import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WatcherDraft, WatcherRow } from '../../lib/watchers';
import type { MemberProfile } from '../../lib/session';

/**
 * CONTRATO DE ACEPTACIÓN · SRCH-03 · pantalla (`Watchers`).
 *
 * Escrito antes que el código y por Claude Code. El Coder no lo ve. Se mockean
 * **solo** las seis funciones de `lib/watchers` que tocan red; el resto -filtros,
 * contador, etiquetas, validación- sigue siendo el de verdad.
 *
 * ⚠ Lo que este fichero NO puede cazar, y por eso existe `app/e2e/watchers.spec.ts`:
 * que la RLS de `0035` aísle a las organizaciones y que las acciones muevan de
 * verdad el estado en la base -aquí está mockeado y siempre «funciona».
 */

const fetchWatchers = vi.fn<() => Promise<WatcherRow[]>>();
const setWatcherPaused = vi.fn<(id: string, paused: boolean) => Promise<void>>();
const updateWatcher = vi.fn<(id: string, d: WatcherDraft) => Promise<void>>();
const renewWatcher = vi.fn<(id: string) => Promise<void>>();
const letWatcherExpire = vi.fn<(id: string) => Promise<void>>();
const deleteWatcher = vi.fn<(id: string) => Promise<void>>();

vi.mock('../../lib/watchers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/watchers')>()),
  fetchWatchers: () => fetchWatchers(),
  setWatcherPaused: (id: string, p: boolean) => setWatcherPaused(id, p),
  updateWatcher: (id: string, d: WatcherDraft) => updateWatcher(id, d),
  renewWatcher: (id: string) => renewWatcher(id),
  letWatcherExpire: (id: string) => letWatcherExpire(id),
  deleteWatcher: (id: string) => deleteWatcher(id),
}));

const { Watchers } = await import('./Watchers');

const NOW = new Date('2026-09-24T12:00:00Z');
const haceH = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

const profile = { id: 'm-1', orgId: 'org-1' } as unknown as MemberProfile;

function w(over: Partial<WatcherRow>): WatcherRow {
  return {
    id: `w-${over.partNumber}`,
    partNumber: 'X',
    minQuantity: 100,
    brand: null,
    zone: null,
    country: null,
    emailChannel: false,
    state: 'ACTIVE',
    createdAt: haceH(72),
    expiresAt: '2026-10-21T12:00:00Z',
    daysRemaining: 27,
    renewalDaysLeft: null,
    triggeredAt: null,
    triggeredDistributor: null,
    triggeredQuantity: null,
    triggeredCountry: null,
    ...over,
  };
}

/** Spec §3, «Datos de ejemplo», más un EXPIRED. */
function ejemplo(): WatcherRow[] {
  return [
    w({ partNumber: '6308-ZZ', zone: 'EU', emailChannel: true }),
    w({
      partNumber: 'NU2210-E-TVP2',
      minQuantity: 50,
      brand: 'FAG',
      state: 'TRIGGERED',
      daysRemaining: null,
      triggeredAt: haceH(2),
      triggeredDistributor: 'Schaeffler Iberia SL',
      triggeredQuantity: 120,
      triggeredCountry: 'ES',
    }),
    w({ partNumber: '22316-E', minQuantity: 20, state: 'PENDIENTE RENOVACIÓN', daysRemaining: null, renewalDaysLeft: 2 }),
    w({ partNumber: '7210-BECBP', minQuantity: 10, brand: 'SKF', country: 'ES', state: 'PAUSED', daysRemaining: 12 }),
    w({ partNumber: '6205-2RS', minQuantity: 200, state: 'EXPIRED', daysRemaining: null }),
  ];
}

beforeEach(() => {
  fetchWatchers.mockReset().mockResolvedValue(ejemplo());
  setWatcherPaused.mockReset().mockResolvedValue();
  updateWatcher.mockReset().mockResolvedValue();
  renewWatcher.mockReset().mockResolvedValue();
  letWatcherExpire.mockReset().mockResolvedValue();
  deleteWatcher.mockReset().mockResolvedValue();
});

async function montar(onViewResults = vi.fn()) {
  render(<Watchers profile={profile} now={NOW} onViewResults={onViewResults} />);
  await screen.findByRole('article', { name: 'Watcher 6308-ZZ' });
  return onViewResults;
}

const referencias = () =>
  screen.getAllByRole('article').map((a) => a.getAttribute('aria-label')?.replace('Watcher ', ''));

describe('Watchers · cabecera y contador', () => {
  it('eyebrow, título y subtítulo literales de la spec §3', async () => {
    await montar();
    expect(screen.getByText('Módulo 03 · Búsqueda Conversacional')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Mis watchers' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Los watchers te avisan cuando aparece stock de una referencia que buscas. Cada watcher está activo durante 30 días y puedes renovarlo.',
      ),
    ).toBeInTheDocument();
  });

  it('el contador cuenta los ACTIVE (1 de 5 filas) y es brass', async () => {
    await montar();
    const c = screen.getByTestId('watcher-counter');
    expect(c).toHaveTextContent('1 / 50 watchers activos');
    expect(c).toHaveAttribute('data-tone', 'brass');
  });

  it('con 50 ACTIVE el contador es rojo (spec §6)', async () => {
    fetchWatchers.mockResolvedValue(Array.from({ length: 50 }, (_, i) => w({ partNumber: `R-${String(i).padStart(2, '0')}` })));
    render(<Watchers profile={profile} now={NOW} onViewResults={vi.fn()} />);
    await screen.findByRole('article', { name: 'Watcher R-00' });
    const c = screen.getByTestId('watcher-counter');
    expect(c).toHaveTextContent('50 / 50 watchers activos');
    expect(c).toHaveAttribute('data-tone', 'danger');
  });

  it('pide fetchWatchers UNA vez al montar', async () => {
    await montar();
    expect(fetchWatchers).toHaveBeenCalledTimes(1);
  });

  it('un fallo de carga se pinta en un role=alert', async () => {
    fetchWatchers.mockRejectedValue(new Error('boom'));
    render(<Watchers profile={profile} now={NOW} onViewResults={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
  });
});

describe('Watchers · chips', () => {
  it('seis chips en orden, con aria-pressed y el contador en el nombre accesible', async () => {
    await montar();
    const nombres = ['Todos 5', 'Activos 1', 'Pausados 1', 'Disparados 1', 'Pendientes de renovación 1', 'Expirados 1'];
    for (const n of nombres) expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Todos 5' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Activos 1' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('pulsar un chip filtra EN CLIENTE, sin volver a pedir', async () => {
    await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Pausados 1' }));
    expect(referencias()).toEqual(['7210-BECBP']);
    expect(screen.getByRole('button', { name: 'Pausados 1' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Disparados 1' }));
    expect(referencias()).toEqual(['NU2210-E-TVP2']);
    await userEvent.click(screen.getByRole('button', { name: 'Todos 5' }));
    expect(referencias()).toHaveLength(5);
    expect(fetchWatchers).toHaveBeenCalledTimes(1);
  });

  it('un chip sin filas pinta su mensaje de vacío y conserva los chips', async () => {
    fetchWatchers.mockResolvedValue([w({ partNumber: '6308-ZZ' })]);
    await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Expirados 0' }));
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.getByText('No hay watchers en este estado.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Todos 1' })).toBeInTheDocument();
  });
});

describe('Watchers · lista', () => {
  it('una tarjeta por watcher, en una lista con nombre, en el orden recibido', async () => {
    await montar();
    expect(screen.getByRole('list', { name: 'Lista de watchers' })).toBeInTheDocument();
    expect(referencias()).toEqual(['6308-ZZ', 'NU2210-E-TVP2', '22316-E', '7210-BECBP', '6205-2RS']);
  });

  it('sin ningún watcher: el estado vacío de la spec §6', async () => {
    fetchWatchers.mockResolvedValue([]);
    render(<Watchers profile={profile} now={NOW} onViewResults={vi.fn()} />);
    expect(await screen.findByText('Todavía no tienes ningún watcher activo.')).toBeInTheDocument();
    expect(
      screen.getByText('Crea un watcher desde la búsqueda cuando no encuentres stock de una referencia — te avisaremos cuando aparezca.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('watcher-counter')).toHaveTextContent('0 / 50 watchers activos');
  });
});

describe('Watchers · acciones', () => {
  it('Pausar llama a setWatcherPaused(id, true), repide la lista y avisa', async () => {
    await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Pausar — 6308-ZZ' }));
    await waitFor(() => expect(setWatcherPaused).toHaveBeenCalledWith('w-6308-ZZ', true));
    await waitFor(() => expect(fetchWatchers).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('status')).toHaveTextContent('Watcher de 6308-ZZ pausado.');
  });

  it('Reactivar llama a setWatcherPaused(id, false)', async () => {
    await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Reactivar — 7210-BECBP' }));
    await waitFor(() => expect(setWatcherPaused).toHaveBeenCalledWith('w-7210-BECBP', false));
    expect(await screen.findByRole('status')).toHaveTextContent('Watcher de 7210-BECBP reactivado.');
  });

  it('Mantener activo 30 días más renueva', async () => {
    await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Mantener activo 30 días más' }));
    await waitFor(() => expect(renewWatcher).toHaveBeenCalledWith('w-22316-E'));
    expect(await screen.findByRole('status')).toHaveTextContent('Watcher de 22316-E renovado por 30 días más.');
  });

  it('Dejar que expire llama a letWatcherExpire', async () => {
    await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Dejar que expire' }));
    await waitFor(() => expect(letWatcherExpire).toHaveBeenCalledWith('w-22316-E'));
    expect(await screen.findByRole('status')).toHaveTextContent('Watcher de 22316-E expirado.');
  });

  it('si la acción falla, el error va a un role=alert y NO se repide la lista', async () => {
    setWatcherPaused.mockRejectedValue(new Error('Solo se pausa un watcher activo'));
    await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Pausar — 6308-ZZ' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo se pausa un watcher activo');
    expect(fetchWatchers).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('Ver resultados entrega a onViewResults los criterios del watcher', async () => {
    const onView = await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Ver resultados' }));
    expect(onView).toHaveBeenCalledWith({
      partNumber: 'NU2210-E-TVP2',
      brand: 'FAG',
      minQuantity: 50,
      zone: null,
      country: '',
      maxLeadTimeDays: null,
    });
  });
});

describe('Watchers · editar (spec §4)', () => {
  it('Editar abre el formulario inline de ESA tarjeta, con sus valores', async () => {
    await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Editar — 7210-BECBP' }));
    const form = screen.getByRole('form', { name: 'Editar watcher 7210-BECBP' });
    expect(within(form).getByLabelText('Referencia')).toHaveValue('7210-BECBP');
    expect(within(form).getByLabelText('Cantidad mínima')).toHaveValue(10);
    expect(within(form).getByLabelText('Marca')).toHaveValue('SKF');
    expect(within(form).getByLabelText('País')).toHaveValue('ES');
  });

  it('solo hay un formulario abierto: editar otro cierra el anterior', async () => {
    await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Editar — 7210-BECBP' }));
    await userEvent.click(screen.getByRole('button', { name: 'Editar — 6308-ZZ' }));
    expect(screen.getAllByRole('form')).toHaveLength(1);
    expect(screen.getByRole('form', { name: 'Editar watcher 6308-ZZ' })).toBeInTheDocument();
  });

  it('Guardar cambios llama a updateWatcher(id, borrador), repide, cierra y avisa', async () => {
    await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Editar — 7210-BECBP' }));
    const qty = screen.getByLabelText('Cantidad mínima');
    await userEvent.clear(qty);
    await userEvent.type(qty, '250');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() =>
      expect(updateWatcher).toHaveBeenCalledWith('w-7210-BECBP', {
        partNumber: '7210-BECBP',
        minQuantity: '250',
        brand: 'SKF',
        country: 'ES',
        emailChannel: false,
      }),
    );
    await waitFor(() => expect(fetchWatchers).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('Watcher de 7210-BECBP actualizado.');
  });

  it('Cancelar cierra el formulario sin llamar a nada', async () => {
    await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Editar — 6308-ZZ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(updateWatcher).not.toHaveBeenCalled();
  });

  it('si guardar falla, el formulario SIGUE abierto con el error dentro', async () => {
    updateWatcher.mockRejectedValue(new Error('La cantidad minima tiene que ser un entero positivo.'));
    await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Editar — 6308-ZZ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const form = await screen.findByRole('form', { name: 'Editar watcher 6308-ZZ' });
    expect(within(form).getByRole('alert')).toHaveTextContent('La cantidad minima tiene que ser un entero positivo.');
    expect(fetchWatchers).toHaveBeenCalledTimes(1);
  });
});

describe('Watchers · eliminar (spec §6)', () => {
  it('Eliminar abre un diálogo con la pregunta literal y NO borra todavía', async () => {
    await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar — 6308-ZZ' }));
    const d = screen.getByRole('dialog', { name: '¿Eliminar el watcher de 6308-ZZ? Esta acción no se puede deshacer.' });
    expect(d).toHaveAttribute('aria-modal', 'true');
    expect(within(d).getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(deleteWatcher).not.toHaveBeenCalled();
  });

  it('Cancelar cierra el diálogo sin borrar', async () => {
    await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar — 6308-ZZ' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deleteWatcher).not.toHaveBeenCalled();
  });

  it('Eliminar confirma: borra, repide, cierra y avisa', async () => {
    await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar — 6205-2RS' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(deleteWatcher).toHaveBeenCalledWith('w-6205-2RS'));
    await waitFor(() => expect(fetchWatchers).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('Watcher de 6205-2RS eliminado.');
  });

  it('si borrar falla, el diálogo SIGUE abierto con el error dentro', async () => {
    deleteWatcher.mockRejectedValue(new Error('sin permiso'));
    await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar — 6308-ZZ' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));
    const d = await screen.findByRole('dialog');
    expect(within(d).getByRole('alert')).toHaveTextContent('sin permiso');
    expect(fetchWatchers).toHaveBeenCalledTimes(1);
  });
});
