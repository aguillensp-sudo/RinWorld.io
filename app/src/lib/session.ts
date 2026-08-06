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
 */
async function loadProfile(userId: string, email: string): Promise<State> {
  const { data, error } = await supabase
    .from('members')
    .select('id, email, full_name, role, state, org_id, organizations(name, country)')
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
          setError(e instanceof Error ? e.message : String(e));
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
