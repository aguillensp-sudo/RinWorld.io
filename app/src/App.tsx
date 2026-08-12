import { useState } from 'react';
import { useSession } from './lib/session';
import { supabase } from './lib/supabase';
import { createProxyCall } from './lib/vera';
import type { Screen } from './lib/vera-tools';
import type { SearchCriteria } from './lib/search';
import type { VeraAgent } from './shell/VeraPanel';
import { AppShell, navIndexOf } from './shell/AppShell';
import { Login } from './screens/Login';
import { Welcome } from './screens/Welcome';
import { Inventory } from './screens/inventory/Inventory';
import { Messages } from './screens/messages/Messages';
import { Thread } from './screens/messages/Thread';
import { SearchResults } from './screens/search/SearchResults';
import { SentOffers } from './screens/selling/SentOffers';

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
/** VND-01 §2: "Ítem activo en nav: **Vendiendo**". Aquí spec y HTML aprobado
 *  coinciden — es INV-01/INV-02 quien discrepa, ver el comentario de arriba. */
const SELLING_NAV = navIndexOf('Vendiendo');
const HOME_NAV = navIndexOf('Panel');

/** INV-01 §5: "Subtítulo del panel: `Agente de inventario`". Ver F-025. */
const INVENTORY_VERA_SUBTITLE = 'Agente de inventario';

/** MSG-01 §5: "**Subtítulo del panel:** `Agente de mensajería`". Aquí spec y HTML
 *  aprobado no discrepan, así que no hay nada que resolver como en F-025.
 *
 *  **MSG-02 §5 dice exactamente lo mismo**, así que el subtítulo no cambia al
 *  entrar en un hilo — y su ítem de nav también es `Hilos` (MSG-02 §2). Las dos
 *  pantallas son el mismo sitio del shell; lo que cambia es qué se pinta dentro. */
const MESSAGES_VERA_SUBTITLE = 'Agente de mensajería';

/** SRCH-01 §5: "**Subtítulo del panel:** `Agente de búsqueda`".
 *
 *  **VND-01 §6 dice exactamente lo mismo** —`Agente de búsqueda`— aunque la
 *  pantalla no tenga nada que ver con SRCH-01. Está comprobado en la spec, no
 *  supuesto: no es un copiar y pegar de aquí. */
const SEARCH_VERA_SUBTITLE = 'Agente de búsqueda';

export function App() {
  const { state, error, signIn, signOut } = useSession();
  const [nav, setNav] = useState(HOME_NAV);

  /**
   * El hilo abierto, o `null` si estamos en la lista. MSG-01 y MSG-02 comparten
   * ítem de nav, así que el shell necesita este segundo dato para saber cuál de
   * las dos pintar.
   *
   * **Se limpia al cambiar de ítem de nav, y no es cosmético:** sin limpiarlo,
   * salir a `Inventario` y volver a `Hilos` devolvería al hilo que estaba abierto
   * hace media hora en vez de a la lista, con el estado del hilo ya rancio.
   */
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);

  /**
   * Lo último que VERA ha escrito como criterios de búsqueda, o `null` si aún no
   * ha escrito nada. Vive aquí y no en SRCH-01 porque VERA puede escribirlo
   * estando el usuario en otra pantalla — y entonces hay que llevarle a ella.
   */
  const [veraCriteria, setVeraCriteria] = useState<SearchCriteria | null>(null);

  const navigate = (index: number) => {
    setNav(index);
    setOpenThreadId(null);
  };

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
  const onSelling = nav === SELLING_NAV;

  const veraSubtitle = onInventory
    ? INVENTORY_VERA_SUBTITLE
    : onMessages
      ? MESSAGES_VERA_SUBTITLE
      : onSearch || onSelling
        ? SEARCH_VERA_SUBTITLE
        : undefined;

  /*
   * El agente se construye aquí, después de saber que hay perfil, y no en un
   * `useMemo`: los hooks no pueden ir detrás de los retornos tempranos de
   * arriba, y memorizarlo no compraría nada — nada depende de su identidad.
   */
  const vera: VeraAgent = {
    profile: state.profile,

    navigate: (pantalla: Screen) => navigate(navIndexOf(pantalla)),

    /*
     * Escribir criterios LLEVA a Comprando, además de escribirlos.
     *
     * No es redundante con la herramienta `navegar`: si el modelo se olvidara de
     * llamarla después de buscar —y a veces se olvidará— el usuario habría
     * pedido una búsqueda y no vería pasar nada, con los resultados cargados en
     * una pantalla que no está mirando. Pedir una búsqueda es pedir verla.
     */
    setCriteria: (criteria: SearchCriteria) => {
      setVeraCriteria(criteria);
      navigate(SEARCH_NAV);
    },

    /*
     * El token se pide en cada llamada, no al montar: el de acceso caduca y se
     * renueva solo, y uno congelado empezaría a dar 401 a mitad de sesión.
     */
    call: createProxyCall(
      async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
      },
      { orgName: state.profile.orgName, fullName: state.profile.fullName },
    ),
  };

  return (
    <AppShell
      profile={state.profile}
      onSignOut={signOut}
      activeNav={nav}
      onNavigate={navigate}
      vera={vera}
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
        openThreadId ? (
          /* MSG-02. `now` explícito y construido en el render, mismo criterio que
           * las otras tres: los timestamps del historial son relativos. */
          <Thread
            profile={state.profile}
            threadId={openThreadId}
            now={new Date()}
            onBack={() => setOpenThreadId(null)}
          />
        ) : (
          <Messages profile={state.profile} now={new Date()} onOpenThread={setOpenThreadId} />
        )
      ) : onSearch ? (
        /* Mismo criterio que arriba con `now`, y por la misma razón: explícito
         * desde aquí y construido en el render. La columna Antigüedad de SRCH-01
         * es tan sensible al reloj como el timestamp relativo de MSG-01 — con un
         * `now` congelado al montar, una sesión larga acabaría pintando en naranja
         * lo que ya debería estar en rojo. */
        <SearchResults profile={state.profile} now={new Date()} veraCriteria={veraCriteria} />
      ) : onSelling ? (
        /*
         * VND-01. Sin `now`: es la única de las cuatro que no tiene ni un
         * timestamp relativo — su columna Fecha es absoluta (`DD Mmm YYYY`, §5.1)
         * y la calcula `sentAtLabel`. Inyectar un reloj que nadie usa sería una
         * prop que hay que mantener sin nada detrás.
         *
         * `onOpenThread` sí se cablea: `Ver hilo` y `Ver acuerdo` llevan a MSG-02,
         * que es CA-VND-05. Y **cambia el ítem de nav además del hilo**, porque
         * MSG-02 vive en `Hilos` (MSG-02 §2): sin eso, la pantalla del hilo se
         * pintaría con `Vendiendo` marcado en el nav y el shell mentiría sobre
         * dónde está el usuario.
         */
        <SentOffers
          profile={state.profile}
          onOpenThread={(threadId) => {
            setNav(MESSAGES_NAV);
            setOpenThreadId(threadId);
          }}
        />
      ) : onInventory ? (
        <Inventory profile={state.profile} />
      ) : (
        <Welcome profile={state.profile} />
      )}
    </AppShell>
  );
}
