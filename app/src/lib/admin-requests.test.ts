import { describe, expect, it } from 'vitest';
import { countryName } from './search';
import {
  DEFAULT_FILTER,
  hoursSince,
  isValidRejectionReason,
  QUEUE_FILTERS,
  queueAgeLabel,
  queueAgeLevel,
  REASON_MAX,
  REASON_MIN,
  REQUEST_STATES,
  requestDateLabel,
  toRequestEvent,
  toRequestRow,
  websiteHref,
  type RequestRowRaw,
} from './admin-requests';

/**
 * La lógica pura de ADMIN-01. Sin base y sin React.
 *
 * Esta capa la escribe Claude Code, no el Coder (`CLAUDE.md` §3), así que estos
 * tests **no son el contrato del arnés**: son los míos.
 */

const AHORA = new Date('2026-09-11T12:00:00Z');
const hace = (horas: number) => new Date(AHORA.getTime() - horas * 3_600_000).toISOString();

function raw(over: Partial<RequestRowRaw> = {}): RequestRowRaw {
  return {
    id: '11110000-0000-4000-8000-000000000001',
    org_name: 'Distribuciones Álvarez SL',
    country: 'ES',
    applicant_full_name: 'Juan Álvarez García',
    applicant_email: 'jalvarez@distribalvarez.test',
    applicant_phone: '+34 91 234 56 78',
    website: null,
    submitted_at: hace(52),
    state: 'PENDING_REVIEW',
    rejection_reason: null,
    decided_by: null,
    decided_at: null,
    ...over,
  };
}

describe('los chips de la cola', () => {
  it('son los cinco de la spec, y `Pendientes` es el de arranque', () => {
    expect(QUEUE_FILTERS.map((f) => f.label)).toEqual([
      'Pendientes', 'Aprobadas', 'Rechazadas', 'Canceladas', 'Todas',
    ]);
    expect(DEFAULT_FILTER).toBe('PENDING_REVIEW');
  });

  it('`Todas` no filtra por ningún estado', () => {
    expect(QUEUE_FILTERS.at(-1)?.state).toBeNull();
  });

  it('y los cuatro estados son los que admite la base', () => {
    // Si alguien inventa aquí un estado que el CHECK de 0028 no conoce, el
    // filtro devolvería siempre cero filas sin dar ningún error.
    const conEstado = QUEUE_FILTERS.map((f) => f.state).filter((s) => s !== null);
    for (const estado of conEstado) {
      expect(REQUEST_STATES).toContain(estado);
    }
  });
});

describe('antigüedad en cola', () => {
  it('menos de 24 horas es normal', () => {
    expect(queueAgeLevel(hace(3), AHORA)).toBe('normal');
    expect(queueAgeLevel(hace(24), AHORA)).toBe('normal');
  });

  it('pasadas las 24 horas, naranja', () => {
    expect(queueAgeLevel(hace(25), AHORA)).toBe('warn');
    expect(queueAgeLevel(hace(48), AHORA)).toBe('warn');
  });

  it('y pasadas las 48, rojo', () => {
    expect(queueAgeLevel(hace(52), AHORA)).toBe('alert');
  });

  it('los bordes son estrictos: 24 y 48 clavadas NO saltan de color', () => {
    // La spec dice "> 24h" y "> 48h". Un `>=` aquí pondría en naranja una
    // solicitud que acaba de cumplir el día, y el operador vería alarma donde
    // la spec dice que todavía no la hay.
    expect(queueAgeLevel(hace(24), AHORA)).toBe('normal');
    expect(queueAgeLevel(hace(48), AHORA)).toBe('warn');
  });

  it('la etiqueta cuenta horas enteras, como el ejemplo de la spec', () => {
    expect(queueAgeLabel(hace(52), AHORA)).toBe('Hace 52 horas');
    expect(queueAgeLabel(hace(18), AHORA)).toBe('Hace 18 horas');
    expect(queueAgeLabel(hace(3), AHORA)).toBe('Hace 3 horas');
  });

  it('y trata aparte la primera hora y la una', () => {
    expect(queueAgeLabel(hace(0.2), AHORA)).toBe('Hace menos de una hora');
    expect(queueAgeLabel(hace(1), AHORA)).toBe('Hace 1 hora');
  });

  it('una fecha ilegible no revienta la tabla', () => {
    expect(hoursSince('esto no es una fecha', AHORA)).toBe(0);
    expect(queueAgeLevel('esto no es una fecha', AHORA)).toBe('normal');
  });

  it('ni una fecha en el futuro cuenta horas negativas', () => {
    const futuro = new Date(AHORA.getTime() + 3_600_000).toISOString();
    expect(hoursSince(futuro, AHORA)).toBe(0);
  });
});

describe('el motivo del rechazo', () => {
  it('exige diez caracteres y admite hasta quinientos', () => {
    expect(isValidRejectionReason('x'.repeat(REASON_MIN - 1))).toBe(false);
    expect(isValidRejectionReason('x'.repeat(REASON_MIN))).toBe(true);
    expect(isValidRejectionReason('x'.repeat(REASON_MAX))).toBe(true);
    expect(isValidRejectionReason('x'.repeat(REASON_MAX + 1))).toBe(false);
  });

  it('y no cuela un motivo de solo espacios', () => {
    expect(isValidRejectionReason('              ')).toBe(false);
  });
});

describe('el mapeo de la fila', () => {
  it('trae las ocho columnas de la tabla', () => {
    const fila = toRequestRow(raw());
    expect(fila.orgName).toBe('Distribuciones Álvarez SL');
    expect(fila.country).toBe('ES');
    expect(fila.countryLabel).toBe(countryName('ES'));
    expect(fila.email).toBe('jalvarez@distribalvarez.test');
    expect(fila.phone).toBe('+34 91 234 56 78');
    expect(fila.state).toBe('PENDING_REVIEW');
  });

  it('los campos opcionales del FSR salen como hueco, nunca como null', () => {
    // La spec dice que teléfono y sitio web "pueden estar vacíos", y la fila
    // de ejemplo los pinta con un guion. Un `null` en la tabla se pintaría
    // como la palabra "null" en cuanto alguien interpole sin pensar.
    const fila = toRequestRow(raw({ applicant_phone: null, website: null }));
    expect(fila.phone).toBe('');
    expect(fila.website).toBe('');
  });

  it('una solicitud sin decidir no trae firma', () => {
    const fila = toRequestRow(raw());
    expect(fila.decidedBy).toBeNull();
    expect(fila.decidedAt).toBeNull();
    expect(fila.rejectionReason).toBe('');
  });
});

describe('el historial', () => {
  it('una nota vacía es cadena vacía, no null', () => {
    const evento = toRequestEvent({
      id: 1, state: 'PENDING_REVIEW', at: hace(52), operator_id: null, note: null,
    });
    expect(evento.note).toBe('');
    expect(evento.operatorId).toBeNull();
  });

  it('y la fila de una decisión trae al operador que la tomó', () => {
    const evento = toRequestEvent({
      id: 2, state: 'REJECTED', at: hace(1),
      operator_id: '0e000001-0000-0000-0000-000000000001',
      note: 'Sin actividad comprobable en el sector.',
    });
    expect(evento.operatorId).toBe('0e000001-0000-0000-0000-000000000001');
    expect(evento.note).toBe('Sin actividad comprobable en el sector.');
  });
});

describe('requestDateLabel', () => {
  it('formatea fecha y hora como las otras pantallas formatean la fecha, con la hora sumada', () => {
    expect(requestDateLabel('2026-06-28T08:14:00Z')).toBe('28 jun 2026 · 08:14');
  });

  it('una fecha ilegible se devuelve tal cual, sin inventar un guion', () => {
    expect(requestDateLabel('no soy una fecha')).toBe('no soy una fecha');
  });
});

describe('websiteHref', () => {
  it('antepone https:// a un dominio sin esquema, para que no sea una URL relativa', () => {
    expect(websiteHref('nordicbearings.se')).toBe('https://nordicbearings.se');
  });

  it('no toca una URL que ya trae esquema, http o https', () => {
    expect(websiteHref('https://roulementsfrance.fr')).toBe('https://roulementsfrance.fr');
    expect(websiteHref('http://roulementsfrance.fr')).toBe('http://roulementsfrance.fr');
  });
});
