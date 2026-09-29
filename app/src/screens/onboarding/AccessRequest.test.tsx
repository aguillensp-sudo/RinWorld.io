import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AccessRequestForm, SubmittedAccessRequest } from '../../lib/access-request';

/**
 * CONTRATO DE ACEPTACIÓN · REG-00 · FSR — Formulario de Solicitud de Registro
 * (`AccessRequest`).
 *
 * Escrito antes que el código y por Claude Code (`harness/README.md`). El Coder no
 * lo ve. Se mockea **solo** la función de red, `submitAccessRequest` (de
 * `lib/access-request`). La validación, los textos de error y la lista de países
 * son los de verdad.
 *
 * Los textos son los del HTML aprobado, que manda sobre la spec (`F-170`): los
 * mensajes de error de cada campo y las opciones de país en inglés con su código
 * (`Spain (ES)`).
 *
 * ⚠ Lo que este fichero NO puede cazar, y por eso existe `app/e2e/access-request.spec.ts`:
 * que se llegue a la pantalla desde el login sin sesión. Lo que ESCRIBE (la fila de
 * `registration_requests`) lo mide la Edge Function, probada con `curl` en la base
 * de e2e, no un navegador contra producción (F-188).
 */

const submitAccessRequest = vi.fn<(form: AccessRequestForm) => Promise<SubmittedAccessRequest>>();

vi.mock('../../lib/access-request', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/access-request')>()),
  submitAccessRequest: (form: AccessRequestForm) => submitAccessRequest(form),
}));

const { AccessRequest } = await import('./AccessRequest');

/**
 * 28-sep, tras la corrida de REG-00: rellenar los seis campos tecla a tecla son
 * ~90 pulsaciones, y con la suite entera en paralelo dos tests pasaban de los 5 s
 * por defecto (medido: 5 037 a 5 092 ms) y fallaban a ratos. Se sube el límite,
 * no se toca ningún aserto: un test que falla por reloj cargado se le cobraría
 * al Coder de la tarea que corra a continuación.
 */
vi.setConfig({ testTimeout: 20_000 });

const onSubmitted = vi.fn<(request: SubmittedAccessRequest) => void>();
const onHaveInvitation = vi.fn<() => void>();

const DATOS: AccessRequestForm = {
  email: 'john@bearings.com',
  fullName: 'John Reece',
  orgName: 'Bearings',
  country: 'US',
  phone: '+1 555 010 0100',
  website: 'https://www.bearings.com',
};

const email = () => screen.getByRole('textbox', { name: 'Email del solicitante' });
const nombre = () => screen.getByRole('textbox', { name: 'Nombre y apellidos' });
const org = () => screen.getByRole('textbox', { name: 'Nombre de la organización' });
const pais = () => screen.getByRole('combobox', { name: 'País de la organización' });
const telefono = () => screen.getByRole('textbox', { name: 'Teléfono de contacto' });
const web = () => screen.getByRole('textbox', { name: 'Sitio web' });
const enviar = () => screen.getByRole('button', { name: 'Enviar solicitud' });

function mount() {
  return render(<AccessRequest onSubmitted={onSubmitted} onHaveInvitation={onHaveInvitation} />);
}

async function rellenar(over: Partial<AccessRequestForm> = {}) {
  const d = { ...DATOS, ...over };
  if (d.email) await userEvent.type(email(), d.email);
  if (d.fullName) await userEvent.type(nombre(), d.fullName);
  if (d.orgName) await userEvent.type(org(), d.orgName);
  if (d.country) await userEvent.selectOptions(pais(), d.country);
  if (d.phone) {
    // 29-sep: elegir país rellena el prefijo (petición del PO en la C5); el
    // teléfono de los datos ya lo lleva, así que se escribe sobre el campo vacío.
    await userEvent.clear(telefono());
    await userEvent.type(telefono(), d.phone);
  }
  if (d.website) await userEvent.type(web(), d.website);
}

beforeEach(() => {
  submitAccessRequest.mockReset();
  onSubmitted.mockReset();
  onHaveInvitation.mockReset();
});

describe('REG-00 · la pantalla', () => {
  it('cabecera: eyebrow, un solo h1 con el título y el subtítulo', () => {
    mount();
    expect(screen.getByText('Módulo 01 · Onboarding')).toBeInTheDocument();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent('Solicita acceso a Bearingworld.io');
    expect(
      screen.getByText('Nuestro equipo revisará tu solicitud y te contactará en un plazo máximo de 48 horas.'),
    ).toBeInTheDocument();
  });

  it('el logo de la cabecera mínima', () => {
    mount();
    expect(screen.getByRole('img', { name: 'Bearingworld.io' })).toHaveAttribute('src', expect.stringContaining('intentologo.png'));
  });

  it('los seis campos, con sus placeholders', () => {
    mount();
    expect(email()).toHaveAttribute('placeholder', 'tu@empresa.com');
    expect(email()).toHaveAttribute('type', 'email');
    expect(nombre()).toHaveAttribute('placeholder', 'Nombre y apellidos');
    expect(org()).toHaveAttribute('placeholder', 'Nombre legal de la empresa');
    expect(telefono()).toHaveAttribute('placeholder', '+34 963 456 789');
    expect(web()).toHaveAttribute('placeholder', 'https://www.empresa.com');
    expect(web()).toHaveAttribute('type', 'url');
  });

  it('el país: primero "Selecciona un país" y luego los 194 del HTML aprobado', () => {
    mount();
    const opciones = Array.from(pais().querySelectorAll('option'));
    expect(opciones).toHaveLength(195);
    expect(opciones[0]).toHaveTextContent('Selecciona un país');
    expect(opciones[0]).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Spain (ES)' })).toHaveValue('ES');
    expect(screen.getByRole('option', { name: 'United States of America (US)' })).toHaveValue('US');
    expect(pais()).toHaveValue('');
  });

  it('el enlace de invitación es un botón que llama a onHaveInvitation', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: '¿Tienes un enlace de invitación? Accede directamente →' }));
    expect(onHaveInvitation).toHaveBeenCalledTimes(1);
  });

  it('no hay ningún error visible al abrir', () => {
    mount();
    expect(screen.queryByText('Introduce un email válido')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('REG-00 · validación', () => {
  it('Enviar solicitud empieza deshabilitado', () => {
    mount();
    expect(enviar()).toBeDisabled();
  });

  it('con los seis campos válidos se habilita', async () => {
    mount();
    await rellenar();
    expect(enviar()).toBeEnabled();
  });

  it('una web sin https:// lo deja deshabilitado y, al salir del campo, dice por qué', async () => {
    mount();
    await rellenar({ website: 'http://www.bearings.com' });
    expect(enviar()).toBeDisabled();
    await userEvent.tab();
    expect(screen.getByText('La URL debe comenzar por https://')).toBeInTheDocument();
    expect(web()).toHaveAttribute('aria-invalid', 'true');
  });

  it('un email mal escrito se señala al salir del campo', async () => {
    mount();
    await userEvent.type(email(), 'john@bearings');
    await userEvent.tab();
    expect(screen.getByText('Introduce un email válido')).toBeInTheDocument();
    expect(email()).toHaveAttribute('aria-invalid', 'true');
  });

  it('el email vacío NO se queja al salir (regla del HTML aprobado)', async () => {
    mount();
    await userEvent.click(email());
    await userEvent.tab();
    expect(screen.queryByText('Introduce un email válido')).toBeNull();
  });

  it('el teléfono vacío SÍ se queja al salir', async () => {
    mount();
    await userEvent.click(telefono());
    await userEvent.tab();
    expect(screen.getByText('Introduce un teléfono de contacto')).toBeInTheDocument();
  });

  it('el error desaparece al corregir el campo', async () => {
    mount();
    await userEvent.type(email(), 'john@bearings');
    await userEvent.tab();
    expect(screen.getByText('Introduce un email válido')).toBeInTheDocument();
    await userEvent.type(email(), '.com');
    await userEvent.tab();
    expect(screen.queryByText('Introduce un email válido')).toBeNull();
  });
});

describe('REG-00 · envío', () => {
  const guardada: SubmittedAccessRequest = { id: 'r-1', submittedAt: '2026-09-28T10:31:00Z', form: DATOS };

  it('envía los seis campos una vez y entrega el resultado a onSubmitted', async () => {
    submitAccessRequest.mockResolvedValue(guardada);
    mount();
    await rellenar();
    await userEvent.click(enviar());
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(guardada));
    expect(submitAccessRequest).toHaveBeenCalledTimes(1);
    expect(submitAccessRequest).toHaveBeenCalledWith(DATOS);
  });

  it('mientras está en vuelo el botón está deshabilitado', async () => {
    let resolver: (r: SubmittedAccessRequest) => void = () => {};
    submitAccessRequest.mockReturnValue(new Promise((r) => (resolver = r)));
    mount();
    await rellenar();
    await userEvent.click(enviar());
    expect(enviar()).toBeDisabled();
    resolver(guardada);
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
  });

  it('si el servidor rechaza, el motivo en un alert y se puede reintentar', async () => {
    submitAccessRequest.mockRejectedValueOnce(new Error('Ya hay una solicitud en revisión con este email.'));
    mount();
    await rellenar();
    await userEvent.click(enviar());
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya hay una solicitud en revisión con este email.');
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(enviar()).toBeEnabled();

    submitAccessRequest.mockResolvedValueOnce(guardada);
    await userEvent.click(enviar());
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(guardada));
  });

  it('pulsar Intro en un campo con el formulario válido también envía (es un <form>)', async () => {
    submitAccessRequest.mockResolvedValue(guardada);
    mount();
    await rellenar();
    await userEvent.type(web(), '{Enter}');
    await waitFor(() => expect(submitAccessRequest).toHaveBeenCalledTimes(1));
  });
});
