import { describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
const signIn = vi.fn();
vi.mock('./supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
    auth: { signInWithPassword: (...args: unknown[]) => signIn(...args) },
  },
}));

const {
  DIAL_OPTIONS,
  EMAIL_ERROR,
  EMPTY_REGISTRATION_FORM,
  FIELD_META,
  LINK_ERROR,
  PASSWORD_MISMATCH_ERROR,
  REGISTRATION_COUNTRIES,
  REGISTRATION_FIELDS,
  SIGN_IN_AFTER_ERROR,
  WEBSITE_ERROR,
  addBrand,
  addOperatingCountry,
  blurError,
  canSubmitRegistration,
  composePhone,
  fieldError,
  formFromPrefill,
  isAdminEmailAvailable,
  isFieldValid,
  matchCountry,
  passwordStrength,
  registrationTokenFromHash,
  removeAt,
  submitErrors,
  submitRegistration,
  toRegisterBody,
  validateRegistrationLink,
  withHeadquarters,
} = await import('./register-org');

/**
 * La lógica pura de REG-01 y sus tres llamadas a la función de borde, con el cliente de
 * Supabase mockeado. Esta capa la escribe Claude Code, no el Coder (`CLAUDE.md` §3): estos
 * tests **no son el contrato del arnés**, son los míos.
 */

const TOKEN = 'ab'.repeat(32);

/** Un formulario entero y válido. */
function valid(over: Partial<typeof EMPTY_REGISTRATION_FORM> = {}) {
  return {
    ...EMPTY_REGISTRATION_FORM,
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
    brands: ['SKF', 'FAG'],
    adminName: 'Juan Martínez Herrera',
    adminEmail: 'juan@sur.es',
    password: 'Correcta-2026!',
    passwordRepeat: 'Correcta-2026!',
    acceptedTerms: true,
    ...over,
  };
}

describe('registrationTokenFromHash', () => {
  it('saca el token de #registro?token=<64 hex>', () => {
    expect(registrationTokenFromHash(`#registro?token=${TOKEN}`)).toBe(TOKEN);
  });
  it('lo pasa a minúsculas', () => {
    expect(registrationTokenFromHash(`#registro?token=${TOKEN.toUpperCase()}`)).toBe(TOKEN);
  });
  it('rechaza otra ruta, un token corto o sin forma y añadidos', () => {
    expect(registrationTokenFromHash('')).toBeNull();
    expect(registrationTokenFromHash('#solicitud-de-registro')).toBeNull();
    expect(registrationTokenFromHash('#registro')).toBeNull();
    expect(registrationTokenFromHash('#registro?token=abc')).toBeNull();
    expect(registrationTokenFromHash(`#registro?token=${'g'.repeat(64)}`)).toBeNull();
    expect(registrationTokenFromHash(`#registro?token=${TOKEN}&x=1`)).toBeNull();
  });
});

describe('países y prefijos', () => {
  it('ofrece los 194 países, en español y con el código, ordenados', () => {
    expect(REGISTRATION_COUNTRIES).toHaveLength(194);
    expect(REGISTRATION_COUNTRIES.find((c) => c.code === 'ES')?.label).toBe('España (ES)');
    const labels = REGISTRATION_COUNTRIES.map((c) => c.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'es')));
  });

  it('cada país tiene su prefijo, y la opción lleva el código para distinguir los que comparten (+1)', () => {
    expect(DIAL_OPTIONS).toHaveLength(194);
    expect(DIAL_OPTIONS.find((o) => o.code === 'ES')?.label).toBe('+34 · ES');
    expect(DIAL_OPTIONS.find((o) => o.code === 'US')?.label).toBe('+1 · US');
    expect(DIAL_OPTIONS.find((o) => o.code === 'CA')?.label).toBe('+1 · CA');
  });

  it('matchCountry entiende nombre, código, mayúsculas y acentos', () => {
    expect(matchCountry('España')).toBe('ES');
    expect(matchCountry('  espana ')).toBe('ES');
    expect(matchCountry('ES')).toBe('ES');
    expect(matchCountry('es')).toBe('ES');
    expect(matchCountry('España (ES)')).toBe('ES');
    expect(matchCountry('Alemania')).toBe('DE');
    expect(matchCountry('')).toBeNull();
    expect(matchCountry('Narnia')).toBeNull();
  });

  it('addOperatingCountry añade un país que existe y no repite', () => {
    expect(addOperatingCountry(['ES'], 'Portugal')).toEqual(['ES', 'PT']);
    expect(addOperatingCountry(['ES'], 'españa')).toEqual(['ES']);
    expect(addOperatingCountry(['ES'], 'Narnia')).toEqual(['ES']);
  });

  it('elegir el país de sede pone su prefijo y lo deja preseleccionado en operación', () => {
    const f = withHeadquarters(EMPTY_REGISTRATION_FORM, 'ES');
    expect(f.country).toBe('ES');
    expect(f.phoneDial).toBe('ES');
    expect(f.operatingCountries).toEqual(['ES']);
  });

  it('cambiar de sede no quita la anterior de operación y no la duplica al volver', () => {
    let f = withHeadquarters(EMPTY_REGISTRATION_FORM, 'ES');
    f = withHeadquarters(f, 'PT');
    expect(f.operatingCountries).toEqual(['ES', 'PT']);
    expect(f.phoneDial).toBe('PT');
    f = withHeadquarters(f, 'ES');
    expect(f.operatingCountries).toEqual(['ES', 'PT']);
  });

  it('un código que no existe deja la sede vacía y no toca lo demás', () => {
    const f = withHeadquarters(valid(), 'ZZ');
    expect(f.country).toBe('');
    expect(f.phoneDial).toBe('ES');
    expect(f.operatingCountries).toEqual(['ES', 'PT']);
  });

  it('composePhone junta prefijo y número, y es vacío si falta uno', () => {
    expect(composePhone({ phoneDial: 'ES', phoneNumber: ' 954 123 456 ' })).toBe('+34 954 123 456');
    expect(composePhone({ phoneDial: 'JM', phoneNumber: '555 1234' })).toBe('+1 876 555 1234');
    expect(composePhone({ phoneDial: '', phoneNumber: '954' })).toBe('');
    expect(composePhone({ phoneDial: 'ES', phoneNumber: '  ' })).toBe('');
  });
});

describe('marcas', () => {
  it('recorta, no repite (sin mirar mayúsculas) y no admite vacías', () => {
    expect(addBrand([], '  SKF ')).toEqual(['SKF']);
    expect(addBrand(['SKF'], 'skf')).toEqual(['SKF']);
    expect(addBrand(['SKF'], '   ')).toEqual(['SKF']);
  });
  it('tope de 20 marcas y de 60 caracteres', () => {
    const veinte = Array.from({ length: 20 }, (_, i) => `M${i}`);
    expect(addBrand(veinte, 'otra')).toEqual(veinte);
    expect(addBrand([], 'x'.repeat(61))).toEqual([]);
    expect(addBrand([], 'x'.repeat(60))).toHaveLength(1);
  });
  it('removeAt quita por posición', () => {
    expect(removeAt(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
  });
});

describe('isFieldValid · las reglas de la spec §4', () => {
  it('un formulario entero y válido no tiene errores', () => {
    expect(submitErrors(valid())).toEqual({});
  });

  it('el formulario vacío falla en todos los campos menos en la web, que es opcional', () => {
    const errores = Object.keys(submitErrors(EMPTY_REGISTRATION_FORM));
    expect(errores).toEqual(REGISTRATION_FIELDS.filter((f) => f !== 'website'));
  });

  it.each([
    ['legalName', { legalName: 'Sur' }, false],
    ['legalName', { legalName: 'Sur1 ' }, false], // 4 recortado
    ['legalName', { legalName: 'Sur SL' }, true],
    ['legalName', { legalName: 'a'.repeat(121) }, false],
    ['taxId', { taxId: '' }, false],
    ['taxId', { taxId: 'a'.repeat(21) }, false],
    ['taxId', { taxId: 'a'.repeat(20) }, true],
    ['address', { address: 'a'.repeat(151) }, false],
    ['postalCode', { postalCode: '12345678901' }, false],
    ['country', { country: 'ZZ' }, false],
    ['contactEmail', { contactEmail: 'sin-arroba' }, false],
    ['contactEmail', { contactEmail: 'informacion.general@rodamientos.es' }, false], // > 30
    ['contactEmail', { contactEmail: 'juan@sur.es' }, false], // igual que el del admin
    ['contactEmail', { contactEmail: 'JUAN@SUR.ES' }, false], // sin mirar mayúsculas
    ['phoneNumber', { phoneNumber: '954' }, false],
    ['phoneNumber', { phoneNumber: '954 abc 456' }, false],
    ['phoneNumber', { phoneNumber: '954-123-456' }, true],
    ['phoneNumber', { phoneDial: '' }, false],
    ['website', { website: '' }, true],
    ['website', { website: 'http://sur.es' }, false],
    ['website', { website: 'https://sur.es/a b' }, false],
    ['operatingCountries', { operatingCountries: [] }, false],
    ['adminName', { adminName: 'Juan' }, false],
    ['adminName', { adminName: 'a'.repeat(51) }, false],
    ['adminEmail', { adminEmail: 'no es email' }, false],
    ['password', { password: 'corta1!A', passwordRepeat: 'corta1!A' }, false],
    ['password', { password: 'sinsimbolo123A', passwordRepeat: 'sinsimbolo123A' }, false],
    ['passwordRepeat', { passwordRepeat: 'Otra-2026!xx' }, false],
    ['passwordRepeat', { passwordRepeat: '' }, false],
  ] as const)('%s con %j → %s', (field, over, esperado) => {
    expect(isFieldValid(field, valid(over as Partial<typeof EMPTY_REGISTRATION_FORM>))).toBe(esperado);
  });
});

describe('los errores que se enseñan', () => {
  it('email, web y contraseñas tienen texto propio (spec §6)', () => {
    expect(fieldError('adminEmail', valid({ adminEmail: 'x' }))).toBe(EMAIL_ERROR);
    expect(fieldError('contactEmail', valid({ contactEmail: 'x' }))).toBe(EMAIL_ERROR);
    expect(fieldError('website', valid({ website: 'http://x.es' }))).toBe(WEBSITE_ERROR);
    expect(fieldError('passwordRepeat', valid({ passwordRepeat: 'otra' }))).toBe(PASSWORD_MISMATCH_ERROR);
  });

  it('el resto enseña su propio texto de ayuda (que se pone en rojo)', () => {
    expect(fieldError('legalName', valid({ legalName: '' }))).toBe(FIELD_META.legalName.hint);
    expect(fieldError('taxId', valid({ taxId: '' }))).toBe(FIELD_META.taxId.hint);
    expect(fieldError('operatingCountries', valid({ operatingCountries: [] }))).toBe(
      FIELD_META.operatingCountries.hint,
    );
  });

  it('un email de contacto bien formado pero repetido enseña la ayuda, no «email válido»', () => {
    expect(fieldError('contactEmail', valid({ contactEmail: 'juan@sur.es' }))).toBe(FIELD_META.contactEmail.hint);
  });

  it('un campo válido no tiene error', () => {
    for (const f of REGISTRATION_FIELDS) expect(fieldError(f, valid())).toBeNull();
  });

  it('al salir de un campo VACÍO no se queja; con algo escrito que no vale, sí', () => {
    expect(blurError('legalName', EMPTY_REGISTRATION_FORM)).toBeNull();
    expect(blurError('country', EMPTY_REGISTRATION_FORM)).toBeNull();
    expect(blurError('operatingCountries', EMPTY_REGISTRATION_FORM)).toBeNull();
    expect(blurError('phoneNumber', EMPTY_REGISTRATION_FORM)).toBeNull();
    expect(blurError('legalName', valid({ legalName: 'Sur' }))).toBe(FIELD_META.legalName.hint);
    expect(blurError('adminEmail', valid({ adminEmail: 'x' }))).toBe(EMAIL_ERROR);
    expect(blurError('legalName', valid())).toBeNull();
  });

  it('el botón solo depende de los términos: lo demás se valida al enviar', () => {
    expect(canSubmitRegistration(EMPTY_REGISTRATION_FORM)).toBe(false);
    expect(canSubmitRegistration({ ...EMPTY_REGISTRATION_FORM, acceptedTerms: true })).toBe(true);
  });
});

describe('passwordStrength · la cuenta del HTML aprobado', () => {
  it.each([
    ['', 0],
    ['abcdefghijkl', 1], // 10+ caracteres
    ['Abcdefghij', 2], // 10+ y mayúscula
    ['Abcdefghi1', 3],
    ['Abcdefgh1!', 4],
    ['abcdefgh1!', 3], // la minúscula no cuenta y la mayúscula falta
    ['Ab1!', 3], // corta: sin la barra de longitud
  ] as const)('%j → %i barras', (pw, barras) => {
    expect(passwordStrength(pw)).toBe(barras);
  });
});

describe('formFromPrefill', () => {
  const prefill = {
    orgName: 'Distribuciones Álvarez SL',
    country: 'ES',
    applicantFullName: 'Juan Álvarez García',
    applicantEmail: 'jalvarez@distribalvarez.com',
    applicantPhone: '+34 600 111 222',
    website: 'https://distribalvarez.com',
    expiresAt: '2026-10-06T08:00:00Z',
  };

  it('pone lo del FSR: nombre, país, administrador y web', () => {
    const f = formFromPrefill(prefill);
    expect(f.legalName).toBe('Distribuciones Álvarez SL');
    expect(f.country).toBe('ES');
    expect(f.operatingCountries).toEqual(['ES']);
    expect(f.adminName).toBe('Juan Álvarez García');
    expect(f.adminEmail).toBe('jalvarez@distribalvarez.com');
    expect(f.website).toBe('https://distribalvarez.com');
    expect(f.acceptedTerms).toBe(false);
  });

  it('parte el teléfono en prefijo y número', () => {
    const f = formFromPrefill(prefill);
    expect(f.phoneDial).toBe('ES');
    expect(f.phoneNumber).toBe('600 111 222');
  });

  it('un prefijo de otro país lo respeta: el más largo que encaja', () => {
    const f = formFromPrefill({ ...prefill, applicantPhone: '+351 912 345 678' });
    expect(f.phoneDial).toBe('PT');
    expect(f.phoneNumber).toBe('912 345 678');
    const j = formFromPrefill({ ...prefill, country: 'JM', applicantPhone: '+1 876 555 1234' });
    expect(j.phoneDial).toBe('JM');
    expect(j.phoneNumber).toBe('555 1234');
  });

  it('un teléfono sin prefijo conocido se deja tal cual, y sin teléfono ni web queda vacío', () => {
    expect(formFromPrefill({ ...prefill, applicantPhone: '600 111 222' }).phoneNumber).toBe('600 111 222');
    const f = formFromPrefill({ ...prefill, applicantPhone: null, website: null });
    expect(f.phoneNumber).toBe('');
    expect(f.website).toBe('');
  });
});

describe('toRegisterBody', () => {
  it('manda lo recortado y en el formato de la base', () => {
    const body = toRegisterBody(
      TOKEN,
      valid({ legalName: '  Rodamientos del Sur SL ', adminEmail: ' Juan@Sur.ES ', contactEmail: ' INFO@sur.es ' }),
    );
    expect(body).toEqual({
      action: 'register',
      token: TOKEN,
      admin_full_name: 'Juan Martínez Herrera',
      admin_email: 'juan@sur.es',
      password: 'Correcta-2026!',
      legal_name: 'Rodamientos del Sur SL',
      tax_id: 'B-12345678',
      address: 'Calle Industria, 47, Nave 3',
      postal_code: '41900',
      country: 'ES',
      contact_email: 'info@sur.es',
      contact_phone: '+34 954 123 456',
      website: 'https://www.sur.es',
      operating_countries: ['ES', 'PT'],
      brands: ['SKF', 'FAG'],
      inventory_visibility: 'VISIBLE_TODOS',
    });
  });
});

function respuestaDeError(status: number, error: string) {
  return { context: new Response(JSON.stringify({ error }), { status }) };
}

describe('validateRegistrationLink', () => {
  it('devuelve lo del FSR', async () => {
    invoke.mockReset().mockResolvedValue({
      data: {
        prefill: {
          org_name: 'Sur SL',
          country: 'ES',
          applicant_full_name: 'Ana Sur',
          applicant_email: 'ana@sur.es',
          applicant_phone: '+34 600 000 000',
          website: 'https://sur.es',
          expires_at: '2026-10-06T08:00:00Z',
        },
      },
      error: null,
    });
    const p = await validateRegistrationLink(TOKEN);
    expect(invoke).toHaveBeenCalledWith('register-organization', { body: { action: 'validate', token: TOKEN } });
    expect(p).toMatchObject({ orgName: 'Sur SL', applicantEmail: 'ana@sur.es', applicantPhone: '+34 600 000 000' });
  });

  it('un 404 de la función es «enlace no válido», con el mensaje de la función', async () => {
    invoke.mockReset().mockResolvedValue({ data: null, error: respuestaDeError(404, LINK_ERROR) });
    await expect(validateRegistrationLink(TOKEN)).rejects.toThrow(LINK_ERROR);
  });

  it('una respuesta sin lo esperado también es «enlace no válido»', async () => {
    invoke.mockReset().mockResolvedValue({ data: { prefill: { org_name: 3 } }, error: null });
    await expect(validateRegistrationLink(TOKEN)).rejects.toThrow(LINK_ERROR);
  });
});

describe('isAdminEmailAvailable', () => {
  it('true si está libre, false si no', async () => {
    invoke.mockReset().mockResolvedValue({ data: { available: true }, error: null });
    expect(await isAdminEmailAvailable(TOKEN, ' Ana@Sur.es ')).toBe(true);
    expect(invoke).toHaveBeenCalledWith('register-organization', {
      body: { action: 'check_email', token: TOKEN, email: 'ana@sur.es' },
    });
    invoke.mockReset().mockResolvedValue({ data: { available: false }, error: null });
    expect(await isAdminEmailAvailable(TOKEN, 'ana@sur.es')).toBe(false);
  });

  it('si la red falla no bloquea: la comprobación definitiva es la del alta', async () => {
    invoke.mockReset().mockResolvedValue({ data: null, error: respuestaDeError(500, 'x') });
    expect(await isAdminEmailAvailable(TOKEN, 'ana@sur.es')).toBe(true);
    invoke.mockReset().mockRejectedValue(new Error('sin red'));
    expect(await isAdminEmailAvailable(TOKEN, 'ana@sur.es')).toBe(true);
  });
});

describe('submitRegistration', () => {
  it('da de alta y después inicia sesión con esa cuenta', async () => {
    invoke.mockReset().mockResolvedValue({ data: { registered: true }, error: null });
    signIn.mockReset().mockResolvedValue({ error: null });
    await submitRegistration(TOKEN, valid());
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0]?.[1]).toEqual({ body: toRegisterBody(TOKEN, valid()) });
    expect(signIn).toHaveBeenCalledWith({ email: 'juan@sur.es', password: 'Correcta-2026!' });
  });

  it('si el alta falla lanza el mensaje de la función y NO inicia sesión', async () => {
    invoke.mockReset().mockResolvedValue({ data: null, error: respuestaDeError(409, 'Este email ya tiene cuenta en Bearingworld.io.') });
    signIn.mockReset();
    await expect(submitRegistration(TOKEN, valid())).rejects.toThrow('Este email ya tiene cuenta en Bearingworld.io.');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('si el alta sale bien y el inicio de sesión falla, lo dice sin fingir que salió mal', async () => {
    invoke.mockReset().mockResolvedValue({ data: { registered: true }, error: null });
    signIn.mockReset().mockResolvedValue({ error: { message: 'x' } });
    await expect(submitRegistration(TOKEN, valid())).rejects.toThrow(SIGN_IN_AFTER_ERROR);
  });
});
