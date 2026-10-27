/**
 * El nombre de la pantalla que se le dice a VERA en el bloque dinámico (F-090).
 *
 * ⚠ **HASTA EL 14-OCT-2026 SE LE MENTÍA EN DOS DE OCHO ÍTEMS DEL MENÚ.** `App.tsx` mandaba
 * `NAV_SCREEN[nav] ?? 'Panel'`, y `NAV_SCREEN` solo tiene las cinco pantallas a las que `navegar` puede
 * llevar: en Empresas y en Foros VERA creía que el usuario estaba en el Panel, justo donde viven cinco
 * de las ocho entradas de la guía verificada que se le acababan de enseñar. Las subpantallas tampoco
 * llegaban: en «Mis watchers» se le decía «Comprando».
 *
 * Por eso esto NO es la lista de destinos de `navegar` (`vera-tools.ts` SCREENS): aquella es adónde
 * puede llevar VERA, esta es dónde está el usuario, y mezclarlas fue el fallo. Los nombres entre
 * paréntesis son los de la GUÍA VERIFICADA de `vera/index.ts`, para que el modelo case una con otra.
 *
 * Sigue el MISMO orden de prioridad que las ramas del render de `App.tsx`: si una rama cambia de orden
 * allí, aquí también, o el nombre dirá una pantalla que no es la que se pinta.
 */
export type NavLabel = 'Panel' | 'Inventario' | 'Hilos' | 'Comprando' | 'Vendiendo' | 'Empresas' | 'Foros' | 'Contacto';

export interface ScreenState {
  nav: NavLabel;
  securityOpen: boolean;
  settingsOpen: boolean;
  threadOpen: boolean;
  watchersOpen: boolean;
  batchOpen: boolean;
  favoritesOpen: boolean;
  importSummary: boolean;
  importDraft: boolean;
  visibilityOpen: boolean;
  ingestOpen: boolean;
  orgProfileOpen: boolean;
  forumCategoryOpen: boolean;
  forumThreadOpen: boolean;
}

export function veraScreenName(s: ScreenState): string {
  if (s.securityOpen) return 'Cambiar backup passphrase (menú Seguridad)';
  if (s.settingsOpen) return 'Gestión de invitaciones (menú Configuración)';
  switch (s.nav) {
    case 'Hilos':
      return s.threadOpen ? 'Hilos, con un hilo abierto' : 'Hilos, en la lista de hilos';
    case 'Comprando':
      if (s.watchersOpen) return 'Mis watchers (dentro de Comprando)';
      if (s.batchOpen) return 'Búsqueda por lotes (dentro de Comprando)';
      if (s.favoritesOpen) return 'Mis favoritos (dentro de Comprando)';
      return 'Comprando (Búsqueda de referencias)';
    case 'Vendiendo':
      return 'Vendiendo (Mis ofertas)';
    case 'Inventario':
      if (s.importSummary) return 'Inventario, en el resultado de una importación';
      if (s.importDraft) return 'Inventario, emparejando las columnas de un archivo que se está importando';
      if (s.visibilityOpen) return 'Visibilidad del inventario (dentro de Inventario)';
      if (s.ingestOpen) return 'Canal de ingestión por email (dentro de Inventario)';
      return 'Inventario';
    case 'Empresas':
      return s.orgProfileOpen ? 'Empresas, en la ficha de una empresa' : 'Empresas (Directorio de Organizaciones)';
    case 'Foros':
      if (s.forumThreadOpen) return 'Foros, leyendo un hilo del Foro';
      if (s.forumCategoryOpen) return 'Foros, dentro de una categoría';
      return 'Foros (la lista de categorías)';
    case 'Contacto':
      return 'Contacto (no disponible todavía)';
    case 'Panel':
      return 'Panel (Mi Panel)';
  }
}
