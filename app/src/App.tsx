import { useState } from 'react';
import { useSession } from './lib/session';
import { AppShell, navIndexOf } from './shell/AppShell';
import { Login } from './screens/Login';
import { Welcome } from './screens/Welcome';
import { Inventory } from './screens/inventory/Inventory';
import { Messages } from './screens/messages/Messages';
import { SearchResults } from './screens/search/SearchResults';

/**
 * Qué pantalla va con qué ítem de nav.
 *
 * **`INV-01` cuelga de `Inventario`, aunque su spec §2 diga "Vendiendo".** Es la
 * única vez en el proyecto que se contradice un spec cerrado a propósito, así que
 * aquí queda la evidencia que lo justifica (F-025):
 *
 *   VND-01            spec "Vendiendo"  · HTML "Vendiendo"   -> coherente
 *   INV-03/04/07      spec "Inventario" · HTML "Inventario"  -> coherente
 *   INV-01, INV-02    spec "Vendiendo"  · HTML "Inventario"  -> las dos únicas que discrepan
 *
 * Los **cinco** HTML de INV marcan `Inventario` sin excepción, y **tres de las
 * cinco** specs de INV dicen lo mismo. "Vendiendo" es de VND-01 y se colaron en las
 * dos specs de INV más antiguas por copia de plantilla. No es una intención de
 * diseño: es una errata, y el PO la resolvió el 7-ago.
 *
 * Los otros cinco ítems no tienen pantalla en el MVP (Plan §9, 8 pantallas).
 */
const INVENTORY_NAV = navIndexOf('Inventario');
const MESSAGES_NAV = navIndexOf('Hilos');
/** SRCH-01 §2: "Ítem activo en nav: **Comprando**". Aquí spec y HTML aprobado
 *  coinciden, así que no hay nada que resolver como en F-025. */
const SEARCH_NAV = navIndexOf('Comprando');
const HOME_NAV = navIndexOf('Panel');

/** INV-01 §5: "Subtítulo del panel: `Agente de inventario`". Ver F-025. */
const INVENTORY_VERA_SUBTITLE = 'Agente de inventario';

/** MSG-01 §5: "**Subtítulo del panel:** `Agente de mensajería`". Aquí spec y HTML
 *  aprobado no discrepan, así que no hay nada que resolver como en F-025. */
const MESSAGES_VERA_SUBTITLE = 'Agente de mensajería';

/** SRCH-01 §5: "**Subtítulo del panel:** `Agente de búsqueda`". */
const SEARCH_VERA_SUBTITLE = 'Agente de búsqueda';

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
  const onMessages = nav === MESSAGES_NAV;
  const onSearch = nav === SEARCH_NAV;

  const veraSubtitle = onInventory
    ? INVENTORY_VERA_SUBTITLE
    : onMessages
      ? MESSAGES_VERA_SUBTITLE
      : onSearch
        ? SEARCH_VERA_SUBTITLE
        : undefined;

  return (
    <AppShell
      profile={state.profile}
      onSignOut={signOut}
      activeNav={nav}
      onNavigate={setNav}
      {...(veraSubtitle ? { veraSubtitle } : {})}
    >
      {onMessages ? (
        /*
         * `now` va explícito, y no por omisión como en INV-01, a propósito. El
         * contrato de aceptación lo pasa siempre (`Messages.test.tsx` monta
         * `<Messages profile={…} now={NOW} />`) pero no fija si es opcional. Si el
         * Coder lo declara obligatorio, un `<Messages profile={…} />` a secas
         * rompería `npm run typecheck` desde este fichero — que la tarea le prohíbe
         * tocar y que además no ve. Sería C1 en rojo por el wiring, no por el
         * artefacto, y con tope de tres intentos ese falso rojo se lleva por
         * delante la medición del día. Al revés no puede pasar: si no aceptara
         * `now`, su propio contrato no compilaría.
         *
         * Se construye en el render y no se congela al montar: con un `now` fijo,
         * una sesión abierta un par de horas acabaría diciendo "en 1 h" de un
         * elemento del pasado. Es el mismo comportamiento que el `new Date()` por
         * defecto de `relativeTime`.
         */
        <Messages profile={state.profile} now={new Date()} />
      ) : onSearch ? (
        /* Mismo criterio que arriba con `now`, y por la misma razón: explícito
         * desde aquí y construido en el render. La columna Antigüedad de SRCH-01
         * es tan sensible al reloj como el timestamp relativo de MSG-01 — con un
         * `now` congelado al montar, una sesión larga acabaría pintando en naranja
         * lo que ya debería estar en rojo. */
        <SearchResults profile={state.profile} now={new Date()} />
      ) : onInventory ? (
        <Inventory profile={state.profile} />
      ) : (
        <Welcome profile={state.profile} />
      )}
    </AppShell>
  );
}
