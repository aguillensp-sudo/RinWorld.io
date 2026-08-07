#!/usr/bin/env node
/**
 * Cobertura de tokens · comprueba que ningún color de los HTML aprobados de
 * pantalla clara del MVP se queda sin token en src/styles/tokens.css.
 *
 * Por qué existe: al definir §1.4 y §1.5 me dejé cuatro colores fuera y solo
 * salieron al comprobarlo a máquina. Si el catálogo de tokens se queda corto, el
 * Coder no tiene más salida que escribir un hex — y entonces C3 falla por un
 * hueco del sistema de diseño, no por un fallo suyo. Eso es lo que pasó en SP-1
 * (F-003).
 *
 * NO es el check de paleta del Test-runner (día 4). Ese mira el output del Coder;
 * este mira si el sistema de diseño está completo. Son las dos mitades del mismo
 * problema, y este tiene que estar verde para que el otro sea justo.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const approved = join(repo, 'openspec', 'design-gui', 'specs y html aprobados');

/** Las seis pantallas claras del alcance (Plan §9). El shell va aparte: es oscuro. */
const SCREENS = ['PANEL-01', 'INV-01', 'SRCH-01', 'MSG-01', 'MSG-02', 'VND-01'];

/**
 * Excluidos a propósito, documentados en design-system.md §1.4: valores de un
 * solo uso que parecen deriva del set aprobado, no decisiones. Si alguno hace
 * falta al convertir su pantalla, se sustituye por el token equivalente. Añadir
 * algo aquí es una decisión de diseño: hay que justificarla en §1.4.
 */
const ALLOWED_DRIFT = new Map([
  ['#2d3748', 'SRCH-01 · gris azulado de un solo uso'],
  ['#e2e8f0', 'SRCH-01 · gris azulado de un solo uso'],
  ['#fafbff', 'MSG-01 · tinte casi blanco de un solo uso'],
  ['#f5f7ff', 'VND-01 · tinte casi blanco de un solo uso'],
]);

/** Blanco puro y el histórico documentado en §1.1 como "no se usa". */
const IGNORED = new Set(['#fff', '#ffffff', '#111827']);

const HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;

const tokens = readFileSync(join(here, '..', 'src', 'styles', 'tokens.css'), 'utf8');
const defined = new Set((tokens.match(HEX) ?? []).map((h) => h.toLowerCase()));

const files = readdirSync(approved).filter(
  (f) => f.endsWith('.html') && SCREENS.some((s) => f.startsWith(`${s} `)),
);

if (files.length !== SCREENS.length) {
  console.error(
    `✗ Esperaba ${SCREENS.length} pantallas y encontré ${files.length}. ` +
      `¿Han cambiado de nombre los HTML aprobados? Encontradas: ${files.join(', ')}`,
  );
  process.exit(1);
}

const missing = new Map();
for (const file of files) {
  const screen = file.split(' ')[0];
  const html = readFileSync(join(approved, file), 'utf8');
  for (const raw of html.match(HEX) ?? []) {
    const hex = raw.toLowerCase();
    if (defined.has(hex) || IGNORED.has(hex) || ALLOWED_DRIFT.has(hex)) continue;
    if (!missing.has(hex)) missing.set(hex, new Set());
    missing.get(hex).add(screen);
  }
}

if (missing.size > 0) {
  console.error('✗ Colores de los HTML aprobados sin token en tokens.css:\n');
  for (const [hex, screens] of [...missing].sort()) {
    console.error(`   ${hex}  ← ${[...screens].sort().join(', ')}`);
  }
  console.error(
    '\n  Cada uno necesita un token en design-system.md §1.4 o §1.5 (con su rol real,\n' +
      '  verificado en el HTML) y su variable en tokens.css. Si es deriva de un solo uso,\n' +
      '  documéntalo en ALLOWED_DRIFT y en §1.4 — pero justifícalo.',
  );
  process.exit(1);
}

console.log(
  `✓ Cobertura completa: los colores de las ${files.length} pantallas claras están ` +
    `todos en tokens.css (${ALLOWED_DRIFT.size} excluidos a propósito).`,
);
