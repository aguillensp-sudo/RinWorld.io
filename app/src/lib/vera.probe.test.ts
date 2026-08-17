/**
 * SONDA DE VERIFICACIÓN CONTRA SONNET · NO ES UN TEST DE UNIDAD
 * =============================================================================
 *
 * Habla con la **Edge Function desplegada** y con la **base real**, con sesión
 * de `alpha@`. Por eso va **apagada por defecto** y no corre en `npm test`:
 *
 *     VERA_PROBE=1 npx vitest run src/lib/vera.probe.test.ts
 *
 * ── POR QUÉ EXISTE COMO FICHERO Y NO COMO UNA SESIÓN A MANO ────────────────
 *
 * Es el procedimiento con el que se verificó `F-090` el 14-ago y con el que se
 * encontró `F-102` el 16-ago, y las dos veces se hizo a mano y sin dejar rastro
 * ejecutable. `F-097` ya cobró ese peaje una vez: *"una instrucción que no se ha
 * ejecutado nunca es una hipótesis, no un procedimiento"*, y las quince
 * preguntas del guion llevaban once días existiendo solo como cita.
 *
 * ── LO QUE HACE QUE ESTO VALGA Y UNA SONDA IMPROVISADA NO ──────────────────
 *
 * Usa `ask()` y `runTool()` **de producción**, no una reimplementación. Las
 * herramientas de VERA corren en el cliente (D-09-05), así que una sonda que
 * hablara solo con la función recibiría `tool_use` y nunca una respuesta final:
 * habría que ejecutar las herramientas por su cuenta, y esa segunda
 * implementación acabaría midiendo algo que no es lo que ve el usuario.
 *
 * ── LO QUE NO COMPRUEBA ────────────────────────────────────────────────────
 *
 * Que la respuesta sea VERDAD. Eso se contrasta contra SQL, y lo hace quien
 * corre la sonda leyendo lo que imprime. Aquí solo se fijan las reglas que el
 * despliegue v5 introduce y que sí son comprobables como texto.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { ask, createProxyCall } from './vera';
import type { SearchCriteria } from './search';
import type { Screen, ToolContext } from './vera-tools';
/*
 * El arranque de sesión se mudó a `vera.sonda.ts` el día 15, cuando el ensayo
 * general pasó a necesitarlo también. Tenerlo dos veces era la forma exacta de
 * F-012/F-089/F-095: dos copias del mismo contrato divergiendo en silencio.
 */
import {
  TIMEOUT,
  cargarEnv,
  contarFilas,
  entrarComoAlpha,
  espiar,
  invarianteDeRecorte,
  tokenVigente,
} from './vera.sonda';

/** Apagada salvo que se pida a propósito: toca red, base y cuota del modelo. */
const ACTIVA = process.env.VERA_PROBE === '1';

let ctx: ToolContext;
let espia: ReturnType<typeof espiar>;
let navegadoA: Screen[] = [];
let criteriosEscritos: SearchCriteria[] = [];

async function preguntar(pregunta: string) {
  navegadoA = [];
  criteriosEscritos = [];
  espia.reiniciar();
  const r = await ask(pregunta, ctx, espia.call);
  const filasRecibidas = espia.retornos.reduce((n, t) => n + contarFilas(t), 0);
  const filasPintadas = contarFilas(r.text);
  // Se imprime SIEMPRE: la sonda vale por lo que deja leer, no por el verde.
  console.log(
    `\n──────── ${pregunta}\n${r.text}\n   · herramientas: ${
      r.toolsUsed.join(', ') || 'ninguna'
    } · vueltas: ${r.steps} · navegó a: ${navegadoA.join(', ') || '—'}` +
      ` · filas ${filasRecibidas} → ${filasPintadas}`,
  );
  return { ...r, filasRecibidas, filasPintadas };
}

describe.skipIf(!ACTIVA)('SONDA v5 contra Sonnet desplegado', () => {
  beforeAll(async () => {
    await cargarEnv();
    const profile = await entrarComoAlpha();

    ctx = {
      profile,
      navigate: (s) => navegadoA.push(s),
      setCriteria: (c) => criteriosEscritos.push(c),
    };

    /*
     * `pantalla: 'Panel'` fijo para todas: a la sonda le da igual desde dónde se
     * pregunta —comprueba reglas del prompt, no encuadres—. El que sí varía la
     * pantalla por pregunta es `vera.ensayo.test.ts`, porque el guion lo exige.
     */
    espia = espiar(
      createProxyCall(tokenVigente, {
        orgName: profile.orgName,
        fullName: profile.fullName,
        pantalla: 'Panel',
      }),
    );

    console.log(`\nSesión: ${profile.orgName} · miembro ${profile.id.slice(0, 8)}…`);
  }, TIMEOUT);

  it('F-102 · no manda a responder una consulta que envió el propio usuario', async () => {
    const r = await preguntar('¿Tengo algo pendiente de responder?');
    expect(r.toolsUsed).toContain('listar_mis_hilos');
    /*
     * Cuscinetti Padana es el hilo cuya CONSULTA emitió Rodamientos Ibéricos —el
     * propio usuario—. Si aparece, tiene que aparecer del lado de "estás
     * esperando", nunca del de "tienes que contestar".
     */
    const texto = r.text.toLowerCase();
    if (texto.includes('cuscinetti')) {
      expect(texto).toMatch(/enviaste|has enviado|esperando|tu consulta|pendiente de que/);
    }
  }, TIMEOUT);

  it('F-104 · responde sin markdown', async () => {
    const r = await preguntar('¿Cuántas líneas de inventario tengo publicadas?');
    expect(r.text).not.toMatch(/\*\*/);
    expect(r.text).not.toMatch(/^\s*\|/m);
    expect(r.text).not.toMatch(/^\s*#{1,6}\s/m);
  }, TIMEOUT);

  it('F-103 · contesta en inglés pero NO traduce los estados', async () => {
    const r = await preguntar('How many negotiations do I have, and in what state is each one?');
    expect(r.toolsUsed).toContain('listar_mis_hilos');
    expect(r.text).not.toMatch(/Agreement reached|Closed \(no deal\)|Offer pending/i);
    expect(r.text).toMatch(/ACUERDO ALCANZADO|CERRADO SIN ACUERDO|CON OFERTA PENDIENTE|ABIERTO/);
  }, TIMEOUT);

  it('F-101 · un refinamiento sin contexto se pregunta, no se busca', async () => {
    const r = await preguntar('filtra por más de 500 unidades en Europa');
    // Lo que NO puede pasar: ejecutar la búsqueda y devolver el catálogo entero.
    expect(r.toolsUsed).not.toContain('buscar_en_catalogo');
    expect(r.text).toMatch(/\?/);
  }, TIMEOUT);

  /*
   * ⚠ ESTA PREGUNTA NO ES LA DEL HALLAZGO, Y EL CAMBIO ES DELIBERADO.
   *
   * La original —*"motor a 3000 rpm en ambiente húmedo, 600 unidades"*— ya no
   * llega a ejercitar la regla: con la descripción nueva de `referencia` en
   * `tools.json`, el modelo deja de buscar por el sufijo `2RS` y pide el
   * diámetro del eje, así que no hay filas que recortar. Es mejor resultado y
   * peor prueba: la primera versión de este caso pasó en verde **sin haber
   * comprobado nada**, porque el regex casó con el "criterio general" de la
   * costura de B3.
   *
   * Se pregunta por `6205-2RS`, que devuelve **12 filas** a Alpha (verificado
   * por SQL el 17-ago) —por debajo de `MAX_FILAS`, así que `recorte()` no
   * avisa— y se pide explícitamente una recomendación, que es lo que empuja al
   * modelo a quedarse con unas pocas. Ahí es donde F-105 vive.
   */
  /*
   * ⚠ TERCERA VERSIÓN DE ESTE ASERTO, Y LAS DOS ANTERIORES PASARON EN VERDE SIN
   * COMPROBAR NADA.
   *
   * La v1 buscaba palabras y casó con el *"criterio general"* de la costura de
   * B3. La v2 exigía un `12` y casó con *"Anadolu Rulman · FAG · 830 u ·
   * Turquía · **12** días"*, un plazo de entrega — las dos, en `F-107`.
   *
   * La v3 —el 17-ago, al cerrar— **falló por fragilidad**: sacaba el total de la
   * prosa con un regex y esa pasada lo dijo de otra forma, así que `total` salió
   * `null` y el test se puso rojo sin que VERA hubiera hecho nada mal. Un
   * instrumento que da falsos positivos Y falsos negativos no es un instrumento.
   *
   * Ahora el total **no se infiere del texto: se mide del retorno de la
   * herramienta** con el espía, y las tres cotas viven en `invarianteDeRecorte`,
   * compartidas con `vera.ensayo.test.ts` para que no vuelvan a divergir. La
   * pregunta también cambia: pide **tres** sobre **una** referencia, que es la
   * única forma medida de provocar un recorte de verdad (`F-110`).
   */
  it('F-105 · si enseña menos filas de las que recibe, lo dice y con qué criterio', async () => {
    const r = await preguntar(
      'Necesito 6205-2RS para un pedido grande esta semana. Dame solo las tres mejores opciones.',
    );
    expect(r.toolsUsed).toContain('buscar_en_catalogo');
    expect(r.filasRecibidas).toBeGreaterThanOrEqual(5);

    const { huboRecorte, declaraTotal } = invarianteDeRecorte(
      r.filasRecibidas,
      r.filasPintadas,
      r.text,
    );
    expect(huboRecorte).toBe(true);
    expect(declaraTotal).toBe(true);
  }, TIMEOUT);

  /*
   * Se conserva la pregunta original del hallazgo, pero midiendo lo que ahora
   * hace: preguntar el diámetro en vez de buscar por un sufijo de sellado.
   */
  it('F-105 (2) · no busca por un sufijo de sellado: pide el diámetro', async () => {
    const r = await preguntar(
      'Necesito rodamientos para un motor a 3000 rpm en ambiente húmedo, unas 600 unidades. ¿Cuál me compro y a quién?',
    );
    expect(criteriosEscritos.every((c) => (c.partNumber ?? '').toUpperCase() !== '2RS')).toBe(true);
    expect(r.text).toMatch(/diámetro|eje/i);
  }, TIMEOUT);

  it('B3 · el conocimiento general va con la costura visible', async () => {
    const r = await preguntar('¿Qué diferencia hay entre un rodamiento 2RS y uno ZZ?');
    expect(r.toolsUsed).toHaveLength(0);
    expect(r.text).toMatch(
      /por lo general|como norma|criterio general|confírmalo|consulta la ficha|fabricante/i,
    );
  }, TIMEOUT);
});
