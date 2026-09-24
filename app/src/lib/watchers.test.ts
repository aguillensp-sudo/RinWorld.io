import { describe, expect, it } from 'vitest';
import {
  activeCounterLabel,
  activeWatcherCount,
  conditionsLabel,
  counterTone,
  DEFAULT_WATCHER_FILTER,
  daysLeftLabel,
  daysTone,
  draftFromRow,
  expiresInLabel,
  filterWatchers,
  isValidWatcherDraft,
  isValidWatcherQuantity,
  isValidWatcherRef,
  sinceLabel,
  sortWatchers,
  toWatcherRow,
  toWatcherState,
  triggeredLabel,
  watcherDateLabel,
  watcherFilterCount,
  watcherToCriteria,
  WATCHER_COUNTRY_OPTIONS,
  WATCHER_FILTERS,
  WATCHER_LIMIT,
  type WatcherRow,
  type WatcherRowRaw,
  type WatcherState,
} from './watchers';

/**
 * La lógica pura de SRCH-03. Sin base y sin React.
 *
 * Esta capa la escribe Claude Code, no el Coder (`CLAUDE.md` §3), así que estos
 * tests **no son el contrato del arnés**: son los míos. Los cuatro ejemplos son los
 * de la spec §3 («Datos de ejemplo»).
 */

const NOW = new Date('2026-09-24T12:00:00Z');
const haceH = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

function row(partNumber: string, state: WatcherState, over: Partial<WatcherRow> = {}): WatcherRow {
  return {
    id: `w-${partNumber}`,
    partNumber,
    minQuantity: 100,
    brand: null,
    zone: null,
    country: null,
    emailChannel: false,
    state,
    createdAt: haceH(72),
    expiresAt: '2026-10-24T12:00:00Z',
    daysRemaining: null,
    renewalDaysLeft: null,
    triggeredAt: null,
    triggeredDistributor: null,
    triggeredQuantity: null,
    triggeredCountry: null,
    ...over,
  };
}

/** Spec §3, «Datos de ejemplo», en el orden en que los enumera. */
const EJEMPLO: WatcherRow[] = [
  row('6308-ZZ', 'ACTIVE', { zone: 'EU', emailChannel: true, daysRemaining: 27 }),
  row('NU2210-E-TVP2', 'TRIGGERED', {
    minQuantity: 50,
    brand: 'FAG',
    triggeredAt: haceH(2),
    triggeredDistributor: 'Schaeffler Iberia SL',
    triggeredQuantity: 120,
    triggeredCountry: 'ES',
  }),
  row('22316-E', 'PENDIENTE RENOVACIÓN', { minQuantity: 20, renewalDaysLeft: 2 }),
  row('7210-BECBP', 'PAUSED', { minQuantity: 10, brand: 'SKF', country: 'ES', daysRemaining: 12 }),
];

describe('filtros', () => {
  it('son seis, en el orden de la spec, y arranca en Todos', () => {
    expect(WATCHER_FILTERS.map((f) => f.label)).toEqual([
      'Todos',
      'Activos',
      'Pausados',
      'Disparados',
      'Pendientes de renovación',
      'Expirados',
    ]);
    expect(DEFAULT_WATCHER_FILTER).toBe('ALL');
  });

  it('cada chip deja pasar solo su estado', () => {
    expect(filterWatchers(EJEMPLO, 'ALL')).toHaveLength(4);
    expect(filterWatchers(EJEMPLO, 'ACTIVE').map((r) => r.partNumber)).toEqual(['6308-ZZ']);
    expect(filterWatchers(EJEMPLO, 'PAUSED').map((r) => r.partNumber)).toEqual(['7210-BECBP']);
    expect(filterWatchers(EJEMPLO, 'TRIGGERED').map((r) => r.partNumber)).toEqual(['NU2210-E-TVP2']);
    expect(filterWatchers(EJEMPLO, 'RENEWAL').map((r) => r.partNumber)).toEqual(['22316-E']);
    expect(filterWatchers(EJEMPLO, 'EXPIRED')).toEqual([]);
  });

  it('el contador de cada chip cuenta también a cero', () => {
    expect(WATCHER_FILTERS.map((f) => watcherFilterCount(EJEMPLO, f.key))).toEqual([4, 1, 1, 1, 1, 0]);
  });
});

describe('el contador X / 50', () => {
  it('spec §3: 4 watchers en la tabla, uno ACTIVE → `1 / 50`, no `4 / 50`', () => {
    // La spec de ejemplo dice «4 / 50 activos» con un ACTIVE, un TRIGGERED, un
    // PENDIENTE y un PAUSED: es la errata de siempre del mock (F-024). Manda el
    // criterio de `watcher-lifecycle`: cuentan los ACTIVE.
    expect(activeWatcherCount(EJEMPLO)).toBe(1);
    expect(activeCounterLabel(EJEMPLO)).toBe('1 / 50 watchers activos');
  });

  it('brass hasta 49 y rojo con 50 (spec §6)', () => {
    const cincuenta = Array.from({ length: WATCHER_LIMIT }, (_, i) => row(`R-${i}`, 'ACTIVE'));
    expect(counterTone(cincuenta.slice(1))).toBe('brass');
    expect(counterTone(cincuenta)).toBe('danger');
    expect(activeCounterLabel(cincuenta)).toBe('50 / 50 watchers activos');
  });

  it('sin watchers, `0 / 50`', () => {
    expect(activeCounterLabel([])).toBe('0 / 50 watchers activos');
  });
});

describe('etiquetas', () => {
  it('sinceLabel: días, horas y minutos', () => {
    expect(sinceLabel(haceH(72), NOW)).toBe('Hace 3 días');
    expect(sinceLabel(haceH(24), NOW)).toBe('Hace 1 día');
    expect(sinceLabel(haceH(2), NOW)).toBe('Hace 2 horas');
    expect(sinceLabel(haceH(1), NOW)).toBe('Hace 1 hora');
    expect(sinceLabel(new Date(NOW.getTime() - 5 * 60_000).toISOString(), NOW)).toBe('Hace unos minutos');
    expect(sinceLabel(null, NOW)).toBe('—');
  });

  it('daysLeftLabel: plural, singular y pausado', () => {
    expect(daysLeftLabel(27, false)).toBe('27 días restantes');
    expect(daysLeftLabel(1, false)).toBe('1 día restante');
    expect(daysLeftLabel(12, true)).toBe('12 días restantes (pausado)');
  });

  it('expiresInLabel', () => {
    expect(expiresInLabel(2)).toBe('Expira en: 2 días');
    expect(expiresInLabel(1)).toBe('Expira en: 1 día');
  });

  it('daysTone: naranja por debajo de 5, el 5 ya es normal', () => {
    expect(daysTone(4)).toBe('warn');
    expect(daysTone(0)).toBe('warn');
    expect(daysTone(5)).toBe('normal');
  });

  it('watcherDateLabel: `12 Sep 2026`, sin Intl', () => {
    expect(watcherDateLabel('2026-09-12T10:00:00Z')).toBe('12 Sep 2026');
    expect(watcherDateLabel('2025-12-28')).toBe('28 Dic 2025');
    expect(watcherDateLabel(null)).toBe('—');
  });

  it('conditionsLabel: los tres ejemplos de la spec, y país gana a zona', () => {
    expect(conditionsLabel(EJEMPLO[0]!)).toBe('Cantidad mín: 100 u · Marca: cualquiera · País: Europa');
    expect(conditionsLabel(EJEMPLO[1]!)).toBe('Cantidad mín: 50 u · Marca: FAG · País: cualquiera');
    expect(conditionsLabel(EJEMPLO[3]!)).toBe('Cantidad mín: 10 u · Marca: SKF · País: España');
    expect(conditionsLabel({ minQuantity: 5, brand: null, country: 'DE', zone: 'EU' })).toContain('País: Alemania');
  });

  it('triggeredLabel: solo en TRIGGERED, con distribuidor, cantidad y país', () => {
    expect(triggeredLabel(EJEMPLO[1]!)).toBe('Stock detectado el 24 Sep 2026 — Schaeffler Iberia SL · 120 u · ES');
    expect(triggeredLabel(EJEMPLO[0]!)).toBeNull();
  });
});

describe('«Ver resultados»: los criterios que precarga SRCH-01', () => {
  it('lleva referencia, marca, cantidad mínima, zona y país', () => {
    expect(watcherToCriteria(EJEMPLO[3]!)).toEqual({
      partNumber: '7210-BECBP',
      brand: 'SKF',
      minQuantity: 10,
      zone: null,
      country: 'ES',
      maxLeadTimeDays: null,
    });
  });

  it('lo que el watcher no fija queda vacío, no `null` disfrazado de texto', () => {
    expect(watcherToCriteria(EJEMPLO[0]!)).toMatchObject({ brand: '', country: '', zone: 'EU' });
  });
});

describe('formulario Editar (spec §4)', () => {
  it('referencia: mínimo 2 caracteres, recortada', () => {
    expect(isValidWatcherRef('6')).toBe(false);
    expect(isValidWatcherRef(' 6 ')).toBe(false);
    expect(isValidWatcherRef('63')).toBe(true);
  });

  it('cantidad: entero positivo', () => {
    for (const malo of ['', '0', '-3', '1.5', 'abc', '1e3']) {
      expect(isValidWatcherQuantity(malo), malo).toBe(false);
    }
    expect(isValidWatcherQuantity('100')).toBe(true);
    expect(isValidWatcherQuantity(' 7 ')).toBe(true);
  });

  it('el borrador nace de la fila y solo los dos obligatorios lo invalidan', () => {
    const d = draftFromRow(EJEMPLO[3]!);
    expect(d).toEqual({ partNumber: '7210-BECBP', minQuantity: '10', brand: 'SKF', country: 'ES', emailChannel: false });
    expect(isValidWatcherDraft(d)).toBe(true);
    expect(isValidWatcherDraft({ ...d, brand: '', country: '' })).toBe(true);
    expect(isValidWatcherDraft({ ...d, partNumber: '' })).toBe(false);
    expect(isValidWatcherDraft({ ...d, minQuantity: '0' })).toBe(false);
  });
});

describe('toWatcherRow', () => {
  const raw: WatcherRowRaw = {
    id: 'x',
    part_number: '22316-E',
    min_quantity: 20,
    brand: null,
    zone: 'XX',
    country: 'es',
    email_channel: true,
    status: 'PENDIENTE RENOVACION',
    created_at: '2026-08-20T10:00:00Z',
    expires_at: '2026-09-19T10:00:00Z',
    days_remaining: null,
    renewal_days_left: 2,
    triggered_at: null,
    triggered_distributor: null,
    triggered_quantity: null,
    triggered_country: null,
  };

  it('traduce el estado de la base al literal de la spec, con tilde', () => {
    expect(toWatcherRow(raw).state).toBe('PENDIENTE RENOVACIÓN');
    expect(toWatcherState('ACTIVE')).toBe('ACTIVE');
    expect(toWatcherState('EXPIRED')).toBe('EXPIRED');
  });

  it('el país en mayúsculas y una zona desconocida se descarta', () => {
    const r = toWatcherRow(raw);
    expect(r.country).toBe('ES');
    expect(r.zone).toBeNull();
    expect(r.renewalDaysLeft).toBe(2);
  });
});

describe('sortWatchers', () => {
  it('los más recientes primero, desempate por referencia', () => {
    const a = row('B', 'ACTIVE', { createdAt: '2026-09-01T00:00:00Z' });
    const b = row('A', 'ACTIVE', { createdAt: '2026-09-01T00:00:00Z' });
    const c = row('C', 'ACTIVE', { createdAt: '2026-09-10T00:00:00Z' });
    expect(sortWatchers([a, b, c]).map((r) => r.partNumber)).toEqual(['C', 'A', 'B']);
  });
});

describe('WATCHER_COUNTRY_OPTIONS', () => {
  it('son los 249 códigos ISO, sin duplicados, y todos tienen nombre en español (no el código)', () => {
    expect(WATCHER_COUNTRY_OPTIONS).toHaveLength(249);
    expect(new Set(WATCHER_COUNTRY_OPTIONS.map((o) => o.code)).size).toBe(249);
    const sinNombre = WATCHER_COUNTRY_OPTIONS.filter((o) => o.label === o.code).map((o) => o.code);
    expect(sinNombre).toEqual([]);
  });

  it('España y Alemania con su nombre, y ordenados por nombre', () => {
    expect(WATCHER_COUNTRY_OPTIONS.find((o) => o.code === 'ES')?.label).toBe('España');
    expect(WATCHER_COUNTRY_OPTIONS.find((o) => o.code === 'DE')?.label).toBe('Alemania');
    const nombres = WATCHER_COUNTRY_OPTIONS.map((o) => o.label);
    expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b, 'es')));
  });
});
