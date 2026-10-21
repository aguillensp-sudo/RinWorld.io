/**
 * Paridad de migraciones (F-277) · la comparación, con listas falsas y sin red.
 * Un escenario por caso: todo cuadra, falta en e2e, falta en producción, aplicada
 * sin fichero, y las tres formas de registrar una versión que hay de verdad en las
 * dos bases (comprobado el 21-oct-2026).
 */
import { describe, it, expect } from 'vitest';
import {
  leerRegistrada,
  compararBase,
  comprobarParidad,
  mensajes,
} from './paridad-migraciones-lib.mjs';

const FICHEROS = ['0001_organizations.sql', '0002_inventory.sql', '0003_threads.sql', 'README.md'];

// Las tres formas en uso: número como versión, número en el nombre, sin número.
const PROD = [
  { version: '0001', name: 'organizations' },
  { version: '20261020164853', name: '0002_inventory' },
  { version: '20261012062333', name: 'threads' },
];
const E2E = [
  { version: '20260906111937', name: '0001_organizations' },
  { version: '20260906112024', name: '0002_inventory' },
  { version: '20260906112122', name: '0003_threads' },
];

const bases = (prod, e2e) => [
  { nombre: 'produccion', registradas: prod },
  { nombre: 'e2e', registradas: e2e },
];

describe('leerRegistrada', () => {
  it('saca el número de la versión de cuatro cifras, del nombre o de ninguno', () => {
    expect(leerRegistrada(PROD[0])).toMatchObject({ numero: '0001', resto: 'organizations' });
    expect(leerRegistrada(PROD[1])).toMatchObject({ numero: '0002', resto: 'inventory' });
    expect(leerRegistrada(PROD[2])).toMatchObject({ numero: null, resto: 'threads' });
    expect(leerRegistrada({ version: '1', name: '0035b_watchers_x' })).toMatchObject({ numero: '0035b' });
  });
});

describe('comprobarParidad', () => {
  it('todo cuadra: ok y ningún mensaje', () => {
    const r = comprobarParidad({ ficheros: FICHEROS, bases: bases(PROD, E2E) });
    expect(r.ok).toBe(true);
    expect(mensajes(r)).toEqual([]);
  });

  it('falta en e2e: dice qué migración y en qué base', () => {
    const r = comprobarParidad({ ficheros: FICHEROS, bases: bases(PROD, E2E.slice(0, 2)) });
    expect(r.ok).toBe(false);
    expect(r.pendientes).toEqual([{ tipo: 'falta', base: 'e2e', migracion: '0003_threads' }]);
    const [m] = mensajes(r, { e2e: 'ogdhyzgjjbbikjbkhxmu' });
    expect(m).toContain('FALTA en e2e (ogdhyzgjjbbikjbkhxmu)');
    expect(m).toContain('0003_threads.sql');
  });

  it('falta en producción', () => {
    const r = comprobarParidad({ ficheros: FICHEROS, bases: bases(PROD.slice(1), E2E) });
    expect(r.pendientes).toEqual([{ tipo: 'falta', base: 'produccion', migracion: '0001_organizations' }]);
    expect(mensajes(r)[0]).toMatch(/^FALTA en produccion: 0001_organizations\.sql/);
  });

  it('aplicada en una base y sin fichero en el repo', () => {
    const extra = { version: '20260805104206', name: 'spike_suelto' };
    const r = comprobarParidad({ ficheros: FICHEROS, bases: bases([...PROD, extra], E2E) });
    expect(r.pendientes).toEqual([
      { tipo: 'sobra', base: 'produccion', migracion: 'spike_suelto', version: '20260805104206' },
    ]);
    expect(mensajes(r)[0]).toContain('SIN FICHERO en produccion: «spike_suelto»');
  });

  it('mismo número con otro nombre es otra migración, y se avisa', () => {
    const r = compararBase('e2e', FICHEROS, [...E2E.slice(0, 2), { version: '9', name: '0003_otra_cosa' }]);
    expect(r).toEqual([{ tipo: 'nombre', base: 'e2e', migracion: '0003_threads', registrada: '0003_otra_cosa' }]);
  });

  it('una diferencia con excepción no falla; una excepción que ya no se da, sí', () => {
    const exc = [{ tipo: 'falta', base: 'e2e', migracion: '0003_threads', motivo: 'x' }];
    const aceptada = comprobarParidad({ ficheros: FICHEROS, bases: bases(PROD, E2E.slice(0, 2)), excepciones: exc });
    expect(aceptada).toMatchObject({ ok: true, aceptadas: 1 });

    const caducada = comprobarParidad({ ficheros: FICHEROS, bases: bases(PROD, E2E), excepciones: exc });
    expect(caducada.ok).toBe(false);
    expect(mensajes(caducada)[0]).toContain('EXCEPCIÓN CADUCADA');
  });

  it('una base vacía (token sin permiso, tabla ilegible) falla con todo lo que le falta', () => {
    const r = comprobarParidad({ ficheros: FICHEROS, bases: bases(PROD, []) });
    expect(r.ok).toBe(false);
    expect(r.pendientes.filter((d) => d.base === 'e2e')).toHaveLength(3);
  });
});
