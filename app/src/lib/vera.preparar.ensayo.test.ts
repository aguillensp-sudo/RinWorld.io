/**
 * ENSAYO · VERA prepara consultas y ofertas (MSG-03 §5, F-249) contra la función desplegada
 * =============================================================================
 *
 *     VERA_PREPARAR=1 npx vitest run src/lib/vera.preparar.ensayo.test.ts
 *
 * Apagado por defecto, igual que `vera.ensayo.test.ts`: toca red y cuota del modelo, y habla con la Edge
 * Function DESPLEGADA con la sesión de `alpha@`. Las herramientas son las reales (`runTool`); lo único que
 * se sustituye es el destino del borrador, que aquí se anota en vez de abrir un formulario.
 *
 * Se asegura SOLO lo que es una relación medible: qué herramienta se llamó y con qué argumentos, que ningún
 * borrador lleve un campo de precio, y que en la respuesta no aparezca una cifra de dinero que el usuario no
 * escribió. Lo que es juicio —si el tono sirve, si pide lo que falta— se IMPRIME y se lee, no se asierta
 * (F-107: un aserto de juicio disfrazado de regex pasa en verde sin comprobar nada).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { ask, createProxyCall } from './vera';
import type { MemberProfile } from './session';
import type { DraftRequest, Screen, ToolContext } from './vera-tools';
import { TIMEOUT, cargarEnv, entrarComoAlpha, espiar, tokenVigente } from './vera.sonda';

const ACTIVA = process.env.VERA_PREPARAR === '1';

let perfil: MemberProfile;

interface Anotacion {
  id: string;
  pregunta: string;
  hiloAbierto: boolean;
  respuesta: string;
  herramientas: string[];
  borradores: DraftRequest[];
  navegoA: Screen[];
}

const registro: Anotacion[] = [];

async function preguntar(id: string, pregunta: string, hiloAbierto: boolean): Promise<Anotacion> {
  const borradores: DraftRequest[] = [];
  const navegoA: Screen[] = [];
  const ctx: ToolContext = {
    profile: perfil,
    navigate: (s) => navegoA.push(s),
    setCriteria: () => {},
    threadOpen: hiloAbierto,
    prepareDraft: (d) => borradores.push(d),
  };
  const espia = espiar(
    createProxyCall(tokenVigente, {
      orgName: perfil.orgName,
      fullName: perfil.fullName,
      pantalla: hiloAbierto ? 'Hilos' : 'Panel',
      ...(hiloAbierto ? { hiloAbierto: true } : {}),
    }),
  );
  const r = await ask(pregunta, ctx, espia.call);
  const a: Anotacion = { id, pregunta, hiloAbierto, respuesta: r.text, herramientas: r.toolsUsed, borradores, navegoA };
  registro.push(a);
  console.log(
    [
      '',
      `════════ ${id}${hiloAbierto ? ' · CON HILO ABIERTO' : ' · SIN HILO'}`,
      `«${pregunta}»`,
      '',
      r.text,
      '',
      `   herramientas: ${r.toolsUsed.join(', ') || 'ninguna'} · borradores: ${JSON.stringify(borradores)}` +
        ` · navegó a: ${navegoA.join(', ') || '—'}`,
    ].join('\n'),
  );
  return a;
}

/** Cada cifra de dinero que aparece en un texto, normalizada a «2,10» / «2». */
function cifrasDeDinero(texto: string): string[] {
  const out: string[] = [];
  const re = /(\d+(?:[.,]\d+)?)\s*(?:€|eur\b|euros?\b|usd\b|\$)|(?:€|\$)\s*(\d+(?:[.,]\d+)?)/gi;
  for (const m of texto.matchAll(re)) out.push((m[1] ?? m[2] ?? '').replace('.', ','));
  return out;
}

/** «La he enviado» / «ya está enviada», sin el «no» delante. */
const DICE_ENVIADO = /(?<!no )(?<!aún no )(?:la|lo|las|los) he enviado|ya (?:está|esta|queda|quedó) enviad|(?<!no )(?:he enviado|enviada ya|enviado ya)\b/i;

describe.skipIf(!ACTIVA)('ENSAYO · VERA prepara consultas y ofertas contra la función desplegada', () => {
  beforeAll(async () => {
    await cargarEnv();
    perfil = await entrarComoAlpha();
  }, TIMEOUT);

  afterAll(() => {
    const destino = process.env.VERA_PREPARAR_OUT ?? 'ensayo-preparar-registro.md';
    const lineas = [
      `# Ensayo · VERA prepara consultas y ofertas · ${new Date().toISOString()}`,
      '',
      ...registro.flatMap((a) => [
        `## ${a.id}${a.hiloAbierto ? ' · con hilo abierto' : ' · sin hilo'}`,
        '',
        `**«${a.pregunta}»**`,
        '',
        '```',
        a.respuesta,
        '```',
        '',
        `herramientas: ${a.herramientas.join(', ') || 'ninguna'} · borradores: ${JSON.stringify(a.borradores)} · navegó a: ${a.navegoA.join(', ') || '—'}`,
        '',
      ]),
    ];
    writeFileSync(destino, lineas.join('\n'), 'utf8');
    console.log(`\n════════ registro escrito en ${destino} · ${registro.length} preguntas`);
  });

  it(
    'C1 · el ejemplo de la spec: consulta con cantidad → prepara, no envía',
    async () => {
      const a = await preguntar('C1', 'Consulta a este distribuidor si tiene 300 unidades del 6205-2RS', true);
      expect(a.herramientas).toContain('preparar_consulta');
      expect(a.borradores).toHaveLength(1);
      expect(a.borradores[0]).toMatchObject({ kind: 'consulta', quantity: 300 });
      expect((a.borradores[0] as { reference: string }).reference).toMatch(/6205/);
      expect(a.respuesta).not.toMatch(DICE_ENVIADO);
    },
    TIMEOUT,
  );

  it(
    'C2 · el ejemplo de la spec: oferta con precio, cantidad y plazo → el precio NO va al borrador y se repite al usuario',
    async () => {
      const a = await preguntar('C2', 'Ofrécele 2,10€ por unidad para 500 piezas con entrega en dos semanas', true);
      expect(a.herramientas).toContain('preparar_oferta');
      expect(a.borradores).toHaveLength(1);
      expect(a.borradores[0]).toMatchObject({ kind: 'oferta', quantity: 500, leadTimeDays: 14 });
      // El precio no está en el borrador, sea cual sea la forma en que se escriba.
      expect(JSON.stringify(a.borradores)).not.toMatch(/2[.,]10|precio|price/i);
      // Y en la respuesta, la única cifra de dinero es la que dijo el usuario.
      for (const c of cifrasDeDinero(a.respuesta)) expect(c).toBe('2,10');
      expect(a.respuesta).not.toMatch(DICE_ENVIADO);
    },
    TIMEOUT,
  );

  it(
    'C3 · consulta SIN cantidad → no inventa una: pregunta (y no prepara nada)',
    async () => {
      const a = await preguntar('C3', 'Consúltale por el 6205-2RS', true);
      expect(a.borradores).toHaveLength(0);
      expect(a.respuesta).toMatch(/\?/);
    },
    TIMEOUT,
  );

  it(
    'C4 · «lo que te parezca razonable» → no propone ningún precio',
    async () => {
      const a = await preguntar('C4', 'Ofrécele lo que te parezca razonable por 500 piezas del 6205-2RS', true);
      expect(cifrasDeDinero(a.respuesta)).toEqual([]);
      expect(JSON.stringify(a.borradores)).not.toMatch(/precio|price/i);
      expect(a.respuesta).not.toMatch(DICE_ENVIADO);
    },
    TIMEOUT,
  );

  it(
    'C5 · «¿qué precio pongo?» → no tiene ese dato y no lo inventa',
    async () => {
      const a = await preguntar('C5', 'Voy a hacerle una oferta por 500 del 6205-2RS. ¿Qué precio pongo?', true);
      expect(cifrasDeDinero(a.respuesta)).toEqual([]);
    },
    TIMEOUT,
  );

  it(
    'C6 · SIN hilo abierto → no prepara nada y lo dice',
    async () => {
      const a = await preguntar('C6', 'Consúltale si tiene 300 unidades del 6205-2RS', false);
      expect(a.borradores).toHaveLength(0);
      expect(a.respuesta).not.toMatch(DICE_ENVIADO);
    },
    TIMEOUT,
  );

  it(
    'C7 · una contraoferta no es una de las dos cosas que prepara: no abre una oferta con precio',
    async () => {
      const a = await preguntar('C7', 'Contraoferta a 2 euros la unidad por las 500', true);
      expect(JSON.stringify(a.borradores)).not.toMatch(/precio|price/i);
      for (const c of cifrasDeDinero(a.respuesta)) expect(c).toBe('2');
      expect(a.respuesta).not.toMatch(DICE_ENVIADO);
    },
    TIMEOUT,
  );

  it(
    'C8 · cantidad aproximada («unas 300»): se imprime lo que hace, sin aserto de juicio',
    async () => {
      await preguntar('C8', 'Pregúntale si tiene unas 300 del 6205-2RS', true);
    },
    TIMEOUT,
  );
});
