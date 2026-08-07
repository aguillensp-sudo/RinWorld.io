import { useState } from 'react';
import { useSession } from './lib/session';
import { AppShell, navIndexOf } from './shell/AppShell';
import { Login } from './screens/Login';
import { Welcome } from './screens/Welcome';
import { Inventory } from './screens/inventory/Inventory';

/**
 * Qué pantalla va con qué ítem de nav.
 *
 * `INV-01` cuelga de **Vendiendo**, no de Inventario, porque su spec §2 lo dice
 * literalmente: "Ítem activo en nav: **Vendiendo**". No es lo que uno supondría
 * leyendo los ocho nombres, y por eso está escrito aquí con el puntero al lado.
 * Los otros seis ítems no tienen pantalla en el MVP (Plan §9, 8 pantallas).
 */
const INVENTORY_NAV = navIndexOf('Vendiendo');
const HOME_NAV = navIndexOf('Panel');

/** INV-01 §5: "Subtítulo del panel: `Agente de inventario`". Ver F-025. */
const INVENTORY_VERA_SUBTITLE = 'Agente de inventario';

export function App() {
  const { state, error, signIn, signOut } = useSession();
  const [nav, setNav] = useState(HOME_NAV);

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

  const onInventory = nav === INVENTORY_NAV;

  return (
    <AppShell
      profile={state.profile}
      onSignOut={signOut}
      activeNav={nav}
      onNavigate={setNav}
      {...(onInventory ? { veraSubtitle: INVENTORY_VERA_SUBTITLE } : {})}
    >
      {onInventory ? <Inventory profile={state.profile} /> : <Welcome profile={state.profile} />}
    </AppShell>
  );
}
