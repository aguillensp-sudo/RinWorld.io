/**
 * El recorrido de un correo de ingestión (INV-04, fase 2), con la E/S inyectada.
 *
 * `index.ts` pone las manos (S3, MIME, la base); aquí está el orden de las comprobaciones, que
 * es lo que decide qué ve un atacante y qué queda en el historial. Se prueba entero con
 * falsos en `app/src/lib/ingest-email.pipeline.test.ts`.
 *
 * Orden, y por qué ese:
 *   1. dirección → sin organización no hay nada más que mirar (`DIRECCION_INEXISTENTE`, el único
 *      evento sin `org_id`: solo lo ve `service_role`);
 *   2. virus y autenticación **antes** de mirar la lista: no se confirma a un remitente no
 *      autenticado si estaba en la lista o no (todo `RECHAZADO`, sin respuesta al remitente);
 *   3. lista de remitentes;
 *   4. tamaño, **antes** de bajar el objeto: se pregunta su tamaño a S3 sin leerlo;
 *   5. adjunto → formato (perfil) → líneas → importación.
 *
 * Nunca se escribe en el historial nada del contenido del correo: ni el asunto, ni el cuerpo,
 * ni una celda del archivo. Un nombre de archivo sí (acotado por `safeFileName`), porque es lo
 * que el ADMIN necesita para reconocer su envío.
 */
import {
  applyProfileMapping,
  buildLines,
  columnsOf,
  decodeText,
  headerSignature,
  missingRequired,
  parseImportText,
  MAX_LINES_PER_UPLOAD,
  type ImportLinePayload,
} from './import-core.ts';
import {
  MAX_MAIL_BYTES,
  chooseAttachment,
  isAuthenticated,
  isVirusFree,
  safeFileName,
  senderOf,
  tokenFromRecipients,
  type Attachment,
  type Reason,
  type SesNotification,
} from './mail-rules.ts';

export interface ResolvedAddress {
  address_id: string;
  org_id: string;
  org_country: string;
  senders: string[];
  profiles: { header_signature: string; mapping: unknown }[];
}

export interface IngestEvent {
  org_id: string | null;
  address_id: string | null;
  sender_email: string;
  file_name: string | null;
  result: 'PROCESADO' | 'RECHAZADO' | 'ERROR';
  reason: Reason | null;
  rows_imported: number | null;
  message_id: string | null;
}

export interface Deps {
  /** Dominio de las direcciones de ingestión, p. ej. `ingest.nortexsys.com`. */
  domain: string;
  /** `ingest_resolve` (0061): null si la dirección no existe o ya no vale. */
  resolve: (token: string) => Promise<ResolvedAddress | null>;
  /** Tamaño del objeto en S3 sin descargarlo (HEAD). */
  objectSize: (bucket: string, key: string) => Promise<number>;
  /** Bytes del objeto. Solo se llama con el tamaño ya comprobado. */
  getObject: (bucket: string, key: string) => Promise<Uint8Array>;
  /** MIME crudo → adjuntos. */
  attachmentsOf: (raw: Uint8Array) => Promise<Attachment[]>;
  /** `import_inventory_for_org` (0061): acumulativo. Devuelve cuántas líneas quedaron publicadas. */
  importLines: (orgId: string, lines: ImportLinePayload[]) => Promise<number>;
  /** ¿Ya hay un evento con este `message_id`? SNS reintenta. */
  alreadyHandled: (messageId: string) => Promise<boolean>;
  record: (event: IngestEvent) => Promise<void>;
}

export type Outcome = { result: IngestEvent['result']; reason: Reason | null; rows: number | null };

export async function processNotification(n: SesNotification, deps: Deps): Promise<Outcome> {
  const messageId = typeof n.mail?.messageId === 'string' ? n.mail.messageId.slice(0, 200) : null;
  const sender = senderOf(n) ?? 'desconocido';

  if (messageId !== null && (await deps.alreadyHandled(messageId))) {
    return { result: 'RECHAZADO', reason: null, rows: null };
  }

  const base = { sender_email: sender, message_id: messageId, file_name: null as string | null };
  let ctx: { org_id: string | null; address_id: string | null } = { org_id: null, address_id: null };
  let fileName: string | null = null;

  const done = async (result: IngestEvent['result'], reason: Reason | null, rows: number | null): Promise<Outcome> => {
    await deps.record({ ...base, ...ctx, file_name: fileName, result, reason, rows_imported: rows });
    return { result, reason, rows };
  };

  try {
    const token = tokenFromRecipients(n.receipt?.recipients, deps.domain);
    const address = token === null ? null : await deps.resolve(token);
    if (address === null) return await done('RECHAZADO', 'DIRECCION_INEXISTENTE', null);
    ctx = { org_id: address.org_id, address_id: address.address_id };

    if (!isVirusFree(n)) return await done('RECHAZADO', 'VIRUS', null);
    if (!isAuthenticated(n)) {
      const r = n.receipt;
      console.warn(
        `ingest-email: AUTENTICACION spf=${r?.spfVerdict?.status} dkim=${r?.dkimVerdict?.status} ` +
          `dmarc=${r?.dmarcVerdict?.status} envelope=${(n.mail?.source ?? '').split('@')[1] ?? '?'}`,
      );
      return await done('RECHAZADO', 'AUTENTICACION', null);
    }
    if (senderOf(n) === null || !address.senders.includes(sender)) {
      return await done('RECHAZADO', 'REMITENTE_NO_AUTORIZADO', null);
    }

    const action = n.receipt?.action;
    if (action?.type !== 'S3' || !action.bucketName || !action.objectKey) {
      return await done('ERROR', 'ERROR_INTERNO', null);
    }

    if ((await deps.objectSize(action.bucketName, action.objectKey)) > MAX_MAIL_BYTES) {
      return await done('RECHAZADO', 'TAMANO', null);
    }

    const attachments = await deps.attachmentsOf(await deps.getObject(action.bucketName, action.objectKey));
    const chosen = chooseAttachment(attachments);
    if (!chosen.ok) {
      fileName = safeFileName(attachments[0]?.filename);
      return await done('RECHAZADO', chosen.reason, null);
    }
    fileName = safeFileName(chosen.attachment.filename);

    const file = parseImportText(fileName ?? 'adjunto', decodeText(toArrayBuffer(chosen.attachment.content)));
    if (file === null) return await done('RECHAZADO', 'FORMATO_NO_RECONOCIDO', null);

    // Solo perfiles conocidos (decisión 2): un correo no puede preguntar «¿qué es esta columna?».
    const signature = headerSignature(file.headers);
    const profile = address.profiles.find((p) => p.header_signature === signature);
    const mapping = profile ? applyProfileMapping(columnsOf(file), profile.mapping) : null;
    if (mapping === null || missingRequired(mapping, address.org_country).length > 0) {
      return await done('RECHAZADO', 'FORMATO_NO_RECONOCIDO', null);
    }

    if (file.rows.length > MAX_LINES_PER_UPLOAD) return await done('RECHAZADO', 'TAMANO', null);
    const { lines } = buildLines(file, mapping, address.org_country);
    if (lines.length === 0) return await done('RECHAZADO', 'SIN_FILAS_VALIDAS', null);

    const published = await deps.importLines(address.org_id, lines);
    return await done('PROCESADO', null, published);
  } catch {
    // Nada de lo que falle se cuenta: ni el mensaje del error (puede llevar contenido del
    // correo) ni la traza. El historial dice `ERROR_INTERNO` y el registro de la función,
    // que `index.ts` escribe sin datos del correo, dice dónde.
    // Si ni esto se puede escribir, la excepción sube: `index.ts` responde 500 y SNS reintenta.
    return await done('ERROR', 'ERROR_INTERNO', null);
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
