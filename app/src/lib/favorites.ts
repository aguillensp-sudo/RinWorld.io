import { supabase } from './supabase';

/**
 * «Mis favoritos» (F-280): las distribuidoras que el miembro ha marcado. La lista es SUYA:
 * `favorites_select_own` (`0005`) ya limita la tabla a `member_id = auth.uid()`, así que el filtro
 * por `member_id` es explícito por claridad, no por seguridad.
 */
export interface FavoriteRow {
  orgId: string;
  name: string;
  country: string;
  /** Cuándo la marcó, ISO. */
  addedAt: string;
}

interface RawFavorite {
  distributor_org_id: string;
  created_at: string;
  organizations: { name: string; country: string } | null;
}

/**
 * Una organización que ya no se puede leer (suspendida o dada de baja: `organizations_select_approved`)
 * llega con `organizations: null`; se salta, porque no hay ficha a la que llevar ni nombre que enseñar.
 * Orden: la última marcada primero, y a igualdad el nombre.
 */
export function toFavoriteRows(raw: RawFavorite[]): FavoriteRow[] {
  return raw
    .filter((r): r is RawFavorite & { organizations: { name: string; country: string } } => r.organizations !== null)
    .map((r) => ({
      orgId: r.distributor_org_id,
      name: r.organizations.name,
      country: r.organizations.country,
      addedAt: r.created_at,
    }))
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt) || a.name.localeCompare(b.name, 'es-ES'));
}

export async function fetchMyFavorites(memberId: string): Promise<FavoriteRow[]> {
  const { data, error } = await supabase
    .from('favorite_distributors')
    .select('distributor_org_id, created_at, organizations(name, country)')
    .eq('member_id', memberId);
  if (error) throw error;
  return toFavoriteRows((data ?? []) as unknown as RawFavorite[]);
}

