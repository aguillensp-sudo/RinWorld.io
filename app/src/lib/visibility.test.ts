import { describe, expect, it } from 'vitest';
import {
  canManageVisibility,
  CONTINENT_OPTIONS,
  filterOrgCandidates,
  groupExclusions,
  isAlreadyExcluded,
  toExclusion,
  VISIBILITY_MODES,
  type Exclusion,
  type ExclusionRowRaw,
  type OrgCandidate,
} from './visibility';

/**
 * La lógica pura de INV-07. Sin base y sin React.
 *
 * Esta capa la escribe Claude Code, no el Coder (`CLAUDE.md` §3), así que estos
 * tests **no son el contrato del arnés**: son los míos. Los ejemplos son los de la
 * spec §3 («Datos de ejemplo»).
 */

const raw = (over: Partial<ExclusionRowRaw>): ExclusionRowRaw => ({
  id: 'x',
  excluded_org_id: null,
  excluded_country: null,
  excluded_continent: null,
  organizations: null,
  ...over,
});

/** Spec §3: `[Rodamientos Express SL ×] [Nordic Bearings AB ×]` y `[Asia ×] [Rusia ×]`. */
const EJEMPLO: Exclusion[] = [
  toExclusion(raw({ id: '1', excluded_org_id: 'o-nordic', organizations: { name: 'Nordic Bearings AB' } })),
  toExclusion(raw({ id: '2', excluded_continent: 'AS' })),
  toExclusion(raw({ id: '3', excluded_org_id: 'o-express', organizations: { name: 'Rodamientos Express SL' } })),
  toExclusion(raw({ id: '4', excluded_country: 'ru' })),
];

describe('modos', () => {
  it('son dos, con los literales de la spec, y el primero es el defecto', () => {
    expect(VISIBILITY_MODES.map((m) => m.value)).toEqual(['VISIBLE_TODOS', 'RESTRINGIDA']);
    expect(VISIBILITY_MODES[0]).toMatchObject({
      label: 'Visible para todos los miembros',
      description: 'Cualquier distribuidor verificado en la plataforma puede consultar tu stock',
    });
    expect(VISIBILITY_MODES[1]).toMatchObject({
      label: 'Visibilidad restringida',
      description: 'Solo miembros no excluidos explícitamente pueden ver tu inventario',
    });
  });

  it('solo el ADMIN gestiona', () => {
    expect(canManageVisibility('ADMIN')).toBe(true);
    expect(canManageVisibility('EDITOR')).toBe(false);
  });
});

describe('continentes', () => {
  it('seis, en el orden de la spec y sin Antártida', () => {
    expect(CONTINENT_OPTIONS.map((c) => c.label)).toEqual([
      'Europa',
      'Asia',
      'América del Norte',
      'América del Sur',
      'África',
      'Oceanía',
    ]);
    expect(CONTINENT_OPTIONS.map((c) => c.code)).not.toContain('AN');
  });
});

describe('toExclusion y groupExclusions', () => {
  it('traduce cada tipo a su etiqueta: nombre, continente o país en español', () => {
    expect(EJEMPLO.map((e) => [e.kind, e.label])).toEqual([
      ['ORG', 'Nordic Bearings AB'],
      ['CONTINENT', 'Asia'],
      ['ORG', 'Rodamientos Express SL'],
      ['COUNTRY', 'Rusia'],
    ]);
    expect(EJEMPLO[3]?.country).toBe('RU');
  });

  it('separa organizaciones de geografía y ordena por etiqueta', () => {
    const { orgs, geo } = groupExclusions(EJEMPLO);
    expect(orgs.map((e) => e.label)).toEqual(['Nordic Bearings AB', 'Rodamientos Express SL']);
    expect(geo.map((e) => e.label)).toEqual(['Asia', 'Rusia']);
  });

  it('una organización borrada no rompe la lista', () => {
    expect(toExclusion(raw({ excluded_org_id: 'o-x' })).label).toBe('Organización desconocida');
  });
});

describe('filterOrgCandidates', () => {
  const TODAS: OrgCandidate[] = [
    { id: 'me', name: 'Rodamientos Ibéricos', country: 'ES' },
    { id: 'o-nordic', name: 'Nordic Bearings AB', country: 'SE' },
    { id: 'o-nordwalz', name: 'Nordwälz Lager', country: 'DE' },
    { id: 'o-express', name: 'Rodamientos Express SL', country: 'ES' },
  ];

  it('busca sin tildes ni mayúsculas', () => {
    expect(filterOrgCandidates(TODAS, 'NORDWALZ', [], 'me').map((o) => o.id)).toEqual(['o-nordwalz']);
  });

  it('encuentra `Łożyska Wschód` escribiendo `lozyska` (la Ł no se descompone con NFD)', () => {
    const polaca = [...TODAS, { id: 'o-lozyska', name: 'Łożyska Wschód', country: 'PL' }];
    expect(filterOrgCandidates(polaca, 'lozyska', [], 'me').map((o) => o.id)).toEqual(['o-lozyska']);
    expect(filterOrgCandidates(polaca, 'ŁOŻYSKA', [], 'me').map((o) => o.id)).toEqual(['o-lozyska']);
    expect(filterOrgCandidates(polaca, 'wschod', [], 'me').map((o) => o.id)).toEqual(['o-lozyska']);
  });

  it('no ofrece la propia organización ni las ya excluidas', () => {
    expect(filterOrgCandidates(TODAS, 'rodamientos', EJEMPLO, 'me').map((o) => o.id)).toEqual([]);
    expect(filterOrgCandidates(TODAS, 'nord', EJEMPLO, 'me').map((o) => o.id)).toEqual(['o-nordwalz']);
  });

  it('sin texto no ofrece nada, y como mucho ocho', () => {
    expect(filterOrgCandidates(TODAS, '  ', [], 'me')).toEqual([]);
    const muchas = Array.from({ length: 20 }, (_, i) => ({ id: `o${i}`, name: `Acme ${i}`, country: 'ES' }));
    expect(filterOrgCandidates(muchas, 'acme', [], 'me')).toHaveLength(8);
  });
});

describe('isAlreadyExcluded', () => {
  it('detecta organización, continente y país repetidos', () => {
    expect(isAlreadyExcluded(EJEMPLO, { orgId: 'o-nordic' })).toBe(true);
    expect(isAlreadyExcluded(EJEMPLO, { continent: 'AS' })).toBe(true);
    expect(isAlreadyExcluded(EJEMPLO, { country: 'RU' })).toBe(true);
    expect(isAlreadyExcluded(EJEMPLO, { continent: 'EU' })).toBe(false);
    expect(isAlreadyExcluded(EJEMPLO, { country: 'JP' })).toBe(false);
  });
});
