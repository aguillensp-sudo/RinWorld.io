import { useState, type ReactNode } from 'react';
import { initials, type OperatorProfile } from '../lib/session';
import { VeraPanel } from './VeraPanel';
import shell from './AppShell.module.css';
import styles from './OperatorShell.module.css';

/**
 * El shell del Operador de Plataforma — NO el de un miembro distribuidor.
 *
 * ADMIN-01 §2 lo dice explícito: *"Ítem activo en nav: ninguno de los ítems
 * estándar — el Operador tiene su propia vista de navegación"*, y el HTML
 * aprobado lo confirma con un menú de cinco ítems propios (`Panel`,
 * `Solicitudes`, `Organizaciones`, `Log de auditoría`, `Sistema`) y acento
 * BRASS en vez de Calibration Blue. Y un `OperatorProfile` (`session.ts`) no
 * tiene `orgName` ni `role`: intentar reutilizar `AppShell` tal cual —tipado a
 * `MemberProfile`— habría significado tocar un componente compartido con su
 * propia suite de pruebas por una pantalla que ni siquiera pertenece a una
 * organización.
 *
 * Por eso este fichero es NUEVO, no una edición de `AppShell.tsx` (que queda
 * intacto, con sus tests intactos): reutiliza `AppShell.module.css` para todo
 * lo que el sistema base ya fija igual para las dos vistas —brand bar, nav,
 * sidebar overlay, `bwcnt`— e importa `VeraPanel` tal cual, sin `agent`: el
 * panel ya sabe decir que no está conectada cuando se monta así (`VeraPanel`,
 * doc de `NOT_WIRED`), que es exactamente lo correcto aquí — el cableado
 * VERA↔herramientas del Operador no es parte de ninguna tarea todavía. Lo único
 * que SÍ es nuevo (`OperatorShell.module.css`) son las dos reglas de acento que
 * de verdad cambian, más la píldora "Operador" del HTML aprobado.
 */
export const OPERATOR_NAV_ITEMS = [
  { label: 'Panel', icon: 'ti-layout-dashboard' },
  { label: 'Solicitudes', icon: 'ti-clipboard-list' },
  { label: 'Organizaciones', icon: 'ti-building' },
  { label: 'Log de auditoría', icon: 'ti-file-description' },
  { label: 'Sistema', icon: 'ti-settings-2' },
] as const;

/** El índice del ítem con ese nombre, o 0 (Panel) si no existe. Espejo de
 *  `navIndexOf` de `AppShell.tsx`, sobre la lista propia del Operador. */
export function operatorNavIndexOf(label: string): number {
  const i = OPERATOR_NAV_ITEMS.findIndex((n) => n.label === label);
  return i === -1 ? 0 : i;
}

interface Props {
  operator: OperatorProfile;
  onSignOut: () => void;
  /** Controlado desde fuera, mismo criterio que `AppShell` (día 3). */
  activeNav: number;
  onNavigate: (index: number) => void;
  veraSubtitle?: string;
  children: ReactNode;
}

export function OperatorShell({ operator, onSignOut, activeNav, onNavigate, veraSubtitle, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => setSidebarOpen((o) => !o);
  const userName = operator.fullName ?? operator.email;

  return (
    <div className={shell.bwshell} data-testid="operator-home">
      <div className={shell.bwbrand}>
        <div>ZERO KNOWLEDGE ARCHITECTURE · CRYPTOGRAPHIC SECURITY</div>
        <div>CONNECT · TRADE · SECURE</div>
        <div>INDUSTRIAL INTELLIGENCE NETWORK</div>
      </div>

      <div className={shell.bwnav}>
        <button className={shell.bwhbg} onClick={toggleSidebar} aria-label="Abrir menú">
          <span />
          <span />
          <span />
        </button>
        <img className={shell.bwnavlogo} src="/intentologo.png" alt="Bearingworld.io" />
        <div className={shell.bwnavdiv} />
        <nav className={shell.bwnavitems} aria-label="Navegación principal">
          {OPERATOR_NAV_ITEMS.map((item, i) => (
            <button
              key={item.label}
              className={`${shell.bwnavitem} ${i === activeNav ? styles.actBrass : ''}`}
              aria-current={i === activeNav ? 'page' : undefined}
              onClick={() => onNavigate(i)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className={shell.bwnavright}>
          <span className={styles.opBadge}>Operador</span>
          <div className={shell.bwnavuser}>
            <div className={shell.bwnavco} data-testid="nav-org">
              {userName}
            </div>
            <div className={shell.bwnavun} data-testid="nav-user">
              Bearingworld.io
            </div>
          </div>
          <button className={shell.bwnavsout} onClick={onSignOut}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className={shell.bwmain}>
        <button
          className={`${shell.bwsbo} ${sidebarOpen ? shell.open : ''}`}
          onClick={toggleSidebar}
          aria-hidden={!sidebarOpen}
          tabIndex={-1}
        />

        <aside className={`${shell.bwsb} ${sidebarOpen ? shell.open : ''}`} aria-label="Menú lateral">
          <div className={shell.bwsbh}>
            <button className={shell.bwsbx} onClick={toggleSidebar} aria-label="Cerrar menú">
              ×
            </button>
          </div>
          <nav className={shell.bwsbnav} aria-label="Navegación lateral">
            {OPERATOR_NAV_ITEMS.map((item, i) => (
              <button
                key={item.label}
                className={`${shell.bwsbitem} ${i === activeNav ? styles.actBrassSb : ''}`}
                aria-current={i === activeNav ? 'page' : undefined}
                onClick={() => onNavigate(i)}
              >
                <i className={`ti ${item.icon}`} />
                {item.label}
              </button>
            ))}
          </nav>
          <div className={shell.bwsbft}>
            <div className={shell.bwsbset}>
              <i className="ti ti-adjustments-horizontal" />
              Configuración
            </div>
            <div className={shell.bwsbusr}>
              <div className={shell.bwav}>{initials(operator.fullName, operator.email)}</div>
              <div>
                <div className={shell.bwsbusrn}>{userName}</div>
                {/* El HTML aprobado pinta "Operador · Bearingworld.io" en el sitio
                    donde el shell de miembro pinta el nombre de la organización:
                    un Operador no tiene una, y ese literal lo dice. */}
                <div className={shell.bwsbusro}>Operador · Bearingworld.io</div>
              </div>
            </div>
          </div>
        </aside>

        <main className={shell.bwcnt}>{children}</main>

        <VeraPanel {...(veraSubtitle ? { subtitle: veraSubtitle } : {})} />
      </div>
    </div>
  );
}
