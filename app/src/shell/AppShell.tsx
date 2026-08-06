import { useState, type ReactNode } from 'react';
import { initials, type MemberProfile } from '../lib/session';
import { VeraPanel } from './VeraPanel';
import styles from './AppShell.module.css';

/** Los ocho ítems y sus iconos, en el orden del shell aprobado. */
const NAV_ITEMS = [
  { label: 'Panel', icon: 'ti-layout-dashboard' },
  { label: 'Vendiendo', icon: 'ti-tag' },
  { label: 'Comprando', icon: 'ti-shopping-cart' },
  { label: 'Hilos', icon: 'ti-messages' },
  { label: 'Inventario', icon: 'ti-package' },
  { label: 'Empresas', icon: 'ti-building' },
  { label: 'Foros', icon: 'ti-notes' },
  { label: 'Contacto', icon: 'ti-headset' },
] as const;

/** Los tres textos de la brand bar, literales del shell aprobado. */
const BRAND_TEXTS = [
  'ZERO KNOWLEDGE ARCHITECTURE · CRYPTOGRAPHIC SECURITY',
  'CONNECT · TRADE · SECURE',
  'INDUSTRIAL INTELLIGENCE NETWORK',
] as const;

interface Props {
  profile: MemberProfile;
  onSignOut: () => void;
  children: ReactNode;
}

export function AppShell({ profile, onSignOut, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [active, setActive] = useState(0);

  const toggleSidebar = () => setSidebarOpen((o) => !o);
  const userName = profile.fullName ?? profile.email;

  return (
    <div className={styles.bwshell}>
      <div className={styles.bwbrand}>
        {BRAND_TEXTS.map((t) => (
          <div key={t}>{t}</div>
        ))}
      </div>

      <div className={styles.bwnav}>
        <button className={styles.bwhbg} onClick={toggleSidebar} aria-label="Abrir menú">
          <span />
          <span />
          <span />
        </button>
        <img className={styles.bwnavlogo} src="/intentologo.png" alt="Bearingworld.io" />
        <div className={styles.bwnavdiv} />
        <nav className={styles.bwnavitems} aria-label="Navegación principal">
          {NAV_ITEMS.map((item, i) => (
            <button
              key={item.label}
              className={`${styles.bwnavitem} ${i === active ? styles.act : ''}`}
              aria-current={i === active ? 'page' : undefined}
              onClick={() => setActive(i)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className={styles.bwnavright}>
          <div className={styles.bwnavuser}>
            <div className={styles.bwnavco} data-testid="nav-org">
              {profile.orgName}
            </div>
            <div className={styles.bwnavun} data-testid="nav-user">
              {userName}
            </div>
          </div>
          <button className={styles.bwnavsout} onClick={onSignOut}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className={styles.bwmain}>
        <button
          className={`${styles.bwsbo} ${sidebarOpen ? styles.open : ''}`}
          onClick={toggleSidebar}
          aria-hidden={!sidebarOpen}
          tabIndex={-1}
        />

        <aside
          className={`${styles.bwsb} ${sidebarOpen ? styles.open : ''}`}
          aria-label="Menú lateral"
        >
          <div className={styles.bwsbh}>
            <button className={styles.bwsbx} onClick={toggleSidebar} aria-label="Cerrar menú">
              ×
            </button>
          </div>
          <nav className={styles.bwsbnav} aria-label="Navegación lateral">
            {NAV_ITEMS.map((item, i) => (
              <button
                key={item.label}
                className={`${styles.bwsbitem} ${i === active ? styles.act : ''}`}
                aria-current={i === active ? 'page' : undefined}
                onClick={() => setActive(i)}
              >
                <i className={`ti ${item.icon}`} />
                {item.label}
              </button>
            ))}
          </nav>
          <div className={styles.bwsbft}>
            <div className={styles.bwsbset}>
              <i className="ti ti-adjustments-horizontal" />
              Configuración
            </div>
            <div className={styles.bwsbusr}>
              <div className={styles.bwav}>{initials(profile.fullName, profile.email)}</div>
              <div>
                <div className={styles.bwsbusrn}>{userName}</div>
                <div className={styles.bwsbusro}>{profile.orgName}</div>
              </div>
            </div>
          </div>
        </aside>

        <main className={styles.bwcnt}>{children}</main>

        <VeraPanel />
      </div>
    </div>
  );
}
