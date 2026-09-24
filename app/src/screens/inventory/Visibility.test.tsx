import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CountryOption, Exclusion, ExclusionTarget, OrgCandidate, VisibilityMode, VisibilityState } from '../../lib/visibility';
import type { Zone } from '../../lib/search';
import type { MemberProfile } from '../../lib/session';

/**
 * CONTRATO DE ACEPTACIÓN · INV-07 · pantalla (`Visibility`).
 *
 * Escrito antes que el código y por Claude Code. El Coder no lo ve. Se mockean
 * **solo** las siete funciones de `lib/visibility` que tocan red; el resto -modos,
 * agrupación, candidatos, etiquetas- sigue siendo el de verdad.
 *
 * ⚠ Lo que este fichero NO puede cazar, y por eso existe `app/e2e/visibility.spec.ts`:
 * que la RLS deje escribir solo al ADMIN y que la exclusión oculte de verdad el
 * stock -aquí todo está mockeado y siempre «funciona».
 */

const fetchVisibility = vi.fn<(orgId: string) => Promise<VisibilityState>>();
const fetchOrgCandidates = vi.fn<() => Promise<OrgCandidate[]>>();
const fetchContinentCountries = vi.fn<(c: Zone) => Promise<CountryOption[]>>();
const addExclusion = vi.fn<(orgId: string, t: ExclusionTarget) => Promise<void>>();
const removeExclusion = vi.fn<(id: string) => Promise<void>>();
const saveVisibilityMode = vi.fn<(orgId: string, m: VisibilityMode) => Promise<void>>();

vi.mock('../../lib/visibility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/visibility')>()),
  fetchVisibility: (o: string) => fetchVisibility(o),
  fetchOrgCandidates: () => fetchOrgCandidates(),
  fetchContinentCountries: (c: Zone) => fetchContinentCountries(c),
  addExclusion: (o: string, t: ExclusionTarget) => addExclusion(o, t),
  removeExclusion: (id: string) => removeExclusion(id),
  saveVisibilityMode: (o: string, m: VisibilityMode) => saveVisibilityMode(o, m),
}));

const { Visibility } = await import('./Visibility');

const admin = { id: 'm-1', orgId: 'org-me', role: 'ADMIN' } as unknown as MemberProfile;
const editor = { id: 'm-2', orgId: 'org-me', role: 'EDITOR' } as unknown as MemberProfile;

function ex(id: string, kind: Exclusion['kind'], label: string, over: Partial<Exclusion> = {}): Exclusion {
  return { id, kind, orgId: kind === 'ORG' ? `o-${id}` : null, label, continent: null, country: null, ...over };
}

/** Spec §3, «Datos de ejemplo». */
const EJEMPLO: Exclusion[] = [
  ex('1', 'ORG', 'Rodamientos Express SL'),
  ex('2', 'ORG', 'Nordic Bearings AB'),
  ex('3', 'CONTINENT', 'Asia', { continent: 'AS' }),
  ex('4', 'COUNTRY', 'Rusia', { country: 'RU' }),
];

const CANDIDATOS: OrgCandidate[] = [
  { id: 'org-me', name: 'Rodamientos Ibéricos', country: 'ES' },
  { id: 'c1', name: 'Nordwälz Lager', country: 'DE' },
  { id: 'c2', name: 'Cuscinetti Padana', country: 'IT' },
];

beforeEach(() => {
  fetchVisibility.mockReset().mockResolvedValue({ mode: 'RESTRINGIDA', exclusions: EJEMPLO });
  fetchOrgCandidates.mockReset().mockResolvedValue(CANDIDATOS);
  fetchContinentCountries.mockReset().mockResolvedValue([{ code: 'JP', label: 'Japón' }]);
  addExclusion.mockReset().mockResolvedValue();
  removeExclusion.mockReset().mockResolvedValue();
  saveVisibilityMode.mockReset().mockResolvedValue();
});

async function montar(profile = admin) {
  render(<Visibility profile={profile} />);
  await screen.findByRole('radio', { name: /Visibilidad restringida/ });
}

const panel = () => screen.queryByTestId('exclusion-panel');

describe('Visibility · cabecera y modos', () => {
  it('eyebrow, título y subtítulo literales de la spec §3', async () => {
    await montar();
    expect(screen.getByText('Módulo 02 · Gestión de Inventario')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Visibilidad del inventario' })).toBeInTheDocument();
    expect(
      screen.getByText('Controla quién puede ver tu stock en Bearingworld.io. El modo se aplica a todo tu inventario de forma inmediata.'),
    ).toBeInTheDocument();
  });

  it('pide fetchVisibility con la organización del miembro, una vez', async () => {
    await montar();
    expect(fetchVisibility).toHaveBeenCalledTimes(1);
    expect(fetchVisibility).toHaveBeenCalledWith('org-me');
  });

  it('un radiogroup con las dos opciones y sus descripciones, con el modo de la base seleccionado', async () => {
    await montar();
    expect(screen.getByRole('radiogroup', { name: 'Modo de visibilidad' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Visible para todos los miembros/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Visibilidad restringida/ })).toBeChecked();
    expect(screen.getByText('Cualquier distribuidor verificado en la plataforma puede consultar tu stock')).toBeInTheDocument();
    expect(screen.getByText('Solo miembros no excluidos explícitamente pueden ver tu inventario')).toBeInTheDocument();
  });

  it('con el modo abierto en la base, «Visible para todos» arranca seleccionado', async () => {
    fetchVisibility.mockResolvedValue({ mode: 'VISIBLE_TODOS', exclusions: [] });
    render(<Visibility profile={admin} />);
    expect(await screen.findByRole('radio', { name: /Visible para todos los miembros/ })).toBeChecked();
  });

  it('el bloque informativo brass está siempre', async () => {
    await montar();
    expect(
      screen.getByText('Los cambios en la visibilidad tienen efecto inmediato — las organizaciones excluidas dejarán de ver tu stock en su próxima búsqueda.'),
    ).toBeInTheDocument();
  });

  it('un fallo de carga se pinta en un role=alert', async () => {
    fetchVisibility.mockRejectedValue(new Error('boom'));
    render(<Visibility profile={admin} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
  });
});

describe('Visibility · el panel de exclusión según el modo', () => {
  it('modo restringido: el panel está activo y agrupa las exclusiones por tipo', async () => {
    await montar();
    expect(panel()).toHaveAttribute('data-active', 'true');
    const orgs = screen.getByRole('region', { name: 'Exclusión por organización' });
    expect(within(orgs).getByText('Nordic Bearings AB')).toBeInTheDocument();
    expect(within(orgs).getByText('Rodamientos Express SL')).toBeInTheDocument();
    const geo = screen.getByRole('region', { name: 'Exclusión por geografía' });
    expect(within(geo).getByText('Asia')).toBeInTheDocument();
    expect(within(geo).getByText('Rusia')).toBeInTheDocument();
  });

  it('cambiar a «Visible para todos» desactiva el panel (se conserva la lista) y avisa', async () => {
    await montar();
    await userEvent.click(screen.getByRole('radio', { name: /Visible para todos los miembros/ }));
    expect(panel()).toHaveAttribute('data-active', 'false');
    expect(screen.getByText('Nordic Bearings AB')).toBeInTheDocument();
    expect(screen.getByText('Tu lista de exclusión se conserva — si vuelves al modo restringido, se reactivará automáticamente.')).toBeInTheDocument();
    expect(removeExclusion).not.toHaveBeenCalled();
  });

  it('volver a «Visibilidad restringida» reactiva el panel y quita el aviso', async () => {
    await montar();
    await userEvent.click(screen.getByRole('radio', { name: /Visible para todos los miembros/ }));
    await userEvent.click(screen.getByRole('radio', { name: /Visibilidad restringida/ }));
    expect(panel()).toHaveAttribute('data-active', 'true');
    expect(screen.queryByText(/Tu lista de exclusión se conserva/)).not.toBeInTheDocument();
  });

  it('modo abierto y SIN exclusiones: no hay panel ni aviso', async () => {
    fetchVisibility.mockResolvedValue({ mode: 'VISIBLE_TODOS', exclusions: [] });
    render(<Visibility profile={admin} />);
    await screen.findByRole('radio', { name: /Visible para todos los miembros/ });
    expect(panel()).not.toBeInTheDocument();
    expect(screen.queryByText(/Tu lista de exclusión se conserva/)).not.toBeInTheDocument();
  });

  it('cambiar el radio NO guarda nada hasta pulsar Guardar configuración', async () => {
    await montar();
    await userEvent.click(screen.getByRole('radio', { name: /Visible para todos los miembros/ }));
    expect(saveVisibilityMode).not.toHaveBeenCalled();
  });
});

describe('Visibility · guardar', () => {
  it('Guardar configuración llama a saveVisibilityMode(org, modo elegido) y avisa en un role=status', async () => {
    await montar();
    await userEvent.click(screen.getByRole('radio', { name: /Visible para todos los miembros/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    await waitFor(() => expect(saveVisibilityMode).toHaveBeenCalledWith('org-me', 'VISIBLE_TODOS'));
    expect(await screen.findByRole('status')).toHaveTextContent('Configuración guardada. Los cambios tienen efecto inmediato.');
  });

  it('si guardar falla: role=alert y ningún aviso de éxito', async () => {
    saveVisibilityMode.mockRejectedValue(new Error('sin permiso'));
    await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('sin permiso');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('Visibility · exclusiones (efecto inmediato)', () => {
  it('escribir filtra los candidatos sin tildes, sin la propia organización ni las ya excluidas', async () => {
    await montar();
    fireEvent.change(screen.getByPlaceholderText('Buscar organización por nombre...'), { target: { value: 'nordwalz' } });
    expect(screen.getByRole('button', { name: 'Nordwälz Lager' })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Buscar organización por nombre...'), { target: { value: 'rodamientos' } });
    expect(screen.queryByRole('button', { name: 'Rodamientos Ibéricos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rodamientos Express SL' })).not.toBeInTheDocument();
  });

  it('elegir un candidato llama a addExclusion(org, {orgId}), repide la lista y vacía el buscador', async () => {
    await montar();
    fireEvent.change(screen.getByPlaceholderText('Buscar organización por nombre...'), { target: { value: 'nordwalz' } });
    await userEvent.click(screen.getByRole('button', { name: 'Nordwälz Lager' }));
    await waitFor(() => expect(addExclusion).toHaveBeenCalledWith('org-me', { orgId: 'c1' }));
    await waitFor(() => expect(fetchVisibility).toHaveBeenCalledTimes(2));
    expect(screen.getByPlaceholderText('Buscar organización por nombre...')).toHaveValue('');
  });

  it('quitar una etiqueta llama a removeExclusion(id) y repide la lista', async () => {
    await montar();
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Nordic Bearings AB' }));
    await waitFor(() => expect(removeExclusion).toHaveBeenCalledWith('2'));
    await waitFor(() => expect(fetchVisibility).toHaveBeenCalledTimes(2));
  });

  it('elegir continente pide sus países y ofrece el select de país', async () => {
    await montar();
    expect(screen.queryByLabelText('Refinar por país')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Excluir por continente'), { target: { value: 'AS' } });
    await waitFor(() => expect(fetchContinentCountries).toHaveBeenCalledWith('AS'));
    expect(await screen.findByLabelText('Refinar por país')).toBeInTheDocument();
  });

  it('añadir solo el continente llama a addExclusion(org, {continent})', async () => {
    await montar();
    fireEvent.change(screen.getByLabelText('Excluir por continente'), { target: { value: 'EU' } });
    await userEvent.click(screen.getByRole('button', { name: 'Añadir exclusión geográfica' }));
    await waitFor(() => expect(addExclusion).toHaveBeenCalledWith('org-me', { continent: 'EU' }));
    await waitFor(() => expect(fetchVisibility).toHaveBeenCalledTimes(2));
  });

  it('con un país elegido llama a addExclusion(org, {country}), no al continente', async () => {
    await montar();
    fireEvent.change(screen.getByLabelText('Excluir por continente'), { target: { value: 'AS' } });
    const sel = await screen.findByLabelText('Refinar por país');
    await within(sel).findByRole('option', { name: 'Japón' });
    fireEvent.change(sel, { target: { value: 'JP' } });
    await userEvent.click(screen.getByRole('button', { name: 'Añadir exclusión geográfica' }));
    await waitFor(() => expect(addExclusion).toHaveBeenCalledWith('org-me', { country: 'JP' }));
  });

  it('si añadir falla, el error va al panel y NO se repide la lista', async () => {
    addExclusion.mockRejectedValue(new Error('Ya está en tu lista de exclusión.'));
    await montar();
    fireEvent.change(screen.getByLabelText('Excluir por continente'), { target: { value: 'EU' } });
    await userEvent.click(screen.getByRole('button', { name: 'Añadir exclusión geográfica' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya está en tu lista de exclusión.');
    expect(fetchVisibility).toHaveBeenCalledTimes(1);
  });
});

describe('Visibility · un EDITOR solo lee', () => {
  it('avisa, y deja los radios, el guardado y el panel deshabilitados', async () => {
    await montar(editor);
    expect(screen.getByText('Solo un administrador de tu organización puede cambiar la visibilidad del inventario.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Visible para todos los miembros/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Visibilidad restringida/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeDisabled();
    expect(panel()).toHaveAttribute('data-active', 'false');
    expect(screen.getByText('Nordic Bearings AB')).toBeInTheDocument();
  });

  it('un ADMIN no ve ese aviso', async () => {
    await montar(admin);
    expect(screen.queryByText(/Solo un administrador/)).not.toBeInTheDocument();
  });
});
