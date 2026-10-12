/**
 * El recorrido de un correo (`supabase/functions/ingest-email/{mail-rules,pipeline}.ts`) con S3,
 * el MIME y la base sustituidos por falsos. Comprueba el ORDEN de las comprobaciones y que cada
 * rechazo deja su fila con su motivo — y que ninguna fila lleva contenido del correo.
 */
import { describe, expect, it } from 'vitest';
import {
  addressOf,
  chooseAttachment,
  isAuthenticated,
  safeFileName,
  tokenFromRecipients,
  type SesNotification,
} from '../../../supabase/functions/ingest-email/mail-rules';
import {
  processNotification,
  type Deps,
  type IngestEvent,
  type ResolvedAddress,
} from '../../../supabase/functions/ingest-email/pipeline';

const DOMINIO = 'ingest.nortexsys.com';
const TOKEN = 'a3f7k9m2q8wz';
const ORG = '00000000-0000-0000-0000-0000000000a1';
const CSV = 'Referencia;Marca;Cantidad\n6205-2RS;SKF;120\nNU 210;FAG;40\n';
const FIRMA = 'referencia|marca|cantidad';

const direccion: ResolvedAddress = {
  address_id: '00000000-0000-0000-0000-0000000000b1',
  org_id: ORG,
  org_country: 'ES',
  senders: ['erp@rodamientosdelsur.es', 'juan@rodamientosdelsur.es'],
  profiles: [{ header_signature: FIRMA, mapping: ['part_number', 'brand', 'quantity'] }],
};

interface Cambios {
  to?: string;
  from?: string;
  source?: string;
  spf?: string;
  dkim?: string;
  dmarc?: string;
  virus?: string;
  id?: string;
}

function aviso(c: Cambios = {}): SesNotification {
  return {
    notificationType: 'Received',
    mail: {
      messageId: c.id ?? 'msg-1',
      source: c.source ?? 'erp@rodamientosdelsur.es',
      commonHeaders: { from: [c.from ?? 'ERP Sur <ERP@rodamientosdelsur.es>'] },
    },
    receipt: {
      recipients: [c.to ?? `ingest-${TOKEN}@${DOMINIO}`],
      spfVerdict: { status: c.spf ?? 'PASS' },
      dkimVerdict: { status: c.dkim ?? 'PASS' },
      dmarcVerdict: { status: c.dmarc ?? 'PASS' },
      virusVerdict: { status: c.virus ?? 'PASS' },
      action: { type: 'S3', bucketName: 'nortexsys-ingest-mail-eu', objectKey: 'inbox/abc' },
    },
  };
}

const csvAdjunto = (texto: string, filename = 'a.csv') => async () => [
  { filename, content: new TextEncoder().encode(texto) },
];

function banco(over: Partial<Deps> = {}) {
  const eventos: IngestEvent[] = [];
  const importadas: { org: string; n: number }[] = [];
  let descargas = 0;
  const deps: Deps = {
    domain: DOMINIO,
    resolve: async (t) => (t === TOKEN ? direccion : null),
    objectSize: async () => 5000,
    getObject: async () => {
      descargas++;
      return new Uint8Array();
    },
    attachmentsOf: csvAdjunto(CSV, 'inventario.csv'),
    importLines: async (org, lines) => {
      importadas.push({ org, n: lines.length });
      return lines.length;
    },
    alreadyHandled: async () => false,
    record: async (e) => {
      eventos.push(e);
    },
    ...over,
  };
  return { deps, eventos, importadas, descargas: () => descargas };
}

describe('un correo bueno', () => {
  it('se importa y deja una fila PROCESADO con las filas importadas', async () => {
    const b = banco();
    const r = await processNotification(aviso(), b.deps);
    expect(r).toEqual({ result: 'PROCESADO', reason: null, rows: 2 });
    expect(b.importadas).toEqual([{ org: ORG, n: 2 }]);
    expect(b.eventos).toEqual([
      {
        org_id: ORG,
        address_id: direccion.address_id,
        sender_email: 'erp@rodamientosdelsur.es',
        file_name: 'inventario.csv',
        result: 'PROCESADO',
        reason: null,
        rows_imported: 2,
        message_id: 'msg-1',
      },
    ]);
  });

  it('un reintento de SNS con el mismo message_id no cuenta dos veces', async () => {
    const b = banco({ alreadyHandled: async () => true });
    await processNotification(aviso(), b.deps);
    expect(b.eventos).toEqual([]);
    expect(b.importadas).toEqual([]);
  });
});

describe('rechazos, cada uno con su motivo y sin tocar nada más', () => {
  const casos: [string, Cambios, string][] = [
    ['dirección que no existe', { to: `ingest-zzzzzzzzzzzz@${DOMINIO}` }, 'DIRECCION_INEXISTENTE'],
    ['destinatario de otro dominio', { to: `ingest-${TOKEN}@otro.com` }, 'DIRECCION_INEXISTENTE'],
    ['virus', { virus: 'FAIL' }, 'VIRUS'],
    ['sin autenticar (DMARC y SPF fallan)', { dmarc: 'FAIL', spf: 'FAIL' }, 'AUTENTICACION'],
    [
      'remitente que no está en la lista',
      { from: 'otro@rodamientosdelsur.es', source: 'otro@rodamientosdelsur.es' },
      'REMITENTE_NO_AUTORIZADO',
    ],
  ];
  for (const [nombre, cambios, motivo] of casos) {
    it(nombre, async () => {
      const b = banco();
      const r = await processNotification(aviso(cambios), b.deps);
      expect(r.reason).toBe(motivo);
      expect(r.result).toBe('RECHAZADO');
      expect(b.eventos).toHaveLength(1);
      expect(b.eventos[0]?.reason).toBe(motivo);
      expect(b.importadas).toEqual([]);
      expect(b.descargas()).toBe(0); // no se baja el objeto de S3 si el correo no llega a eso
    });
  }

  it('una dirección inexistente se registra sin organización', async () => {
    const b = banco();
    await processNotification(aviso({ to: `ingest-zzzzzzzzzzzz@${DOMINIO}` }), b.deps);
    expect(b.eventos[0]?.org_id).toBeNull();
  });

  it('un remitente sin autenticar no se entera de si estaba en la lista (mismo motivo esté o no)', async () => {
    for (const from of ['erp@rodamientosdelsur.es', 'intruso@spam.com']) {
      const b = banco();
      const r = await processNotification(aviso({ from, dmarc: 'FAIL', spf: 'FAIL' }), b.deps);
      expect(r.reason).toBe('AUTENTICACION');
    }
  });

  it('correo mayor de 40 MB: se rechaza sin descargarlo', async () => {
    const b = banco({ objectSize: async () => 41 * 1024 * 1024 });
    expect((await processNotification(aviso(), b.deps)).reason).toBe('TAMANO');
    expect(b.descargas()).toBe(0);
  });

  it('adjunto con extensión no admitida (.xls, .xlsx, .pdf): EXTENSION, con el nombre en el historial', async () => {
    for (const nombre of ['inventario.xls', 'inventario.xlsx', 'catalogo.pdf']) {
      const b = banco({ attachmentsOf: async () => [{ filename: nombre, content: new Uint8Array([1]) }] });
      expect((await processNotification(aviso(), b.deps)).reason).toBe('EXTENSION');
      expect(b.eventos[0]?.file_name).toBe(nombre);
    }
  });

  it('correo sin adjuntos: EXTENSION', async () => {
    const b = banco({ attachmentsOf: async () => [] });
    expect((await processNotification(aviso(), b.deps)).reason).toBe('EXTENSION');
  });

  it('cabecera sin perfil guardado: FORMATO_NO_RECONOCIDO y no se importa nada', async () => {
    const b = banco({ attachmentsOf: csvAdjunto('Ref;Marca;Uds\nX;SKF;1\n') });
    expect((await processNotification(aviso(), b.deps)).reason).toBe('FORMATO_NO_RECONOCIDO');
    expect(b.importadas).toEqual([]);
  });

  it('archivo vacío: FORMATO_NO_RECONOCIDO', async () => {
    const b = banco({ attachmentsOf: csvAdjunto('') });
    expect((await processNotification(aviso(), b.deps)).reason).toBe('FORMATO_NO_RECONOCIDO');
  });

  it('perfil conocido pero todas las líneas inválidas: SIN_FILAS_VALIDAS', async () => {
    const b = banco({ attachmentsOf: csvAdjunto('Referencia;Marca;Cantidad\nX;SKF;mucha\n') });
    expect((await processNotification(aviso(), b.deps)).reason).toBe('SIN_FILAS_VALIDAS');
  });

  it('más de 20.000 líneas: TAMANO', async () => {
    const grande = 'Referencia;Marca;Cantidad\n' + Array.from({ length: 20001 }, (_, i) => `R${i};SKF;1`).join('\n');
    const b = banco({ attachmentsOf: csvAdjunto(grande) });
    expect((await processNotification(aviso(), b.deps)).reason).toBe('TAMANO');
  });
});

describe('fallos internos', () => {
  it('si S3 o la base fallan, queda ERROR_INTERNO sin el mensaje del error', async () => {
    const b = banco({
      getObject: async () => {
        throw new Error('contenido secreto del correo');
      },
    });
    const r = await processNotification(aviso(), b.deps);
    expect(r).toEqual({ result: 'ERROR', reason: 'ERROR_INTERNO', rows: null });
    expect(JSON.stringify(b.eventos)).not.toContain('secreto');
  });

  it('si ni el historial se puede escribir, la excepción sube (la función responde 500 y SNS reintenta)', async () => {
    const b = banco({
      record: async () => {
        throw new Error('db caída');
      },
    });
    await expect(processNotification(aviso(), b.deps)).rejects.toThrow();
  });

  it('el historial nunca lleva texto del archivo ni cabeceras del correo', async () => {
    const b = banco();
    await processNotification(aviso(), b.deps);
    const e = JSON.stringify(b.eventos);
    for (const prohibido of ['6205', 'SKF', 'ERP Sur', 'Referencia']) expect(e).not.toContain(prohibido);
  });
});

describe('autenticación del remitente', () => {
  it('sin DMARC acepta SPF+DKIM solo si el sobre y el From son del mismo dominio', () => {
    const sinDmarc = (c: Cambios) => isAuthenticated(aviso({ dmarc: 'GRAY', ...c }));
    expect(sinDmarc({})).toBe(true);
    expect(sinDmarc({ source: 'bounce@mailer.atacante.net' })).toBe(false); // SPF/DKIM de otro dominio, From suplantado
    expect(sinDmarc({ spf: 'FAIL' })).toBe(false);
    expect(sinDmarc({ dkim: 'FAIL' })).toBe(false);
  });

  it('DMARC PASS basta', () => {
    expect(isAuthenticated(aviso({ spf: 'FAIL', dkim: 'FAIL', dmarc: 'PASS' }))).toBe(true);
  });

  it('sin veredictos no hay autenticación', () => {
    const { mail } = aviso();
    expect(isAuthenticated(mail ? { mail } : {})).toBe(false);
  });
});

describe('piezas', () => {
  it('addressOf saca la dirección en minúsculas o null', () => {
    expect(addressOf('ERP Sur <ERP@Sur.es>')).toBe('erp@sur.es');
    expect(addressOf('erp@sur.es')).toBe('erp@sur.es');
    expect(addressOf('no es un correo')).toBeNull();
    expect(addressOf(undefined)).toBeNull();
  });

  it('tokenFromRecipients exige el dominio y el alfabeto de 12 caracteres', () => {
    expect(tokenFromRecipients([`Ingest-${TOKEN}@${DOMINIO.toUpperCase()}`], DOMINIO)).toBe(TOKEN);
    expect(tokenFromRecipients([`ingest-${TOKEN}@${DOMINIO}.evil.com`], DOMINIO)).toBeNull();
    expect(tokenFromRecipients([`ingest-a3f7k9@${DOMINIO}`], DOMINIO)).toBeNull(); // el de 6 de la spec
    expect(tokenFromRecipients([`ingest-a3f7k9m2q8wl@${DOMINIO}`], DOMINIO)).toBeNull(); // «l» no está en el alfabeto
    expect(tokenFromRecipients(undefined, DOMINIO)).toBeNull();
  });

  it('chooseAttachment toma el primero admitido e ignora el resto', () => {
    const a = (filename: string) => ({ filename, content: new Uint8Array() });
    expect(chooseAttachment([a('x.pdf'), a('b.CSV'), a('c.tsv')])).toEqual({ ok: true, attachment: a('b.CSV') });
    expect(chooseAttachment([a('x.pdf')])).toEqual({ ok: false, reason: 'EXTENSION' });
  });

  it('safeFileName quita rutas y caracteres de control, y acota a 255', () => {
    expect(safeFileName('C:\\datos\\inv.csv')).toBe('inv.csv');
    expect(safeFileName('../../etc/inv.csv')).toBe('inv.csv');
    expect(safeFileName('a\u0000b\nc.csv')).toBe('abc.csv');
    expect(safeFileName('x'.repeat(400))?.length).toBe(255);
    expect(safeFileName('   ')).toBeNull();
  });
});
