import { describe, expect, it } from 'vitest';
import {
  addressLines,
  favoritesLabel,
  memberSinceLabel,
  organizationInitials,
  statusBadge,
  telHref,
  toOrganizationProfile,
  type OrganizationProfileRaw,
} from './organization';

/**
 * La lógica pura de DIR-02. Sin base y sin React.
 *
 * Esta capa la escribe Claude Code, no el Coder (`CLAUDE.md` §3), así que estos
 * tests **no son el contrato del arnés**: son los míos. Los ejemplos son los del
 * HTML aprobado (`NSK Europe Ltd`).
 */

const RAW: OrganizationProfileRaw = {
  id: 'o-1',
  name: 'NSK Europe Ltd',
  country: 'DE',
  status: 'APPROVED',
  created_at: '2024-02-15T10:00:00Z',
  address: 'Heinrich-Hertz-Strasse 1',
  city: 'Erkrath',
  postal_code: '40699',
  contact_phone: '+49 211 5288 0',
  contact_email: 'contact@nskeurope.de',
  favorite_count: 21,
};

describe('memberSinceLabel', () => {
  it('«Febrero 2024»: mes con inicial mayúscula y año, sin «de»', () => {
    expect(memberSinceLabel('2024-02-15T10:00:00Z')).toBe('Febrero 2024');
  });

  it('lee en UTC: el uno de enero a las 00:00Z sigue siendo enero', () => {
    expect(memberSinceLabel('2026-01-01T00:00:00Z')).toBe('Enero 2026');
    expect(memberSinceLabel('2025-12-31T23:59:59Z')).toBe('Diciembre 2025');
  });

  it('una fecha ilegible da cadena vacía, no «undefined NaN»', () => {
    expect(memberSinceLabel('no es una fecha')).toBe('');
  });
});

describe('organizationInitials', () => {
  it('una sigla de dos a cuatro letras en mayúsculas es la sigla entera', () => {
    expect(organizationInitials('NSK Europe Ltd')).toBe('NSK');
    expect(organizationInitials('SKF Ibérica')).toBe('SKF');
  });

  it('si no, la inicial de las dos primeras palabras', () => {
    expect(organizationInitials('Rodamientos Ibéricos')).toBe('RI');
    expect(organizationInitials('Łożyska Wschód')).toBe('ŁW');
    expect(organizationInitials('Cuscinetti Padana')).toBe('CP');
  });

  it('una sola palabra en minúsculas da su inicial; un nombre vacío, nada', () => {
    expect(organizationInitials('timken')).toBe('T');
    expect(organizationInitials('   ')).toBe('');
  });
});

describe('favoritesLabel', () => {
  it('«★ 21 favoritos», y en singular «★ 1 favorito»', () => {
    expect(favoritesLabel(21)).toBe('★ 21 favoritos');
    expect(favoritesLabel(1)).toBe('★ 1 favorito');
    expect(favoritesLabel(0)).toBe('★ 0 favoritos');
  });

  it('un contador negativo no se pinta negativo', () => {
    expect(favoritesLabel(-3)).toBe('★ 0 favoritos');
  });
});

describe('statusBadge', () => {
  it('APPROVED se pinta ACTIVA; cualquier otro estado, tal cual', () => {
    expect(statusBadge('APPROVED')).toBe('ACTIVA');
    expect(statusBadge('SUSPENDED')).toBe('SUSPENDED');
  });
});

describe('addressLines', () => {
  it('calle y, debajo, código postal y ciudad', () => {
    expect(addressLines({ address: 'Heinrich-Hertz-Strasse 1', postalCode: '40699', city: 'Erkrath' })).toEqual([
      'Heinrich-Hertz-Strasse 1',
      '40699 Erkrath',
    ]);
  });

  it('lo que falta se omite sin dejar huecos', () => {
    expect(addressLines({ address: 'Calle Industria 14', postalCode: null, city: null })).toEqual([
      'Calle Industria 14',
    ]);
    expect(addressLines({ address: null, postalCode: '41013', city: null })).toEqual(['41013']);
    expect(addressLines({ address: '  ', postalCode: '', city: 'Sevilla' })).toEqual(['Sevilla']);
  });

  it('sin nada, la lista vacía', () => {
    expect(addressLines({ address: null, postalCode: null, city: null })).toEqual([]);
  });
});

describe('telHref', () => {
  it('conserva el + inicial y quita espacios y signos', () => {
    expect(telHref('+49 211 5288 0')).toBe('tel:+4921152880');
    expect(telHref('954 123 456')).toBe('tel:954123456');
    expect(telHref('+34 (954) 12-34-56')).toBe('tel:+34954123456');
  });
});

describe('toOrganizationProfile', () => {
  it('mapea la fila completa del ejemplo aprobado', () => {
    const p = toOrganizationProfile(RAW);
    expect(p).toMatchObject({
      id: 'o-1',
      name: 'NSK Europe Ltd',
      initials: 'NSK',
      countryLabel: 'Alemania',
      addressLines: ['Heinrich-Hertz-Strasse 1', '40699 Erkrath'],
      postalCode: '40699',
      memberSince: 'Febrero 2024',
      phone: '+49 211 5288 0',
      email: 'contact@nskeurope.de',
      favoriteCount: 21,
      status: 'ACTIVA',
    });
  });

  it('los nulos se normalizan una sola vez: cadena vacía y cero, nunca null', () => {
    const p = toOrganizationProfile({
      ...RAW,
      address: null,
      city: null,
      postal_code: null,
      contact_phone: null,
      contact_email: null,
      favorite_count: null,
    });
    expect(p.address).toBe('');
    expect(p.city).toBe('');
    expect(p.postalCode).toBe('');
    expect(p.addressLines).toEqual([]);
    expect(p.phone).toBe('');
    expect(p.email).toBe('');
    expect(p.favoriteCount).toBe(0);
  });
});
