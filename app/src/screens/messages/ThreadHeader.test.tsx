import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { THREAD_STATES, type ThreadState } from '../../lib/threads';
import { AGREEMENT_DISABLED_REASON, type ThreadDetail } from '../../lib/thread-detail';
import { ThreadHeader } from './ThreadHeader';

/**
 * CONTRATO DE ACEPTACIÓN · MSG-02 · cabecera del hilo.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 *
 * Aquí viven las tres acciones del hilo de la §3, y **una de las tres no se puede
 * ejecutar** (D-07-04): `Marcar acuerdo alcanzado` va deshabilitada siempre,
 * porque `app.guard_thread_state` levanta excepción ante ese valor puesto desde
 * el cliente. Es lo más importante de este fichero.
 */

const onBack = vi.fn();
const onOpenCounterparty = vi.fn();
const onClose = vi.fn();
const onRevert = vi.fn();

beforeEach(() => {
  onBack.mockReset();
  onOpenCounterparty.mockReset();
  onClose.mockReset();
  onRevert.mockReset();
});

function detail(state: ThreadState = 'CON OFERTA PENDIENTE'): ThreadDetail {
  return {
    id: 't1000000-0000-4000-8000-000000000001',
    counterpartyId: 'b2000000-0000-4000-8000-000000000002',
    counterpartyName: 'NSK Europe Ltd',
    counterpartyCountry: 'DE',
    state,
  };
}

function pinta(state: ThreadState = 'CON OFERTA PENDIENTE') {
  return render(
    <ThreadHeader
      detail={detail(state)}
      onBack={onBack}
      onOpenCounterparty={onOpenCounterparty}
      onClose={onClose}
      onRevert={onRevert}
    />,
  );
}

/** Las acciones viven en un desplegable: hay que abrirlo antes de mirarlas. */
async function abreAcciones(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Acciones del hilo' }));
}

describe('identificación del hilo', () => {
  it('lleva el eyebrow del módulo', () => {
    pinta();
    expect(screen.getByText('Módulo 04 · Mensajería E2EE')).toBeInTheDocument();
  });

  it('el breadcrumb vuelve a MSG-01', async () => {
    const user = userEvent.setup();
    pinta();
    await user.click(screen.getByRole('button', { name: 'Hilos' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('el nombre de la contraparte avisa con su ID de organización', async () => {
    const user = userEvent.setup();
    pinta();
    await user.click(screen.getByRole('button', { name: 'NSK Europe Ltd' }));
    expect(onOpenCounterparty).toHaveBeenCalledWith('b2000000-0000-4000-8000-000000000002');
  });

  it('el badge de estado dice el estado literal del esquema', () => {
    pinta('ACUERDO ALCANZADO');
    expect(screen.getByText('ACUERDO ALCANZADO')).toBeInTheDocument();
  });

  it('⚠ el badge de país es el código ISO de 2 letras, no el nombre', () => {
    // La §3 dice "código ISO 2 letras" y el HTML aprobado escribe "Alemania".
    // Manda el spec, el mock es un mock (F-041), y MSG-01 ya pinta el código.
    pinta();
    expect(screen.getByText('DE')).toBeInTheDocument();
    expect(screen.queryByText(/Alemania/i)).not.toBeInTheDocument();
  });
});

describe('⚠ `Marcar acuerdo alcanzado` — la acción que no existe (D-07-04)', () => {
  it('está deshabilitada en LOS CINCO estados, sin excepción', async () => {
    // No es "deshabilitada mientras no toque": es que el estado lo deriva la base
    // desde la aceptación de una oferta (`spec.md:195`) y el cliente no lo escribe
    // nunca (`0007:246`). Si en algún estado saliera activa, ese clic reventaría
    // con un error de Postgres delante del socio.
    const user = userEvent.setup();
    for (const state of THREAD_STATES) {
      const { unmount } = pinta(state);
      await abreAcciones(user);
      expect(screen.getByRole('button', { name: 'Marcar acuerdo alcanzado' })).toBeDisabled();
      unmount();
    }
  });

  it('lleva el motivo real en texto visible, y no dice que falte una función', () => {
    pinta();
    expect(screen.getByText(AGREEMENT_DISABLED_REASON)).toBeInTheDocument();
  });
});

describe('`Cerrar sin acuerdo`', () => {
  it.each(['ABIERTO', 'CON CONSULTA PENDIENTE', 'CON OFERTA PENDIENTE', 'ACUERDO ALCANZADO'] as const)(
    'está disponible en %s',
    async (state) => {
      const user = userEvent.setup();
      pinta(state);
      await abreAcciones(user);
      const boton = screen.getByRole('button', { name: 'Cerrar sin acuerdo' });
      expect(boton).not.toBeDisabled();
      await user.click(boton);
      expect(onClose).toHaveBeenCalledTimes(1);
    },
  );

  it('no está disponible en un hilo ya cerrado', async () => {
    const user = userEvent.setup();
    pinta('CERRADO SIN ACUERDO');
    await abreAcciones(user);
    expect(screen.getByRole('button', { name: 'Cerrar sin acuerdo' })).toBeDisabled();
  });

  it('la cabecera NO confirma por su cuenta: solo avisa', async () => {
    // La confirmación es de la pantalla (`Thread.test.tsx`). Si la cabecera montara
    // su propio diálogo habría dos, y el de la pantalla es el que sabe si la
    // escritura salió bien.
    const user = userEvent.setup();
    pinta();
    await abreAcciones(user);
    await user.click(screen.getByRole('button', { name: 'Cerrar sin acuerdo' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('`Revertir a abierto`', () => {
  it('solo está disponible con el acuerdo alcanzado', async () => {
    const user = userEvent.setup();
    pinta('ACUERDO ALCANZADO');
    await abreAcciones(user);
    const boton = screen.getByRole('button', { name: 'Revertir a abierto' });
    expect(boton).not.toBeDisabled();
    await user.click(boton);
    expect(onRevert).toHaveBeenCalledTimes(1);
  });

  it.each(['ABIERTO', 'CON CONSULTA PENDIENTE', 'CON OFERTA PENDIENTE', 'CERRADO SIN ACUERDO'] as const)(
    'está deshabilitada en %s',
    async (state) => {
      const user = userEvent.setup();
      pinta(state);
      await abreAcciones(user);
      expect(screen.getByRole('button', { name: 'Revertir a abierto' })).toBeDisabled();
    },
  );
});

describe('el desplegable', () => {
  it('declara si está abierto o cerrado, y no solo con una clase', async () => {
    // `_nota_accesibilidad` del formato: si un test tiene que distinguir dos
    // estados de un control, el estado va en un atributo ARIA.
    const user = userEvent.setup();
    pinta();
    const toggle = screen.getByRole('button', { name: 'Acciones del hilo' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('las tres acciones de la §3 están, ni una más ni una menos', async () => {
    const user = userEvent.setup();
    pinta();
    await abreAcciones(user);
    for (const nombre of ['Marcar acuerdo alcanzado', 'Cerrar sin acuerdo', 'Revertir a abierto']) {
      expect(screen.getByRole('button', { name: nombre })).toBeInTheDocument();
    }
    // `Retirar oferta` es de VND-01 y no entra en el MVP (D-07-02); aquí no pinta
    // nada, pero el hilo es donde se colaría.
    expect(screen.queryByRole('button', { name: /Retirar/i })).not.toBeInTheDocument();
  });
});
