import { useSession } from './lib/session';
import { AppShell } from './shell/AppShell';
import { Login } from './screens/Login';
import { Welcome } from './screens/Welcome';

export function App() {
  const { state, error, signIn, signOut } = useSession();

  if (state.status === 'loading') {
    return <div style={{ height: '100%', background: '#1B2537' }} aria-busy="true" />;
  }

  if (state.status === 'anonymous') {
    return <Login onSubmit={signIn} error={error} />;
  }

  // Autenticado en Auth pero sin fila en `members`. Pasa si alguien crea el
  // usuario sin provisionar el miembro; se dice en claro en vez de mostrar un
  // shell vacío con "—" por todas partes.
  if (state.status === 'orphan') {
    return (
      <Login
        onSubmit={signIn}
        error={`La cuenta ${state.email} existe pero no está asignada a ninguna organización. Habla con el operador.`}
      />
    );
  }

  return (
    <AppShell profile={state.profile} onSignOut={signOut}>
      <Welcome profile={state.profile} />
    </AppShell>
  );
}
