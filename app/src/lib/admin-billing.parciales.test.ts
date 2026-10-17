import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as adminBilling from './admin-billing';

/**
 * PARCIALES · billing-subscription (trial-period#1, automatic-suspension#4)
 *
 * Escritos desde la spec (`openspec/specs/billing-subscription/spec.md`), no
 * desde la implementación. Recorren el código fuente entregado a la interfaz.
 */

const RAIZ = resolve(process.cwd(), 'src');

function fuentes(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return fuentes(ruta);
    return /\.(ts|tsx)$/.test(nombre) && !/\.test\.(ts|tsx)$/.test(nombre) ? [ruta] : [];
  });
}

function sinComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const esDeOperador = (ruta: string) => {
  const rel = relative(RAIZ, ruta).replace(/\\/g, '/');
  return rel.startsWith('screens/admin/') || rel === 'lib/admin-billing.ts';
};

describe('billing-subscription (parciales)', () => {
  it('billing-subscription/trial-period#1 · el código de miembro no tiene ninguna puerta de cobro: solo el panel del Operador toca billing', () => {
    // GIVEN una organización recién aprobada (EN PRUEBA, 90 días)
    // WHEN cualquier usuario de esa organización accede a la plataforma
    // THEN tiene acceso completo: ninguna pantalla ni capa de datos de miembro
    //      consulta tablas/vistas/funciones de cobro ni compara con el estado EN PRUEBA
    // AND no se le presenta requerimiento de pago ni bloqueo
    const ficheros = fuentes(RAIZ);
    expect(ficheros.length).toBeGreaterThan(50);
    const delOperador = ficheros.filter(esDeOperador);
    expect(delOperador.length).toBeGreaterThan(3); // el recorrido sí ve el panel del Operador

    const PUERTA = /billing_|['"]EN PRUEBA['"]|trial_ends_at|current_period_ends_at|suspended_since/;
    const infractores = ficheros
      .filter((f) => !esDeOperador(f))
      .filter((f) => PUERTA.test(sinComentarios(readFileSync(f, 'utf8'))))
      .map((f) => relative(RAIZ, f));
    expect(infractores).toEqual([]);

    // y la regla de revocación de sesión no mira el cobro: se alimenta del estado del MIEMBRO
    const session = sinComentarios(readFileSync(join(RAIZ, 'lib/session.ts'), 'utf8'));
    expect(session).not.toMatch(/billing|EN PRUEBA|trial/i);
  });

  it('billing-subscription/automatic-suspension#4 · la capa de datos del Operador no ofrece ninguna acción de extensión ni prórroga', () => {
    // GIVEN un operador que considera justificado dar más tiempo a una organización
    // WHEN busca un mecanismo para extender manualmente el plazo
    // THEN el sistema no ofrece ninguna acción de extensión o prórroga
    // AND todas las organizaciones se rigen por el mismo cálculo automático
    const exportadas = Object.keys(adminBilling);
    expect(exportadas.filter((n) => /extend|extens|prorrog|pr[oó]rroga|grace|gracia|ampli|aplaz|postpone|defer/i.test(n))).toEqual([]);

    // las únicas escrituras contra la base son el pago confirmado y la suspensión manual
    const rpcs = new Set<string>();
    for (const f of fuentes(RAIZ)) {
      const src = sinComentarios(readFileSync(f, 'utf8'));
      for (const m of src.matchAll(/\.rpc\(\s*['"]([a-z_0-9]+)['"]/g)) {
        if (m[1] && /billing|trial|period|suspend|subscri/i.test(m[1])) rpcs.add(m[1]);
      }
    }
    expect([...rpcs].sort()).toEqual(['billing_confirm_payment', 'billing_suspend_organization']);

    // y el cálculo es uno solo: el vencimiento tras un pago es siempre pago + 365 días, sin parámetro de excepción
    expect(adminBilling.renewalDate.length).toBe(1);
    expect(adminBilling.renewalDate('2026-01-10')).toBe('2027-01-10'); // 365 días exactos (2026 no es bisiesto)
  });
});
