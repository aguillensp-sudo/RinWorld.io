import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { CountryOption, ExclusionTarget, OrgCandidate, VisibilityMode, VisibilityState } from '../../lib/visibility';
import type { Zone } from '../../lib/search';
import type { MemberProfile } from '../../lib/session';

/**
 * FUERA DE CONTRATO · INV-07 · continentes que llegan desordenados (F-250). Escrito a mano.
 *
 * El contrato de aceptación de INV-07 (`Visibility.test.tsx`) es el de la tarea del arnés y no se toca para
 * otra cosa (`F-116`). Aquí vive lo que no pedía: el selector de continente no se desactiva con `busy`, así
 * que se puede cambiar de A a B con la petición de A en vuelo, y si la de A llegaba la última dejaba en el
 * selector de país los países de A bajo el continente B. Solo la última elección escribe países, error o
 * fin de carga.
 */

const fetchVisibility = vi.fn<(orgId: string) => Promise<VisibilityState>>();
const fetchOrgCandidates = vi.fn<() => Promise<OrgCandidate[]>>();
const fetchContinentCountries = vi.fn<(c: Zone) => Promise<CountryOption[]>>();

vi.mock('../../lib/visibility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/visibility')>()),
  fetchVisibility: (o: string) => fetchVisibility(o),
  fetchOrgCandidates: () => fetchOrgCandidates(),
  fetchContinentCountries: (c: Zone) => fetchContinentCountries(c),
  addExclusion: (_o: string, _t: ExclusionTarget) => Promise.resolve(),
  removeExclusion: (_id: string) => Promise.resolve(),
  saveVisibilityMode: (_o: string, _m: VisibilityMode) => Promise.resolve(),
}));

const { Visibility } = await import('./Visibility');

const admin = { id: 'm-1', orgId: 'org-me', role: 'ADMIN' } as unknown as MemberProfile;

/** Una promesa que se resuelve o se rechaza cuando el test lo decide. */
function diferida() {
  let resolver: (c: CountryOption[]) => void = () => {};
  let rechazar: (e: unknown) => void = () => {};
  const promesa = new Promise<CountryOption[]>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

const esperar = () => new Promise((r) => setTimeout(r, 30));
const elegirContinente = (code: Zone) =>
  fireEvent.change(screen.getByLabelText('Excluir por continente'), { target: { value: code } });

/** Asia (la vieja) queda en vuelo; el usuario cambia a Europa (la nueva) antes de que llegue. */
async function montarConAsiaYEuropaEnVuelo() {
  const asia = diferida();
  const europa = diferida();
  fetchContinentCountries.mockImplementation((c) => (c === 'AS' ? asia.promesa : europa.promesa));

  render(<Visibility profile={admin} />);
  await screen.findByRole('radio', { name: /Visibilidad restringida/ });

  elegirContinente('AS');
  await waitFor(() => expect(fetchContinentCountries).toHaveBeenCalledWith('AS'));
  elegirContinente('EU');
  await waitFor(() => expect(fetchContinentCountries).toHaveBeenCalledWith('EU'));

  return { asia, europa };
}

beforeEach(() => {
  fetchVisibility.mockReset().mockResolvedValue({ mode: 'RESTRINGIDA', exclusions: [] });
  fetchOrgCandidates.mockReset().mockResolvedValue([]);
  fetchContinentCountries.mockReset();
});

describe('INV-07 · continentes que llegan desordenados', () => {
  it('los países de un continente viejo que llegan los últimos no pisan los del elegido', async () => {
    const { asia, europa } = await montarConAsiaYEuropaEnVuelo();

    europa.resolver([{ code: 'DE', label: 'Alemania' }]);
    const selector = await screen.findByLabelText('Refinar por país');
    await within(selector).findByRole('option', { name: 'Alemania' });

    // Llegan los de Asia, los últimos: el selector sigue siendo el de Europa.
    asia.resolver([{ code: 'JP', label: 'Japón' }]);
    await esperar();
    expect(within(selector).getByRole('option', { name: 'Alemania' })).toBeInTheDocument();
    expect(within(selector).queryByRole('option', { name: 'Japón' })).not.toBeInTheDocument();
  });

  it('un fallo del continente viejo ni pinta el error ni libera el «ocupado» del nuevo', async () => {
    const { asia, europa } = await montarConAsiaYEuropaEnVuelo();

    // Con Europa en vuelo, «Guardar configuración» sigue deshabilitado (`busy`).
    const guardar = screen.getByRole('button', { name: 'Guardar configuración' });
    expect(guardar).toBeDisabled();

    asia.rechazar(new Error('timeout de Asia'));
    await esperar();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(guardar).toBeDisabled();

    europa.resolver([{ code: 'DE', label: 'Alemania' }]);
    const selector = await screen.findByLabelText('Refinar por país');
    await within(selector).findByRole('option', { name: 'Alemania' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await waitFor(() => expect(guardar).toBeEnabled());
  });
});
