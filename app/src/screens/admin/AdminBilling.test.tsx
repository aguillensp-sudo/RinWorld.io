import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BillingPayment, BillingRow, BillingStatusEvent } from '../../lib/admin-billing';
import type { OperatorProfile } from '../../lib/session';

/**
 * CONTRATO DE ACEPTACIÓN · ADMIN-02 · pantalla (`AdminBilling`).
 *
 * Escrito antes que el código y por Claude Code. El Coder no lo ve. Se mockean
 * **solo** las seis funciones de `lib/admin-billing` que tocan red; el resto
 * -filtros, fechas, validación, `renewalDate`, `todayIso`- sigue siendo el de verdad.
 *
 * ⚠ Lo que este fichero NO puede cazar, y por eso existe `app/e2e/admin-billing.spec.ts`:
 * que la RLS de `0034` esconda los cobros a quien no sea Operador, y que
 * `billing_confirm_payment` mueva de verdad el estado en la base -aquí está
 * mockeado y siempre "funciona".
 */

const fetchBillingOrgs = vi.fn<() => Promise<BillingRow[]>>();
const fetchBillingPayments = vi.fn<(id: string) => Promise<BillingPayment[]>>();
const fetchBillingStatusEvents = vi.fn<(id: string) => Promise<BillingStatusEvent[]>>();
const fetchBillingContactEmail = vi.fn<(id: string) => Promise<string | null>>();
const confirmPayment = vi.fn<(id: string, date: string, note: string) => Promise<void>>();
const suspendOrganization = vi.fn<(id: string) => Promise<void>>();

vi.mock('../../lib/admin-billing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/admin-billing')>()),
  fetchBillingOrgs: () => fetchBillingOrgs(),
  fetchBillingPayments: (id: string) => fetchBillingPayments(id),
  fetchBillingStatusEvents: (id: string) => fetchBillingStatusEvents(id),
  fetchBillingContactEmail: (id: string) => fetchBillingContactEmail(id),
  confirmPayment: (id: string, d: string, n: string) => confirmPayment(id, d, n),
  suspendOrganization: (id: string) => suspendOrganization(id),
}));

const { AdminBilling } = await import('./AdminBilling');

const operator: OperatorProfile = {
  id: 'op-1000000-0000-4000-8000-000000000001',
  email: 'operador@bearingworld.test',
  fullName: 'Admin Principal',
};

const DIA = 86_400_000;
const haceDias = (n: number) => new Date(Date.now() - n * DIA).toISOString();

function row(over: Partial<BillingRow> = {}): BillingRow {
  return {
    orgId: 'org-nordic',
    name: 'Nordic Bearings AB',
    country: 'SE',
    countryLabel: 'Suecia',
    state: 'ACTIVE',
    joinedAt: '2025-06-30T00:00:00Z',
    suspendedSince: null,
    lastPaymentDate: '2025-06-30',
    trialEndsAt: '2025-09-28',
    dueDate: '2026-06-30',
    daysRemaining: 2,
    ...over,
  };
}

/** Spec §3, "Datos de ejemplo", ya en el orden por defecto. */
function ejemplo(): BillingRow[] {
  return [
    row({
      orgId: 'org-timken',
      name: 'Timken Europe GmbH',
      country: 'DE',
      countryLabel: 'Alemania',
      state: 'CANDIDATA A BORRADO',
      lastPaymentDate: null,
      dueDate: '2025-12-28',
      daysRemaining: -182,
      suspendedSince: haceDias(190),
    }),
    row({
      orgId: 'org-ruiz',
      name: 'Distribuciones Ruiz SL',
      country: 'ES',
      countryLabel: 'España',
      state: 'SUSPENDED',
      lastPaymentDate: null,
      dueDate: '2026-02-15',
      daysRemaining: -133,
      suspendedSince: haceDias(133),
    }),
    row(),
    row({
      orgId: 'org-sur',
      name: 'Rodamientos del Sur SL',
      country: 'ES',
      countryLabel: 'España',
      state: 'EN PRUEBA',
      lastPaymentDate: null,
      dueDate: '2026-09-27',
      daysRemaining: 91,
    }),
    row({
      orgId: 'org-nsk',
      name: 'NSK Europe Ltd',
      country: 'DE',
      countryLabel: 'Alemania',
      lastPaymentDate: '2026-03-01',
      dueDate: '2027-03-01',
      daysRemaining: 246,
    }),
  ];
}

/** `YYYY-MM-DD` local, sin depender de la función de producción. */
function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

beforeEach(() => {
  fetchBillingOrgs.mockReset().mockResolvedValue(ejemplo());
  fetchBillingPayments.mockReset().mockResolvedValue([]);
  fetchBillingStatusEvents.mockReset().mockResolvedValue([]);
  fetchBillingContactEmail.mockReset().mockResolvedValue('info@nordicbearings.se');
  confirmPayment.mockReset().mockResolvedValue();
  suspendOrganization.mockReset().mockResolvedValue();
});

const nombresEnTabla = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[0]?.textContent);

async function montar() {
  render(<AdminBilling operator={operator} />);
  await screen.findByRole('button', { name: 'Nordic Bearings AB' });
}

describe('AdminBilling · cabecera y datos', () => {
  it('pinta el eyebrow, el título y el subtítulo literales de la spec §3', async () => {
    await montar();
    expect(screen.getByText('Operador de Plataforma · Módulo 07')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Gestión de cobros' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Suscripciones anuales de todas las organizaciones miembro. Sin pasarela de pago — cobro por transferencia bancaria confirmada manualmente.',
      ),
    ).toBeInTheDocument();
  });

  it('pide las organizaciones UNA vez al montar y las pinta en el orden que llegan', async () => {
    await montar();
    expect(fetchBillingOrgs).toHaveBeenCalledTimes(1);
    expect(nombresEnTabla()).toEqual([
      'Timken Europe GmbH',
      'Distribuciones Ruiz SL',
      'Nordic Bearings AB',
      'Rodamientos del Sur SL',
      'NSK Europe Ltd',
    ]);
  });

  it('un fallo al cargar se pinta en role="alert"', async () => {
    fetchBillingOrgs.mockRejectedValue(new Error('la base no responde'));
    render(<AdminBilling operator={operator} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('la base no responde');
  });

  it('no hay ningún campo de tarjeta ni de pasarela (spec §7)', async () => {
    await montar();
    expect(screen.queryByLabelText(/tarjeta|card|cvv|iban/i)).toBeNull();
  });
});

describe('AdminBilling · filtros', () => {
  it('cinco chips con su contador, Todos activo: 5 / 1 / 1 / 1 / 1', async () => {
    await montar();
    for (const n of ['Todos 5', 'Próximos a vencer 1', 'Suspendidos 1', 'Candidatas a borrado 1', 'En periodo de prueba 1']) {
      expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Todos 5' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Suspendidos 1' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('un chip FILTRA de verdad la tabla, en cliente y sin volver a pedir a la base', async () => {
    const user = userEvent.setup();
    await montar();

    await user.click(screen.getByRole('button', { name: 'Próximos a vencer 1' }));
    expect(nombresEnTabla()).toEqual(['Nordic Bearings AB']);
    expect(screen.getByRole('button', { name: 'Próximos a vencer 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Todos 5' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'Suspendidos 1' }));
    expect(nombresEnTabla()).toEqual(['Distribuciones Ruiz SL']);

    await user.click(screen.getByRole('button', { name: 'En periodo de prueba 1' }));
    expect(nombresEnTabla()).toEqual(['Rodamientos del Sur SL']);

    await user.click(screen.getByRole('button', { name: 'Todos 5' }));
    expect(nombresEnTabla()).toHaveLength(5);
    expect(fetchBillingOrgs).toHaveBeenCalledTimes(1);
  });

  it('Candidatas a borrado filtra la tabla a Timken', async () => {
    const user = userEvent.setup();
    await montar();
    await user.click(screen.getByRole('button', { name: 'Candidatas a borrado 1' }));
    expect(nombresEnTabla()).toEqual(['Timken Europe GmbH']);
  });

  it('sin organizaciones próximas a vencer: el literal de la spec §6', async () => {
    const user = userEvent.setup();
    fetchBillingOrgs.mockResolvedValue(ejemplo().filter((r) => r.orgId !== 'org-nordic'));
    render(<AdminBilling operator={operator} />);
    await screen.findByRole('button', { name: 'NSK Europe Ltd' });
    await user.click(screen.getByRole('button', { name: 'Próximos a vencer 0' }));
    expect(
      screen.getByText('No hay organizaciones con vencimiento en los próximos 15 días.'),
    ).toBeInTheDocument();
  });

  it('los otros tres vacíos y el general, con su literal', async () => {
    const user = userEvent.setup();
    fetchBillingOrgs.mockResolvedValue([row()]);
    render(<AdminBilling operator={operator} />);
    await screen.findByRole('button', { name: 'Nordic Bearings AB' });

    await user.click(screen.getByRole('button', { name: 'Suspendidos 0' }));
    expect(screen.getByText('No hay organizaciones suspendidas.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Candidatas a borrado 0' }));
    expect(screen.getByText('No hay organizaciones candidatas a borrado.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'En periodo de prueba 0' }));
    expect(screen.getByText('No hay organizaciones en periodo de prueba.')).toBeInTheDocument();
  });

  it('sin ninguna organización: "No hay organizaciones."', async () => {
    fetchBillingOrgs.mockResolvedValue([]);
    render(<AdminBilling operator={operator} />);
    expect(await screen.findByText('No hay organizaciones.')).toBeInTheDocument();
  });
});

describe('AdminBilling · sección Candidatas a borrado', () => {
  it('aparece cuando hay candidatas, con nombre, país, fecha de suspensión y meses', async () => {
    await montar();
    const seccion = screen.getByRole('region', { name: 'Candidatas a borrado' });
    expect(within(seccion).getByText('Timken Europe GmbH')).toBeInTheDocument();
    expect(within(seccion).getByText('DE')).toBeInTheDocument();
    expect(within(seccion).getByText(/^Suspendida desde: \d{1,2} [A-Z][a-z]{2} \d{4}$/)).toBeInTheDocument();
    expect(within(seccion).getByText('6 meses en SUSPENDED')).toBeInTheDocument();
  });

  it('no aparece si no hay ninguna candidata', async () => {
    fetchBillingOrgs.mockResolvedValue(ejemplo().filter((r) => r.state !== 'CANDIDATA A BORRADO'));
    render(<AdminBilling operator={operator} />);
    await screen.findByRole('button', { name: 'Nordic Bearings AB' });
    expect(screen.queryByRole('region', { name: 'Candidatas a borrado' })).not.toBeInTheDocument();
  });

  it('Iniciar borrado está deshabilitado, no abre ningún modal y no borra nada', async () => {
    const user = userEvent.setup();
    await montar();
    const seccion = screen.getByRole('region', { name: 'Candidatas a borrado' });
    const boton = within(seccion).getByRole('button', { name: /Iniciar borrado/ });
    expect(boton).toBeDisabled();
    await user.click(boton);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

describe('AdminBilling · panel lateral', () => {
  it('pulsar el nombre abre el panel y pide pagos, estados y email de ESA organización', async () => {
    const user = userEvent.setup();
    await montar();
    await user.click(screen.getByRole('button', { name: 'Nordic Bearings AB' }));

    const panel = await screen.findByRole('complementary', { name: 'Detalle de organización' });
    expect(within(panel).getByRole('heading', { level: 2, name: 'Nordic Bearings AB' })).toBeInTheDocument();
    expect(fetchBillingPayments).toHaveBeenCalledWith('org-nordic');
    expect(fetchBillingStatusEvents).toHaveBeenCalledWith('org-nordic');
    expect(fetchBillingContactEmail).toHaveBeenCalledWith('org-nordic');
    expect(await within(panel).findByText('info@nordicbearings.se')).toBeInTheDocument();
  });

  it('la fila seleccionada es la clicada, no otra (F-179)', async () => {
    const user = userEvent.setup();
    await montar();
    await user.click(screen.getByRole('button', { name: 'Timken Europe GmbH' }));
    const actuales = screen.getAllByRole('row').filter((r) => r.getAttribute('aria-current') === 'true');
    expect(actuales).toHaveLength(1);
    expect(actuales[0]).toHaveTextContent('Timken Europe GmbH');
  });

  it('cerrar el panel lo quita y deja sin fila seleccionada', async () => {
    const user = userEvent.setup();
    await montar();
    await user.click(screen.getByRole('button', { name: 'Nordic Bearings AB' }));
    await screen.findByRole('complementary', { name: 'Detalle de organización' });
    await user.click(screen.getByRole('button', { name: 'Cerrar detalle' }));
    expect(screen.queryByRole('complementary', { name: 'Detalle de organización' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('row').filter((r) => r.hasAttribute('aria-current'))).toHaveLength(0);
  });

  it('un fallo al cargar el historial se pinta en role="alert" sin tirar la tabla', async () => {
    const user = userEvent.setup();
    fetchBillingPayments.mockRejectedValue(new Error('sin permiso sobre billing_payments'));
    await montar();
    await user.click(screen.getByRole('button', { name: 'Nordic Bearings AB' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('sin permiso sobre billing_payments');
    expect(screen.getByRole('button', { name: 'NSK Europe Ltd' })).toBeInTheDocument();
  });
});

describe('AdminBilling · modal Marcar pago recibido', () => {
  const abrir = async (user: ReturnType<typeof userEvent.setup>, nombre = 'Nordic Bearings AB') => {
    await user.click(screen.getByRole('button', { name: `Marcar pago recibido — ${nombre}` }));
    return screen.getByRole('dialog', { name: 'Marcar pago recibido' });
  };

  it('se abre desde la tabla con la fecha de hoy por defecto, y los dos campos de la spec', async () => {
    const user = userEvent.setup();
    await montar();
    const modal = await abrir(user);

    expect(within(modal).getByText('Nordic Bearings AB')).toBeInTheDocument();
    const fecha = within(modal).getByLabelText('Fecha del pago');
    expect(fecha).toHaveAttribute('type', 'date');
    expect(fecha).toHaveValue(iso(new Date()));
    expect(fecha).toHaveAttribute('max', iso(new Date()));
    expect(within(modal).getByText('Fecha en que se recibió la transferencia')).toBeInTheDocument();

    const nota = within(modal).getByLabelText('Nota interna');
    expect(nota).toHaveAttribute('maxlength', '300');
    expect(
      within(modal).getByText('Máx 300 caracteres · ej: referencia de transferencia, banco emisor'),
    ).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: 'Confirmar pago recibido' })).toBeEnabled();
    expect(within(modal).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('Confirmar llama a confirmPayment, repide la lista y avisa con el nuevo vencimiento (+365 días)', async () => {
    const user = userEvent.setup();
    await montar();
    const modal = await abrir(user);
    fireEvent.change(within(modal).getByLabelText('Fecha del pago'), { target: { value: '2026-06-30' } });
    await user.type(within(modal).getByLabelText('Nota interna'), 'Transferencia BBVA ref. 8841');
    await user.click(within(modal).getByRole('button', { name: 'Confirmar pago recibido' }));

    await waitFor(() =>
      expect(confirmPayment).toHaveBeenCalledWith('org-nordic', '2026-06-30', 'Transferencia BBVA ref. 8841'),
    );
    await waitFor(() => expect(fetchBillingOrgs).toHaveBeenCalledTimes(2)); // montaje + tras el pago
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Pago de Nordic Bearings AB confirmado. Nuevo vencimiento: 30 Jun 2027.',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('la nota es opcional', async () => {
    const user = userEvent.setup();
    await montar();
    const modal = await abrir(user);
    await user.click(within(modal).getByRole('button', { name: 'Confirmar pago recibido' }));
    await waitFor(() => expect(confirmPayment).toHaveBeenCalledWith('org-nordic', iso(new Date()), ''));
  });

  it('una fecha futura o vacía deshabilita Confirmar y no llama a la base', async () => {
    const user = userEvent.setup();
    await montar();
    const modal = await abrir(user);
    const fecha = within(modal).getByLabelText('Fecha del pago');
    const boton = within(modal).getByRole('button', { name: 'Confirmar pago recibido' });

    const manana = new Date(Date.now() + DIA);
    fireEvent.change(fecha, { target: { value: iso(manana) } });
    expect(boton).toBeDisabled();
    fireEvent.change(fecha, { target: { value: '' } });
    expect(boton).toBeDisabled();
    await user.click(boton);
    expect(confirmPayment).not.toHaveBeenCalled();
  });

  it('Cancelar cierra el modal sin llamar a la base', async () => {
    const user = userEvent.setup();
    await montar();
    const modal = await abrir(user);
    await user.click(within(modal).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(confirmPayment).not.toHaveBeenCalled();
  });

  it('abrir de nuevo tras cancelar parte de cero: fecha de hoy y nota vacía', async () => {
    const user = userEvent.setup();
    await montar();
    let modal = await abrir(user);
    fireEvent.change(within(modal).getByLabelText('Fecha del pago'), { target: { value: '2026-01-01' } });
    await user.type(within(modal).getByLabelText('Nota interna'), 'algo');
    await user.click(within(modal).getByRole('button', { name: 'Cancelar' }));

    modal = await abrir(user);
    expect(within(modal).getByLabelText('Fecha del pago')).toHaveValue(iso(new Date()));
    expect(within(modal).getByLabelText('Nota interna')).toHaveValue('');
  });

  it('un fallo de la base se pinta en el modal (role="alert") y el modal SIGUE abierto', async () => {
    const user = userEvent.setup();
    confirmPayment.mockRejectedValue(new Error('Solo un Operador de Plataforma confirma un pago'));
    await montar();
    const modal = await abrir(user);
    await user.click(within(modal).getByRole('button', { name: 'Confirmar pago recibido' }));
    expect(await within(modal).findByRole('alert')).toHaveTextContent(
      'Solo un Operador de Plataforma confirma un pago',
    );
    expect(screen.getByRole('dialog', { name: 'Marcar pago recibido' })).toBeInTheDocument();
    expect(fetchBillingOrgs).toHaveBeenCalledTimes(1);
  });

  it('Reactivar (una suspendida) abre ESTE mismo modal: es el mismo verbo en la base', async () => {
    const user = userEvent.setup();
    await montar();
    await user.click(screen.getByRole('button', { name: 'Reactivar — Distribuciones Ruiz SL' }));
    const modal = screen.getByRole('dialog', { name: 'Marcar pago recibido' });
    expect(within(modal).getByText('Distribuciones Ruiz SL')).toBeInTheDocument();
    await user.click(within(modal).getByRole('button', { name: 'Confirmar pago recibido' }));
    await waitFor(() => expect(confirmPayment).toHaveBeenCalledWith('org-ruiz', iso(new Date()), ''));
  });

  it('desde el panel lateral, Marcar pago recibido abre el modal de la organización del panel', async () => {
    const user = userEvent.setup();
    await montar();
    await user.click(screen.getByRole('button', { name: 'Nordic Bearings AB' }));
    const panel = await screen.findByRole('complementary', { name: 'Detalle de organización' });
    await user.click(within(panel).getByRole('button', { name: 'Marcar pago recibido' }));
    const modal = screen.getByRole('dialog', { name: 'Marcar pago recibido' });
    expect(within(modal).getByText('Nordic Bearings AB')).toBeInTheDocument();
  });

  it('con el panel abierto, tras confirmar se refresca también su historial', async () => {
    const user = userEvent.setup();
    await montar();
    await user.click(screen.getByRole('button', { name: 'Nordic Bearings AB' }));
    const panel = await screen.findByRole('complementary', { name: 'Detalle de organización' });
    await waitFor(() => expect(fetchBillingPayments).toHaveBeenCalledTimes(1));

    await user.click(within(panel).getByRole('button', { name: 'Marcar pago recibido' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar pago recibido' }));

    await waitFor(() => expect(fetchBillingPayments).toHaveBeenCalledTimes(2));
    expect(fetchBillingPayments).toHaveBeenLastCalledWith('org-nordic');
  });
});

describe('AdminBilling · Suspender manualmente', () => {
  it('llama a suspendOrganization, repide la lista y avisa', async () => {
    const user = userEvent.setup();
    await montar();
    await user.click(screen.getByRole('button', { name: 'Nordic Bearings AB' }));
    const panel = await screen.findByRole('complementary', { name: 'Detalle de organización' });

    await user.click(within(panel).getByRole('button', { name: 'Suspender manualmente' }));

    await waitFor(() => expect(suspendOrganization).toHaveBeenCalledWith('org-nordic'));
    await waitFor(() => expect(fetchBillingOrgs).toHaveBeenCalledTimes(2));
    expect(await within(panel).findByRole('status')).toHaveTextContent('Nordic Bearings AB suspendida.');
  });

  it('un fallo deja el panel abierto con el error en role="alert"', async () => {
    const user = userEvent.setup();
    suspendOrganization.mockRejectedValue(new Error('Solo se suspende una organizacion activa o en prueba'));
    await montar();
    await user.click(screen.getByRole('button', { name: 'Nordic Bearings AB' }));
    const panel = await screen.findByRole('complementary', { name: 'Detalle de organización' });
    await user.click(within(panel).getByRole('button', { name: 'Suspender manualmente' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent(
      'Solo se suspende una organizacion activa o en prueba',
    );
    expect(within(panel).getByRole('button', { name: 'Suspender manualmente' })).toBeInTheDocument();
  });
});
