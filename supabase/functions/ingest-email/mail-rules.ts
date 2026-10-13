/**
 * Las reglas de un correo de ingestión (INV-04, fase 2), sin red ni base.
 *
 * Todo lo que decide «este correo entra o no, y si no, por qué» vive aquí como funciones puras,
 * para poder probarlo una por una. `index.ts` solo las encadena y hace la E/S.
 *
 * El correo es **dato no confiable**: de él solo se leen el remitente, los nombres de los
 * adjuntos y su contenido, y nada de eso llega nunca a un registro (ver `reasonFor`).
 *
 * Sin `import`s relativos: lo carga Deno (la función) y Node (vitest).
 */

/** Códigos de motivo del historial: cortos, estables, sin texto libre (`ingest_events_reason_chk`). */
export type Reason =
  | 'DIRECCION_INEXISTENTE'
  | 'AUTENTICACION'
  | 'VIRUS'
  | 'REMITENTE_NO_AUTORIZADO'
  | 'TAMANO'
  | 'EXTENSION'
  | 'FORMATO_NO_RECONOCIDO'
  | 'SIN_FILAS_VALIDAS'
  | 'LIMITE_HORARIO'
  | 'ERROR_INTERNO';

/**
 * Tope por correo en la fase 2: 5 MB (medido el 13-oct-2026, no de memoria). La spec y el PO dicen
 * 40 MB, que SES sí recibe, pero la función de borde tiene 256 MB y 2 s de CPU por petición y el
 * MIME se descodifica entero en memoria: un correo de 37 MB con un CSV de 500.000 filas ocupó
 * ~670 MB tras `PostalMime` y ~4 s de CPU; uno de 1,4 MB con las 20.000 filas del tope de la spec,
 * ~0,3 s y ~70 MB sobre la base. 5 MB deja margen de sobra para 20.000 filas (~1 MB de CSV) y para
 * un archivo con notas largas. Los 40 MB vuelven con la fase 3, fuera de la función de borde.
 */
export const MAX_MAIL_BYTES = 5 * 1024 * 1024;

/**
 * Extensiones que se leen. `.xlsx` entra en la fase 3 con su propio lector sin DOM
 * (`xlsx-rows.ts`, medido en `openspec/v1/inv04-medidas-xlsx.md`); `.xls` binario, fuera siempre.
 */
export const ACCEPTED_EXTENSIONS: readonly string[] = ['csv', 'tsv', 'txt', 'xlsx'];

/**
 * Filas de datos por correo en un `.xlsx`. El CSV sigue en 20.000 (`MAX_LINES_PER_UPLOAD`): se lee
 * entero en memoria y 500.000 filas llegaron a 1 GB. El `.xlsx` de 100.001 filas del PO
 * (`Rodamientos_100000_Ficticio.xlsx`, 3 MB) costó 0,6 s de CPU y 173 MB hasta tener las líneas
 * listas; 120.000 deja ~20 % de holgura sobre ese archivo y sigue dentro de los 256 MB. Medido en
 * Node, no en Supabase: el primer correo grande real lo confirmará en los registros.
 */
export const MAX_XLSX_ROWS = 120_000;

/**
 * Correos por hora y organización (INV-04, fase 4). Un ERP bien configurado manda uno por hora o
 * menos; 20 deja holgura para reenvíos a mano y corta un bucle o un abuso de un remitente
 * autorizado. Es un número elegido, no medido: se cambia aquí y se despliega.
 */
export const MAX_MAILS_PER_HOUR = 20;

/**
 * Qué cuenta para ese límite: los correos de remitentes autenticados y autorizados, procesados o
 * rechazados por su contenido. NO cuentan los rechazos anteriores a la lista de remitentes
 * (dirección, virus, autenticación, remitente) ni el propio `LIMITE_HORARIO`: si contaran, cualquiera
 * que conociera la dirección podría agotar la cuota de la organización con correo falsificado.
 */
export const HOURLY_COUNTED_REASONS: readonly Reason[] = ['TAMANO', 'EXTENSION', 'FORMATO_NO_RECONOCIDO', 'SIN_FILAS_VALIDAS', 'ERROR_INTERNO'];

/** Lo que SES manda en la notificación de la acción S3 (solo los campos que usamos). */
export interface SesNotification {
  notificationType?: string;
  mail?: {
    messageId?: string;
    source?: string;
    commonHeaders?: { from?: string[] };
  };
  receipt?: {
    recipients?: string[];
    spfVerdict?: { status?: string };
    dkimVerdict?: { status?: string };
    dmarcVerdict?: { status?: string };
    virusVerdict?: { status?: string };
    action?: { type?: string; bucketName?: string; objectKey?: string };
  };
}

/** `Nombre <a@b.c>` o `a@b.c` → `a@b.c` en minúsculas; `null` si no hay una dirección. */
export function addressOf(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string') return null;
  const m = raw.match(/<([^<>\s]+@[^<>\s]+)>\s*$/) ?? raw.trim().match(/^([^<>\s,;]+@[^<>\s,;]+)$/);
  const addr = m?.[1]?.toLowerCase() ?? null;
  return addr !== null && addr.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr) ? addr : null;
}

function domainOf(addr: string): string {
  return addr.slice(addr.lastIndexOf('@') + 1);
}

/** El token de `ingest-<12>@ingest.<dominio>` entre los destinatarios, o `null`. */
export function tokenFromRecipients(recipients: string[] | undefined, domain: string): string | null {
  const suffix = `@${domain.toLowerCase()}`;
  for (const r of recipients ?? []) {
    const addr = addressOf(r);
    if (addr === null || !addr.endsWith(suffix)) continue;
    const m = addr.slice(0, -suffix.length).match(/^ingest-([a-km-np-z2-9]{12})$/);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** El remitente que se compara con la lista: el `From` del correo, normalizado. */
export function senderOf(n: SesNotification): string | null {
  return addressOf(n.mail?.commonHeaders?.from?.[0]);
}

/**
 * ¿Es de verdad quien dice ser? (decisión 1 del plan: el `From` se falsifica.)
 *
 *   · DMARC `PASS`: SPF o DKIM pasan **y están alineados con el dominio del `From`**. Es la
 *     única comprobación que ata el veredicto al remitente que se compara con la lista.
 *   · Si no hay DMARC (el dominio del remitente no publica política), se aceptan SPF `PASS` y
 *     DKIM `PASS` **solo si el remitente del sobre (`mail.source`) es del mismo dominio que el
 *     `From`**; sin esa condición un atacante pasaría SPF con su propio dominio y firmaría con
 *     el suyo mientras pone en el `From` a un remitente autorizado.
 *
 * Límite conocido: en la rama sin DMARC, SES no dice con qué dominio firmó el DKIM, así que un
 * atacante que controle el dominio del `From` sigue siendo indistinguible del dueño; eso es lo
 * que ya garantiza cualquier remitente que no publique DMARC.
 */
export function isAuthenticated(n: SesNotification): boolean {
  const r = n.receipt;
  if (!r) return false;
  if (r.dmarcVerdict?.status === 'PASS') return true;
  const from = senderOf(n);
  const source = addressOf(n.mail?.source);
  return (
    r.spfVerdict?.status === 'PASS' &&
    r.dkimVerdict?.status === 'PASS' &&
    from !== null &&
    source !== null &&
    domainOf(from) === domainOf(source)
  );
}

export function isVirusFree(n: SesNotification): boolean {
  return n.receipt?.virusVerdict?.status === 'PASS';
}

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? '' : fileName.slice(dot + 1).toLowerCase();
}

export interface Attachment {
  filename: string;
  content: Uint8Array;
}

export type AttachmentChoice =
  | { ok: true; attachment: Attachment }
  | { ok: false; reason: 'EXTENSION' };

/**
 * El adjunto que se importa: **el primero** con extensión admitida. Un correo con varios
 * adjuntos importa uno solo; los demás se ignoran sin más (el historial lleva una fila por
 * correo, no por adjunto).
 */
export function chooseAttachment(attachments: readonly Attachment[]): AttachmentChoice {
  const found = attachments.find((a) => ACCEPTED_EXTENSIONS.includes(extensionOf(a.filename)));
  return found ? { ok: true, attachment: found } : { ok: false, reason: 'EXTENSION' };
}

/** Nombre de archivo apto para el historial: sin rutas, sin control, como mucho 255. */
export function safeFileName(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string') return null;
  const base = raw.split(/[\\/]/).pop() ?? '';
  const clean = Array.from(base)
    .filter((ch) => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) !== 127)
    .join('')
    .trim()
    .slice(0, 255);
  return clean === '' ? null : clean;
}
