import type { CountryOption, Exclusion, OrgCandidate } from '../../lib/visibility';
import type { Zone } from '../../lib/search';

interface Props {
  orgs: Exclusion[];
  geo: Exclusion[];
  candidates: OrgCandidate[];
  query: string;
  continent: Zone | '';
  country: string;
  countries: CountryOption[];
  /** Panel inactivo: modo abierto (la lista se conserva) o miembro sin permiso. */
  disabled: boolean;
  busy: boolean;
  error: string | null;
  onQueryChange: (query: string) => void;
  onPickOrg: (candidate: OrgCandidate) => void;
  onContinentChange: (continent: Zone | '') => void;
  onCountryChange: (country: string) => void;
  onAddGeo: () => void;
  onRemove: (exclusion: Exclusion) => void;
}

/**
 * INV-07 · panel de la lista de exclusión (spec §3) -- MARCADOR
 * (`ExclusionPanel.test.tsx` es el contrato, en rojo a propósito hasta la
 * corrida). La tarea del arnés sustituye este fichero entero.
 */
export function ExclusionPanel(_props: Props) {
  return <div data-testid="exclusion-panel" />;
}
