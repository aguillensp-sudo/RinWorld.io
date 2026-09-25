import { supabase } from './supabase';
import { countryName } from './search';

/**
 * Capa de datos de DIR-02 · Ficha Pública de Organización (MSG-04 en la capability
 * `organization-directory`).
 *
 * **La escribe Claude Code a mano, no el Coder** (`CLAUDE.md` §3, y
 * `UMBRAL-FABRICA-V1.md` §1: la capa de datos es precondición de la pantalla, no
 * producto de la fábrica). Mismo reparto que `directory.ts`: la lógica pura arriba
 * y suelta, para probarla sin base ni React; lo que toca red, al final.
 *
 * ⚠ **CUATRO COSAS QUE LA SPEC Y EL ESQUEMA NO DICEN IGUAL**, descubiertas
 * cruzando el HTML aprobado con el catálogo de la base:
 *
 * 1. **La spec dice `ACTIVA` y el estado en la base es `APPROVED`.** Mismo desfase
 *    que `directory.ts` (punto 1): `organizations_status_chk` no tiene `ACTIVE`.
 *    La insignia dice `ACTIVA` y se pinta solo si `status = 'APPROVED'`.
 * 2. **Dirección, ciudad y código postal no existían**: `0036` las añade, con las
 *    mismas reglas que el contacto público (`0027`): públicas de leer, y las
 *    escribe el operador.
 * 3. **`Contactar` sin hilo previo NO se puede construir con el esquema actual.** La
 *    spec pide *"sin requerir cantidad ni referencia"*, pero el único camino que
 *    crea un hilo es `create_inquiry` (0014), que exige una línea de inventario
 *    PUBLICADA. Hilo libre sin referencia es una capacidad de la mensajería, no de
 *    esta pantalla (*"Gestión del hilo… capability messaging-and-negotiation"*,
 *    spec, Out of Scope). Con hilo previo, sí: se abre (`fetchThreadWithOrg`).
 * 4. **La ficha no lee las reglas de visibilidad de inventario, y no debe.**
 *    `open-public-contact-data`: el contacto es visible para cualquier miembro
 *    aunque la organización tenga el inventario RESTRINGIDO. `organizations` se
 *    lee por `organizations_select_approved`, que solo mira el estado.
 */

// -----------------------------------------------------------------------------
// Lo puro
// -----------------------------------------------------------------------------

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

/**
 * *"Miembro desde: Febrero 2024"*. Mes en español con la inicial en mayúscula y
 * año, sin la preposición que da `Intl` (`febrero de 2024`), y **a mano** porque
 * el formato del diseño no es el de ningún `dateStyle` del CLDR. Se lee en UTC: una
 * fecha `2024-02-01T00:00:00Z` en un navegador al oeste de Greenwich sería enero
 * si se leyera en hora local.
 */
export function memberSinceLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Las iniciales del avatar. Si el primer término es una sigla en mayúsculas de dos
 * a cuatro letras (`NSK Europe Ltd`, `SKF Ibérica`), es la sigla entera; si no, la
 * inicial de las dos primeras palabras (`Rodamientos Ibéricos` → `RI`). Nunca vacía
 * para un nombre no vacío.
 */
export function organizationInitials(name: string): string {
  const palabras = name.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '';
  const primera = palabras[0]!;
  const esSigla = primera.length >= 2 && primera.length <= 4 && primera === primera.toUpperCase() && primera !== primera.toLowerCase();
  if (esSigla) return primera;
  return palabras
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

/** *"★ 21 favoritos"*; en singular, *"★ 1 favorito"*. */
export function favoritesLabel(count: number): string {
  const n = Math.max(0, Math.trunc(count));
  return `★ ${n} ${n === 1 ? 'favorito' : 'favoritos'}`;
}

/** La insignia de estado. Solo `APPROVED` es `ACTIVA` (ver cabecera, punto 1). */
export function statusBadge(status: string): string {
  return status === 'APPROVED' ? 'ACTIVA' : status;
}

/**
 * Las dos líneas de la dirección, como en el diseño: la calle y, debajo,
 * `<código postal> <ciudad>`. Lo que falte se omite sin dejar huecos ni espacios
 * de sobra; sin nada, la lista vacía (la fila pinta un guion).
 */
export function addressLines(o: {
  address: string | null;
  postalCode: string | null;
  city: string | null;
}): string[] {
  const calle = (o.address ?? '').trim();
  const resto = [o.postalCode ?? '', o.city ?? ''].map((s) => s.trim()).filter(Boolean).join(' ');
  return [calle, resto].filter(Boolean);
}

/** El destino de `href="tel:"`: solo dígitos y el `+` inicial. */
export function telHref(phone: string): string {
  const limpio = phone.trim();
  const digitos = limpio.replace(/[^0-9]/g, '');
  return `tel:${limpio.startsWith('+') ? '+' : ''}${digitos}`;
}

// -----------------------------------------------------------------------------
// La ficha
// -----------------------------------------------------------------------------

export interface OrganizationProfile {
  id: string;
  name: string;
  initials: string;
  /** El nombre del país en el idioma de sesión (la ficha pinta `Alemania`, no `DE`). */
  countryLabel: string;
  /** `''` si no hay: la ficha pinta un guion, nunca `null`. */
  address: string;
  city: string;
  postalCode: string;
  /** Las dos líneas de dirección ya compuestas (`addressLines`). */
  addressLines: string[];
  memberSince: string;
  phone: string;
  email: string;
  favoriteCount: number;
  /** `ACTIVA` o el estado crudo (ver `statusBadge`). */
  status: string;
}

/** Lo que devuelve PostgREST, antes de tocarlo. */
export interface OrganizationProfileRaw {
  id: string;
  name: string;
  country: string;
  status: string;
  created_at: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  favorite_count: number | null;
}

export function toOrganizationProfile(raw: OrganizationProfileRaw): OrganizationProfile {
  return {
    id: raw.id,
    name: raw.name,
    initials: organizationInitials(raw.name),
    countryLabel: countryName(raw.country ?? ''),
    address: raw.address ?? '',
    city: raw.city ?? '',
    postalCode: raw.postal_code ?? '',
    addressLines: addressLines({ address: raw.address, postalCode: raw.postal_code, city: raw.city }),
    memberSince: memberSinceLabel(raw.created_at),
    phone: raw.contact_phone ?? '',
    email: raw.contact_email ?? '',
    favoriteCount: raw.favorite_count ?? 0,
    status: statusBadge(raw.status),
  };
}

const COLUMNS =
  'id, name, country, status, created_at, address, city, postal_code, contact_phone, contact_email, favorite_count';

// -----------------------------------------------------------------------------
// Red
// -----------------------------------------------------------------------------

/**
 * La ficha de una organización, o `null` si no existe o no es visible.
 *
 * El filtro `status = 'APPROVED'` va explícito aunque la RLS ya filtre, por la
 * misma razón que en `fetchOrganizations` (`directory.ts`, punto 2): la política
 * `organizations_select_approved` deja ver también la organización PROPIA en
 * cualquier estado, y sin el `.eq` una URL con el id de una organización en
 * `PENDING_REVIEW` propia pintaría una ficha pública que no debería existir.
 */
export async function fetchOrganizationProfile(id: string): Promise<OrganizationProfile | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select(COLUMNS)
    .eq('id', id)
    .eq('status', 'APPROVED')
    .maybeSingle();

  if (error) throw error;
  return data ? toOrganizationProfile(data as unknown as OrganizationProfileRaw) : null;
}

/**
 * El hilo que ya existe entre dos organizaciones, o `null`. Hay UNO como mucho por
 * pareja (`threads` guarda la pareja en orden canónico, `org_low_id < org_high_id`),
 * así que el orden en que se pasan las dos no importa: se ordenan aquí. La
 * comparación de cadenas equivale a la de `uuid` en Postgres porque los dos son
 * hexadecimales en minúscula de longitud fija.
 */
export async function fetchThreadWithOrg(ownOrgId: string, otherOrgId: string): Promise<string | null> {
  const [low, high] = ownOrgId < otherOrgId ? [ownOrgId, otherOrgId] : [otherOrgId, ownOrgId];
  const { data, error } = await supabase
    .from('threads')
    .select('id')
    .eq('org_low_id', low)
    .eq('org_high_id', high)
    .maybeSingle();

  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}
