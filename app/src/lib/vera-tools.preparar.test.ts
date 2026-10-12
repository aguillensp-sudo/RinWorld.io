import { beforeEach, describe, expect, it } from 'vitest';
import tools from '../../../supabase/functions/vera/tools.json';
import { CURRENCIES } from '../screens/messages/OfferCounterForm';
import type { MemberProfile } from './session';
import {
  OFFER_CURRENCIES,
  TOOL_NAMES,
  leaksCiphertext,
  runTool,
  type DraftRequest,
  type ToolContext,
} from './vera-tools';

/**
 * VERA rellena consultas y ofertas (MSG-03 §5, F-249). Escrito a mano.
 *
 * Lo que hay que sostener, porque es el riesgo #1 con dinero de por medio:
 *  - se PREPARA, no se envía: la herramienta solo abre un formulario que revisa y envía el usuario;
 *  - el PRECIO no existe en la herramienta (§4.2 y §7: lo teclea siempre el usuario, decisión del PO);
 *  - una cifra mal entendida se RECHAZA, no se redondea;
 *  - solo con un hilo abierto: sin él no hay a quién preguntar y VERA no se lo inventa.
 */

const PERFIL = { orgId: 'org-a', id: 'm-1', orgName: 'Alpha', fullName: 'Ana' } as unknown as MemberProfile;

let hiloAbierto: boolean;
let borradores: DraftRequest[];

function ctx(): ToolContext {
  return {
    profile: PERFIL,
    navigate: () => {},
    setCriteria: () => {},
    threadOpen: hiloAbierto,
    prepareDraft: (d) => borradores.push(d),
  };
}

beforeEach(() => {
  hiloAbierto = true;
  borradores = [];
});

describe('las herramientas existen y el precio no', () => {
  it('están en TOOL_NAMES y en tools.json, con su esquema', () => {
    expect(TOOL_NAMES).toEqual(expect.arrayContaining(['preparar_consulta', 'preparar_oferta']));
    const consulta = tools.find((t) => t.name === 'preparar_consulta')!;
    const oferta = tools.find((t) => t.name === 'preparar_oferta')!;
    expect(consulta.input_schema.required).toEqual(['referencia', 'cantidad']);
    expect(oferta.input_schema.required).toEqual([]);
  });

  it('NINGÚN esquema tiene un campo de precio, importe ni coste: el modelo no tiene dónde ponerlo', () => {
    for (const nombre of ['preparar_consulta', 'preparar_oferta']) {
      const campos = Object.keys(tools.find((t) => t.name === nombre)!.input_schema.properties);
      expect(campos.filter((c) => /precio|price|importe|coste|tarifa|euros?/i.test(c))).toEqual([]);
    }
  });

  it('el esquema de oferta dice con todas las letras que el precio no se rellena', () => {
    const d = tools.find((t) => t.name === 'preparar_oferta')!.description;
    expect(d).toContain('EL PRECIO NO SE RELLENA NUNCA');
  });

  it('las divisas admitidas son las del formulario de oferta y las del esquema', () => {
    expect([...OFFER_CURRENCIES]).toEqual([...CURRENCIES]);
    const enumEsquema = (tools.find((t) => t.name === 'preparar_oferta')!.input_schema.properties as Record<string, { enum?: string[] }>)
      .divisa!.enum;
    expect(enumEsquema).toEqual([...CURRENCIES]);
  });
});

describe('preparar_consulta', () => {
  it('con un hilo abierto prepara el borrador con lo que dijo el usuario y NO dice que se haya enviado', async () => {
    const r = await runTool('preparar_consulta', { referencia: '6205-2RS', cantidad: 300 }, ctx());
    expect(r.isError).toBe(false);
    expect(borradores).toEqual([{ kind: 'consulta', reference: '6205-2RS', brand: '', quantity: 300, notes: null }]);
    expect(r.content).toContain('NO está enviada');
    expect(r.content).toContain('Enviar consulta');
    expect(r.content).toContain('No digas que la has enviado');
  });

  it('acepta la cantidad escrita como cadena, la marca y las notas, recortadas', async () => {
    await runTool('preparar_consulta', { referencia: ' 22316-E ', marca: 'FAG', cantidad: '40', notas: '  Plazo urgente ' }, ctx());
    expect(borradores).toEqual([{ kind: 'consulta', reference: '22316-E', brand: 'FAG', quantity: 40, notes: 'Plazo urgente' }]);
  });

  it('sin hilo abierto no prepara nada y manda al usuario a abrirlo, sin inventar la empresa', async () => {
    hiloAbierto = false;
    const r = await runTool('preparar_consulta', { referencia: '6205', cantidad: 10 }, ctx());
    expect(r.isError).toBe(true);
    expect(borradores).toHaveLength(0);
    expect(r.content).toContain('No hay ningún hilo abierto');
    expect(r.content).toContain('navegar');
  });

  it('sin referencia: error, y no prepara nada', async () => {
    const r = await runTool('preparar_consulta', { cantidad: 10 }, ctx());
    expect(r.isError).toBe(true);
    expect(r.content).toContain('no la supongas');
    expect(borradores).toHaveLength(0);
  });

  it.each([
    ['sin cantidad', {}],
    ['cero', { cantidad: 0 }],
    ['negativa', { cantidad: -5 }],
    ['con decimales', { cantidad: 2.5 }],
    ['con decimales como cadena', { cantidad: '2,5' }],
    ['en notación científica', { cantidad: '1e3' }],
    ['en palabras', { cantidad: 'trescientas' }],
    ['aproximada', { cantidad: 'unas 300' }],
  ])('una cantidad %s se RECHAZA, no se redondea ni se supone', async (_caso, extra) => {
    const r = await runTool('preparar_consulta', { referencia: '6205', ...extra }, ctx());
    expect(r.isError).toBe(true);
    expect(r.content).toContain('pregúntasela');
    expect(borradores).toHaveLength(0);
  });

  it('unas notas de más de 300 caracteres se rechazan', async () => {
    const r = await runTool('preparar_consulta', { referencia: '6205', cantidad: 5, notas: 'x'.repeat(301) }, ctx());
    expect(r.isError).toBe(true);
    expect(borradores).toHaveLength(0);
  });

  it('un precio que el modelo mande de más se IGNORA: no llega al borrador ni se repite', async () => {
    await runTool('preparar_consulta', { referencia: '6205', cantidad: 5, precio: 2.1, unit_price: 2.1 }, ctx());
    expect(JSON.stringify(borradores)).not.toMatch(/2\.1|precio|price/i);
  });

  it('lo que devuelve al modelo no lleva nada cifrado', async () => {
    const r = await runTool('preparar_consulta', { referencia: '6205', cantidad: 5 }, ctx());
    expect(leaksCiphertext(r.content)).toBe(false);
  });
});

describe('preparar_oferta', () => {
  it('prepara el borrador con referencia, cantidad, plazo y divisa, y avisa de que el precio queda vacío', async () => {
    const r = await runTool('preparar_oferta', { referencia: '6205-2RS', cantidad: 500, plazo_dias: 14, divisa: 'eur' }, ctx());
    expect(r.isError).toBe(false);
    expect(borradores).toEqual([
      { kind: 'oferta', reference: '6205-2RS', brand: '', quantity: 500, leadTimeDays: 14, currency: 'EUR', notes: null },
    ]);
    expect(r.content).toContain('EL PRECIO UNITARIO ESTÁ VACÍO A PROPÓSITO');
    expect(r.content).toContain('no propongas, sugieras, calcules ni completes ninguna cifra de precio');
    expect(r.content).toContain('NO está enviada');
    expect(r.content).toContain('plazo 14 días');
  });

  it('el borrador NO tiene ningún campo de precio, ni siquiera si el modelo manda uno', async () => {
    await runTool('preparar_oferta', { cantidad: 500, precio: 2.1, precio_unitario: '2,10', unit_price: 2.1, importe: 1050 }, ctx());
    expect(borradores).toHaveLength(1);
    expect(Object.keys(borradores[0]!).filter((k) => /precio|price|unit|importe/i.test(k))).toEqual([]);
    expect(JSON.stringify(borradores)).not.toMatch(/2\.1|2,10|1050/);
  });

  it('sin ningún dato abre el formulario vacío y lo dice', async () => {
    const r = await runTool('preparar_oferta', {}, ctx());
    expect(r.isError).toBe(false);
    expect(borradores).toEqual([
      { kind: 'oferta', reference: '', brand: '', quantity: null, leadTimeDays: null, currency: null, notes: null },
    ]);
    expect(r.content).toContain('sin ningún campo rellenado');
  });

  it('sin hilo abierto no prepara nada', async () => {
    hiloAbierto = false;
    const r = await runTool('preparar_oferta', { cantidad: 5 }, ctx());
    expect(r.isError).toBe(true);
    expect(borradores).toHaveLength(0);
  });

  it.each([
    ['cantidad con decimales', { cantidad: 2.5 }],
    ['cantidad cero', { cantidad: 0 }],
    ['plazo cero', { plazo_dias: 0 }],
    ['plazo con decimales', { plazo_dias: '1,5' }],
    ['plazo desorbitado', { plazo_dias: 4000 }],
    ['divisa no admitida', { divisa: 'JPY' }],
    ['divisa en símbolo', { divisa: '€' }],
    ['notas de más de 500 caracteres', { notas: 'x'.repeat(501) }],
  ])('%s se RECHAZA y no prepara nada', async (_caso, extra) => {
    const r = await runTool('preparar_oferta', { referencia: '6205', ...extra }, ctx());
    expect(r.isError).toBe(true);
    expect(borradores).toHaveLength(0);
  });

  it('lo que devuelve al modelo no lleva nada cifrado', async () => {
    const r = await runTool('preparar_oferta', { cantidad: 5, notas: 'FOB' }, ctx());
    expect(leaksCiphertext(r.content)).toBe(false);
  });
});
