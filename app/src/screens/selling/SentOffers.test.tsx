import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MemberProfile } from '../../lib/session';
import type { SentOffer } from '../../lib/sent-offers';

/**
 * CONTRATO DE ACEPTACIÓN · VND-01 · Mis Ofertas (vista del vendedor).
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). **El Coder no lo
 * ve**: si lo viera, escribiría para el test y el test dejaría de verificar
 * (`CLAUDE.md` §3).
 *
 * Se mockea **solo** `fetchSentOffers`, que es lo único que toca red. El
 * filtrado, la ordenación y los literales son los de verdad: mockearlos
 * convertiría esto en una comprobación de los mocks.
 *
 * ── LAS TRES REGLAS QUE ESTE CONTRATO APLICA, Y DE DÓNDE VIENEN ─────────────
 *
 * **F-047** · compila y se ejecuta contra los esqueletos vacíos antes de lanzar.
 * **F-058** · y su rojo tiene que ser TOTAL. Un aserto que se queda verde contra
 *   un componente que devuelve `null` no está midiendo nada — nueve de los 67 de
 *   MSG-02 lo hacían, y entre ellos el de la frontera del zero-knowledge.
 * **F-059** · todo aserto negativo lleva **ancla positiva delante** y **ámbito
 *   acotado**. Los tres fallos propios del día 7 fueron los tres eso.
 */

const fetchSentOffers = vi.fn<(orgId: string) => Promise<SentOffer[]>>();

vi.mock('../../lib/sent-offers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/sent-offers')>()),
  fetchSentOffers: (orgId: string) => fetchSentOffers(orgId),
}));

const { SentOffers } = await import('./SentOffers');
const {
  EMPTY_NO_MATCHES,
  EMPTY_NO_OFFERS,
  EYEBROW,
  SEARCH_PLACEHOLDER,
  SUBTITLE,
  TITLE,
} = await import('../../lib/sent-offers');

const MI_ORG = 'a1000000-0000-4000-8000-000000000001';

const profile: MemberProfile = {
  id: 'a1000000-0000-4000-8000-00000000000a',
  email: 'alpha@bearingworld.test',
  fullName: 'Alvaro Alpha',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: MI_ORG,
  orgName: 'Rodamientos Ibéricos',
  orgCountry: 'ES',
};

function oferta(over: Partial<SentOffer> = {}): SentOffer {
  return {
    id: 'of-1',
    threadId: 'h-1',
    partNumber: '6205-2RS',
    brand: 'NSK',
    counterpartyId: 'org-b',
    counterpartyName: 'Nordwälz Lager',
    state: 'Pendiente',
    createdAt: '2026-08-10T10:00:00Z',
    ...over,
  };
}

/** Las cuatro, una por estado del esquema. La cuarta es la que la §5.2 olvida. */
const CUATRO: SentOffer[] = [
  oferta({ id: 'of-1', state: 'Pendiente', partNumber: '6205-2RS', brand: 'NSK', counterpartyName: 'Nordwälz Lager', createdAt: '2026-08-10T10:00:00Z' }),
  oferta({ id: 'of-2', state: 'Aceptada', partNumber: '22316-E', brand: 'Timken', counterpartyName: 'Roulements Rhône', createdAt: '2026-08-08T10:00:00Z', threadId: 'h-2' }),
  oferta({ id: 'of-3', state: 'Rechazada', partNumber: 'NU2210-E-TVP2', brand: 'INA', counterpartyName: 'Cuscinetti Padana', createdAt: '2026-08-06T10:00:00Z', threadId: 'h-3' }),
  oferta({ id: 'of-4', state: 'Superada por contraoferta', partNumber: '6205-2RS', brand: 'SKF', counterpartyName: 'Ácido Bearings', createdAt: '2026-08-04T10:00:00Z', threadId: 'h-4' }),
];

function pinta(onOpenThread = vi.fn()) {
  render(<SentOffers profile={profile} onOpenThread={onOpenThread} />);
  return onOpenThread;
}

const filas = () => screen.getAllByTestId('sent-offer-row');

beforeEach(() => {
  vi.clearAllMocks();
  fetchSentOffers.mockResolvedValue(CUATRO);
});

describe('carga y encabezado', () => {
  it('pide las ofertas de MI organización, no de mi miembro', async () => {
    pinta();
    await waitFor(() => expect(fetchSentOffers).toHaveBeenCalledWith(MI_ORG));
  });

  it('pinta eyebrow, título y subtítulo verbatim de la spec', async () => {
    pinta();
    expect(await screen.findByText(EYEBROW)).toBeInTheDocument();
    expect(screen.getByText(TITLE)).toBeInTheDocument();
    expect(screen.getByText(SUBTITLE)).toBeInTheDocument();
  });

  it('declara si está cargando en aria-busy, no solo con un spinner', async () => {
    pinta();
    const cuerpo = await screen.findByTestId('selling-body');
    await waitFor(() => expect(cuerpo).toHaveAttribute('aria-busy', 'false'));
  });

  it('un fallo de carga se enseña con su mensaje real, no con un texto genérico', async () => {
    // F-020: un error que no identifica el fallo cuesta más que no tenerlo.
    fetchSentOffers.mockRejectedValue({ message: 'PGRST201: could not embed', code: 'PGRST201' });
    pinta();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/PGRST201/);
  });
});

describe('la tabla · §5.1', () => {
  it('ANCLA · una fila por oferta, con su referencia, marca y organización', async () => {
    pinta();
    await waitFor(() => expect(filas()).toHaveLength(4));
    const primera = filas()[0]!;
    expect(within(primera).getByText(/6205-2RS/)).toBeInTheDocument();
    expect(within(primera).getByText(/NSK/)).toBeInTheDocument();
    expect(within(primera).getByText(/Nordwälz Lager/)).toBeInTheDocument();
  });

  it('las cinco columnas de la §5.1 están, con sus nombres', async () => {
    pinta();
    for (const col of ['Referencia', 'Organización', 'Estado', 'Fecha', 'Acciones']) {
      expect(await screen.findByText(col)).toBeInTheDocument();
    }
  });

  it('⚠ CA-VND-01 · NI UNA columna de contenido cifrado, en ninguna fila', async () => {
    // ÁMBITO Y ANCLA: se mide sobre una tabla que YA se ha comprobado que pinta
    // las cuatro filas con sus metadatos. Sobre una pantalla vacía este aserto
    // pasaría solo, que es exactamente el defecto de F-058.
    const { container } = render(<SentOffers profile={profile} onOpenThread={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByTestId('sent-offer-row')).toHaveLength(4));

    const texto = container.textContent ?? '';
    for (const prohibido of ['Precio', 'precio', 'Cantidad', 'Plazo', 'Transporte', 'Portes', '€', 'EUR']) {
      expect(texto).not.toContain(prohibido);
    }
    for (const cabecera of ['Precio', 'Cantidad', 'Plazo', 'Transporte']) {
      expect(screen.queryByText(cabecera)).not.toBeInTheDocument();
    }
  });

  it('la fecha va formateada, nunca un ISO en crudo', async () => {
    // El defecto que la revisión a mano del día 7 encontró y ningún check vio.
    const { container } = render(<SentOffers profile={profile} onOpenThread={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByTestId('sent-offer-row')).toHaveLength(4));
    expect(container.textContent ?? '').toMatch(/ago\.? 2026/); // ancla: la fecha se pinta
    expect(container.textContent ?? '').not.toMatch(/2026-08-\d{2}T/);
  });
});

describe('los badges de estado · §5.2 corregida por el esquema', () => {
  it('ANCLA · los CUATRO estados del esquema se pintan, incluido el que la §5.2 no lista', async () => {
    pinta();
    for (const estado of ['Pendiente', 'Aceptada', 'Rechazada', 'Superada por contraoferta']) {
      expect(await screen.findByText(estado)).toBeInTheDocument();
    }
  });

  it('⚠ van CAPITALIZADOS como el CHECK de 0003, no en mayúsculas como la §5.2', async () => {
    // La spec de pantalla escribe `PENDIENTE`; el literal real es `Pendiente`
    // (`0003:132` y la capability `offer-card`), y MSG-02 ya lo pinta así. Dos
    // pantallas del mismo producto llamando de dos formas al mismo estado es
    // peor que cualquiera de las dos. Es la lección de F-041.
    pinta();
    expect(await screen.findByText('Pendiente')).toBeInTheDocument(); // ancla
    expect(screen.queryByText('PENDIENTE')).not.toBeInTheDocument();
    expect(screen.queryByText('ACEPTADA')).not.toBeInTheDocument();
    expect(screen.queryByText('RECHAZADA')).not.toBeInTheDocument();
  });

  it('⚠ EXPIRADA no existe en esta pantalla, y no puede existir', async () => {
    // `valid_until` vive DENTRO del blob cifrado (`0003:121`): no hay columna en
    // claro, así que VND-01 no puede saber si una oferta caducó sin descifrar, y
    // RNG-VND-01 lo prohíbe. Además D-07-03 ya lo había degradado a etiqueta de
    // presentación: una oferta caducada sigue `Pendiente` y sigue siendo aceptable.
    pinta();
    expect(await screen.findByText('Pendiente')).toBeInTheDocument(); // ancla
    expect(screen.queryByText(/EXPIRADA|Expirada|Caducada/)).not.toBeInTheDocument();
  });
});

describe('las acciones · §5.3 recortada por D-07-02 y por el esquema', () => {
  it('ANCLA · cada fila lleva su acción, y la aceptada dice `Ver acuerdo`', async () => {
    pinta();
    await waitFor(() => expect(filas()).toHaveLength(4));
    expect(within(filas()[0]!).getByRole('button', { name: 'Ver hilo' })).toBeInTheDocument();
    expect(within(filas()[1]!).getByRole('button', { name: 'Ver acuerdo' })).toBeInTheDocument();
    expect(within(filas()[2]!).getByRole('button', { name: 'Ver hilo' })).toBeInTheDocument();
    expect(within(filas()[3]!).getByRole('button', { name: 'Ver hilo' })).toBeInTheDocument();
  });

  it('CA-VND-05 · abrir lleva al hilo de ESA fila', async () => {
    const user = userEvent.setup();
    const onOpenThread = pinta();
    await waitFor(() => expect(filas()).toHaveLength(4));
    await user.click(within(filas()[1]!).getByRole('button', { name: 'Ver acuerdo' }));
    expect(onOpenThread).toHaveBeenCalledWith('h-2');
  });

  it('⚠ D-07-02 · `Retirar oferta` NO se pinta, ni deshabilitado', async () => {
    // `RETIRADA` no entra en el MVP. No es un botón inerte con su motivo como el
    // watcher de SRCH-01: es un estado que la base no tiene, así que el botón no
    // existe. La §5.3 lo pide para PENDIENTE y no manda.
    pinta();
    await waitFor(() => expect(filas()).toHaveLength(4));
    expect(within(filas()[0]!).getByRole('button', { name: 'Ver hilo' })).toBeInTheDocument(); // ancla
    expect(screen.queryByRole('button', { name: /Retirar/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/¿Retirar esta oferta\?/)).not.toBeInTheDocument();
  });

  it('⚠ `Renovar` tampoco, porque solo existía para EXPIRADA', async () => {
    pinta();
    await waitFor(() => expect(filas()).toHaveLength(4));
    expect(within(filas()[0]!).getByRole('button', { name: 'Ver hilo' })).toBeInTheDocument(); // ancla
    expect(screen.queryByRole('button', { name: /Renovar/i })).not.toBeInTheDocument();
  });
});

describe('la búsqueda · §4 y CA-VND-02', () => {
  it('ANCLA · filtra en tiempo real por referencia', async () => {
    const user = userEvent.setup();
    pinta();
    await waitFor(() => expect(filas()).toHaveLength(4));
    await user.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), '22316');
    await waitFor(() => expect(filas()).toHaveLength(1));
    expect(within(filas()[0]!).getByText(/22316-E/)).toBeInTheDocument();
  });

  it('filtra también por organización', async () => {
    const user = userEvent.setup();
    pinta();
    await waitFor(() => expect(filas()).toHaveLength(4));
    await user.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), 'Padana');
    await waitFor(() => expect(filas()).toHaveLength(1));
  });

  it('el conteo se actualiza con el filtro, y dice `1 oferta` en singular', async () => {
    const user = userEvent.setup();
    pinta();
    expect(await screen.findByText('4 ofertas')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), 'Padana');
    expect(await screen.findByText('1 oferta')).toBeInTheDocument();
  });

  it('el botón de limpiar aparece con texto, restaura la tabla y desaparece', async () => {
    const user = userEvent.setup();
    pinta();
    await waitFor(() => expect(filas()).toHaveLength(4));

    // Ancla: sin texto NO está — medido contra el caso en que sí aparece, abajo.
    expect(screen.queryByRole('button', { name: /limpiar/i })).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), 'Padana');
    const limpiar = await screen.findByRole('button', { name: /limpiar/i });
    await user.click(limpiar);

    await waitFor(() => expect(filas()).toHaveLength(4));
    expect(screen.queryByRole('button', { name: /limpiar/i })).not.toBeInTheDocument();
  });
});

describe('la ordenación · §5.4 y CA-VND-03/04', () => {
  it('ANCLA · CA-VND-03 · el orden por defecto es fecha descendente', async () => {
    pinta();
    await waitFor(() => expect(filas()).toHaveLength(4));
    expect(within(filas()[0]!).getByText(/6205-2RS/)).toBeInTheDocument();
    expect(filas()[0]!).toHaveAttribute('data-offer-id', 'of-1');
    expect(filas()[3]!).toHaveAttribute('data-offer-id', 'of-4');
  });

  it('CA-VND-04 · pulsar una cabecera ordena, y volver a pulsarla invierte', async () => {
    const user = userEvent.setup();
    pinta();
    await waitFor(() => expect(filas()).toHaveLength(4));

    await user.click(screen.getByRole('button', { name: /Organización/ }));
    // `Ácido Bearings` primero: se ordena con acentos, no por punto de código.
    await waitFor(() => expect(filas()[0]!).toHaveAttribute('data-offer-id', 'of-4'));

    await user.click(screen.getByRole('button', { name: /Organización/ }));
    await waitFor(() => expect(filas()[0]!).toHaveAttribute('data-offer-id', 'of-1'));
  });

  it('⚠ el sentido se declara en aria-sort, no solo con una flecha', async () => {
    // Una flecha ↑/↓ es un carácter dentro de un `<th>`: un lector de pantalla no
    // dice nada útil con eso. `aria-sort` es el mecanismo de la plataforma y es
    // además lo único que un test puede leer sin depender del glifo elegido.
    const user = userEvent.setup();
    pinta();
    await waitFor(() => expect(filas()).toHaveLength(4));

    const fecha = screen.getByRole('columnheader', { name: /Fecha/ });
    expect(fecha).toHaveAttribute('aria-sort', 'descending');

    await user.click(screen.getByRole('button', { name: /Organización/ }));
    const org = screen.getByRole('columnheader', { name: /Organización/ });
    await waitFor(() => expect(org).toHaveAttribute('aria-sort', 'ascending'));
    // Y la que deja de estar activa lo suelta: dos columnas diciendo que ordenan
    // a la vez es una tabla que miente.
    expect(screen.getByRole('columnheader', { name: /Fecha/ })).toHaveAttribute('aria-sort', 'none');
  });

  it('⚠ `Acciones` NO es ordenable (§5.4)', async () => {
    pinta();
    await waitFor(() => expect(filas()).toHaveLength(4));
    // Ancla: las otras cuatro sí lo son.
    for (const col of ['Referencia', 'Organización', 'Estado', 'Fecha']) {
      expect(screen.getByRole('button', { name: new RegExp(col) })).toBeInTheDocument();
    }
    expect(screen.getByRole('columnheader', { name: /Acciones/ })).not.toHaveAttribute('aria-sort');
  });
});

describe('los dos estados vacíos · §5.5', () => {
  it('sin ninguna oferta enviada dice que no hay, y no pinta una tabla en blanco', async () => {
    fetchSentOffers.mockResolvedValue([]);
    pinta();
    expect(await screen.findByText(EMPTY_NO_OFFERS)).toBeInTheDocument();
    expect(screen.queryAllByTestId('sent-offer-row')).toHaveLength(0);
  });

  it('⚠ con búsqueda sin resultados dice OTRA cosa, no la misma', async () => {
    // Si los dos textos fueran el mismo, buscar mal parecería no tener ofertas —
    // y el vendedor cerraría la pantalla creyendo que no ha enviado nada.
    const user = userEvent.setup();
    pinta();
    await waitFor(() => expect(filas()).toHaveLength(4));

    await user.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), 'zzzz-no-existe');
    expect(await screen.findByText(EMPTY_NO_MATCHES)).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_NO_OFFERS)).not.toBeInTheDocument();
  });
});

describe('lo que esta pantalla no puede prometer', () => {
  it('⚠ CA-VND-06 · no pide passphrase ni ofrece introducirla', async () => {
    // La passphrase solo se pide al abrir el hilo en MSG-02, y en el MVP ni
    // siquiera ahí: las claves viven en memoria de sesión (F-027, `CLAUDE.md` §4).
    // Un bloque que la pida aquí promete recuperación de claves que no existe.
    pinta();
    await waitFor(() => expect(filas()).toHaveLength(4)); // ancla
    expect(screen.queryByRole('button', { name: /frase de seguridad|passphrase/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Contenido cifrado/)).not.toBeInTheDocument();
  });

  it('no anuncia funciones con fecha que nadie se ha comprometido a cumplir', async () => {
    const { container } = render(<SentOffers profile={profile} onOpenThread={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByTestId('sent-offer-row')).toHaveLength(4)); // ancla
    expect(container.textContent ?? '').not.toMatch(/próximamente|pronto|en breve|muy pronto/i);
  });
});
