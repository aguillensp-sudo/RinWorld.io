import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RegistrationForm, RegistrationPrefill } from '../../lib/register-org';

/**
 * CONTRATO DE ACEPTACIÓN · REG-01 · FRO — Formulario de Registro de Organización
 * (`OrgRegistration`).
 *
 * Escrito antes que el código y por Claude Code (`harness/README.md`). El Coder no lo ve.
 * Se mockean **solo** las tres funciones de red de `lib/register-org`
 * (`validateRegistrationLink`, `isAdminEmailAvailable`, `submitRegistration`). La
 * validación, los textos, los países y las reglas de etiquetas son los de verdad.
 *
 * Los textos son los del HTML aprobado, que manda sobre la spec (`F-170`); los mensajes de
 * error que el HTML no pinta, los de la spec §6. Lo que el HTML dibuja y esta pantalla no
 * pinta (VERA, shell, eyebrow, ref interna) está medido como AUSENTE.
 *
 * ⚠ Lo que este fichero NO puede cazar, y por eso existe `app/e2e/org-registration.spec.ts`:
 * que se llegue a la pantalla con el enlace `#registro?token=…`, que la página entera se
 * pinte fuera del shell y que el formulario funcione en el build real. Lo que ESCRIBE (la
 * organización, el NIF y el administrador) lo midió el banco de esquema (`0041`) y la Edge
 * Function con `curl` (F-188: nada de esto crea cuentas contra producción desde un navegador).
 */

const validateRegistrationLink = vi.fn<(token: string) => Promise<RegistrationPrefill>>();
const isAdminEmailAvailable = vi.fn<(token: string, email: string) => Promise<boolean>>();
const submitRegistration = vi.fn<(token: string, form: RegistrationForm) => Promise<void>>();
const isContactEmailAvailable = vi.fn<(token: string, email: string, adminEmail: string) => Promise<boolean>>();

vi.mock('../../lib/register-org', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/register-org')>()),
  validateRegistrationLink: (token: string) => validateRegistrationLink(token),
  isAdminEmailAvailable: (token: string, email: string) => isAdminEmailAvailable(token, email),
  submitRegistration: (token: string, form: RegistrationForm) => submitRegistration(token, form),
  isContactEmailAvailable: (token: string, email: string, adminEmail: string) =>
    isContactEmailAvailable(token, email, adminEmail),
}));

const { OrgRegistration } = await import('./OrgRegistration');
const { REGISTRATION_COUNTRIES, DIAL_OPTIONS, FIELD_META, REGISTRATION_TEXTS, INVALID_LINK_TEXTS, VISIBILITY_OPTIONS } =
  await import('../../lib/register-org');

/** Rellenar un formulario entero tecla a tecla es lento con la suite en paralelo (F-225). */
vi.setConfig({ testTimeout: 30_000 });

const TOKEN = 'cd'.repeat(32);
const onRegistered = vi.fn<() => void>();
const onBackToLogin = vi.fn<() => void>();

const PREFILL: RegistrationPrefill = {
  orgName: 'Rodamientos del Sur SL',
  country: 'ES',
  applicantFullName: 'Juan Martínez Herrera',
  applicantEmail: 'juan@sur.es',
  applicantPhone: '+34 954 123 456',
  website: 'https://www.sur.es',
  expiresAt: '2026-10-06T08:00:00Z',
};

beforeEach(() => {
  validateRegistrationLink.mockReset().mockResolvedValue(PREFILL);
  isAdminEmailAvailable.mockReset().mockResolvedValue(true);
  submitRegistration.mockReset().mockResolvedValue(undefined);
  isContactEmailAvailable.mockReset().mockResolvedValue(true);
  onRegistered.mockReset();
  onBackToLogin.mockReset();
});

const user = () => userEvent.setup({ delay: null });

const legal = () => screen.getByRole('textbox', { name: 'Nombre legal de la empresa' });
const nif = () => screen.getByRole('textbox', { name: /^NIF \/ CIF/ });
const direccion = () => screen.getByRole('textbox', { name: 'Dirección' });
const cp = () => screen.getByRole('textbox', { name: 'Código postal' });
const sede = () => screen.getByRole('combobox', { name: 'País de sede' });
const emailContacto = () => screen.getByRole('textbox', { name: 'Email de contacto público' });
const prefijo = () => screen.getByRole('combobox', { name: 'Prefijo telefónico' });
const telefono = () => screen.getByRole('textbox', { name: 'Teléfono de contacto público' });
const web = () => screen.getByRole('textbox', { name: 'Sitio web corporativo' });
// 29-sep (C5 del PO): los países se ELIGEN de un desplegable; ya no se escriben ni se añaden con Intro.
const paisesOperacion = () => screen.getByRole('combobox', { name: 'Países de operación' });
const opcionesDePaises = () => within(paisesOperacion()).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
const marcas = () => screen.getByRole('textbox', { name: 'Marcas principales que distribuye' });
const nombreAdmin = () => screen.getByRole('textbox', { name: 'Nombre completo' });
const emailAdmin = () => screen.getByRole('textbox', { name: 'Email del administrador' });
// El asterisco de obligatorio va oculto (`aria-hidden`) pero su texto cuenta para `getByLabelText`.
const clave = () => screen.getByLabelText(/^Contraseña\s*\*?$/);
const repetir = () => screen.getByLabelText(/^Repetir contraseña\s*\*?$/);

/** Una etiqueta de país (no la `<option>` del mismo texto de los desplegables). */
const SIN_OPCION = { selector: ':not(option)' } as const;
const etiqueta = (texto: string) => screen.getByText(texto, SIN_OPCION);
const etiquetas = (texto: string) => screen.queryAllByText(texto, SIN_OPCION);
const terminos = () => screen.getByRole('checkbox', { name: /Acepto los Términos y Condiciones de Bearingworld\.io\./ });
const crear = () => screen.getByRole('button', { name: /^(Crear mi cuenta|Creando tu cuenta…)$/ });

async function montar() {
  const u = user();
  render(<OrgRegistration token={TOKEN} onRegistered={onRegistered} onBackToLogin={onBackToLogin} />);
  await screen.findByRole('heading', { level: 1, name: REGISTRATION_TEXTS.title });
  return u;
}

/** Lo que el FSR no trae: NIF, dirección, CP, contacto, contraseñas y términos. */
async function completar(u: ReturnType<typeof user>) {
  await u.type(nif(), 'B-12345678');
  await u.type(direccion(), 'Calle Industria, 47, Nave 3');
  await u.type(cp(), '41900');
  await u.type(emailContacto(), 'info@sur.es');
  await u.type(clave(), 'Correcta-2026!');
  await u.type(repetir(), 'Correcta-2026!');
  await u.click(terminos());
}

describe('REG-01 · el enlace', () => {
  it('comprueba el token que recibe y, mientras tanto, no pinta el formulario', async () => {
    let resolver: (p: RegistrationPrefill) => void = () => {};
    validateRegistrationLink.mockReset().mockReturnValue(new Promise((r) => (resolver = r)));
    const { container } = render(<OrgRegistration token={TOKEN} onRegistered={onRegistered} onBackToLogin={onBackToLogin} />);
    expect(validateRegistrationLink).toHaveBeenCalledTimes(1);
    expect(validateRegistrationLink).toHaveBeenCalledWith(TOKEN);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Nombre legal de la empresa' })).not.toBeInTheDocument();
    resolver(PREFILL);
    expect(await screen.findByRole('heading', { level: 1, name: REGISTRATION_TEXTS.title })).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('un enlace que no vale enseña «Este enlace no es válido», sin formulario, y se puede volver al login', async () => {
    validateRegistrationLink.mockReset().mockRejectedValue(new Error('El enlace no es válido o ha caducado.'));
    const u = user();
    render(<OrgRegistration token={TOKEN} onRegistered={onRegistered} onBackToLogin={onBackToLogin} />);
    expect(await screen.findByRole('heading', { level: 1, name: INVALID_LINK_TEXTS.title })).toBeInTheDocument();
    expect(screen.getByText(INVALID_LINK_TEXTS.message)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: INVALID_LINK_TEXTS.back }));
    expect(onBackToLogin).toHaveBeenCalledTimes(1);
  });
});

describe('REG-01 · la página', () => {
  it('pinta la barra de marca, el logo, el título, el subtítulo y las dos secciones, verbatim', async () => {
    await montar();
    expect(screen.getByText('ZERO KNOWLEDGE ARCHITECTURE · CRYPTOGRAPHIC SECURITY')).toBeInTheDocument();
    expect(screen.getByText('CONNECT · TRADE · SECURE')).toBeInTheDocument();
    expect(screen.getByText('INDUSTRIAL INTELLIGENCE NETWORK')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Bearingworld.io' })).toHaveAttribute('src', '/intentologo.png');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText(REGISTRATION_TEXTS.subtitleLine1, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(REGISTRATION_TEXTS.subtitleLine2, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(REGISTRATION_TEXTS.section1)).toBeInTheDocument();
    expect(screen.getByText(REGISTRATION_TEXTS.section2)).toBeInTheDocument();
  });

  it('va fuera del shell y sin lo que el HTML dibuja y no existe: sin menú, sin VERA, sin eyebrow ni ref internos', async () => {
    await montar();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByText(/Cerrar sesión/)).not.toBeInTheDocument();
    expect(screen.queryByText('VERA')).not.toBeInTheDocument();
    expect(screen.queryByText('Asistente de registro')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Pregunta a VERA...')).not.toBeInTheDocument();
    expect(screen.queryByText('Módulo 01 · Onboarding')).not.toBeInTheDocument();
    expect(screen.queryByText(/REG-01 \/ FRO/)).not.toBeInTheDocument();
  });

  it('cada campo lleva su etiqueta, su placeholder y su ayuda, verbatim', async () => {
    await montar();
    expect(legal()).toHaveAttribute('placeholder', FIELD_META.legalName.placeholder);
    expect(legal()).toHaveAttribute('maxlength', '120');
    expect(nif()).toHaveAttribute('placeholder', FIELD_META.taxId.placeholder);
    expect(nif()).toHaveAttribute('maxlength', '20');
    expect(direccion()).toHaveAttribute('maxlength', '150');
    expect(cp()).toHaveAttribute('maxlength', '10');
    expect(cp()).toHaveAttribute('placeholder', '41900');
    expect(emailContacto()).toHaveAttribute('maxlength', '30');
    expect(telefono()).toHaveAttribute('placeholder', '954 123 456');
    expect(web()).toHaveAttribute('placeholder', 'https://www.empresa.com');
    expect(within(paisesOperacion()).getAllByRole('option')[0]).toHaveTextContent('Selecciona un país para añadirlo');
    expect(marcas()).toHaveAttribute('placeholder', 'Escribe una marca...');
    expect(nombreAdmin()).toHaveAttribute('maxlength', '50');
    expect(clave()).toHaveAttribute('placeholder', 'Mín. 10 caracteres');
    expect(repetir()).toHaveAttribute('placeholder', 'Repite la contraseña');
    for (const hint of [
      'Mín 5 / máx 120 caracteres',
      'Dato interno · máx 20 caracteres',
      'Máx 150 caracteres',
      'Máx 10 car.',
      'Lista ISO 3166-1 · establece prefijo telefónico',
      'Máx 30 caracteres',
      'Solo dígitos, espacios y guiones',
      'Debe comenzar por https:// si se introduce',
      'Mín 1 · país de sede preseleccionado',
      'Máx 20 tags · máx 60 caracteres por tag',
      'Mín 6 / máx 50 caracteres',
      'Formato email · unicidad en tiempo real',
      '1 may · 1 min · 1 número · 1 símbolo',
      'Debe coincidir exactamente',
    ]) {
      expect(screen.getByText(hint)).toBeInTheDocument();
    }
    expect(screen.getByText(REGISTRATION_TEXTS.sensitiveTag)).toBeInTheDocument();
  });

  it('el aviso de rol, Google (desactivado, «Próximamente») y el divisor están donde el HTML los pone', async () => {
    await montar();
    expect(screen.getByText(REGISTRATION_TEXTS.roleNoticeStrong)).toBeInTheDocument();
    expect(screen.getByText(REGISTRATION_TEXTS.or)).toBeInTheDocument();
    const google = screen.getByRole('button', { name: new RegExp(REGISTRATION_TEXTS.google) });
    expect(google).toBeDisabled();
    expect(screen.getAllByText(REGISTRATION_TEXTS.soon)).toHaveLength(2); // Google y logo
  });

  it('el logo se pinta desactivado: ningún selector de ficheros activo', async () => {
    const { container } = render(
      <OrgRegistration token={TOKEN} onRegistered={onRegistered} onBackToLogin={onBackToLogin} />,
    );
    await screen.findByRole('heading', { level: 1, name: REGISTRATION_TEXTS.title });
    expect(screen.getByText(REGISTRATION_TEXTS.logoTitle)).toBeInTheDocument();
    expect(screen.getByText(REGISTRATION_TEXTS.logoHint)).toBeInTheDocument();
    expect(container.querySelector('input[type="file"]:not([disabled])')).toBeNull();
  });
});

describe('REG-01 · pre-relleno desde el FSR', () => {
  it('trae lo que el solicitante escribió y deja vacío lo demás', async () => {
    await montar();
    expect(legal()).toHaveValue('Rodamientos del Sur SL');
    expect(sede()).toHaveValue('ES');
    expect(prefijo()).toHaveValue('ES');
    expect(telefono()).toHaveValue('954 123 456');
    expect(web()).toHaveValue('https://www.sur.es');
    expect(nombreAdmin()).toHaveValue('Juan Martínez Herrera');
    expect(emailAdmin()).toHaveValue('juan@sur.es');
    expect(nif()).toHaveValue('');
    expect(direccion()).toHaveValue('');
    expect(cp()).toHaveValue('');
    expect(emailContacto()).toHaveValue('');
    expect(clave()).toHaveValue('');
    expect(repetir()).toHaveValue('');
  });

  it('el país de sede sale preseleccionado en «Países de operación»', async () => {
    await montar();
    expect(etiqueta('España (ES)')).toBeInTheDocument();
  });

  it('ni un campo enseña error al abrir, y «Crear mi cuenta» está deshabilitado', async () => {
    const { container } = render(
      <OrgRegistration token={TOKEN} onRegistered={onRegistered} onBackToLogin={onBackToLogin} />,
    );
    await screen.findByRole('heading', { level: 1, name: REGISTRATION_TEXTS.title });
    expect(container.querySelector('[aria-invalid="true"]')).toBeNull();
    expect(crear()).toBeDisabled();
    expect(terminos()).not.toBeChecked();
  });
});

describe('REG-01 · país de sede y prefijo', () => {
  it('el país de sede ofrece los 194 países, en español y con su código', async () => {
    await montar();
    const opciones = within(sede()).getAllByRole('option');
    expect(opciones).toHaveLength(REGISTRATION_COUNTRIES.length + 1);
    expect(opciones[0]).toHaveTextContent('Selecciona un país');
    expect(within(sede()).getByRole('option', { name: 'España (ES)' })).toHaveValue('ES');
  });

  it('el prefijo ofrece una opción por país con su prefijo y su código', async () => {
    await montar();
    expect(within(prefijo()).getAllByRole('option')).toHaveLength(DIAL_OPTIONS.length);
    expect(within(prefijo()).getByRole('option', { name: '+34 · ES' })).toHaveValue('ES');
    expect(within(prefijo()).getByRole('option', { name: '+351 · PT' })).toHaveValue('PT');
  });

  it('elegir otro país de sede cambia el prefijo, conserva el número y añade el país a los de operación', async () => {
    const u = await montar();
    await u.selectOptions(sede(), 'PT');
    expect(prefijo()).toHaveValue('PT');
    expect(telefono()).toHaveValue('954 123 456');
    expect(etiqueta('Portugal (PT)')).toBeInTheDocument();
    expect(etiqueta('España (ES)')).toBeInTheDocument();
  });

  it('el prefijo se puede cambiar a mano sin tocar el país de sede', async () => {
    const u = await montar();
    await u.selectOptions(prefijo(), 'FR');
    expect(prefijo()).toHaveValue('FR');
    expect(sede()).toHaveValue('ES');
  });
});

describe('REG-01 · etiquetas de países y de marcas', () => {
  it('un país se elige del desplegable, se añade a la caja y el desplegable vuelve a su texto de ayuda', async () => {
    const u = await montar();
    await u.selectOptions(paisesOperacion(), 'DE');
    expect(etiqueta('Alemania (DE)')).toBeInTheDocument();
    expect(paisesOperacion()).toHaveValue('');
  });

  it('los países añadidos van en una caja aparte, en varias líneas, con su botón de quitar', async () => {
    const u = await montar();
    await u.selectOptions(paisesOperacion(), 'DE');
    await u.selectOptions(paisesOperacion(), 'FR');
    const caja = screen.getByRole('group', { name: 'Países añadidos' });
    for (const texto of ['España (ES)', 'Alemania (DE)', 'Francia (FR)']) {
      expect(within(caja).getByText(texto)).toBeInTheDocument();
    }
    expect(within(caja).getAllByRole('button')).toHaveLength(3);
  });

  it('un país ya elegido deja de ofrecerse, y al quitarlo vuelve a ofrecerse', async () => {
    const u = await montar();
    expect(opcionesDePaises()).not.toContain('ES'); // el de sede viene preseleccionado
    expect(opcionesDePaises()).toContain('DE');
    await u.selectOptions(paisesOperacion(), 'DE');
    expect(opcionesDePaises()).not.toContain('DE');
    await u.click(screen.getByRole('button', { name: 'Eliminar Alemania (DE)' }));
    expect(opcionesDePaises()).toContain('DE');
    expect(etiquetas('Alemania (DE)')).toHaveLength(0);
  });

  it('el desplegable ofrece los 194 países menos los ya elegidos, y ningún campo de texto para los países', async () => {
    await montar();
    expect(opcionesDePaises().filter((v) => v !== '')).toHaveLength(REGISTRATION_COUNTRIES.length - 1);
    expect(screen.queryByRole('textbox', { name: 'Países de operación' })).not.toBeInTheDocument();
  });

  it('Intro en un campo de etiquetas no envía el formulario', async () => {
    const u = await montar();
    await u.type(marcas(), 'SKF{Enter}');
    expect(submitRegistration).not.toHaveBeenCalled();
  });

  it('las marcas se añaden con Intro, sin repetir aunque cambien las mayúsculas, y se quitan', async () => {
    const u = await montar();
    await u.type(marcas(), 'SKF{Enter}');
    await u.type(marcas(), 'skf{Enter}');
    await u.type(marcas(), 'FAG{Enter}');
    expect(screen.getAllByText('SKF')).toHaveLength(1);
    expect(screen.getByText('FAG')).toBeInTheDocument();
    expect(marcas()).toHaveValue('');
    await u.click(screen.getByRole('button', { name: 'Eliminar SKF' }));
    expect(screen.queryByText('SKF')).not.toBeInTheDocument();
    expect(screen.getByText('FAG')).toBeInTheDocument();
  });

  it('como mucho 20 marcas', async () => {
    const u = await montar();
    for (let i = 1; i <= 21; i++) await u.type(marcas(), `M${i}{Enter}`);
    expect(screen.getByText('M20')).toBeInTheDocument();
    expect(screen.queryByText('M21')).not.toBeInTheDocument();
  });
});

describe('REG-01 · visibilidad y términos', () => {
  it('la visibilidad es un grupo de radios con sus descripciones, y «Visible para todos» va marcado', async () => {
    await montar();
    const grupo = screen.getByRole('radiogroup', { name: REGISTRATION_TEXTS.visibilityLabel });
    for (const o of VISIBILITY_OPTIONS) {
      expect(within(grupo).getByRole('radio', { name: new RegExp(o.label) })).toBeInTheDocument();
      expect(within(grupo).getByText(o.description)).toBeInTheDocument();
    }
    expect(within(grupo).getByRole('radio', { name: /Visible para todos los miembros/ })).toBeChecked();
    expect(within(grupo).getByRole('radio', { name: /Visibilidad restringida/ })).not.toBeChecked();
  });

  it('marcar los términos habilita «Crear mi cuenta», y desmarcarlos la deshabilita', async () => {
    const u = await montar();
    expect(crear()).toBeDisabled();
    await u.click(terminos());
    expect(terminos()).toBeChecked();
    expect(crear()).toBeEnabled();
    await u.click(terminos());
    expect(crear()).toBeDisabled();
  });
});

describe('REG-01 · la contraseña', () => {
  it('la fuerza es un medidor de 0 a 4 con la cuenta del HTML aprobado', async () => {
    const u = await montar();
    const medidor = () => screen.getByRole('meter', { name: 'Fuerza de la contraseña' });
    expect(medidor()).toHaveAttribute('aria-valuemin', '0');
    expect(medidor()).toHaveAttribute('aria-valuemax', '4');
    expect(medidor()).toHaveAttribute('aria-valuenow', '0');
    await u.type(clave(), 'Abcdefghij');
    expect(medidor()).toHaveAttribute('aria-valuenow', '2'); // 10+ y mayúscula
    await u.type(clave(), '1!');
    expect(medidor()).toHaveAttribute('aria-valuenow', '4');
  });
});

describe('REG-01 · leyenda de obligatorios en blanco', () => {
  const leyenda = () => screen.queryByRole('status');

  it('desde el principio, sin tocar nada, lista los obligatorios que siguen en blanco', async () => {
    await montar();
    const texto = leyenda()?.textContent ?? '';
    expect(texto).toMatch(/^Faltan campos obligatorios por completar: /);
    for (const etiqueta of ['NIF / CIF', 'Dirección', 'Código postal', 'Email de contacto público', 'Contraseña', 'Repetir contraseña']) {
      expect(texto).toContain(etiqueta);
    }
    // Lo que el FSR ya trae y lo opcional no cuenta.
    expect(texto).not.toContain('Nombre legal de la empresa');
    expect(texto).not.toContain('Sitio web corporativo');
    expect(texto).not.toContain('País de sede');
    expect(texto).not.toContain('Teléfono de contacto público');
  });

  it('está aunque los términos estén marcados: marcarlos habilita el botón pero no calla la leyenda', async () => {
    const u = await montar();
    await u.click(terminos());
    expect(crear()).toBeEnabled();
    expect(leyenda()?.textContent).toContain('NIF / CIF');
  });

  it('se va acortando a medida que se rellena, y desaparece cuando no falta ninguno', async () => {
    const u = await montar();
    await u.type(nif(), 'B-12345678');
    expect(leyenda()?.textContent).not.toContain('NIF / CIF');
    expect(leyenda()?.textContent).toContain('Dirección');
    await u.type(direccion(), 'Calle Industria, 47, Nave 3');
    await u.type(cp(), '41900');
    await u.type(emailContacto(), 'info@sur.es');
    await u.type(clave(), 'Correcta-2026!');
    expect(leyenda()).not.toBeNull();
    await u.type(repetir(), 'Correcta-2026!');
    expect(leyenda()).toBeNull();
  });

  it('quitar el último país de operación la vuelve a poner', async () => {
    const u = await montar();
    await completar(u);
    expect(leyenda()).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Eliminar España (ES)' }));
    expect(leyenda()?.textContent).toContain('Países de operación');
  });
});

describe('REG-01 · errores', () => {
  it('al salir de un campo VACÍO no se enseña error; con algo que no vale, sí', async () => {
    const u = await montar();
    await u.click(nif());
    await u.tab();
    expect(nif()).not.toHaveAttribute('aria-invalid');
    await u.clear(nombreAdmin());
    await u.type(nombreAdmin(), 'Juan');
    await u.tab();
    expect(nombreAdmin()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByText('Mín 6 / máx 50 caracteres')).toHaveLength(1); // la ayuda, ahora en rojo
  });

  it('el email del administrador mal escrito enseña el texto de la spec en lugar de la ayuda', async () => {
    const u = await montar();
    await u.clear(emailAdmin());
    await u.type(emailAdmin(), 'sin-arroba');
    await u.tab();
    expect(emailAdmin()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Introduce un email válido')).toBeInTheDocument();
    expect(screen.queryByText('Formato email · unicidad en tiempo real')).not.toBeInTheDocument();
  });

  it('el email de contacto público puede ser el mismo que el del administrador: no se queja', async () => {
    const u = await montar();
    await u.type(emailContacto(), 'juan@sur.es'); // el del administrador, ya pre-rellenado
    await u.tab();
    expect(emailContacto()).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText('Máx 30 caracteres · distinto del email del administrador')).not.toBeInTheDocument();
  });

  it('la web sin https:// enseña «La URL debe comenzar por https://»', async () => {
    const u = await montar();
    await u.clear(web());
    await u.type(web(), 'http://sur.es');
    await u.tab();
    expect(screen.getByText('La URL debe comenzar por https://')).toBeInTheDocument();
    await u.clear(web());
    await u.tab();
    expect(web()).not.toHaveAttribute('aria-invalid'); // opcional: vacía no es error
  });

  it('las contraseñas que no coinciden enseñan «Las contraseñas no coinciden»', async () => {
    const u = await montar();
    await u.type(clave(), 'Correcta-2026!');
    await u.type(repetir(), 'Otra-2026!xx');
    await u.tab();
    expect(repetir()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();
  });

  it('un error desaparece al corregir el campo y salir de él', async () => {
    const u = await montar();
    await u.clear(nombreAdmin());
    await u.type(nombreAdmin(), 'Juan');
    await u.tab();
    expect(nombreAdmin()).toHaveAttribute('aria-invalid', 'true');
    await u.type(nombreAdmin(), ' Martínez');
    await u.tab();
    expect(nombreAdmin()).not.toHaveAttribute('aria-invalid');
  });
});

describe('REG-01 · email del administrador «en tiempo real»', () => {
  it('al salir de un email con forma de email pregunta si está libre, con el token', async () => {
    const u = await montar();
    await u.clear(emailAdmin());
    await u.type(emailAdmin(), 'nuevo@sur.es');
    await u.tab();
    await waitFor(() => expect(isAdminEmailAvailable).toHaveBeenCalledWith(TOKEN, 'nuevo@sur.es'));
    expect(emailAdmin()).not.toHaveAttribute('aria-invalid');
  });

  it('si ya tiene cuenta, enseña «Este email ya tiene cuenta en Bearingworld.io»', async () => {
    isAdminEmailAvailable.mockResolvedValue(false);
    const u = await montar();
    await u.click(emailAdmin());
    await u.tab();
    expect(await screen.findByText('Este email ya tiene cuenta en Bearingworld.io')).toBeInTheDocument();
    expect(emailAdmin()).toHaveAttribute('aria-invalid', 'true');
  });

  it('no pregunta por un email que no tiene forma de email', async () => {
    const u = await montar();
    await u.clear(emailAdmin());
    await u.type(emailAdmin(), 'sin-arroba');
    await u.tab();
    expect(isAdminEmailAvailable).not.toHaveBeenCalled();
  });

  it('un email ya comprobado como ocupado bloquea el envío hasta que se cambie', async () => {
    isAdminEmailAvailable.mockResolvedValue(false);
    const u = await montar();
    await completar(u);
    await u.click(emailAdmin());
    await u.tab();
    await screen.findByText('Este email ya tiene cuenta en Bearingworld.io');
    await u.click(crear());
    expect(submitRegistration).not.toHaveBeenCalled();
  });
});

describe('REG-01 · email de contacto público: no puede ser el de otra organización', () => {
  it('al salir de un contacto con forma de email pregunta si vale, con el token y el email del administrador', async () => {
    const u = await montar();
    await u.type(emailContacto(), 'info@sur.es');
    await u.tab();
    await waitFor(() => expect(isContactEmailAvailable).toHaveBeenCalledWith(TOKEN, 'info@sur.es', 'juan@sur.es'));
    expect(emailContacto()).not.toHaveAttribute('aria-invalid');
  });

  it('si es de otra organización, enseña «Este email ya pertenece a otra organización»', async () => {
    isContactEmailAvailable.mockResolvedValue(false);
    const u = await montar();
    await u.type(emailContacto(), 'alpha@bearingworld.test');
    await u.tab();
    expect(await screen.findByText('Este email ya pertenece a otra organización')).toBeInTheDocument();
    expect(emailContacto()).toHaveAttribute('aria-invalid', 'true');
  });

  it('si es el del propio administrador NO pregunta y vale', async () => {
    isContactEmailAvailable.mockResolvedValue(false);
    const u = await montar();
    await u.type(emailContacto(), 'juan@sur.es'); // el del administrador, pre-rellenado
    await u.tab();
    expect(isContactEmailAvailable).not.toHaveBeenCalled();
    expect(emailContacto()).not.toHaveAttribute('aria-invalid');
  });

  it('no pregunta por un contacto que no tiene forma de email', async () => {
    const u = await montar();
    await u.type(emailContacto(), 'sin-arroba');
    await u.tab();
    expect(isContactEmailAvailable).not.toHaveBeenCalled();
  });

  it('un contacto ya comprobado como de otra organización bloquea el envío hasta que se cambie', async () => {
    isContactEmailAvailable.mockResolvedValue(false);
    const u = await montar();
    await completar(u);
    await u.clear(emailContacto());
    await u.type(emailContacto(), 'alpha@bearingworld.test');
    await u.tab();
    await screen.findByText('Este email ya pertenece a otra organización');
    await u.click(crear());
    expect(submitRegistration).not.toHaveBeenCalled();
  });

  it('si la función lo rechaza al enviar, además de la alerta lo marca en su campo', async () => {
    submitRegistration.mockReset().mockRejectedValue(new Error('Este email de contacto ya pertenece a otra organización.'));
    const u = await montar();
    await completar(u);
    await u.click(crear());
    expect(await screen.findByRole('alert')).toHaveTextContent('Este email de contacto ya pertenece a otra organización.');
    expect(emailContacto()).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('REG-01 · el envío', () => {
  it('con todo válido llama a submitRegistration UNA vez con el token y el formulario, y después a onRegistered', async () => {
    const u = await montar();
    await u.type(marcas(), 'SKF{Enter}');
    await u.selectOptions(paisesOperacion(), 'PT');
    await u.click(screen.getByRole('radio', { name: /Visibilidad restringida/ }));
    await completar(u);
    await u.click(crear());

    await waitFor(() => expect(submitRegistration).toHaveBeenCalledTimes(1));
    const [token, form] = submitRegistration.mock.calls[0] ?? [];
    expect(token).toBe(TOKEN);
    expect(form).toMatchObject({
      legalName: 'Rodamientos del Sur SL',
      taxId: 'B-12345678',
      address: 'Calle Industria, 47, Nave 3',
      postalCode: '41900',
      country: 'ES',
      contactEmail: 'info@sur.es',
      phoneDial: 'ES',
      phoneNumber: '954 123 456',
      website: 'https://www.sur.es',
      operatingCountries: ['ES', 'PT'],
      brands: ['SKF'],
      visibility: 'RESTRINGIDA',
      adminName: 'Juan Martínez Herrera',
      adminEmail: 'juan@sur.es',
      password: 'Correcta-2026!',
      passwordRepeat: 'Correcta-2026!',
      acceptedTerms: true,
    });
    await waitFor(() => expect(onRegistered).toHaveBeenCalledTimes(1));
  });

  it('mientras envía el botón está deshabilitado y un segundo clic no vuelve a enviar', async () => {
    let terminar: () => void = () => {};
    submitRegistration.mockReset().mockReturnValue(new Promise<void>((r) => (terminar = r)));
    const u = await montar();
    await completar(u);
    await u.click(crear());
    await waitFor(() => expect(crear()).toBeDisabled());
    await u.click(crear());
    expect(submitRegistration).toHaveBeenCalledTimes(1);
    terminar();
    await waitFor(() => expect(onRegistered).toHaveBeenCalledTimes(1));
  });

  it('con datos que no valen NO envía, marca los campos malos y lleva el foco al primero', async () => {
    const u = await montar();
    await u.click(terminos());
    await u.click(crear());
    expect(submitRegistration).not.toHaveBeenCalled();
    for (const campo of [nif(), direccion(), cp(), emailContacto(), clave(), repetir()]) {
      expect(campo).toHaveAttribute('aria-invalid', 'true');
    }
    expect(legal()).not.toHaveAttribute('aria-invalid');
    expect(web()).not.toHaveAttribute('aria-invalid');
    expect(nif()).toHaveFocus();
    expect(screen.getByText('Dato interno · máx 20 caracteres')).toBeInTheDocument();
  });

  it('con el email de contacto igual al del administrador SÍ envía', async () => {
    const u = await montar();
    await u.type(nif(), 'B-12345678');
    await u.type(direccion(), 'Calle Industria, 47, Nave 3');
    await u.type(cp(), '41900');
    await u.type(emailContacto(), 'juan@sur.es');
    await u.type(clave(), 'Correcta-2026!');
    await u.type(repetir(), 'Correcta-2026!');
    await u.click(terminos());
    await u.click(crear());
    await waitFor(() => expect(submitRegistration).toHaveBeenCalledTimes(1));
    expect(submitRegistration.mock.calls[0]?.[1]).toMatchObject({ contactEmail: 'juan@sur.es', adminEmail: 'juan@sur.es' });
  });

  it('sin países de operación tampoco envía', async () => {
    const u = await montar();
    await completar(u);
    await u.click(screen.getByRole('button', { name: 'Eliminar España (ES)' }));
    await u.click(crear());
    expect(submitRegistration).not.toHaveBeenCalled();
    expect(screen.getByText('Mín 1 · país de sede preseleccionado')).toBeInTheDocument();
  });

  it('si el envío falla enseña el mensaje en un alert, el botón se habilita y un reintento borra el alert', async () => {
    submitRegistration.mockReset().mockRejectedValueOnce(new Error('No se pudo dar de alta la organización.'));
    const u = await montar();
    await completar(u);
    await u.click(crear());
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo dar de alta la organización.');
    expect(onRegistered).not.toHaveBeenCalled();
    expect(crear()).toBeEnabled();

    submitRegistration.mockResolvedValue(undefined);
    await u.click(crear());
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    await waitFor(() => expect(onRegistered).toHaveBeenCalledTimes(1));
  });

  it('si la función dice que el email ya tiene cuenta, además de la alerta lo marca en su campo', async () => {
    submitRegistration.mockReset().mockRejectedValue(new Error('Este email ya tiene cuenta en Bearingworld.io.'));
    const u = await montar();
    await completar(u);
    await u.click(crear());
    expect(await screen.findByRole('alert')).toHaveTextContent('Este email ya tiene cuenta en Bearingworld.io.');
    expect(emailAdmin()).toHaveAttribute('aria-invalid', 'true');
  });

  it('un error que no es un Error enseña el mensaje genérico', async () => {
    submitRegistration.mockReset().mockRejectedValue('boom');
    const u = await montar();
    await completar(u);
    await u.click(crear());
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo crear la cuenta.');
  });
});
