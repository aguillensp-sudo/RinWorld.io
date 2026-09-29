import { supabase } from './supabase';
import { countryName } from './search';
import { COUNTRY_OPTIONS, DIAL_CODES, functionError } from './access-request';
import { isValidPassword } from './onboarding';

/**
 * Capa de datos de REG-01 (FRO · Formulario de Registro de Organización). Ruta 00.2,
 * segunda mitad: quien el Operador aprobó llega con el enlace que este le envió
 * (`#registro?token=…`, `0040`) y da de alta su organización y su cuenta de
 * administrador.
 *
 * **La escribe Claude Code a mano, no el Coder** (`CLAUDE.md` §3,
 * `UMBRAL-FABRICA-V1.md` §1). La pantalla la importa y no reimplementa nada de
 * aquí: ni una regla de validación, ni un texto, ni la lista de países.
 *
 * Las tres llamadas de red van a la Edge Function `register-organization`, la
 * única que atiende a esta gente: sin sesión, y con un solo permiso, el token.
 *
 * **Los literales salen del HTML aprobado, no de la spec** (regla de `F-170`). Donde
 * el HTML no dice nada —los mensajes de error, que solo están en la spec §6— se usan
 * los de la spec; para lo que no tiene texto en ninguno de los dos, `F-226`.
 *
 * ⚠ **Lo que el HTML aprobado dibuja y esta pantalla NO hace** (`F-226`): el panel de
 * VERA (sin sesión, `F-223`), el shell (no hay sesión), el logo (sin almacenamiento de
 * ficheros) y Google SSO (sin proveedor): los dos últimos se pintan desactivados.
 */

// -----------------------------------------------------------------------------
// La ruta: el enlace que envía el Operador
// -----------------------------------------------------------------------------

/** El formato lo genera `registrationLinkUrl` (lib/admin-requests.ts): `#registro?token=<64 hex>`. */
export function registrationTokenFromHash(hash: string): string | null {
  const match = /^#registro\?token=([0-9a-f]{64})$/i.exec(hash.trim());
  return match && match[1] ? match[1].toLowerCase() : null;
}

// -----------------------------------------------------------------------------
// El formulario
// -----------------------------------------------------------------------------

export type Visibility = 'VISIBLE_TODOS' | 'RESTRINGIDA';

export type RegistrationForm = {
  legalName: string;
  taxId: string;
  address: string;
  postalCode: string;
  /** Código ISO alfa-2 del país de sede (`''` = sin elegir). */
  country: string;
  contactEmail: string;
  /** El país cuyo prefijo lleva el teléfono (`DIAL_CODES`). No es el de sede: se puede cambiar. */
  phoneDial: string;
  phoneNumber: string;
  website: string;
  /** Códigos ISO alfa-2, sin repetidos. */
  operatingCountries: string[];
  brands: string[];
  visibility: Visibility;
  adminName: string;
  adminEmail: string;
  password: string;
  passwordRepeat: string;
  acceptedTerms: boolean;
};

export const EMPTY_REGISTRATION_FORM: RegistrationForm = {
  legalName: '',
  taxId: '',
  address: '',
  postalCode: '',
  country: '',
  contactEmail: '',
  phoneDial: '',
  phoneNumber: '',
  website: '',
  operatingCountries: [],
  brands: [],
  visibility: 'VISIBLE_TODOS',
  adminName: '',
  adminEmail: '',
  password: '',
  passwordRepeat: '',
  acceptedTerms: false,
};

/** Los campos que se validan y pueden enseñar un error, en el orden del HTML aprobado. */
export const REGISTRATION_FIELDS = [
  'legalName',
  'taxId',
  'address',
  'postalCode',
  'country',
  'contactEmail',
  'phoneNumber',
  'website',
  'operatingCountries',
  'adminName',
  'adminEmail',
  'password',
  'passwordRepeat',
] as const;
export type RegistrationField = (typeof REGISTRATION_FIELDS)[number];

type FieldMeta = { label: string; placeholder: string; hint: string; maxLength?: number };

/** Etiqueta, placeholder, texto de ayuda y `maxLength` de cada campo, verbatim del HTML aprobado. */
export const FIELD_META: Record<RegistrationField | 'brands' | 'logo', FieldMeta> = {
  legalName: {
    label: 'Nombre legal de la empresa',
    placeholder: 'Nombre legal de la empresa',
    hint: 'Mín 5 / máx 120 caracteres',
    maxLength: 120,
  },
  taxId: {
    label: 'NIF / CIF',
    placeholder: 'Número de identificación fiscal',
    hint: 'Dato interno · máx 20 caracteres',
    maxLength: 20,
  },
  address: {
    label: 'Dirección',
    placeholder: 'Calle, número, planta / nave',
    hint: 'Máx 150 caracteres',
    maxLength: 150,
  },
  postalCode: { label: 'Código postal', placeholder: '41900', hint: 'Máx 10 car.', maxLength: 10 },
  country: {
    label: 'País de sede',
    placeholder: 'Selecciona un país',
    hint: 'Lista ISO 3166-1 · establece prefijo telefónico',
  },
  contactEmail: {
    label: 'Email de contacto público',
    placeholder: 'info@empresa.com',
    hint: 'Máx 30 caracteres',
    maxLength: 30,
  },
  phoneNumber: {
    label: 'Teléfono de contacto público',
    placeholder: '954 123 456',
    hint: 'Solo dígitos, espacios y guiones',
  },
  website: {
    label: 'Sitio web corporativo',
    placeholder: 'https://www.empresa.com',
    hint: 'Debe comenzar por https:// si se introduce',
  },
  operatingCountries: {
    label: 'Países de operación',
    placeholder: 'Selecciona un país para añadirlo',
    hint: 'Mín 1 · país de sede preseleccionado',
  },
  brands: {
    label: 'Marcas principales que distribuye',
    placeholder: 'Escribe una marca...',
    hint: 'Máx 20 tags · máx 60 caracteres por tag',
    maxLength: 60,
  },
  logo: {
    label: 'Logo de la empresa',
    placeholder: 'Arrastra o haz clic para subir',
    hint: 'PNG, JPG o WEBP · máx. 2 MB',
  },
  adminName: {
    label: 'Nombre completo',
    placeholder: 'Nombre y apellidos',
    hint: 'Mín 6 / máx 50 caracteres',
    maxLength: 50,
  },
  adminEmail: {
    label: 'Email del administrador',
    placeholder: 'tu@empresa.com',
    hint: 'Formato email · unicidad en tiempo real',
  },
  password: {
    label: 'Contraseña',
    placeholder: 'Mín. 10 caracteres',
    hint: '1 may · 1 min · 1 número · 1 símbolo',
  },
  passwordRepeat: {
    label: 'Repetir contraseña',
    placeholder: 'Repite la contraseña',
    hint: 'Debe coincidir exactamente',
  },
};

/** Los textos de la página que no son de un campo, verbatim del HTML aprobado (y la spec §3). */
export const REGISTRATION_TEXTS = {
  title: 'Crear tu cuenta en Bearingworld.io',
  subtitleLine1: 'Completa los datos de tu organización y de tu usuario administrador.',
  subtitleLine2: 'Tu rol de Administrador se asignará automáticamente.',
  section1: '— Sección 1 de 2 · Datos de la organización —',
  section2: '— Sección 2 de 2 · Usuario administrador —',
  sensitiveTag: 'Dato interno',
  roleNoticeBefore: 'Tu usuario quedará registrado automáticamente como ',
  roleNoticeStrong: 'Administrador de la organización',
  roleNoticeAfter: '.',
  google: 'Continuar con Google',
  or: '— o —',
  soon: 'Próximamente',
  termsBefore: 'Acepto los ',
  termsLink: 'Términos y Condiciones',
  termsAfter: ' de Bearingworld.io.',
  submit: 'Crear mi cuenta',
  submitting: 'Creando tu cuenta…',
  logoTitle: 'Arrastra o haz clic para subir',
  logoHint: 'PNG, JPG o WEBP · máx. 2 MB',
  visibilityLabel: 'Visibilidad del inventario',
  /** Leyenda bajo los términos mientras haya obligatorios en blanco; sigue la lista de sus etiquetas. */
  missingRequired: 'Faltan campos obligatorios por completar: ',
} as const;

export const VISIBILITY_OPTIONS: ReadonlyArray<{ value: Visibility; label: string; description: string }> = [
  {
    value: 'VISIBLE_TODOS',
    label: 'Visible para todos los miembros',
    description: 'Cualquier distribuidor verificado puede consultar tu stock',
  },
  {
    value: 'RESTRINGIDA',
    label: 'Visibilidad restringida',
    description: 'Solo miembros autorizados previamente por ti',
  },
];

/** Los errores con texto propio, de la spec §6 (el HTML no los pinta). Sin punto final. */
export const EMAIL_ERROR = 'Introduce un email válido';
export const EMAIL_TAKEN_ERROR = 'Este email ya tiene cuenta en Bearingworld.io';
export const WEBSITE_ERROR = 'La URL debe comenzar por https://';
export const PASSWORD_MISMATCH_ERROR = 'Las contraseñas no coinciden';

/** Lo que se enseña cuando el enlace no vale. No está en el diseño aprobado: `F-226`. */
export const INVALID_LINK_TEXTS = {
  title: 'Este enlace no es válido',
  message: 'El enlace no es válido o ha caducado. Pide a Bearingworld.io que te envíe uno nuevo.',
  back: 'Volver al inicio de sesión',
} as const;

// -----------------------------------------------------------------------------
// Países y prefijos
// -----------------------------------------------------------------------------

const COUNTRY_CODES: ReadonlySet<string> = new Set(COUNTRY_OPTIONS.map(([code]) => code));

/**
 * El país de sede, el de operación y el prefijo salen de los 194 países de `REG-00` —el
 * FSR ya trae uno de ellos y el esquema (`app.continent_of`, `0041`) los cubre todos—, en
 * español y con el código entre paréntesis, como pinta el HTML de `REG-01`
 * (`España (ES)`). ⚠ El HTML dibuja solo nueve y uno con `UK`, que no es ISO: `F-226`.
 */
export const REGISTRATION_COUNTRIES: ReadonlyArray<{ code: string; label: string }> = COUNTRY_OPTIONS.map(
  ([code]) => ({ code, label: `${countryName(code)} (${code})` }),
).sort((a, b) => a.label.localeCompare(b.label, 'es'));

/** Una opción por país: `+34 · ES`. El valor es el código, no el prefijo (`+1` es de varios). */
export const DIAL_OPTIONS: ReadonlyArray<{ code: string; label: string }> = COUNTRY_OPTIONS.map(([code]) => ({
  code,
  label: `${DIAL_CODES[code] ?? ''} · ${code}`,
}))
  .filter((o) => o.label.startsWith('+'))
  .sort((a, b) => a.label.localeCompare(b.label, 'es'));

/**
 * Añade el país elegido en el desplegable de «Países de operación» (su código). Un código que
 * no existe, o que ya está, deja la lista como estaba.
 */
export function addOperatingCountry(list: readonly string[], code: string): string[] {
  return !COUNTRY_CODES.has(code) || list.includes(code) ? [...list] : [...list, code];
}

/** Los países que todavía se pueden añadir: los 194 menos los ya elegidos, en el orden del desplegable. */
export function availableCountries(list: readonly string[]): { code: string; label: string }[] {
  return REGISTRATION_COUNTRIES.filter((c) => !list.includes(c.code));
}

export const BRANDS_MAX = 20;
export const BRAND_MAX_LENGTH = 60;

/** Añade una marca: recortada, sin vacías, sin repetidas (sin mirar mayúsculas), hasta 20 y de hasta 60. */
export function addBrand(list: readonly string[], text: string): string[] {
  const brand = text.trim();
  if (
    brand === '' ||
    brand.length > BRAND_MAX_LENGTH ||
    list.length >= BRANDS_MAX ||
    list.some((b) => b.toLowerCase() === brand.toLowerCase())
  ) {
    return [...list];
  }
  return [...list, brand];
}

export function removeAt<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

/**
 * Elegir el país de sede: fija el país, pone su prefijo en el teléfono y lo deja
 * preseleccionado en «Países de operación» (*«país de sede preseleccionado»*). No quita
 * el que hubiera antes: el usuario puede haberlo dejado a propósito.
 */
export function withHeadquarters(form: RegistrationForm, country: string): RegistrationForm {
  const code = COUNTRY_CODES.has(country) ? country : '';
  return {
    ...form,
    country: code,
    phoneDial: code !== '' && DIAL_CODES[code] ? code : form.phoneDial,
    operatingCountries:
      code !== '' && !form.operatingCountries.includes(code)
        ? [...form.operatingCountries, code]
        : form.operatingCountries,
  };
}

/** El teléfono tal como se guarda: `+34 954 123 456`. Vacío si no hay prefijo ni número. */
export function composePhone(form: Pick<RegistrationForm, 'phoneDial' | 'phoneNumber'>): string {
  const dial = DIAL_CODES[form.phoneDial];
  const number = form.phoneNumber.trim();
  return dial && number !== '' ? `${dial} ${number}` : '';
}

// -----------------------------------------------------------------------------
// Validación
// -----------------------------------------------------------------------------

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_NUMBER = /^[0-9][0-9 -]*$/;
const PHONE_MIN_DIGITS = 6;

function between(value: string, min: number, max: number): boolean {
  const n = value.trim().length;
  return n >= min && n <= max;
}

/**
 * ¿Es válido el campo? Las reglas de la spec §4, las mismas que repite `register_organization`
 * (`0041`). Un campo obligatorio vacío NO es válido; `website`, que es opcional, sí.
 */
export function isFieldValid(field: RegistrationField, form: RegistrationForm): boolean {
  switch (field) {
    case 'legalName':
      return between(form.legalName, 5, 120);
    case 'taxId':
      return between(form.taxId, 1, 20);
    case 'address':
      return between(form.address, 1, 150);
    case 'postalCode':
      return between(form.postalCode, 1, 10);
    case 'country':
      return COUNTRY_CODES.has(form.country);
    case 'contactEmail': {
      // Sin comparar con el email del administrador: si quiere ser también el contacto público,
      // no hay razón para impedírselo (PO, C5 del 29-sep).
      const v = form.contactEmail.trim().toLowerCase();
      return EMAIL.test(v) && v.length <= 30;
    }
    case 'phoneNumber': {
      const v = form.phoneNumber.trim();
      return (
        DIAL_CODES[form.phoneDial] !== undefined &&
        PHONE_NUMBER.test(v) &&
        (v.match(/\d/g) ?? []).length >= PHONE_MIN_DIGITS
      );
    }
    case 'website': {
      const v = form.website.trim();
      return v === '' || (v.startsWith('https://') && v.length <= 200 && !/\s/.test(v));
    }
    case 'operatingCountries':
      return form.operatingCountries.length >= 1;
    case 'adminName':
      return between(form.adminName, 6, 50);
    case 'adminEmail':
      return EMAIL.test(form.adminEmail.trim());
    case 'password':
      return isValidPassword(form.password);
    case 'passwordRepeat':
      return form.passwordRepeat !== '' && form.passwordRepeat === form.password;
  }
}

/**
 * El texto que se enseña cuando el campo no vale: el de la spec §6 donde lo hay (email,
 * web, contraseñas) y, en el resto, **el propio texto de ayuda, que se pone en rojo**
 * (*«borde rojo + hint en rojo»*). `null` si el campo vale.
 */
export function fieldError(field: RegistrationField, form: RegistrationForm): string | null {
  if (isFieldValid(field, form)) return null;
  switch (field) {
    case 'adminEmail':
      return EMAIL_ERROR;
    case 'contactEmail':
      return EMAIL.test(form.contactEmail.trim()) ? FIELD_META.contactEmail.hint : EMAIL_ERROR;
    case 'website':
      return WEBSITE_ERROR;
    case 'passwordRepeat':
      return PASSWORD_MISMATCH_ERROR;
    default:
      return FIELD_META[field].hint;
  }
}

/** ¿Está el campo en blanco? Para el país de sede y los de operación, «sin elegir». */
export function isBlank(field: RegistrationField, form: RegistrationForm): boolean {
  switch (field) {
    case 'operatingCountries':
      return form.operatingCountries.length === 0;
    case 'country':
      return form.country === '';
    case 'phoneNumber':
      return form.phoneNumber.trim() === '';
    default:
      return (form[field] as string).trim() === '';
  }
}

/**
 * El error al SALIR de un campo (`blur`). Un campo vacío no se queja: pasar por él con el
 * tabulador no es un error, y los vacíos ya salen al intentar enviar (`submitErrors`) y en la
 * leyenda de obligatorios en blanco (`missingRequiredText`).
 */
export function blurError(field: RegistrationField, form: RegistrationForm): string | null {
  return isBlank(field, form) ? null : fieldError(field, form);
}

/** Los obligatorios que siguen en blanco, en el orden del formulario. La web es opcional y no cuenta. */
export function blankRequiredFields(form: RegistrationForm): RegistrationField[] {
  return REGISTRATION_FIELDS.filter((f) => f !== 'website' && isBlank(f, form));
}

/**
 * La leyenda que va bajo los términos mientras falte algún obligatorio: `Faltan campos obligatorios
 * por completar: NIF / CIF, Dirección.` `null` si no falta ninguno. Se calcula del formulario, no de
 * los errores enseñados: se ve desde el principio, sin haber tocado nada.
 */
export function missingRequiredText(form: RegistrationForm): string | null {
  const blank = blankRequiredFields(form);
  return blank.length === 0
    ? null
    : `${REGISTRATION_TEXTS.missingRequired}${blank.map((f) => FIELD_META[f].label).join(', ')}.`;
}

/** Todos los campos que no valen, al intentar enviar. Vacío si se puede enviar. */
export function submitErrors(form: RegistrationForm): Partial<Record<RegistrationField, string>> {
  const errors: Partial<Record<RegistrationField, string>> = {};
  for (const field of REGISTRATION_FIELDS) {
    const message = fieldError(field, form);
    if (message !== null) errors[field] = message;
  }
  return errors;
}

/** `Crear mi cuenta` se habilita con los términos aceptados (spec §4, campo 17). Lo demás se valida al enviar. */
export function canSubmitRegistration(form: RegistrationForm): boolean {
  return form.acceptedTerms;
}

/**
 * La fuerza de la contraseña, de 0 a 4 barras, con la cuenta del HTML aprobado (`pwStrength`):
 * una por cada de 10 caracteres, mayúscula, número y símbolo. Ojo: **la minúscula no cuenta**
 * para las barras (sí para que la contraseña valga). Con 4 las barras van «calientes»; con
 * menos, «templadas».
 */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  let score = 0;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score as 0 | 1 | 2 | 3 | 4;
}

// -----------------------------------------------------------------------------
// El enlace: validar y pre-rellenar
// -----------------------------------------------------------------------------

/** Lo que el solicitante escribió en el FSR, tal como lo devuelve la función. */
export type RegistrationPrefill = {
  orgName: string;
  country: string;
  applicantFullName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  website: string | null;
  expiresAt: string;
};

/**
 * El formulario con lo del FSR ya puesto (*«Pre-relleno desde FSR si Ruta 00.2»*): nombre de
 * la organización, país de sede (con su prefijo y preseleccionado en operación), nombre y
 * email del administrador, teléfono y web. El teléfono del FSR trae el prefijo delante
 * (`+34 600 111 222`): se parte en prefijo y número.
 */
export function formFromPrefill(prefill: RegistrationPrefill): RegistrationForm {
  let form = withHeadquarters(EMPTY_REGISTRATION_FORM, prefill.country);
  form = {
    ...form,
    legalName: prefill.orgName,
    adminName: prefill.applicantFullName,
    adminEmail: prefill.applicantEmail,
    website: prefill.website ?? '',
  };

  const phone = (prefill.applicantPhone ?? '').trim();
  if (phone !== '') {
    // El prefijo más largo que encaje: `+1 268` antes que `+1`.
    const dials = Object.entries(DIAL_CODES).sort((a, b) => b[1].length - a[1].length);
    const own = form.phoneDial !== '' ? DIAL_CODES[form.phoneDial] : undefined;
    const hit =
      own !== undefined && phone.startsWith(own)
        ? ([form.phoneDial, own] as const)
        : dials.find(([, dial]) => phone.startsWith(dial));
    form = hit
      ? { ...form, phoneDial: hit[0], phoneNumber: phone.slice(hit[1].length).trim() }
      : { ...form, phoneNumber: phone };
  }
  return form;
}

export const LINK_ERROR = 'El enlace no es válido o ha caducado.';

/** `null` si la respuesta no trae lo que debe. */
function toPrefill(raw: unknown): RegistrationPrefill | null {
  const r = raw as Record<string, unknown> | null;
  if (
    !r ||
    typeof r.org_name !== 'string' ||
    typeof r.country !== 'string' ||
    typeof r.applicant_full_name !== 'string' ||
    typeof r.applicant_email !== 'string' ||
    typeof r.expires_at !== 'string'
  ) {
    return null;
  }
  return {
    orgName: r.org_name,
    country: r.country,
    applicantFullName: r.applicant_full_name,
    applicantEmail: r.applicant_email,
    applicantPhone: typeof r.applicant_phone === 'string' ? r.applicant_phone : null,
    website: typeof r.website === 'string' ? r.website : null,
    expiresAt: r.expires_at,
  };
}

/** Comprueba el enlace y devuelve lo del FSR. Lanza `LINK_ERROR` si no vale, sin decir por qué. */
export async function validateRegistrationLink(token: string): Promise<RegistrationPrefill> {
  const { data, error } = await supabase.functions.invoke('register-organization', {
    body: { action: 'validate', token },
  });
  if (error) throw await functionError(error, LINK_ERROR);
  const prefill = toPrefill((data as { prefill?: unknown } | null)?.prefill);
  if (!prefill) throw new Error(LINK_ERROR);
  return prefill;
}

/**
 * ¿Está libre el email del administrador? La comprobación «en tiempo real» de la spec. Si la
 * red falla devuelve `true`: la comprobación definitiva es la del alta, y un fallo aquí no
 * tiene que impedir escribir.
 */
export async function isAdminEmailAvailable(token: string, email: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('register-organization', {
      body: { action: 'check_email', token, email: email.trim().toLowerCase() },
    });
    if (error) return true;
    return (data as { available?: unknown } | null)?.available !== false;
  } catch {
    return true;
  }
}

// -----------------------------------------------------------------------------
// El alta
// -----------------------------------------------------------------------------

/** El cuerpo de `register`: lo que la función espera, recortado y en el formato de la base. */
export function toRegisterBody(token: string, form: RegistrationForm): Record<string, unknown> {
  return {
    action: 'register',
    token,
    admin_full_name: form.adminName.trim(),
    admin_email: form.adminEmail.trim().toLowerCase(),
    password: form.password,
    legal_name: form.legalName.trim(),
    tax_id: form.taxId.trim(),
    address: form.address.trim(),
    postal_code: form.postalCode.trim(),
    country: form.country,
    contact_email: form.contactEmail.trim().toLowerCase(),
    contact_phone: composePhone(form),
    website: form.website.trim(),
    operating_countries: form.operatingCountries,
    brands: form.brands,
    inventory_visibility: form.visibility,
  };
}

export const REGISTER_ERROR = 'No se pudo crear la cuenta.';
export const SIGN_IN_AFTER_ERROR =
  'Tu cuenta se ha creado, pero no se pudo iniciar sesión. Entra desde el inicio de sesión con tu email y tu contraseña.';

/**
 * Da de alta la organización y su administrador y, si sale bien, **inicia sesión** con esa
 * cuenta: el resto lo hace la sesión de la app (`useSession` reacciona al cambio). La cuenta
 * nace `REGISTERED`, así que cae en el shell vacío de esos usuarios (`F-218`: `REG-05` a
 * `REG-07` no existen). Lanza con el mensaje que la función devolvió (409 de «este email ya
 * tiene cuenta», 400 de un dato no válido, 404 de un enlace que dejó de valer).
 */
export async function submitRegistration(token: string, form: RegistrationForm): Promise<void> {
  const { error } = await supabase.functions.invoke('register-organization', {
    body: toRegisterBody(token, form),
  });
  if (error) throw await functionError(error, REGISTER_ERROR);

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: form.adminEmail.trim().toLowerCase(),
    password: form.password,
  });
  if (signInError) throw new Error(SIGN_IN_AFTER_ERROR);
}
