import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ageLabel,
  countryName,
  leadTimeLabel,
  quantityLabel,
  type SearchResultRow,
  type Sort,
  type SortColumn,
} from '../../lib/search';

/**
 * CONTRATO DE ACEPTACIÓN · SRCH-01 · tabla de resultados.
 *
 * Escrito **antes** que el código y por Claude Code, no por el Coder
 * (`Plan §6`, `CLAUDE.md` §3). El Coder no ve este fichero: si lo viera,
 * escribiría para el test en vez de para la spec, que es la misma degradación por
 * otra puerta.
 *
 * Lo que fija es el **panel de contenido**, nunca el shell (F-025).
 *
 * Y la regla de forma que ya costó un día: **se compara contra la función de
 * formato, nunca contra el literal del mock** (F-024). El mock escribe `1.200` en
 * la fila 3 y el CLDR de `es` da `1200`; el mock escribe `Ayer` y la función de la
 * casa da `Hace 1 día`. Manda la función.
 */

const NOW = new Date('2026-08-11T12:00:00Z');
const hace = (dias: number) => new Date(NOW.getTime() - dias * 86_400_000).toISOString();

function row(over: Partial<SearchResultRow> = {}): SearchResultRow {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    partNumber: '6205-2RS',
    brand: 'SKF',
    quantity: 850,
    leadTimeDays: 3,
    orgId: 'b2000000-0000-4000-8000-000000000002',
    orgName: 'Nordwälz Lager',
    country: 'DE',
    lastUploadAt: hace(1),
    favoriteCount: 12,
    isFavorite: false,
    consulted: false,
    ...over,
  };
}

const { ResultsTable } = await import('./ResultsTable');

/**
 * Los mocks van TIPADOS, y no es cosmética: `vi.fn()` a secas produce
 * `Mock<Procedure | Constructable>`, que con `strict` no satisface una prop de
 * firma concreta. Es lo que suspendió C1 en los tres intentos de la primera
 * corrida — un defecto de este fichero, no del artefacto. Ver F-047.
 */
function pintar(
  rows: SearchResultRow[],
  opts: { sort?: Sort | null; selected?: Set<string>; minQuantity?: number | null } = {},
) {
  const h = {
    onSort: vi.fn<(column: SortColumn) => void>(),
    onToggleRow: vi.fn<(lineId: string) => void>(),
    onToggleFavorite: vi.fn<(orgId: string) => void>(),
    onConsult: vi.fn<(lineId: string) => void>(),
    onContact: vi.fn<(orgId: string) => void>(),
  };
  render(
    <ResultsTable
      rows={rows}
      sort={opts.sort ?? null}
      selected={opts.selected ?? new Set()}
      minQuantity={opts.minQuantity ?? null}
      now={NOW}
      {...h}
    />,
  );
  return h;
}

/** Las filas de datos, sin la de cabecera. */
const filas = () => screen.getAllByRole('row').slice(1);

// -----------------------------------------------------------------------------

describe('SRCH-01 · columnas', () => {
  it('las diez de la spec §3, en su orden fijo e inamovible', () => {
    pintar([row()]);
    const cabeceras = screen.getAllByRole('columnheader').map((th) => th.textContent?.trim() ?? '');
    // La primera es el checkbox de "seleccionar todos" y no lleva texto.
    expect(cabeceras).toHaveLength(10);
    expect(cabeceras.slice(1)).toEqual([
      'Referencia',
      'Marca',
      'Cantidad',
      'Plazo',
      'Empresa',
      'País',
      'Antigüedad',
      'Favoritos',
      'Acciones',
    ]);
  });

  it('NO hay columna de precio, y no es un olvido', () => {
    // `unit_price` va cifrado E2EE en la propia línea y no se indexa
    // (`inventory-management`, y la cabecera de la migración 0002). Una columna
    // de precio en una tabla que cruza organizaciones sería la ruptura del
    // zero-knowledge, que es el argumento entero del producto.
    pintar([row()]);
    for (const t of [/precio/i, /€/, /price/i]) {
      expect(screen.queryByText(t)).not.toBeInTheDocument();
    }
  });
});

describe('SRCH-01 · una fila', () => {
  it('pinta los datos con las funciones de formato, no con los literales del mock', () => {
    pintar([row({ quantity: 1200, country: 'FR', leadTimeDays: 1, lastUploadAt: hace(1) })]);
    const fila = filas()[0]!;

    expect(within(fila).getByText('6205-2RS')).toBeInTheDocument();
    expect(within(fila).getByText('SKF')).toBeInTheDocument();
    expect(within(fila).getByText(quantityLabel(1200))).toBeInTheDocument();
    expect(within(fila).getByText(leadTimeLabel(1))).toBeInTheDocument();
    expect(within(fila).getByText('Nordwälz Lager')).toBeInTheDocument();
    expect(within(fila).getByText(countryName('FR'))).toBeInTheDocument();
    expect(within(fila).getByText(ageLabel(1))).toBeInTheDocument();
  });

  it('el país es el nombre completo, nunca el código ISO', () => {
    pintar([row({ country: 'DE' })]);
    const fila = filas()[0]!;
    expect(within(fila).getByText('Alemania')).toBeInTheDocument();
    expect(within(fila).queryByText('DE')).not.toBeInTheDocument();
  });

  it('respeta el orden que recibe y no reordena por su cuenta', () => {
    // La ordenación es de la pantalla, que la aplica sobre el conjunto completo.
    // Si la tabla reordenara habría dos verdades sobre el orden.
    pintar([row({ id: 'a', partNumber: 'ZZZ-1' }), row({ id: 'b', partNumber: 'AAA-1' })]);
    expect(within(filas()[0]!).getByText('ZZZ-1')).toBeInTheDocument();
    expect(within(filas()[1]!).getByText('AAA-1')).toBeInTheDocument();
  });

  it('marca la cantidad que no llega al mínimo pedido', () => {
    pintar([row({ id: 'a', quantity: 850 }), row({ id: 'b', quantity: 350 })], { minQuantity: 500 });
    const baja = within(filas()[1]!).getByText(quantityLabel(350));
    const alta = within(filas()[0]!).getByText(quantityLabel(850));
    // El cómo es del CSS; lo que se fija es que se distingan.
    expect(baja.className).not.toBe(alta.className);
  });

  it('sin chip de cantidad mínima ninguna fila sale marcada por debajo', () => {
    pintar([row({ id: 'a', quantity: 850 }), row({ id: 'b', quantity: 20 })]);
    const uno = within(filas()[0]!).getByText(quantityLabel(850));
    const dos = within(filas()[1]!).getByText(quantityLabel(20));
    expect(dos.className).toBe(uno.className);
  });

  it('distingue una línea desactualizada (> 7 días)', () => {
    pintar([row({ id: 'a', lastUploadAt: hace(3) }), row({ id: 'b', lastUploadAt: hace(8) })]);
    const fresca = within(filas()[0]!).getByText(ageLabel(3));
    const vieja = within(filas()[1]!).getByText(ageLabel(8));
    expect(vieja.className).not.toBe(fresca.className);
  });
});

describe('SRCH-01 · selección de filas', () => {
  it('cada fila lleva su checkbox y avisa con el id de la línea', async () => {
    const h = pintar([row({ id: 'linea-1' })]);
    await userEvent.click(within(filas()[0]!).getByRole('checkbox'));
    expect(h.onToggleRow).toHaveBeenCalledWith('linea-1');
  });

  it('el checkbox refleja lo que recibe, no un estado propio', () => {
    pintar([row({ id: 'a' }), row({ id: 'b' })], { selected: new Set(['b']) });
    expect(within(filas()[0]!).getByRole('checkbox')).not.toBeChecked();
    expect(within(filas()[1]!).getByRole('checkbox')).toBeChecked();
  });

  /**
   * NO hay checkbox de "seleccionar todos" en la cabecera, y es deliberado.
   *
   * El HTML aprobado lo pinta (`<th class="th-chk"><input id="chkAll">`) y la
   * spec §3 pone además un enlace `Seleccionar todos` en la metabarra: son dos
   * controles para el mismo estado. La metabarra es la que manda —está en la
   * spec, no solo en el mock— y vive en la pantalla, que es quien posee la
   * selección. Un segundo control aquí exigiría un `onToggleAll` que esta tabla
   * no tiene, y dos editores del mismo estado acaban discrepando: es la misma
   * razón por la que el panel de filtros laterales quedó fuera.
   *
   * Este test lo exigía y el contrato no daba con qué implementarlo. Ver F-049.
   */
  it('la cabecera de selección no duplica el control de la metabarra', () => {
    pintar([row({ id: 'a' }), row({ id: 'b' })]);
    const cabecera = screen.getAllByRole('columnheader')[0]!;
    expect(within(cabecera).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });
});

describe('SRCH-01 · ordenación por cabecera', () => {
  it('son ordenables exactamente las seis de la spec §3', async () => {
    const h = pintar([row()]);
    for (const nombre of ['Marca', 'Cantidad', 'Plazo', 'País', 'Antigüedad', 'Favoritos']) {
      await userEvent.click(screen.getByRole('button', { name: nombre }));
    }
    expect(h.onSort.mock.calls.map((c) => c[0])).toEqual([
      'brand',
      'quantity',
      'leadTime',
      'country',
      'age',
      'favorites',
    ]);
  });

  it('Referencia, Empresa y Acciones no son ordenables', () => {
    pintar([row()]);
    for (const nombre of ['Referencia', 'Empresa', 'Acciones']) {
      expect(screen.queryByRole('button', { name: nombre })).not.toBeInTheDocument();
    }
  });

  it('la cabecera activa declara su sentido con aria-sort', () => {
    pintar([row()], { sort: { column: 'quantity', direction: 'desc' } });
    const cantidad = screen.getAllByRole('columnheader').find((th) => th.textContent?.includes('Cantidad'))!;
    expect(cantidad).toHaveAttribute('aria-sort', 'descending');

    const marca = screen.getAllByRole('columnheader').find((th) => th.textContent?.includes('Marca'))!;
    expect(marca).not.toHaveAttribute('aria-sort', 'descending');
  });

  it('sin ordenación explícita ninguna cabecera se declara activa', () => {
    // El tercer clic devuelve `null` y la cabecera tiene que perder el indicador,
    // aunque el orden resultante coincida con el de por defecto.
    pintar([row()], { sort: null });
    const activas = screen
      .getAllByRole('columnheader')
      .filter((th) => ['ascending', 'descending'].includes(th.getAttribute('aria-sort') ?? ''));
    expect(activas).toHaveLength(0);
  });
});

describe('SRCH-01 · acciones de fila', () => {
  it('Consultar avisa con el id de la línea', async () => {
    const h = pintar([row({ id: 'linea-1' })]);
    await userEvent.click(within(filas()[0]!).getByRole('button', { name: 'Consultar' }));
    expect(h.onConsult).toHaveBeenCalledWith('linea-1');
  });

  it('Contactar avisa con el id de la organización, que es con quien se habla', async () => {
    const h = pintar([row({ orgId: 'org-9' })]);
    await userEvent.click(within(filas()[0]!).getByRole('button', { name: 'Contactar' }));
    expect(h.onContact).toHaveBeenCalledWith('org-9');
  });

  it('una fila ya consultada deshabilita Consultar y dice por qué', () => {
    pintar([row({ consulted: true })]);
    const boton = within(filas()[0]!).getByRole('button', { name: 'Consultar' });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAccessibleDescription(/consultada/i);
  });

  it('Contactar sigue habilitado en una fila ya consultada, sin excepción (spec §7)', () => {
    pintar([row({ consulted: true })]);
    expect(within(filas()[0]!).getByRole('button', { name: 'Contactar' })).toBeEnabled();
  });

  it('la fila consultada se distingue de forma permanente', () => {
    pintar([row({ id: 'a' }), row({ id: 'b', consulted: true })]);
    expect(filas()[1]!.className).not.toBe(filas()[0]!.className);
  });
});

describe('SRCH-01 · favoritos', () => {
  /**
   * El botón se busca por su ESTADO (`aria-pressed`), no por su nombre accesible.
   * La corrida 1 lo buscaba por `/12/` dando por hecho que el recuento estaría en
   * el nombre; el Coder puso `aria-label="Añadir favorita <organización>"`, que
   * para un lector de pantalla es mejor —y `aria-label` tapa el texto interno—.
   * El contrato fija el estado accesible y que el recuento se vea; cómo se llame
   * el botón es suyo. Ver F-047.
   */
  it('enseña el recuento agregado y avisa con la organización, no con la línea', async () => {
    const h = pintar([row({ orgId: 'org-9', favoriteCount: 12 })]);
    const fila = filas()[0]!;
    expect(within(fila).getByText('12')).toBeInTheDocument();
    await userEvent.click(within(fila).getByRole('button', { pressed: false }));
    expect(h.onToggleFavorite).toHaveBeenCalledWith('org-9');
  });

  it('distingue marcada de no marcada por estado accesible, no solo por color', () => {
    pintar([row({ id: 'a', isFavorite: false }), row({ id: 'b', isFavorite: true })]);
    expect(within(filas()[0]!).getByRole('button', { pressed: false })).toBeInTheDocument();
    expect(within(filas()[1]!).getByRole('button', { pressed: true })).toBeInTheDocument();
  });
});

describe('SRCH-01 · estado vacío', () => {
  /**
   * Vive aquí y no en la pantalla, igual que en MSG-01: "no hay filas" es un
   * estado de la lista. Si lo deciden los dos, acaban discrepando.
   */
  it('es el literal de la spec §6', () => {
    pintar([]);
    expect(screen.getByText('No hemos encontrado stock con estos filtros.')).toBeInTheDocument();
  });

  /**
   * Una fila con `colSpan` es la forma correcta de poner un estado vacío DENTRO
   * de una `<table>`, y es lo que hizo el Coder. La corrida 1 exigía cero filas
   * de cuerpo, que habría obligado a sacar el mensaje fuera de la tabla o a
   * romper la semántica. Lo que sí importa —y es lo que este test guarda— es que
   * no haya ninguna fila de DATOS inventada.
   */
  it('no pinta filas de datos ni promete un recuento', () => {
    pintar([]);
    const cuerpo = screen.getAllByRole('row').slice(1);
    expect(cuerpo).toHaveLength(1);
    expect(within(cuerpo[0]!).getByText('No hemos encontrado stock con estos filtros.')).toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
});
