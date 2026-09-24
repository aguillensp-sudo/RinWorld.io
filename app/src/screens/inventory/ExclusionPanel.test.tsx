import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CountryOption, Exclusion, OrgCandidate } from '../../lib/visibility';
import type { Zone } from '../../lib/search';
import { ExclusionPanel } from './ExclusionPanel';

/**
 * CONTRATO DE ACEPTACIÓN · INV-07 · panel de exclusión (`ExclusionPanel`).
 *
 * Escrito antes que el código y por Claude Code. El Coder no lo ve. PRESENTACIONAL:
 * nada de red y nada de estado propio; todo llega por props. Los ejemplos son los de
 * la spec §3 («Datos de ejemplo»).
 */

function ex(id: string, kind: Exclusion['kind'], label: string): Exclusion {
  return { id, kind, orgId: kind === 'ORG' ? `o-${id}` : null, label, continent: null, country: null };
}

const ORGS = [ex('1', 'ORG', 'Rodamientos Express SL'), ex('2', 'ORG', 'Nordic Bearings AB')];
const GEO = [ex('3', 'CONTINENT', 'Asia'), ex('4', 'COUNTRY', 'Rusia')];
const CANDIDATOS: OrgCandidate[] = [
  { id: 'c1', name: 'Nordwälz Lager', country: 'DE' },
  { id: 'c2', name: 'Cuscinetti Padana', country: 'IT' },
];
const PAISES: CountryOption[] = [
  { code: 'JP', label: 'Japón' },
  { code: 'CN', label: 'China' },
];

function montar(over: Partial<Parameters<typeof ExclusionPanel>[0]> = {}) {
  const h = {
    onQueryChange: vi.fn(),
    onPickOrg: vi.fn(),
    onContinentChange: vi.fn(),
    onCountryChange: vi.fn(),
    onAddGeo: vi.fn(),
    onRemove: vi.fn(),
  };
  render(
    <ExclusionPanel
      orgs={ORGS}
      geo={GEO}
      candidates={[]}
      query=""
      continent=""
      country=""
      countries={[]}
      disabled={false}
      busy={false}
      error={null}
      {...h}
      {...over}
    />,
  );
  return h;
}

describe('ExclusionPanel · organizaciones', () => {
  it('subsección con su título, su input y su hint literales (spec §3)', () => {
    montar();
    const sec = screen.getByRole('region', { name: 'Exclusión por organización' });
    expect(within(sec).getByPlaceholderText('Buscar organización por nombre...')).toBeInTheDocument();
    expect(within(sec).getByText('EFECTO INMEDIATO AL AÑADIR')).toBeInTheDocument();
  });

  it('las excluidas salen como tags eliminables, con el nombre accesible del botón', async () => {
    const h = montar();
    const sec = screen.getByRole('region', { name: 'Exclusión por organización' });
    expect(within(sec).getByText('Rodamientos Express SL')).toBeInTheDocument();
    expect(within(sec).getByText('Nordic Bearings AB')).toBeInTheDocument();
    await userEvent.click(within(sec).getByRole('button', { name: 'Quitar Nordic Bearings AB' }));
    expect(h.onRemove).toHaveBeenCalledWith(ORGS[1]);
  });

  it('escribir en el buscador llama a onQueryChange con el texto', () => {
    const h = montar();
    fireEvent.change(screen.getByPlaceholderText('Buscar organización por nombre...'), { target: { value: 'nord' } });
    expect(h.onQueryChange).toHaveBeenCalledWith('nord');
  });

  it('los candidatos son botones; pulsar uno llama a onPickOrg con el candidato', async () => {
    const h = montar({ candidates: CANDIDATOS, query: 'n' });
    await userEvent.click(screen.getByRole('button', { name: 'Nordwälz Lager' }));
    expect(h.onPickOrg).toHaveBeenCalledWith(CANDIDATOS[0]);
  });

  it('las sugerencias son un desplegable con su título, distinto de las etiquetas ya excluidas (24-sep)', () => {
    montar({ candidates: CANDIDATOS, query: 'n' });
    expect(screen.getByText('Selecciona la organización que quieres excluir')).toBeInTheDocument();
  });

  it('escribir algo que no coincide con ninguna organización lo dice, y NO ofrece añadir lo escrito', () => {
    montar({ candidates: [], query: 'zzzz' });
    expect(screen.getByText('Ninguna organización coincide con «zzzz».')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'zzzz' })).not.toBeInTheDocument();
  });

  it('sin texto escrito no hay mensaje de «sin coincidencias»', () => {
    montar({ candidates: [], query: '' });
    expect(screen.queryByText(/Ninguna organización coincide/)).not.toBeInTheDocument();
  });

  it('sin candidatos no pinta ninguna lista de sugerencias', () => {
    montar({ candidates: [] });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nordwälz Lager' })).not.toBeInTheDocument();
  });

  it('sin organizaciones excluidas, ningún tag', () => {
    montar({ orgs: [] });
    const sec = screen.getByRole('region', { name: 'Exclusión por organización' });
    expect(within(sec).queryAllByRole('button', { name: /^Quitar/ })).toHaveLength(0);
  });
});

describe('ExclusionPanel · geografía', () => {
  it('subsección con su título y su hint literal', () => {
    montar();
    const sec = screen.getByRole('region', { name: 'Exclusión por geografía' });
    expect(within(sec).getByText('EXCLUYE TODAS LAS ORGANIZACIONES CON SEDE EN ESA GEOGRAFÍA')).toBeInTheDocument();
  });

  it('el select de continente tiene el placeholder y los seis continentes en el orden de la spec', () => {
    montar();
    const sel = screen.getByLabelText('Excluir por continente') as HTMLSelectElement;
    const opts = Array.from(sel.options).map((o) => o.textContent);
    expect(opts).toEqual([
      'Selecciona un continente',
      'Europa',
      'Asia',
      'América del Norte',
      'América del Sur',
      'África',
      'Oceanía',
    ]);
    expect(sel.options[0]).toHaveValue('');
    expect(sel.options[2]).toHaveValue('AS');
  });

  it('cambiar de continente llama a onContinentChange con el código, y vaciar con cadena vacía', () => {
    const h = montar();
    fireEvent.change(screen.getByLabelText('Excluir por continente'), { target: { value: 'AS' } });
    expect(h.onContinentChange).toHaveBeenLastCalledWith('AS');
    fireEvent.change(screen.getByLabelText('Excluir por continente'), { target: { value: '' } });
    expect(h.onContinentChange).toHaveBeenLastCalledWith('');
  });

  it('el select de país SOLO aparece con un continente elegido, con su placeholder', () => {
    const { unmount } = render(
      <ExclusionPanel
        orgs={[]} geo={[]} candidates={[]} query="" continent="" country="" countries={[]}
        disabled={false} busy={false} error={null}
        onQueryChange={vi.fn()} onPickOrg={vi.fn()} onContinentChange={vi.fn()} onCountryChange={vi.fn()}
        onAddGeo={vi.fn()} onRemove={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Refinar por país')).not.toBeInTheDocument();
    unmount();
    montar({ continent: 'AS' as Zone, countries: PAISES });
    const sel = screen.getByLabelText('Refinar por país') as HTMLSelectElement;
    expect(Array.from(sel.options).map((o) => o.textContent)).toEqual(['Todos los países del continente', 'Japón', 'China']);
  });

  it('elegir un país llama a onCountryChange con el código', () => {
    const h = montar({ continent: 'AS' as Zone, countries: PAISES });
    fireEvent.change(screen.getByLabelText('Refinar por país'), { target: { value: 'JP' } });
    expect(h.onCountryChange).toHaveBeenCalledWith('JP');
  });

  it('Añadir exclusión geográfica: deshabilitado sin continente, habilitado con él, y llama a onAddGeo', async () => {
    const { unmount } = render(
      <ExclusionPanel
        orgs={[]} geo={[]} candidates={[]} query="" continent="" country="" countries={[]}
        disabled={false} busy={false} error={null}
        onQueryChange={vi.fn()} onPickOrg={vi.fn()} onContinentChange={vi.fn()} onCountryChange={vi.fn()}
        onAddGeo={vi.fn()} onRemove={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Añadir exclusión geográfica' })).toBeDisabled();
    unmount();
    const h = montar({ continent: 'AS' as Zone, countries: PAISES });
    const b = screen.getByRole('button', { name: 'Añadir exclusión geográfica' });
    expect(b).toBeEnabled();
    await userEvent.click(b);
    expect(h.onAddGeo).toHaveBeenCalledTimes(1);
  });

  it('las exclusiones geográficas (continentes y países) salen como tags eliminables', async () => {
    const h = montar();
    const sec = screen.getByRole('region', { name: 'Exclusión por geografía' });
    // `Asia` también es una <option> del select de continentes: se busca la etiqueta por su botón.
    expect(within(sec).getByRole('button', { name: 'Quitar Asia' })).toBeInTheDocument();
    expect(within(sec).getByText('Rusia')).toBeInTheDocument();
    await userEvent.click(within(sec).getByRole('button', { name: 'Quitar Rusia' }));
    expect(h.onRemove).toHaveBeenCalledWith(GEO[1]);
  });
});

describe('ExclusionPanel · inactivo y ocupado', () => {
  it('con disabled: buscador, selects, añadir y todos los Quitar quedan deshabilitados, y los tags SIGUEN visibles', () => {
    montar({ disabled: true, continent: 'AS' as Zone, countries: PAISES });
    expect(screen.getByPlaceholderText('Buscar organización por nombre...')).toBeDisabled();
    expect(screen.getByLabelText('Excluir por continente')).toBeDisabled();
    expect(screen.getByLabelText('Refinar por país')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Añadir exclusión geográfica' })).toBeDisabled();
    for (const b of screen.getAllByRole('button', { name: /^Quitar/ })) expect(b).toBeDisabled();
    expect(screen.getByText('Rodamientos Express SL')).toBeInTheDocument();
  });

  it('el panel inactivo lo declara con data-active="false" (el activo, "true")', () => {
    const { unmount } = render(
      <ExclusionPanel
        orgs={ORGS} geo={GEO} candidates={[]} query="" continent="" country="" countries={[]}
        disabled busy={false} error={null}
        onQueryChange={vi.fn()} onPickOrg={vi.fn()} onContinentChange={vi.fn()} onCountryChange={vi.fn()}
        onAddGeo={vi.fn()} onRemove={vi.fn()}
      />,
    );
    expect(screen.getByTestId('exclusion-panel')).toHaveAttribute('data-active', 'false');
    unmount();
    montar();
    expect(screen.getByTestId('exclusion-panel')).toHaveAttribute('data-active', 'true');
  });

  it('con busy se deshabilitan las acciones', () => {
    montar({ busy: true, continent: 'AS' as Zone, countries: PAISES });
    expect(screen.getByRole('button', { name: 'Añadir exclusión geográfica' })).toBeDisabled();
    for (const b of screen.getAllByRole('button', { name: /^Quitar/ })) expect(b).toBeDisabled();
  });

  it('un error se pinta en un role=alert', () => {
    montar({ error: 'Ya está en tu lista de exclusión.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Ya está en tu lista de exclusión.');
  });
});
