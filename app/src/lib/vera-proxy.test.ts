import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Contrato de la Edge Function proxy.
 *
 * **Se verifica leyendo su fuente, y eso es una limitación declarada, no un
 * descuido:** la función es Deno y no se puede importar desde vitest, así que
 * esto comprueba que las decisiones del día 9 están ESCRITAS en ella — no que se
 * comporten. Lo segundo solo lo prueba una corrida real contra Sonnet, y esa
 * está bloqueada por D-09-04 (el secret).
 *
 * Cada aserto negativo sobre un literal lleva su control positivo (F-066).
 */

const aqui = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(aqui, '../../../supabase/functions/vera');
const fuente = readFileSync(resolve(DIR, 'index.ts'), 'utf8');
const toolsJson = readFileSync(resolve(DIR, 'tools.json'), 'utf8');

/** La frase de D-09-02 (a), verbatim y con sus acentos (F-048). */
const NO_PUEDO_LEER =
  'No puedo leer el contenido de los hilos: va cifrado y el servidor no tiene la clave.';

describe('la clave de VERA no llega al navegador', () => {
  it('la lee del entorno de Supabase, no de la petición', () => {
    expect(fuente).toContain("Deno.env.get('ANTHROPIC_API_KEY')");
  });

  /**
   * Este aserto pedía el literal `x-api-key`, que daba por hecho un `fetch` a
   * mano. La implementación usa el SDK oficial —que arma la cabecera él— así que
   * comprueba lo mismo por su camino: **el valor de la clave va al constructor
   * del SDK y a ningún otro sitio**. El ancla positiva sigue ahí, que es lo que
   * impide que un fichero vacío pase.
   */
  it('la pasa al SDK y no la escribe en el fichero', () => {
    expect(fuente).toMatch(/new Anthropic\(\{\s*apiKey:/);
    expect(fuente).not.toContain('sk-ant-');
  });

  it('CONTROL POSITIVO de F-066: el detector SÍ marca una clave escrita', () => {
    expect('const k = "sk-ant-api03-xxxx"').toContain('sk-ant-');
  });

  it('exige Authorization en la petición: actúa con los permisos del usuario', () => {
    expect(fuente).toContain('Authorization');
  });
});

describe('el modelo está fijo por contrato (QA-A00-06)', () => {
  it('es Sonnet 4.6, con el identificador exacto', () => {
    expect(fuente).toContain('claude-sonnet-4-6');
  });

  it('el cliente no puede elegir modelo', () => {
    // Ancla positiva: el modelo se declara en la función…
    expect(fuente).toMatch(/model:\s*MODELO/);
    // …y no sale de nada que venga en el cuerpo de la petición.
    expect(fuente).not.toMatch(/model:\s*(body|payload|entrada|req)\./);
  });

  it('CONTROL POSITIVO de F-066: el detector SÍ marca un modelo tomado del cuerpo', () => {
    expect('model: body.model,').toMatch(/model:\s*(body|payload|entrada|req)\./);
  });
});

describe('prompt caching desde el primer commit (CLAUDE.md §5)', () => {
  it('el bloque estático del system prompt lleva cache_control efímero', () => {
    expect(fuente).toContain('cache_control');
    expect(fuente).toContain('ephemeral');
  });
});

describe('el system prompt lleva las reglas que deciden el riesgo #1', () => {
  it('dice que responda exclusivamente desde el retorno de sus herramientas', () => {
    expect(fuente).toMatch(/exclusivamente desde el retorno de tus herramientas/i);
  });

  it('lleva la frase de D-09-02 (a) verbatim, con sus acentos', () => {
    expect(fuente).toContain(NO_PUEDO_LEER);
  });

  it('se llama Bearingworld.io y nunca Rinworld (CLAUDE.md §1.2)', () => {
    // Las dos mitades en el mismo aserto: el nombre bueno ESTÁ y el prohibido
    // no. Separadas, la negativa la pasaba un fichero vacío.
    expect(fuente).toContain('Bearingworld.io');
    expect(fuente).not.toContain('Rinworld');
  });

  it('CONTROL POSITIVO de F-066: el detector SÍ marca el nombre prohibido', () => {
    expect('Soy VERA, de Rinworld.').toContain('Rinworld');
  });
});

describe('las herramientas vienen de tools.json, no duplicadas a mano', () => {
  const NOMBRES = ['buscar_en_catalogo', 'consultar_mi_inventario', 'listar_mis_hilos'];

  it('importa el fichero y no repite sus nombres como literales', () => {
    // Ancla positiva primero, por lo mismo que arriba.
    expect(fuente).toContain('tools.json');
    for (const n of NOMBRES) {
      expect(fuente).not.toContain(`"${n}"`);
      expect(fuente).not.toContain(`'${n}'`);
    }
  });

  it('CONTROL POSITIVO de F-066: esos nombres SÍ están en tools.json', () => {
    for (const n of NOMBRES) {
      expect(toolsJson).toContain(`"${n}"`);
    }
  });
});
