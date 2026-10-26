import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MemberProfile } from './session';
import { TOOL_NAMES, type ToolContext } from './vera-tools';
import { ask, type Exchange, type ProxyRequest, type ProxyTurn } from './vera';

/**
 * Lo que de los escenarios PARCIAL de `vera-agent` se puede probar SIN el modelo: lo que hace el
 * cliente (ejecutar las herramientas con retornos simulados, qué viaja de una pregunta a la
 * siguiente, qué herramientas existen). Las expectativas salen de la spec
 * (`openspec/specs/vera-agent/spec.md`), no del código.
 *
 * ⚠ Lo que NO puede cazar, y por eso esos escenarios siguen PARCIAL: que el MODELO decida llamar a
 * la herramienta, que responda «cifrado de extremo a extremo», que presente la información para
 * decidir. Eso solo lo mide una llamada real (VERA_ENSAYO / VERA_PROBE / VERA_REAL; nunca en CI).
 * El modelo va aquí SIEMPRE guionizado (`CLAUDE.md` §5).
 */

const aqui = dirname(fileURLToPath(import.meta.url));
const TOOLS_JSON = resolve(aqui, '../../../supabase/functions/vera/tools.json');

const fetchOffers = vi.fn();
const fetchPage = vi.fn();
const fetchThreadPage = vi.fn();
const fetchPartKeys = vi.fn();
vi.mock('./part-search', async (importOriginal) => {
  const original = await importOriginal<typeof import('./part-search')>();
  return {
    ...original,
    fetchPartKeys: (...a: unknown[]) => fetchPartKeys(...a),
    fetchOffers: (...a: unknown[]) => fetchOffers(...a),
  };
});

/** Lista previa con una sola clave, la exacta de lo pedido: así la herramienta pide sus ofertas. */
async function listaPreviaExacta(c: { ref: string }) {
  const { normalizeRef } = await import('./part-search');
  const key = normalizeRef(c.ref);
  return { keys: [{ key, offers: 1 }], totalKeys: 1, totalOffers: 1, matchedRef: key, truncated: false, page: 1, pageCount: 1 };
}
vi.mock('./inventory', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./inventory')>()),
  fetchPage: (...a: unknown[]) => fetchPage(...a),
}));
vi.mock('./threads', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./threads')>()),
  fetchThreadPage: (...a: unknown[]) => fetchThreadPage(...a),
}));

const ADMIN: MemberProfile = {
  id: 'member-alpha',
  email: 'alpha@bearingworld.io',
  fullName: 'Alpha Uno',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: 'org-alpha',
  orgName: 'Alpha Rodamientos',
  orgCountry: 'ES',
};
const EDITOR: MemberProfile = { ...ADMIN, id: 'member-ed', role: 'EDITOR' };

let efectos: string[] = [];

function contexto(profile: MemberProfile = ADMIN): ToolContext {
  return {
    profile,
    navigate: (s) => efectos.push(`navigate:${s}`),
    setCriteria: () => efectos.push('setCriteria'),
    threadOpen: true,
    prepareDraft: () => efectos.push('prepareDraft'),
  };
}

function turno(p: Partial<ProxyTurn>): ProxyTurn {
  return { stopReason: 'end_turn', text: '', toolUses: [], raw: [], ...p };
}

/**
 * Un «modelo» guionizado: ante una pregunta nueva pide la herramienta dada; ante su resultado
 * contesta. Guarda cada petición que recibe, para mirar qué le llegó.
 */
function modelo(herramienta: string, input: unknown = {}) {
  const peticiones: ProxyRequest[] = [];
  const call = async (body: ProxyRequest): Promise<ProxyTurn> => {
    peticiones.push(body);
    const ultimo = body.messages[body.messages.length - 1] as { role: string; content: unknown };
    if (typeof ultimo.content === 'string') {
      return turno({
        stopReason: 'tool_use',
        toolUses: [{ id: `tu-${peticiones.length}`, name: herramienta, input }],
        raw: [{ type: 'tool_use', id: `tu-${peticiones.length}`, name: herramienta, input }],
      });
    }
    return turno({ text: 'respuesta' });
  };
  return { call, peticiones };
}

/** El `content` del `tool_result` que recibió el modelo en su última petición. */
function ultimoResultado(peticiones: ProxyRequest[]): { content: string; is_error: boolean } {
  const ultima = peticiones[peticiones.length - 1];
  const msg = ultima!.messages[ultima!.messages.length - 1] as {
    content: { type: string; content: string; is_error: boolean }[];
  };
  const r = msg.content.find((b) => b.type === 'tool_result');
  if (!r) throw new Error('la última petición no lleva tool_result');
  return { content: r.content, is_error: r.is_error };
}

function filaPropia(quantity: number) {
  return {
    lines: [
      {
        id: 'own-1',
        partNumber: '6205-2RS',
        brand: 'SKF',
        quantity,
        country: 'ES',
        productFamily: 'Rígidos de bolas',
        status: 'PUBLISHED',
        leadTimeDays: 2,
        lastUploadAt: '2026-08-12T10:00:00Z',
      },
    ],
    total: 1,
  };
}

function filaAjena(quantity: number) {
  return {
    rows: [
      {
        id: 'line-1',
        partNumber: '6205-2RS',
        brand: 'SKF',
        quantity,
        leadTimeDays: 5,
        orgId: 'org-nsk',
        orgName: 'NSK Europe Ltd',
        country: 'DE',
        lastUploadAt: '2026-08-11T10:00:00Z',
        favoriteCount: 0,
        isFavorite: false,
        consulted: false,
      },
    ],
    total: 1,
    capped: false,
  };
}

beforeEach(() => {
  efectos = [];
  fetchOffers.mockReset();
  fetchPartKeys.mockReset().mockImplementation(listaPreviaExacta);
  fetchPage.mockReset();
  fetchThreadPage.mockReset();
});

describe('realtime-platform-state-layer · consulta en tiempo real, no memorizada', () => {
  // GIVEN un usuario que pregunta dos veces en la misma sesión por su número de líneas de inventario,
  //       con cambios entre ambas preguntas
  // WHEN  VERA responde a cada pregunta
  // THEN  invoca la herramienta correspondiente en cada ocasión
  // AND   la segunda respuesta refleja el cambio ocurrido, no un valor memorizado de la primera consulta
  it('realtime-platform-state-layer#1 · el cliente ejecuta la herramienta en cada pregunta y la segunda lleva el dato nuevo, sin cache', async () => {
    fetchPage.mockResolvedValueOnce(filaPropia(40)).mockResolvedValueOnce(filaPropia(77));

    const primera = modelo('consultar_mi_inventario');
    const a1 = await ask('¿Cuántas líneas tengo?', contexto(), primera.call);
    expect(a1.toolsUsed).toEqual(['consultar_mi_inventario']);
    expect(ultimoResultado(primera.peticiones).content).toContain('40');

    // Entre una y otra cambia el inventario. La conversación lleva la primera respuesta como texto.
    const historial: Exchange[] = [{ question: '¿Cuántas líneas tengo?', answer: 'Tienes la 6205-2RS con 40 unidades.' }];
    const segunda = modelo('consultar_mi_inventario');
    const a2 = await ask('¿Y ahora?', contexto(), segunda.call, historial);

    expect(a2.toolsUsed).toEqual(['consultar_mi_inventario']);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    const r2 = ultimoResultado(segunda.peticiones);
    expect(r2.is_error).toBe(false);
    expect(r2.content).toContain('77');
    expect(r2.content).not.toContain('40');
  });

  it('realtime-platform-state-layer#1 · del historial solo viaja texto: ninguna cifra de una herramienta anterior llega como resultado', async () => {
    fetchPage.mockResolvedValue(filaPropia(77));
    const historial: Exchange[] = [{ question: '¿Cuántas líneas tengo?', answer: 'Tienes 40.' }];
    const m = modelo('consultar_mi_inventario');
    await ask('¿Y ahora?', contexto(), m.call, historial);
    const primeraPeticion = m.peticiones[0]!.messages;
    expect(JSON.stringify(primeraPeticion)).not.toContain('tool_result');
    expect(JSON.stringify(primeraPeticion)).not.toContain('tool_use');
  });
});

describe('non-negotiable-limits · disponibilidad de stock siempre verificada en tiempo real', () => {
  // GIVEN un usuario que pregunta a VERA por la disponibilidad de una referencia
  // WHEN  VERA responde
  // THEN  consulta el índice de búsqueda en tiempo real antes de responder
  // AND   nunca da por buena información de disponibilidad basada solo en memoria de conversación previa
  it('non-negotiable-limits#3 · cada pregunta por una referencia vuelve a consultar el catálogo y lleva el stock de AHORA', async () => {
    fetchOffers.mockResolvedValueOnce(filaAjena(1200)).mockResolvedValueOnce(filaAjena(30));

    const primera = modelo('buscar_en_catalogo', { referencia: '6205-2RS' });
    await ask('¿Quién tiene 6205-2RS?', contexto(), primera.call);
    expect(ultimoResultado(primera.peticiones).content).toContain('1200');

    const historial: Exchange[] = [{ question: '¿Quién tiene 6205-2RS?', answer: 'NSK Europe Ltd tiene 1200.' }];
    const segunda = modelo('buscar_en_catalogo', { referencia: '6205-2RS' });
    await ask('¿Sigue habiendo de 6205-2RS?', contexto(), segunda.call, historial);

    expect(fetchOffers).toHaveBeenCalledTimes(2);
    const r2 = ultimoResultado(segunda.peticiones);
    expect(r2.content).toContain('30');
    expect(r2.content).not.toContain('1200');
    // La consulta es del índice de verdad: lleva la referencia pedida.
    expect(JSON.stringify(fetchOffers.mock.calls[1])).toContain('6205-2RS');
  });
});

describe('las herramientas que VERA tiene no deciden ni administran', () => {
  const definiciones = JSON.parse(readFileSync(TOOLS_JSON, 'utf8')) as { name: string }[];
  const PROHIBIDOS = /acept|rechaz|decid|contraofert|firm|cerrar|rol|invit|elimin|borr|archiv|visib|suspend|revoc|usuario/i;

  // GIVEN un usuario que pide a VERA que decida si aceptar una oferta recibida
  // WHEN  VERA procesa la instrucción
  // THEN  presenta la información disponible para ayudar a decidir
  // AND   no acepta, rechaza ni modifica la oferta sin que el usuario ejecute la acción explícitamente
  it('non-negotiable-limits#2 · ninguna herramienta acepta, rechaza ni modifica ofertas; pedírselo no ejecuta nada', async () => {
    // Control positivo: el detector SÍ marca los nombres que serían un fallo.
    expect(PROHIBIDOS.test('aceptar_oferta')).toBe(true);
    expect(PROHIBIDOS.test('rechazar_oferta')).toBe(true);
    // Ninguna de las herramientas declaradas lo es (y preparar_oferta solo prepara).
    expect(definiciones.map((d) => d.name).filter((n) => PROHIBIDOS.test(n))).toEqual([]);
    expect([...TOOL_NAMES].filter((n) => PROHIBIDOS.test(n))).toEqual([]);

    // Si el modelo se inventara la herramienta, el cliente no ejecuta nada y se lo dice como error.
    const m = modelo('aceptar_oferta', { oferta: 'item-1' });
    const a = await ask('Decide tú si acepto la oferta', contexto(), m.call);
    expect(a.toolsUsed).toEqual(['aceptar_oferta']);
    const r = ultimoResultado(m.peticiones);
    expect(r.is_error).toBe(true);
    expect(r.content).toContain('no existe');
    expect(efectos).toEqual([]);
    expect(fetchThreadPage).not.toHaveBeenCalled();
  });

  // GIVEN un usuario con rol Editor (no Administrador) en su organización
  // WHEN  pide a VERA ejecutar una acción reservada al rol Administrador
  // THEN  VERA respeta la restricción de permisos del usuario
  // AND   no ejecuta la acción ni la eluda de ninguna forma
  it('cross-capability-integration#1 · un EDITOR que pide una acción de administrador: no hay herramienta que la ejecute ni que la eluda', async () => {
    for (const intento of ['cambiar_visibilidad', 'invitar_usuario', 'eliminar_usuario', 'cambiar_rol']) {
      efectos = [];
      const m = modelo(intento, { valor: 'restringida' });
      await ask('Hazlo tú', contexto(EDITOR), m.call);
      const r = ultimoResultado(m.peticiones);
      expect(r.is_error).toBe(true);
      expect(r.content).toContain('no existe');
      expect(efectos).toEqual([]);
    }
    // Las herramientas que sí hay consultan con la organización y el miembro DEL EDITOR, nunca con otros.
    fetchPage.mockResolvedValue(filaPropia(40));
    const m = modelo('consultar_mi_inventario');
    await ask('Mi inventario', contexto(EDITOR), m.call);
    const [arg] = fetchPage.mock.calls[0] as [{ orgId: string }];
    expect(arg.orgId).toBe(EDITOR.orgId);
  });
});
