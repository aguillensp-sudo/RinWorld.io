import { describe, expect, it } from 'vitest';
import {
  BILLING_FILTERS,
  billingDateLabel,
  billingFilterCount,
  daysRemainingLabel,
  dueTone,
  filterBillingRows,
  isValidPaymentDate,
  isValidPaymentNote,
  monthsSince,
  monthsSuspendedLabel,
  PAYMENT_NOTE_MAX,
  renewalDate,
  sortBillingRows,
  toBillingPayment,
  toBillingRow,
  toBillingStatusEvent,
  todayIso,
  type BillingRow,
  type BillingRowRaw,
  type BillingState,
} from './admin-billing';

/**
 * La lógica pura de ADMIN-02. Sin base y sin React.
 *
 * Esta capa la escribe Claude Code, no el Coder (`CLAUDE.md` §3), así que estos
 * tests **no son el contrato del arnés**: son los míos. Los cinco ejemplos son los
 * de la spec §3 ("Datos de ejemplo"), con los días restantes fijados a mano.
 */

function row(name: string, state: BillingState, daysRemaining: number, over: Partial<BillingRow> = {}): BillingRow {
  return {
    orgId: `org-${name}`,
    name,
    country: 'ES',
    countryLabel: 'España',
    state,
    joinedAt: '2026-01-01T00:00:00Z',
    suspendedSince: null,
    lastPaymentDate: null,
    trialEndsAt: '2026-04-01',
    dueDate: '2026-04-01',
    daysRemaining,
    ...over,
  };
}

/** Spec §3, en el orden en que llegan de la base (sin ordenar a propósito). */
const EJEMPLO: BillingRow[] = [
  row('NSK Europe Ltd', 'ACTIVE', 246),
  row('Timken Europe GmbH', 'CANDIDATA A BORRADO', -182),
  row('Rodamientos del Sur SL', 'EN PRUEBA', 91),
  row('Nordic Bearings AB', 'ACTIVE', 2),
  row('Distribuciones Ruiz SL', 'SUSPENDED', -133),
];

describe('sortBillingRows', () => {
  it('días restantes ascendente: la más vencida primero (F-170)', () => {
    expect(sortBillingRows(EJEMPLO).map((r) => r.daysRemaining)).toEqual([-182, -133, 2, 91, 246]);
  });

  it('desempata por nombre y no toca el array de entrada', () => {
    const entrada = [row('Bravo', 'ACTIVE', 5), row('Alfa', 'ACTIVE', 5)];
    expect(sortBillingRows(entrada).map((r) => r.name)).toEqual(['Alfa', 'Bravo']);
    expect(entrada[0]?.name).toBe('Bravo');
  });
});

describe('filtros (spec §3)', () => {
  it('son cinco, en este orden, con Todos por defecto', () => {
    expect(BILLING_FILTERS.map((f) => f.label)).toEqual([
      'Todos',
      'Próximos a vencer',
      'Suspendidos',
      'Candidatas a borrado',
      'En periodo de prueba',
    ]);
  });

  it('Próximos a vencer: solo ACTIVE dentro de 15 días', () => {
    expect(filterBillingRows(EJEMPLO, 'EXPIRING').map((r) => r.name)).toEqual(['Nordic Bearings AB']);
  });

  it('Próximos a vencer: 15 entra, 16 no; una ACTIVE ya vencida no entra', () => {
    const rows = [row('a', 'ACTIVE', 15), row('b', 'ACTIVE', 16), row('c', 'ACTIVE', -3), row('d', 'EN PRUEBA', 5)];
    expect(filterBillingRows(rows, 'EXPIRING').map((r) => r.name)).toEqual(['a']);
  });

  it('Suspendidos NO incluye a la candidata a borrado, que tiene su propio chip', () => {
    expect(filterBillingRows(EJEMPLO, 'SUSPENDED').map((r) => r.name)).toEqual(['Distribuciones Ruiz SL']);
    expect(filterBillingRows(EJEMPLO, 'DELETION').map((r) => r.name)).toEqual(['Timken Europe GmbH']);
  });

  it('En periodo de prueba', () => {
    expect(filterBillingRows(EJEMPLO, 'TRIAL').map((r) => r.name)).toEqual(['Rodamientos del Sur SL']);
  });

  it('los contadores del ejemplo: 5 / 1 / 1 / 1 / 1', () => {
    expect(BILLING_FILTERS.map((f) => billingFilterCount(EJEMPLO, f.key))).toEqual([5, 1, 1, 1, 1]);
  });
});

describe('billingDateLabel', () => {
  it('formatea como la spec: 28 Dic 2025, sin cero a la izquierda', () => {
    expect(billingDateLabel('2025-12-28')).toBe('28 Dic 2025');
    expect(billingDateLabel('2026-03-01')).toBe('1 Mar 2026');
    expect(billingDateLabel('2026-06-30T10:00:00Z')).toBe('30 Jun 2026');
  });

  it('sin fecha es un guion largo; lo que no es fecha se devuelve tal cual', () => {
    expect(billingDateLabel(null)).toBe('—');
    expect(billingDateLabel(undefined)).toBe('—');
    expect(billingDateLabel('ayer')).toBe('ayer');
  });
});

describe('daysRemainingLabel y dueTone', () => {
  it('singular, plural y negativos', () => {
    expect(daysRemainingLabel(2)).toBe('2 días');
    expect(daysRemainingLabel(1)).toBe('1 día');
    expect(daysRemainingLabel(-1)).toBe('-1 día');
    expect(daysRemainingLabel(-182)).toBe('-182 días');
  });

  it('rojo si negativo, naranja si < 15, normal desde 15', () => {
    expect(dueTone(-1)).toBe('danger');
    expect(dueTone(0)).toBe('warn');
    expect(dueTone(14)).toBe('warn');
    expect(dueTone(15)).toBe('normal');
    expect(dueTone(246)).toBe('normal');
  });
});

describe('monthsSince', () => {
  const AHORA = new Date('2026-06-28T12:00:00Z');

  it('seis meses justos desde el 28 de diciembre', () => {
    expect(monthsSince('2025-12-28T00:00:00Z', AHORA)).toBe(6);
    expect(monthsSuspendedLabel('2025-12-28T00:00:00Z', AHORA)).toBe('6 meses en SUSPENDED');
  });

  it('un día menos y ya son cinco', () => {
    expect(monthsSince('2025-12-29T00:00:00Z', AHORA)).toBe(5);
  });

  it('singular, y sin fecha son cero', () => {
    expect(monthsSuspendedLabel('2026-05-20T00:00:00Z', AHORA)).toBe('1 mes en SUSPENDED');
    expect(monthsSince(null, AHORA)).toBe(0);
    expect(monthsSince('no-es-fecha', AHORA)).toBe(0);
  });
});

describe('validación del modal Marcar pago recibido', () => {
  const HOY = new Date(2026, 8, 19, 12, 0, 0);

  it('todayIso es la fecha local de quien mira', () => {
    expect(todayIso(HOY)).toBe('2026-09-19');
  });

  it('pasada y presente valen; futura, vacía e imposible no', () => {
    expect(isValidPaymentDate('2026-09-19', HOY)).toBe(true);
    expect(isValidPaymentDate('2025-01-01', HOY)).toBe(true);
    expect(isValidPaymentDate('2026-09-20', HOY)).toBe(false);
    expect(isValidPaymentDate('', HOY)).toBe(false);
    expect(isValidPaymentDate('2026-02-30', HOY)).toBe(false);
    expect(isValidPaymentDate('19/09/2026', HOY)).toBe(false);
  });

  it('la nota admite hasta 300 caracteres', () => {
    expect(isValidPaymentNote('x'.repeat(PAYMENT_NOTE_MAX))).toBe(true);
    expect(isValidPaymentNote('x'.repeat(PAYMENT_NOTE_MAX + 1))).toBe(false);
    expect(isValidPaymentNote('')).toBe(true);
  });

  it('el nuevo vencimiento es la fecha de pago + 365 días', () => {
    expect(renewalDate('2026-06-28')).toBe('2027-06-28');
    expect(renewalDate('2027-03-01')).toBe('2028-02-29');
  });
});

describe('toBillingRow / toBillingPayment / toBillingStatusEvent', () => {
  const raw: BillingRowRaw = {
    org_id: 'o1',
    name: 'Nordic Bearings AB',
    country: 'se',
    status: 'APPROVED',
    org_created_at: '2025-06-30T00:00:00Z',
    suspended_since: null,
    last_payment_date: '2025-06-30',
    trial_ends_at: '2025-09-28',
    current_period_ends_at: '2026-06-30',
    days_remaining: 2,
    billing_state: 'ACTIVE',
  };

  it('pasa la fila de la vista a la del cliente', () => {
    expect(toBillingRow(raw)).toMatchObject({
      orgId: 'o1',
      country: 'SE',
      state: 'ACTIVE',
      dueDate: '2026-06-30',
      daysRemaining: 2,
      lastPaymentDate: '2025-06-30',
    });
  });

  it('el pago sin nota da cadena vacía; sin operador da null', () => {
    expect(toBillingPayment({ id: 'p', payment_date: '2026-01-01', note: null, platform_operators: null })).toEqual({
      id: 'p',
      paymentDate: '2026-01-01',
      note: '',
      operatorName: null,
    });
  });

  it('un evento con changed_by null es automático, no de un operador', () => {
    const base = { id: 1, from_status: 'APPROVED', to_status: 'SUSPENDED', created_at: '2026-01-01T00:00:00Z' };
    expect(toBillingStatusEvent({ ...base, changed_by: null, platform_operators: null }).automatic).toBe(true);
    const manual = toBillingStatusEvent({
      ...base,
      changed_by: 'op-1',
      platform_operators: { full_name: 'Admin Principal' },
    });
    expect(manual.automatic).toBe(false);
    expect(manual.operatorName).toBe('Admin Principal');
  });
});
