import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Panel } from './Panel';
import type { MemberProfile } from '../../lib/session';
import type { PanelSummary } from '../../lib/panel';

/**
 * CONTRATO DE ACEPTACIÓN de PANEL-01. **El Coder no ve este fichero**
 * (`CLAUDE.md` §3): si lo viera, escribiría para el test.
 *
 * Escrito ANTES de lanzarlo y verificado en ROJO TOTAL contra esqueletos vacíos
 * (F-058). Cada aserto negativo lleva su ancla positiva **en el mismo `it`**
 * (F-074), y los literales van verbatim con sus acentos, del HTML aprobado
 * (F-048).
 *
 * ⚠ **LOS CUATRO SELECTORES DE NAVEGACIÓN SE CORRIGIERON DESPUÉS DE VER EL
 * ARTEFACTO, y eso hay que decirlo (F-077).** Iban sin anclar -`/Ofertas/`,
 * `/Consultas/`, `/líneas publicadas/`, `/con mensajes sin leer/`- y el nombre
 * accesible de cada tarjeta es TODO su contenido concatenado, empezando por el
 * título: `Ofertas2pendientes de respuesta…`. Así que `/Ofertas/` casaba también
 * con la caja `Resumen mes`, que dice `Ofertas Aceptadas`. Ahora van anclados al
 * INICIO (`/^Ofertas/`), que es unívoco y no depende de si el cálculo del nombre
 * mete espacios entre nodos.
 *
 * **No tengo explicación verificada de por qué la primera corrida falló justo en
 * dos de los cuatro y no en los otros dos.** Reproducido después con un sondeo,
 * `/líneas publicadas/` SÍ casa con un único botón. Se deja escrito sin causa en
 * vez de inventarle una (F-065): lo que está verificado es que los selectores
 * anclados funcionan, no por qué fallaron los otros.
 *
 * **Tocar el contrato después de ver la salida contamina la medida**, así que
 * esta corrida NO cuenta como dato del objetivo 4 — cosa que ya era cierta por
 * otro motivo: se interrumpió sin registrar métricas.
 *
 * ⚠ **LA MITAD DE ESTE CONTRATO EXISTE POR UNA SOLA COSA: EL GUION.**
 * Tres de las diez cifras del spec no tienen fuente de datos, y `RNG-PANEL-02`
 * dice que las cajas se ven *"incluso en valor 0 … para reforzar que el dato
 * está actualizado y no ausente"*. Esa regla convierte un `0` en una
 * afirmación. Pintar `0` donde no hay fuente no sería un hueco: sería mentir
 * con el respaldo del spec, en la primera pantalla que se ve al entrar.
 */

const PERFIL: MemberProfile = {
  id: 'member-alpha',
  email: 'alpha@bearingworld.io',
  fullName: 'Juan Martínez',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: 'org-alpha',
  orgName: 'Rodamientos del Sur SL',
  orgCountry: 'ES',
};

const NOW = new Date(2026, 5, 30, 12); // martes 30/06/2026, el ejemplo de la spec §3

const RESUMEN: PanelSummary = {
  offers: {
    pending: 2,
    latest: { partNumber: '6205-2RS', orgName: 'Distribuciones Álvarez SL', at: '2026-06-29T10:00:00Z' },
  },
  queries: {
    unanswered: 1,
    latest: { partNumber: '6205-2RS-JEM', orgName: 'Timken Europe GmbH', at: '2026-06-28T10:00:00Z' },
  },
  inventory: { published: 1247, lastUploadAt: '2026-06-28T10:00:00Z', visits: null },
  threads: { unread: null, latest: null },
  month: { acceptedOffers: 3, madeOffers: 7, receivedQueries: 12 },
  favorites: { monthly: null },
};

const fetchPanelSummary = vi.fn();

vi.mock('../../lib/panel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/panel')>()),
  fetchPanelSummary: (...a: unknown[]) => fetchPanelSummary(...a),
}));

let navegado: string[] = [];

function pintar() {
  navegado = [];
  return render(<Panel profile={PERFIL} now={NOW} onNavigate={(p) => navegado.push(p)} />);
}

beforeEach(() => {
  fetchPanelSummary.mockReset();
  fetchPanelSummary.mockResolvedValue(RESUMEN);
});

// -----------------------------------------------------------------------------
// Cabecera · CA-PANEL-01
// -----------------------------------------------------------------------------

describe('cabecera', () => {
  it('pinta el eyebrow y el título de la pantalla', async () => {
    pintar();
    expect(await screen.findByText('Panel · PANEL-01')).toBeInTheDocument();
    expect(screen.getByText('Mi Panel')).toBeInTheDocument();
  });

  it('CA-PANEL-01 · el subtítulo lleva el nombre y la fecha del sistema', async () => {
    pintar();
    expect(
      await screen.findByText('Bienvenido, Juan Martínez. Hoy es martes 30/06/2026.'),
    ).toBeInTheDocument();
  });

  it('pide el resumen a la organización del perfil, no a otra', async () => {
    pintar();
    await waitFor(() => expect(fetchPanelSummary).toHaveBeenCalled());
    const [arg] = fetchPanelSummary.mock.calls[0] as [{ orgId: string }];
    expect(arg.orgId).toBe(PERFIL.orgId);
  });
});

// -----------------------------------------------------------------------------
// Las cuatro cajas obligatorias
// -----------------------------------------------------------------------------

describe('caja Ofertas · CA-PANEL-02', () => {
  it('lleva título, número y su etiqueta', async () => {
    pintar();
    expect(await screen.findByText('Ofertas')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('pendientes de respuesta')).toBeInTheDocument();
  });

  it('lleva la línea de detalle con referencia, organización y fecha', async () => {
    pintar();
    expect(
      await screen.findByText(/Más reciente: 6205-2RS · Distribuciones Álvarez SL \(29 jun 2026\)/),
    ).toBeInTheDocument();
  });

  it('navega a Vendiendo al pulsarla', async () => {
    const user = userEvent.setup();
    pintar();
    await user.click(await screen.findByRole('button', { name: /^Ofertas/ }));
    expect(navegado).toEqual(['Vendiendo']);
  });
});

describe('caja Consultas · CA-PANEL-03', () => {
  it('lleva título, número y su etiqueta', async () => {
    pintar();
    expect(await screen.findByText('Consultas')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('sin respuesta')).toBeInTheDocument();
  });

  it('lleva la última consulta, y sin fecha: la spec §4.2 no la pide', async () => {
    pintar();
    const linea = await screen.findByText(/Última consulta: 6205-2RS-JEM · Timken Europe GmbH/);
    expect(linea).toBeInTheDocument();
    expect(linea.textContent ?? '').not.toMatch(/\d{4}\)/);
  });

  it('navega a Comprando al pulsarla', async () => {
    const user = userEvent.setup();
    pintar();
    await user.click(await screen.findByRole('button', { name: /^Consultas/ }));
    expect(navegado).toEqual(['Comprando']);
  });
});

describe('caja Inventario · CA-PANEL-04', () => {
  it('lleva las líneas publicadas y la última publicación', async () => {
    pintar();
    expect(await screen.findByText('1247')).toBeInTheDocument();
    expect(screen.getByText('líneas publicadas')).toBeInTheDocument();
    expect(screen.getByText(/Última publicación: 28 jun 2026/)).toBeInTheDocument();
  });

  /**
   * No hay tabla de visitas en el esquema. INV-01 ya decidió lo mismo el día 3.
   * Ancla positiva en el mismo `it`: la etiqueta SÍ está, así que una pantalla
   * que no pintara la línea entera no pasaría por la puerta de atrás.
   */
  it('las visitas van con GUION, nunca con un número ni con cero', async () => {
    pintar();
    const etiqueta = await screen.findByText('visitas (30d)');
    expect(etiqueta).toBeInTheDocument();
    const caja = etiqueta.closest('button') ?? etiqueta.parentElement;
    expect(caja?.textContent ?? '').toContain('—');
  });

  it('navega a Inventario al pulsarla', async () => {
    const user = userEvent.setup();
    pintar();
    await user.click(await screen.findByRole('button', { name: /^Inventario/ }));
    expect(navegado).toEqual(['Inventario']);
  });
});

describe('caja Hilos · CA-PANEL-05', () => {
  /**
   * No existe ningún registro de lectura (F-027 a). El número grande de esta
   * caja NO se puede calcular, y `RNG-PANEL-02` haría que un `0` afirmara "he
   * mirado y no tienes ninguno sin leer". Guion.
   */
  it('el recuento de no leídos va con GUION, y la etiqueta sigue estando', async () => {
    pintar();
    const etiqueta = await screen.findByText('con mensajes sin leer');
    expect(etiqueta).toBeInTheDocument();
    const caja = etiqueta.closest('button') ?? etiqueta.parentElement;
    expect(caja?.textContent ?? '').toContain('—');
    expect(caja?.textContent ?? '').not.toMatch(/\b0\b/);
  });

  it('navega a Hilos al pulsarla', async () => {
    const user = userEvent.setup();
    pintar();
    await user.click(await screen.findByRole('button', { name: /^Hilos/ }));
    expect(navegado).toEqual(['Hilos']);
  });
});

// -----------------------------------------------------------------------------
// Las dos cajas de §4.5 y §4.6
// -----------------------------------------------------------------------------

describe('caja Resumen mes · §4.5', () => {
  it('lleva las tres métricas con sus etiquetas verbatim', async () => {
    pintar();
    expect(await screen.findByText('Resumen mes')).toBeInTheDocument();
    expect(screen.getByText('Ofertas Aceptadas')).toBeInTheDocument();
    expect(screen.getByText('Ofertas Realizadas')).toBeInTheDocument();
    expect(screen.getByText('Consultas Realizadas')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});

describe('caja Favoritos recibidos · §4.6', () => {
  /**
   * `favorite_distributors` tiene `created_at`, pero `favorites_select_own`
   * (`0005:67`) restringe a `member_id = auth.uid()`: la consulta devolvería
   * cero filas EN SILENCIO. Un `0` aquí sería el peor de los tres casos, porque
   * parecería un dato consultado.
   */
  it('va con GUION, y el título sigue estando', async () => {
    pintar();
    const titulo = await screen.findByText('Favoritos recibidos');
    expect(titulo).toBeInTheDocument();
    const caja = titulo.closest('button') ?? titulo.parentElement;
    expect(caja?.textContent ?? '').toContain('—');
  });
});

// -----------------------------------------------------------------------------
// El guion contra el cero · RNG-PANEL-02
// -----------------------------------------------------------------------------

describe('RNG-PANEL-02 · un cero es una afirmación, un guion no', () => {
  /**
   * El ancla de todo lo anterior: **un cero REAL sí se pinta como cero**. Sin
   * este caso, una pantalla que pintara guiones por todas partes pasaría los
   * asertos de guion de arriba y estaría igual de rota.
   */
  it('un cero medido se pinta como 0, no como guion', async () => {
    fetchPanelSummary.mockResolvedValue({
      ...RESUMEN,
      offers: { pending: 0, latest: null },
    });
    pintar();
    const etiqueta = await screen.findByText('pendientes de respuesta');
    const caja = etiqueta.closest('button');
    expect(caja).not.toBeNull();
    if (!caja) return;
    // El cero se busca como NODO. Sobre el `textContent` concatenado
    // ('Ofertas0pendientes de respuesta...') no hay frontera de palabra:
    // /0/ no casa aunque el cero este pintado.
    expect(within(caja).getByText('0')).toBeInTheDocument();
    expect(caja?.textContent ?? '').not.toContain('—');
  });

  it('sin ofertas pendientes la línea de detalle lo dice, no queda a medias', async () => {
    fetchPanelSummary.mockResolvedValue({ ...RESUMEN, offers: { pending: 0, latest: null } });
    pintar();
    expect(await screen.findByText('Sin ofertas pendientes')).toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------------
// El reloj no puede provocar una consulta por render
// -----------------------------------------------------------------------------

describe('el `now` que llega nuevo en cada render', () => {
  /**
   * `App.tsx` construye `now={new Date()}` EN EL RENDER, a proposito y con su
   * comentario: con un reloj congelado al montar, una sesion larga acabaria
   * pintando tiempos rancios. Eso significa que `now` llega con IDENTIDAD NUEVA
   * cada vez.
   *
   * Si el efecto de carga depende del objeto `now`, cada respuesta provoca un
   * render, cada render un `now` nuevo, y cada `now` nuevo otra consulta: bucle
   * infinito contra la base, en la primera pantalla despues del login. No falla
   * ni avisa — solo consulta para siempre.
   *
   * Este test no estaba en el contrato original. Lo añade la revision a mano
   * (F-079), y es el unico defecto REAL del artefacto.
   */
  it('no relanza la consulta solo porque cambie la identidad del reloj', async () => {
    const { rerender } = render(
      <Panel profile={PERFIL} now={new Date(2026, 5, 30, 12, 0, 1)} onNavigate={() => {}} />,
    );
    await screen.findByText('Mi Panel');
    await waitFor(() => expect(fetchPanelSummary).toHaveBeenCalledTimes(1));

    for (let i = 2; i < 6; i += 1) {
      rerender(
        <Panel profile={PERFIL} now={new Date(2026, 5, 30, 12, 0, i)} onNavigate={() => {}} />,
      );
    }

    await new Promise((r) => setTimeout(r, 20));
    expect(fetchPanelSummary).toHaveBeenCalledTimes(1);
  });
});

// -----------------------------------------------------------------------------
// Carga y error
// -----------------------------------------------------------------------------

describe('mientras carga y cuando falla', () => {
  it('mientras carga no pinta ceros: un cero sin consultar es el peor de todos', async () => {
    fetchPanelSummary.mockReturnValue(new Promise(() => {}));
    pintar();
    expect(await screen.findByText('Mi Panel')).toBeInTheDocument();
    expect(screen.queryByText('pendientes de respuesta')).not.toBeInTheDocument();
  });

  it('si la consulta falla lo dice, y no enseña un panel vacío como si fuera cierto', async () => {
    fetchPanelSummary.mockRejectedValue(new Error('PGRST301'));
    pintar();
    expect(await screen.findByText(/No se ha podido cargar/)).toBeInTheDocument();
    expect(screen.queryByText('pendientes de respuesta')).not.toBeInTheDocument();
  });
});
