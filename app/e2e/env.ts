import dotenv from 'dotenv';

/**
 * Carga .env, y tiene que importarse ANTES de cualquier módulo que lea
 * process.env.
 *
 * Existe por un error real: `dotenv.config()` estaba en el cuerpo de
 * playwright.config.ts, pero los imports de un módulo ES se evalúan antes que su
 * cuerpo, así que fixtures.ts leía process.env cuando aún estaba vacío. Resultado:
 * `haveCreds` falso, los seis tests de la puerta saltados y un resumen que decía
 * "3 passed" sin haber probado nada de lo que el día 2 tenía que demostrar.
 *
 * Como módulo aparte, el orden queda garantizado: quien lo necesita lo importa
 * primero.
 */
dotenv.config({ quiet: true });
