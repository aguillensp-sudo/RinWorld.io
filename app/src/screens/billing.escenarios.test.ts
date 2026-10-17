import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ESCENARIOS · billing-subscription/expiration-warning
 *
 * Escrito desde la spec: los datos bancarios existen ÚNICAMENTE en el contenido
 * del email de aviso; el Administrador no los encuentra en ningún banner,
 * pantalla ni componente visible.
 *
 * Alcance honesto del unit: se recorre TODO el código de pantallas y componentes
 * entregado a la interfaz (ficheros .tsx que no son de prueba) buscando un dato
 * bancario (IBAN, BIC/SWIFT, número de cuenta, "datos bancarios"). Cubre la
 * mitad "no aparece en ninguna pantalla"; la mitad "existe en el email" no se
 * puede ejercitar aquí porque el email de aviso no está implementado.
 */

function ficherosTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return ficherosTsx(ruta);
    return /\.tsx$/.test(nombre) && !/\.test\.tsx$/.test(nombre) ? [ruta] : [];
  });
}

/** Sin comentarios: la documentación puede hablar de IBAN; la interfaz, no. */
function sinComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const DATO_BANCARIO =
  /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,}\b|\bIBAN\b|\bBIC\b|\bSWIFT\b|n[úu]mero de cuenta|datos bancarios|cuenta bancaria/;

describe('billing-subscription/expiration-warning', () => {
  it('billing-subscription/expiration-warning#2 · datos bancarios exclusivos del canal email', () => {
    // GIVEN el aviso de vencimiento enviado a un Administrador de Organización
    // WHEN busca los datos bancarios en cualquier pantalla
    const raiz = resolve(process.cwd(), 'src');
    const ficheros = ficherosTsx(raiz);
    expect(ficheros.length).toBeGreaterThan(20); // el recorrido ve las pantallas de verdad

    // THEN no los encuentra en ningún banner, pantalla o componente visible
    const encontrados = ficheros
      .map((f) => ({ f, m: sinComentarios(readFileSync(f, 'utf8')).match(DATO_BANCARIO) }))
      .filter((x) => x.m)
      .map((x) => `${x.f}: ${x.m![0]}`);
    expect(encontrados).toEqual([]);
  });
});
