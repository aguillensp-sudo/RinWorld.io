import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

/** Lo que la sesión necesita saber del miembro y su organización. */
export interface MemberProfile {
  id: string;
  email: string;
  fullName: string | null;
  role: 'ADMIN' | 'EDITOR';
  state: string;
  orgId: string;
  orgName: string;
  orgCountry: string;
}

/**
 * Iniciales para el avatar del sidebar. Función pura y exportada porque es lo
 * único del perfil con lógica propia, y se prueba en session.test.ts.
 */
export function initials(fullName: string | null, email: string): string {
  const source = (fullName ?? '').trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
    const out = (first + last).toUpperCase();
    if (out) return out;
  }
  return (email.trim()[0] ?? '?').toUpperCase();
}

/**
 * Mensaje legible de cualquier cosa que se lance aquí.
 *
 * Por qué no vale `String(e)`: los errores de PostgREST y de GoTrue son objetos
 * planos (`{ message, code, details, hint }`), no instancias de `Error`, así que
 * `String(e)` devuelve literalmente `"[object Object]"`. Eso es lo que la pantalla
 * de login estuvo enseñando cuando la migración 0005 rompió el embed del perfil:
 * un error rojo que no decía nada, tapando un `PGRST201` que sí lo decía todo.
 * Un mensaje de error que no identifica el fallo cuesta más que no tenerlo. F-020.
 */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null) {
    const o = e as { message?: unknown; code?: unknown; hint?: unknown };
    const parts = [
      typeof o.message === 'string' ? o.message : null,
      typeof o.code === 'string' ? `[${o.code}]` : null,
      typeof o.hint === 'string' ? o.hint : null,
    ].filter((p): p is string => !!p);
    if (parts.length) return parts.join(' · ');
  }
  return String(e);
}

type State =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; profile: MemberProfile }
  /** Autenticado en Auth pero sin fila en `members`: cuenta a medio provisionar. */
  | { status: 'orphan'; email: string };

/**
 * La consulta va sin filtro de organización a propósito: RLS ya limita `members`
 * a la propia organización y `organizations` a las aprobadas. Si esto devolviera
 * filas de otra organización, el fallo estaría en la política, no aquí — y el
 * e2e de dos cuentas lo cazaría.
 *
 * ⚠ EL `!members_org_id_fkey` NO ES OPCIONAL. Escrito como `organizations(...)` a
 * secas, este embed funcionó hasta que la migración 0005 creó
 * `favorite_distributors`, que abre un SEGUNDO camino `members → organizations`
 * (many-to-many, vía sus dos claves ajenas). PostgREST dejó de poder elegir y
 * empezó a devolver `PGRST201` "Could not embed because more than one relationship
 * was found": el login se rompió al añadir una tabla que no toca ni a `members` ni
 * al login. Nombrar la FK hace que la consulta no dependa de cuántas tablas nuevas
 * apunten a `organizations` — y van a apuntar más. Ver F-020.
 */
async function loadProfile(userId: string, email: string): Promise<State> {
  const { data, error } = await supabase
    .from('members')
    .select(
      'id, email, full_name, role, state, org_id, organizations!members_org_id_fkey(name, country)',
    )
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { status: 'orphan', email };

  const org = data.organizations as unknown as { name: string; country: string } | null;
  return {
    status: 'authenticated',
    profile: {
      id: data.id as string,
      email: data.email as string,
      fullName: (data.full_name as string | null) ?? null,
      role: data.role as 'ADMIN' | 'EDITOR',
      state: data.state as string,
      orgId: data.org_id as string,
      orgName: org?.name ?? '—',
      orgCountry: org?.country ?? '—',
    },
  };
}

export function useSession() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const apply = async (userId: string | undefined, email: string | undefined) => {
      if (!userId || !email) {
        if (alive) setState({ status: 'anonymous' });
        return;
      }
      try {
        const next = await loadProfile(userId, email);
        if (alive) setState(next);
      } catch (e) {
        if (alive) {
          setError(errorMessage(e));
          setState({ status: 'anonymous' });
        }
      }
    };

    void supabase.auth.getSession().then(({ data }) => {
      void apply(data.session?.user.id, data.session?.user.email);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void apply(session?.user.id, session?.user.email);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: e } = await supabase.auth.signInWithPassword({ email, password });
    if (e) {
      setError(e.message);
      return false;
    }
    return true;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { state, error, signIn, signOut };
}
