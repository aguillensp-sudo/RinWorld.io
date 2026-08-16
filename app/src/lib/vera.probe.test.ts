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
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { supabase } from './supabase';
import { ask, createProxyCall } from './vera';
import type { SearchCriteria } from './search';
import type { MemberProfile } from './session';
import type { Screen, ToolContext } from './vera-tools';

/** Apagada salvo que se pida a propósito: toca red, base y cuota del modelo. */
const ACTIVA = process.env.VERA_PROBE === '1';

/** Generoso: son varias vueltas de modelo con herramientas por medio. */
const TIMEOUT = 120_000;

let ctx: ToolContext;
let llamar: ReturnType<typeof createProxyCall>;
let navegadoA: Screen[] = [];
let criteriosEscritos: SearchCriteria[] = [];

async function preguntar(pregunta: string) {
  navegadoA = [];
  criteriosEscritos = [];
  const r = await ask(pregunta, ctx, llamar);
  // Se imprime SIEMPRE: la sonda vale por lo que deja leer, no por el verde.
  console.log(
    `\n──────── ${pregunta}\n${r.text}\n   · herramientas: ${
      r.toolsUsed.join(', ') || 'ninguna'
    } · vueltas: ${r.steps} · navegó a: ${navegadoA.join(', ') || '—'}`,
  );
  return r;
}

/**
 * El invariante de `F-105`, medido sobre el texto: cuántas filas dice que hay,
 * cuántas pinta, y si declara el criterio cuando pinta menos.
 *
 * Se cuenta una fila por llevar separador `·` **y** una cantidad en unidades,
 * que es la forma que tienen las filas del retorno de `buscar_en_catalogo`. Una
 * frase de prosa no casa las dos cosas a la vez.
 */
function coherenciaDeRecorte(texto: string): {
  total: number | null;
  filas: number;
  declara: boolean;
} {
  const m = texto.match(
    /\b(?:hay|tengo|encontrad[oa]s?|existen|son)\s+(\d+)\s+(?:filas|coincidencias|l[íi]neas|opciones|resultados|proveedores)/i,
  );
  return {
    total: m ? Number(m[1]) : null,
    filas: texto.split('\n').filter((l) => l.includes('·') && /\d+\s*u\b/.test(l)).length,
    declara:
      /de (las |los )?\d+|te (enseño|muestro)|he (seleccionado|elegido|filtrado|descartado)|las \d+ (más|mejores)|solo te/i.test(
        texto,
      ),
  };
}

describe.skipIf(!ACTIVA)('SONDA v5 contra Sonnet desplegado', () => {
  beforeAll(async () => {
    const dotenv = await import('dotenv');
    dotenv.default.config({
      path: join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env'),
      quiet: true,
    });

    const email = process.env.E2E_ALPHA_EMAIL;
    const password = process.env.E2E_ALPHA_PASSWORD;
    if (!email || !password) {
      throw new Error('Faltan E2E_ALPHA_EMAIL / E2E_ALPHA_PASSWORD en app/.env.');
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`No se ha podido entrar como alpha@: ${error.message}`);

    /*
     * El perfil se arma aquí porque `session.ts` solo lo expone por el hook de
     * React. Es pegamento de la sonda, no una segunda copia de nada: las
     * herramientas siguen siendo las de producción.
     */
    /*
     * En DOS consultas y sin embed, a propósito. Con `organizations(...)` esto
     * devuelve `PGRST201` —*"more than one relationship was found"*— porque
     * `members` llega a `organizations` por más de un camino; es exactamente lo
     * que documenta `threads.ts` sobre sus tres claves ajenas (F-020). Nombrar
     * la FK funcionaría, pero aquí la sonda no gana nada acoplándose a su
     * nombre: dos lecturas se leen mejor y no se rompen si la FK se renombra.
     */
    const { data: m, error: eM } = await supabase
      .from('members')
      .select('id, org_id, email, full_name, role, state')
      .eq('email', email)
      .single();
    if (eM) throw new Error(`No se ha podido leer el miembro: ${eM.message}`);

    const fila = m as unknown as {
      id: string;
      org_id: string;
      email: string;
      full_name: string | null;
      role: 'ADMIN' | 'EDITOR';
      state: string;
    };

    const { data: o, error: eO } = await supabase
      .from('organizations')
      .select('name, country')
      .eq('id', fila.org_id)
      .single();
    if (eO) throw new Error(`No se ha podido leer la organización: ${eO.message}`);
    const org = o as unknown as { name: string; country: string };

    const profile: MemberProfile = {
      id: fila.id,
      email: fila.email,
      fullName: fila.full_name,
      role: fila.role,
      state: fila.state,
      orgId: fila.org_id,
      orgName: org.name,
      orgCountry: org.country,
    };

    ctx = {
      profile,
      navigate: (s) => navegadoA.push(s),
      setCriteria: (c) => criteriosEscritos.push(c),
    };

    llamar = createProxyCall(
      async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
      { orgName: profile.orgName, fullName: profile.fullName, pantalla: 'Panel' },
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
  it('F-105 · si enseña menos filas de las que recibe, lo dice y con qué criterio', async () => {
    const r = await preguntar(
      '¿Quién tiene 6205-2RS? Dame las mejores opciones para comprar 500 unidades.',
    );
    expect(r.toolsUsed).toContain('buscar_en_catalogo');

    /*
     * ⚠ SE COMPARA EL TOTAL DECLARADO CON LAS FILAS PINTADAS, Y NO SE BUSCA UNA
     * PALABRA. La primera versión de este aserto exigía que apareciera un "12" y
     * pasó en verde casando con *"Anadolu Rulman · FAG · 830 u · Turquía · 12
     * días"* — un plazo de entrega. Un aserto que puede acertar por un número que
     * significa otra cosa no comprueba nada; es el mismo fallo, en el test, que
     * F-105 describe en el modelo.
     */
    const { total, filas, declara } = coherenciaDeRecorte(r.text);
    expect(total).not.toBeNull();
    if (total !== null && filas < total) {
      // Ha recortado: la regla nueva obliga a decirlo y a decir con qué criterio.
      expect(declara).toBe(true);
    } else {
      // No ha recortado: entonces lo pintado tiene que ser lo declarado.
      expect(filas).toBe(total);
    }
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
