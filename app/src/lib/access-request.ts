import { supabase } from './supabase';
import { countryName } from './search';

/**
 * Capa de datos de REG-00 (FSR · Formulario de Solicitud de Registro) y de
 * REG-00-WAIT (espera de aprobación del Operador). Ruta 00.2: alguien sin cuenta
 * ni invitación pide acceso, y su solicitud cae en la cola de ADMIN-01.
 *
 * **La escribe Claude Code a mano, no el Coder** (`CLAUDE.md` §3,
 * `UMBRAL-FABRICA-V1.md` §1). Las dos pantallas la importan y no reimplementan
 * nada de aquí: ni la validación, ni los textos de error, ni la lista de países,
 * ni qué se pinta en cada estado de la espera.
 *
 * Las dos llamadas de red van a la Edge Function `access-request`, que es la
 * única que atiende a quien no tiene sesión: a `anon` no se le concede nada en la
 * base (`registration_requests` solo admite `INSERT` de `service_role`, `0028`).
 *
 * **Los literales salen del HTML aprobado, no de la spec** (regla de `F-170`): los
 * mensajes de error de cada campo, las 194 opciones de país en inglés con su
 * código (`Afghanistan (AF)`) y los textos de aprobada y rechazada de la espera.
 */

// -----------------------------------------------------------------------------
// El formulario
// -----------------------------------------------------------------------------

export const ACCESS_REQUEST_FIELDS = ['email', 'fullName', 'orgName', 'country', 'phone', 'website'] as const;
export type AccessRequestField = (typeof ACCESS_REQUEST_FIELDS)[number];
export type AccessRequestForm = Record<AccessRequestField, string>;

export const EMPTY_ACCESS_REQUEST: AccessRequestForm = {
  email: '',
  fullName: '',
  orgName: '',
  country: '',
  phone: '',
  website: '',
};

/** Etiqueta, placeholder y `maxLength` de cada campo, en el orden del HTML aprobado. */
export const FIELD_META: Record<AccessRequestField, { label: string; placeholder: string; maxLength: number }> = {
  email: { label: 'Email del solicitante', placeholder: 'tu@empresa.com', maxLength: 254 },
  fullName: { label: 'Nombre y apellidos', placeholder: 'Nombre y apellidos', maxLength: 120 },
  orgName: { label: 'Nombre de la organización', placeholder: 'Nombre legal de la empresa', maxLength: 120 },
  country: { label: 'País de la organización', placeholder: 'Selecciona un país', maxLength: 2 },
  phone: { label: 'Teléfono de contacto', placeholder: '+34 963 456 789', maxLength: 30 },
  website: { label: 'Sitio web', placeholder: 'https://www.empresa.com', maxLength: 200 },
};

/** El texto de error de cada campo, verbatim del HTML aprobado (sin punto final). */
export const FIELD_ERRORS: Record<AccessRequestField, string> = {
  email: 'Introduce un email válido',
  fullName: 'Introduce tu nombre y apellidos (mín. 2 caracteres)',
  orgName: 'Introduce el nombre de la organización (mín. 2 / máx. 120 caracteres)',
  country: 'Selecciona el país de la organización',
  phone: 'Introduce un teléfono de contacto',
  website: 'La URL debe comenzar por https://',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** ¿Es válido el valor? Recorta antes de mirar, como el HTML aprobado. */
export function isFieldValid(field: AccessRequestField, value: string): boolean {
  const v = value.trim();
  switch (field) {
    case 'email':
      return EMAIL.test(v) && v.length <= 254;
    case 'fullName':
      return v.length >= 2 && v.length <= 120;
    case 'orgName':
      return v.length >= 2 && v.length <= 120;
    case 'country':
      return COUNTRY_CODES.has(v);
    case 'phone':
      // Al menos 6 dígitos: desde el 29-sep el campo llega relleno con el prefijo
      // del país (`+34 `), y un prefijo solo no es un teléfono de contacto.
      return v.length <= 30 && (v.match(/\d/g) ?? []).length >= PHONE_MIN_DIGITS;
    case 'website':
      return v.startsWith('https://') && v.length <= 200;
  }
}

/**
 * El error que se ENSEÑA al salir de un campo (`blur`), o `null`.
 *
 * Copia la regla del HTML aprobado, que no es la misma para todos: email, nombre
 * y organización **no se quejan si están vacíos** (solo si lo escrito no vale);
 * país, teléfono y sitio web **sí**, porque vacíos ya son el error. No hay otro
 * momento en que se enseñe un error: el botón de envío está deshabilitado hasta
 * que todo vale, así que no se puede "intentar enviar" con huecos.
 */
export function blurError(field: AccessRequestField, value: string): string | null {
  const empty = value.trim() === '';
  if (empty && (field === 'email' || field === 'fullName' || field === 'orgName')) return null;
  return isFieldValid(field, value) ? null : FIELD_ERRORS[field];
}

/** `Enviar solicitud` solo se habilita con los seis campos válidos. */
export function canSubmitAccessRequest(form: AccessRequestForm): boolean {
  return ACCESS_REQUEST_FIELDS.every((f) => isFieldValid(f, form[f]));
}

// -----------------------------------------------------------------------------
// Los países: los 194 del HTML aprobado, tal cual
// -----------------------------------------------------------------------------

/**
 * `[código ISO alfa-2, texto de la opción]`, en el orden del HTML aprobado. Los
 * textos van en inglés con el código entre paréntesis porque así los pinta el
 * HTML (y la spec: `United States of America (US)`); la espera, en cambio, enseña
 * el país en español (`España`), y para eso está `countryName`.
 */
export const COUNTRY_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ["AF", "Afghanistan (AF)"],
  ["AL", "Albania (AL)"],
  ["DZ", "Algeria (DZ)"],
  ["AD", "Andorra (AD)"],
  ["AO", "Angola (AO)"],
  ["AG", "Antigua and Barbuda (AG)"],
  ["AR", "Argentina (AR)"],
  ["AM", "Armenia (AM)"],
  ["AU", "Australia (AU)"],
  ["AT", "Austria (AT)"],
  ["AZ", "Azerbaijan (AZ)"],
  ["BS", "Bahamas (BS)"],
  ["BH", "Bahrain (BH)"],
  ["BD", "Bangladesh (BD)"],
  ["BB", "Barbados (BB)"],
  ["BY", "Belarus (BY)"],
  ["BE", "Belgium (BE)"],
  ["BZ", "Belize (BZ)"],
  ["BJ", "Benin (BJ)"],
  ["BT", "Bhutan (BT)"],
  ["BO", "Bolivia (BO)"],
  ["BA", "Bosnia and Herzegovina (BA)"],
  ["BW", "Botswana (BW)"],
  ["BR", "Brazil (BR)"],
  ["BN", "Brunei Darussalam (BN)"],
  ["BG", "Bulgaria (BG)"],
  ["BF", "Burkina Faso (BF)"],
  ["BI", "Burundi (BI)"],
  ["CV", "Cabo Verde (CV)"],
  ["KH", "Cambodia (KH)"],
  ["CM", "Cameroon (CM)"],
  ["CA", "Canada (CA)"],
  ["CF", "Central African Republic (CF)"],
  ["TD", "Chad (TD)"],
  ["CL", "Chile (CL)"],
  ["CN", "China (CN)"],
  ["CO", "Colombia (CO)"],
  ["KM", "Comoros (KM)"],
  ["CG", "Congo (CG)"],
  ["CD", "Congo, Democratic Republic (CD)"],
  ["CR", "Costa Rica (CR)"],
  ["CI", "Côte d'Ivoire (CI)"],
  ["HR", "Croatia (HR)"],
  ["CU", "Cuba (CU)"],
  ["CY", "Cyprus (CY)"],
  ["CZ", "Czechia (CZ)"],
  ["DK", "Denmark (DK)"],
  ["DJ", "Djibouti (DJ)"],
  ["DM", "Dominica (DM)"],
  ["DO", "Dominican Republic (DO)"],
  ["EC", "Ecuador (EC)"],
  ["EG", "Egypt (EG)"],
  ["SV", "El Salvador (SV)"],
  ["GQ", "Equatorial Guinea (GQ)"],
  ["ER", "Eritrea (ER)"],
  ["EE", "Estonia (EE)"],
  ["SZ", "Eswatini (SZ)"],
  ["ET", "Ethiopia (ET)"],
  ["FJ", "Fiji (FJ)"],
  ["FI", "Finland (FI)"],
  ["FR", "France (FR)"],
  ["GA", "Gabon (GA)"],
  ["GM", "Gambia (GM)"],
  ["GE", "Georgia (GE)"],
  ["DE", "Germany (DE)"],
  ["GH", "Ghana (GH)"],
  ["GR", "Greece (GR)"],
  ["GD", "Grenada (GD)"],
  ["GT", "Guatemala (GT)"],
  ["GN", "Guinea (GN)"],
  ["GW", "Guinea-Bissau (GW)"],
  ["GY", "Guyana (GY)"],
  ["HT", "Haiti (HT)"],
  ["HN", "Honduras (HN)"],
  ["HU", "Hungary (HU)"],
  ["IS", "Iceland (IS)"],
  ["IN", "India (IN)"],
  ["ID", "Indonesia (ID)"],
  ["IR", "Iran (IR)"],
  ["IQ", "Iraq (IQ)"],
  ["IE", "Ireland (IE)"],
  ["IL", "Israel (IL)"],
  ["IT", "Italy (IT)"],
  ["JM", "Jamaica (JM)"],
  ["JP", "Japan (JP)"],
  ["JO", "Jordan (JO)"],
  ["KZ", "Kazakhstan (KZ)"],
  ["KE", "Kenya (KE)"],
  ["KI", "Kiribati (KI)"],
  ["KP", "Korea, Democratic People's Republic (KP)"],
  ["KR", "Korea, Republic of (KR)"],
  ["KW", "Kuwait (KW)"],
  ["KG", "Kyrgyzstan (KG)"],
  ["LA", "Lao PDR (LA)"],
  ["LV", "Latvia (LV)"],
  ["LB", "Lebanon (LB)"],
  ["LS", "Lesotho (LS)"],
  ["LR", "Liberia (LR)"],
  ["LY", "Libya (LY)"],
  ["LI", "Liechtenstein (LI)"],
  ["LT", "Lithuania (LT)"],
  ["LU", "Luxembourg (LU)"],
  ["MG", "Madagascar (MG)"],
  ["MW", "Malawi (MW)"],
  ["MY", "Malaysia (MY)"],
  ["MV", "Maldives (MV)"],
  ["ML", "Mali (ML)"],
  ["MT", "Malta (MT)"],
  ["MH", "Marshall Islands (MH)"],
  ["MR", "Mauritania (MR)"],
  ["MU", "Mauritius (MU)"],
  ["MX", "Mexico (MX)"],
  ["FM", "Micronesia (FM)"],
  ["MD", "Moldova (MD)"],
  ["MC", "Monaco (MC)"],
  ["MN", "Mongolia (MN)"],
  ["ME", "Montenegro (ME)"],
  ["MA", "Morocco (MA)"],
  ["MZ", "Mozambique (MZ)"],
  ["MM", "Myanmar (MM)"],
  ["NA", "Namibia (NA)"],
  ["NR", "Nauru (NR)"],
  ["NP", "Nepal (NP)"],
  ["NL", "Netherlands (NL)"],
  ["NZ", "New Zealand (NZ)"],
  ["NI", "Nicaragua (NI)"],
  ["NE", "Niger (NE)"],
  ["NG", "Nigeria (NG)"],
  ["MK", "North Macedonia (MK)"],
  ["NO", "Norway (NO)"],
  ["OM", "Oman (OM)"],
  ["PK", "Pakistan (PK)"],
  ["PW", "Palau (PW)"],
  ["PA", "Panama (PA)"],
  ["PG", "Papua New Guinea (PG)"],
  ["PY", "Paraguay (PY)"],
  ["PE", "Peru (PE)"],
  ["PH", "Philippines (PH)"],
  ["PL", "Poland (PL)"],
  ["PT", "Portugal (PT)"],
  ["QA", "Qatar (QA)"],
  ["RO", "Romania (RO)"],
  ["RU", "Russian Federation (RU)"],
  ["RW", "Rwanda (RW)"],
  ["KN", "Saint Kitts and Nevis (KN)"],
  ["LC", "Saint Lucia (LC)"],
  ["VC", "Saint Vincent and the Grenadines (VC)"],
  ["WS", "Samoa (WS)"],
  ["SM", "San Marino (SM)"],
  ["ST", "Sao Tome and Principe (ST)"],
  ["SA", "Saudi Arabia (SA)"],
  ["SN", "Senegal (SN)"],
  ["RS", "Serbia (RS)"],
  ["SC", "Seychelles (SC)"],
  ["SL", "Sierra Leone (SL)"],
  ["SG", "Singapore (SG)"],
  ["SK", "Slovakia (SK)"],
  ["SI", "Slovenia (SI)"],
  ["SB", "Solomon Islands (SB)"],
  ["SO", "Somalia (SO)"],
  ["ZA", "South Africa (ZA)"],
  ["SS", "South Sudan (SS)"],
  ["ES", "Spain (ES)"],
  ["LK", "Sri Lanka (LK)"],
  ["SD", "Sudan (SD)"],
  ["SR", "Suriname (SR)"],
  ["SE", "Sweden (SE)"],
  ["CH", "Switzerland (CH)"],
  ["SY", "Syrian Arab Republic (SY)"],
  ["TW", "Taiwan (TW)"],
  ["TJ", "Tajikistan (TJ)"],
  ["TZ", "Tanzania (TZ)"],
  ["TH", "Thailand (TH)"],
  ["TL", "Timor-Leste (TL)"],
  ["TG", "Togo (TG)"],
  ["TO", "Tonga (TO)"],
  ["TT", "Trinidad and Tobago (TT)"],
  ["TN", "Tunisia (TN)"],
  ["TR", "Türkiye (TR)"],
  ["TM", "Turkmenistan (TM)"],
  ["TV", "Tuvalu (TV)"],
  ["UG", "Uganda (UG)"],
  ["UA", "Ukraine (UA)"],
  ["AE", "United Arab Emirates (AE)"],
  ["GB", "United Kingdom (GB)"],
  ["US", "United States of America (US)"],
  ["UY", "Uruguay (UY)"],
  ["UZ", "Uzbekistan (UZ)"],
  ["VU", "Vanuatu (VU)"],
  ["VE", "Venezuela (VE)"],
  ["VN", "Viet Nam (VN)"],
  ["YE", "Yemen (YE)"],
  ["ZM", "Zambia (ZM)"],
  ["ZW", "Zimbabwe (ZW)"],
];

const COUNTRY_CODES = new Set(COUNTRY_OPTIONS.map(([code]) => code));

// -----------------------------------------------------------------------------
// El prefijo telefónico del país (petición del PO en la C5, 29-sep-2026)
// -----------------------------------------------------------------------------

/**
 * Cuántos dígitos hacen falta para que el teléfono cuente. Con el prefijo
 * rellenado solo, `+34 ` tiene dos: no pasa.
 */
export const PHONE_MIN_DIGITS = 6;

/**
 * El prefijo internacional (E.164) de cada uno de los 194 países del HTML
 * aprobado. Los del plan de numeración norteamericano que no son EE. UU. ni
 * Canadá llevan su código de área (`+1 876`, Jamaica): con `+1` a secas el
 * número quedaría a medias.
 */
export const DIAL_CODES: Record<string, string> = {
  AF: '+93',
  AL: '+355',
  DZ: '+213',
  AD: '+376',
  AO: '+244',
  AG: '+1 268',
  AR: '+54',
  AM: '+374',
  AU: '+61',
  AT: '+43',
  AZ: '+994',
  BS: '+1 242',
  BH: '+973',
  BD: '+880',
  BB: '+1 246',
  BY: '+375',
  BE: '+32',
  BZ: '+501',
  BJ: '+229',
  BT: '+975',
  BO: '+591',
  BA: '+387',
  BW: '+267',
  BR: '+55',
  BN: '+673',
  BG: '+359',
  BF: '+226',
  BI: '+257',
  CV: '+238',
  KH: '+855',
  CM: '+237',
  CA: '+1',
  CF: '+236',
  TD: '+235',
  CL: '+56',
  CN: '+86',
  CO: '+57',
  KM: '+269',
  CG: '+242',
  CD: '+243',
  CR: '+506',
  CI: '+225',
  HR: '+385',
  CU: '+53',
  CY: '+357',
  CZ: '+420',
  DK: '+45',
  DJ: '+253',
  DM: '+1 767',
  DO: '+1 809',
  EC: '+593',
  EG: '+20',
  SV: '+503',
  GQ: '+240',
  ER: '+291',
  EE: '+372',
  SZ: '+268',
  ET: '+251',
  FJ: '+679',
  FI: '+358',
  FR: '+33',
  GA: '+241',
  GM: '+220',
  GE: '+995',
  DE: '+49',
  GH: '+233',
  GR: '+30',
  GD: '+1 473',
  GT: '+502',
  GN: '+224',
  GW: '+245',
  GY: '+592',
  HT: '+509',
  HN: '+504',
  HU: '+36',
  IS: '+354',
  IN: '+91',
  ID: '+62',
  IR: '+98',
  IQ: '+964',
  IE: '+353',
  IL: '+972',
  IT: '+39',
  JM: '+1 876',
  JP: '+81',
  JO: '+962',
  KZ: '+7',
  KE: '+254',
  KI: '+686',
  KP: '+850',
  KR: '+82',
  KW: '+965',
  KG: '+996',
  LA: '+856',
  LV: '+371',
  LB: '+961',
  LS: '+266',
  LR: '+231',
  LY: '+218',
  LI: '+423',
  LT: '+370',
  LU: '+352',
  MG: '+261',
  MW: '+265',
  MY: '+60',
  MV: '+960',
  ML: '+223',
  MT: '+356',
  MH: '+692',
  MR: '+222',
  MU: '+230',
  MX: '+52',
  FM: '+691',
  MD: '+373',
  MC: '+377',
  MN: '+976',
  ME: '+382',
  MA: '+212',
  MZ: '+258',
  MM: '+95',
  NA: '+264',
  NR: '+674',
  NP: '+977',
  NL: '+31',
  NZ: '+64',
  NI: '+505',
  NE: '+227',
  NG: '+234',
  MK: '+389',
  NO: '+47',
  OM: '+968',
  PK: '+92',
  PW: '+680',
  PA: '+507',
  PG: '+675',
  PY: '+595',
  PE: '+51',
  PH: '+63',
  PL: '+48',
  PT: '+351',
  QA: '+974',
  RO: '+40',
  RU: '+7',
  RW: '+250',
  KN: '+1 869',
  LC: '+1 758',
  VC: '+1 784',
  WS: '+685',
  SM: '+378',
  ST: '+239',
  SA: '+966',
  SN: '+221',
  RS: '+381',
  SC: '+248',
  SL: '+232',
  SG: '+65',
  SK: '+421',
  SI: '+386',
  SB: '+677',
  SO: '+252',
  ZA: '+27',
  SS: '+211',
  ES: '+34',
  LK: '+94',
  SD: '+249',
  SR: '+597',
  SE: '+46',
  CH: '+41',
  SY: '+963',
  TW: '+886',
  TJ: '+992',
  TZ: '+255',
  TH: '+66',
  TL: '+670',
  TG: '+228',
  TO: '+676',
  TT: '+1 868',
  TN: '+216',
  TR: '+90',
  TM: '+993',
  TV: '+688',
  UG: '+256',
  UA: '+380',
  AE: '+971',
  GB: '+44',
  US: '+1',
  UY: '+598',
  UZ: '+998',
  VU: '+678',
  VE: '+58',
  VN: '+84',
  YE: '+967',
  ZM: '+260',
  ZW: '+263',
};

/**
 * El teléfono tras cambiar el país de `previous` a `next`. Lo pidió el PO en la
 * C5 de REG-00: al elegir país, el campo muestra `+<prefijo> ` y se puede editar.
 *
 * - Vacío → el prefijo del país nuevo, con un espacio detrás para seguir escribiendo.
 * - Empieza por el prefijo del país anterior → se cambia solo el prefijo y se
 *   conserva lo escrito detrás.
 * - Cualquier otra cosa → no se toca: el usuario ha escrito su propio número.
 */
export function phoneForCountry(phone: string, previous: string, next: string): string {
  const nuevo = DIAL_CODES[next];
  if (!nuevo) return phone;
  if (phone.trim() === '') return `${nuevo} `;
  const viejo = DIAL_CODES[previous];
  if (viejo && phone.startsWith(viejo)) return nuevo + phone.slice(viejo.length);
  return phone;
}

// -----------------------------------------------------------------------------
// El envío
// -----------------------------------------------------------------------------

/** Lo que REG-00 le pasa a REG-00-WAIT: el token y lo que se envió. */
export type SubmittedAccessRequest = {
  /** El token de seguimiento: el `id` de la fila, que solo tiene quien envió. */
  id: string;
  submittedAt: string;
  /** Los datos, ya recortados: los que se guardaron, no los que se tecleó. */
  form: AccessRequestForm;
};

function trimmed(form: AccessRequestForm): AccessRequestForm {
  return {
    email: form.email.trim().toLowerCase(),
    fullName: form.fullName.trim(),
    orgName: form.orgName.trim(),
    country: form.country.trim().toUpperCase(),
    phone: form.phone.trim(),
    website: form.website.trim(),
  };
}

/** Saca el `{ error }` del cuerpo de una respuesta no 2xx de la función. */
async function functionError(error: unknown, fallback: string): Promise<Error> {
  const response = (error as { context?: unknown }).context;
  if (response instanceof Response) {
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === 'string') return new Error(body.error);
    } catch {
      // El cuerpo no era JSON: se cae al mensaje genérico.
    }
  }
  return new Error(fallback);
}

export async function submitAccessRequest(form: AccessRequestForm): Promise<SubmittedAccessRequest> {
  const clean = trimmed(form);
  const { data, error } = await supabase.functions.invoke('access-request', {
    body: {
      action: 'submit',
      email: clean.email,
      full_name: clean.fullName,
      org_name: clean.orgName,
      country: clean.country,
      phone: clean.phone,
      website: clean.website,
    },
  });
  if (error) throw await functionError(error, 'No se pudo enviar la solicitud.');
  const body = data as { id?: unknown; submitted_at?: unknown } | null;
  if (!body || typeof body.id !== 'string' || typeof body.submitted_at !== 'string') {
    throw new Error('No se pudo enviar la solicitud.');
  }
  return { id: body.id, submittedAt: body.submitted_at, form: clean };
}

// -----------------------------------------------------------------------------
// La espera
// -----------------------------------------------------------------------------

export type AccessRequestState = 'PENDING_REVIEW' | 'INVITED_APPROVED' | 'REJECTED' | 'CANCELLED';

export type AccessRequestStatus = { state: AccessRequestState; rejectionReason: string | null };

const STATES: ReadonlySet<string> = new Set(['PENDING_REVIEW', 'INVITED_APPROVED', 'REJECTED', 'CANCELLED']);

export async function fetchAccessRequestStatus(id: string): Promise<AccessRequestStatus> {
  const { data, error } = await supabase.functions.invoke('access-request', {
    body: { action: 'status', id },
  });
  if (error) throw await functionError(error, 'No se pudo consultar la solicitud.');
  const body = data as { state?: unknown; rejection_reason?: unknown } | null;
  if (!body || typeof body.state !== 'string' || !STATES.has(body.state)) {
    throw new Error('No se pudo consultar la solicitud.');
  }
  return {
    state: body.state as AccessRequestState,
    rejectionReason: typeof body.rejection_reason === 'string' ? body.rejection_reason : null,
  };
}

/**
 * Cada cuánto se pregunta el estado. La spec dice *"polling periódico silencioso"*
 * sin cifra, y el funcional (Módulo 01 §3.2B.2) dice 60 s. Se usa la del
 * funcional: una persona revisa la cola, no hay nada que ganar preguntando más.
 */
export const POLL_INTERVAL_MS = 60_000;

/** Aprobada, rechazada o cancelada ya no cambian solas: se deja de preguntar. */
export function isFinalState(state: AccessRequestState): boolean {
  return state !== 'PENDING_REVIEW';
}

export type WaitPhase = 'review' | 'approved' | 'rejected';

export type WaitView = {
  phase: WaitPhase;
  /** Bajo el rodamiento. */
  spinnerLabel: string;
  title: string;
  subtitle: string;
  /** El texto del distintivo de estado (`EN REVISIÓN`…). */
  badge: string;
  /**
   * El aviso destacado bajo el distintivo: `strong` en negrita y `detail` detrás.
   * `null` mientras está en revisión. En rechazada, `detail` es el motivo del
   * Operador, o `''` si no lo hay.
   */
  notice: { strong: string; detail: string } | null;
};

/**
 * Qué pinta REG-00-WAIT en cada estado. Textos verbatim del `setStatus` del HTML
 * aprobado. `null` (aún no se sabe) se pinta como en revisión: es lo que acaba de
 * escribirse. `CANCELLED` (30 días sin revisar, RN-FL00.5) se pinta como
 * rechazada sin motivo: el HTML no tiene un tercer estado final y para quien
 * espera el efecto es el mismo.
 */
export function waitView(status: AccessRequestStatus | null): WaitView {
  const state = status?.state ?? 'PENDING_REVIEW';
  if (state === 'INVITED_APPROVED') {
    return {
      phase: 'approved',
      spinnerLabel: '¡Solicitud aprobada!',
      title: '¡Tu solicitud ha sido aprobada!',
      subtitle: 'Revisa tu email para continuar con el proceso de registro de tu organización.',
      badge: 'APROBADO',
      notice: {
        strong: '¡Tu solicitud ha sido aprobada!',
        detail: 'Revisa tu email para continuar con el proceso de registro de tu organización.',
      },
    };
  }
  if (state === 'REJECTED' || state === 'CANCELLED') {
    return {
      phase: 'rejected',
      spinnerLabel: 'Solicitud no aprobada',
      title: 'Tu solicitud no ha sido aprobada',
      subtitle:
        'En este momento no podemos darte acceso. Puedes iniciar una nueva solicitud si crees que hay un error.',
      badge: 'NO APROBADO',
      notice: {
        strong: 'Tu solicitud no ha sido aprobada en este momento.',
        detail: state === 'REJECTED' ? (status?.rejectionReason ?? '') : '',
      },
    };
  }
  return {
    phase: 'review',
    spinnerLabel: 'Revisando solicitud...',
    title: 'Tu solicitud está en revisión',
    subtitle:
      'Nuestro equipo está analizando los datos de tu organización. Te avisaremos por email en cuanto tengamos una respuesta.',
    badge: 'EN REVISIÓN',
    notice: null,
  };
}

/** Las seis filas de `Datos enviados`, en el orden del HTML aprobado. */
export function requestSummary(form: AccessRequestForm): { label: string; value: string }[] {
  return [
    { label: 'Email', value: form.email },
    { label: 'Nombre y apellidos', value: form.fullName },
    { label: 'Organización', value: form.orgName },
    { label: 'País', value: countryName(form.country) },
    { label: 'Teléfono', value: form.phone },
    { label: 'Sitio web', value: form.website },
  ];
}

// -----------------------------------------------------------------------------
// «Pantalla de un solo uso»: vive lo que vive la pestaña
// -----------------------------------------------------------------------------

/**
 * La solicitud en espera se guarda en `sessionStorage`, y no en `localStorage`
 * ni en la URL, porque eso es literalmente lo que promete la pantalla: *"Una vez
 * cierres el navegador … no podrás volver a acceder"*. Sobrevive a una recarga
 * (el token no se pierde por un F5) y muere con la pestaña. Todo acceso va en
 * `try`: con el almacenamiento bloqueado la pantalla funciona igual, solo que sin
 * sobrevivir a la recarga.
 */
const STORAGE_KEY = 'bw.accessRequest';

export function saveWaitingRequest(request: SubmittedAccessRequest): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(request));
  } catch {
    // Sin almacenamiento: la espera no sobrevive a la recarga, y ya está.
  }
}

export function loadWaitingRequest(): SubmittedAccessRequest | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SubmittedAccessRequest>;
    const form = parsed.form as Partial<AccessRequestForm> | undefined;
    if (
      typeof parsed.id !== 'string' ||
      typeof parsed.submittedAt !== 'string' ||
      !form ||
      !ACCESS_REQUEST_FIELDS.every((f) => typeof form[f] === 'string')
    ) {
      return null;
    }
    return { id: parsed.id, submittedAt: parsed.submittedAt, form: form as AccessRequestForm };
  } catch {
    return null;
  }
}

export function clearWaitingRequest(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada que borrar si no hay almacenamiento.
  }
}
