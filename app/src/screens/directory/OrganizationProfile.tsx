import { useEffect, useState } from 'react';
import {
  favoritesLabel,
  fetchOrganizationProfile,
  fetchThreadWithOrg,
  telHref,
  type OrganizationProfile as OrganizationProfileData,
} from '../../lib/organization';
import { errorMessage, type MemberProfile } from '../../lib/session';
import styles from './OrganizationProfile.module.css';

interface Props {
  profile: MemberProfile;
  /** La organización cuya ficha pública se está viendo (DIR-02). */
  organizationId: string;
  /** Vuelve al directorio (DIR-01). Lo decide el shell. */
  onBack: () => void;
  /** Abre un hilo ya existente con la organización. Lo decide el shell. */
  onOpenThread: (threadId: string) => void;
}

/** El botón está deshabilitado porque la ficha es la de la propia organización. */
const OWN_ORG_TITLE = 'Es tu propia organización.';

/**
 * El botón está deshabilitado por cualquier otro motivo (todavía buscando el hilo,
 * sin hilo, o búsqueda fallida): los tres casos son el mismo para el usuario.
 */
const NO_THREAD_TITLE =
  'Todavía no tienes un hilo con esta organización. Iniciar uno sin referencia llega con la mensajería.';

/** El diseño pinta un guion donde no hay dato; nunca `null`, nunca vacío. */
function orDash(value: string): string {
  return value.trim() === '' ? '—' : value;
}

/**
 * DIR-02 · Ficha Pública de Organización (MSG-04 en la capability
 * `organization-directory`, Módulo 04).
 *
 * Es la PANTALLA: posee todo el estado y es el único sitio que llama a la red.
 * La ficha en sí no escribe nada en la base.
 *
 * Las dos peticiones salen en el MISMO efecto y EN PARALELO:
 *
 * - `fetchOrganizationProfile` es la que manda. Mientras no llegue, la pantalla
 *   está en carga; si rechaza, es el error de la pantalla; si devuelve `null`, la
 *   organización no está disponible (no es visible o no existe).
 * - `fetchThreadWithOrg` solo decide si `Contactar` está habilitado y con qué
 *   hilo se llama a `onOpenThread`. **La ficha NO espera al hilo**: si el hilo
 *   tarda, la ficha se pinta igual con el botón deshabilitado; si la búsqueda
 *   rechaza, se trata como «no hay hilo» y la ficha se ve exactamente igual.
 *
 * La bandera `cancelled` es por `organizationId`: si cambia mientras hay una
 * petición en vuelo, la respuesta vieja se ignora y la pantalla vuelve al estado
 * de carga con la ficha nueva. Sin ella, la ficha de la organización anterior
 * podría aterrizar encima de la nueva.
 */
export function OrganizationProfile({ profile, organizationId, onBack, onOpenThread }: Props) {
  const [data, setData] = useState<OrganizationProfileData | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setData(null);
    setThreadId(null);

    fetchOrganizationProfile(organizationId)
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setData(null);
        setError(errorMessage(err instanceof Error ? err : new Error(String(err))));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    /**
     * Con la organización propia no hay hilo que buscar: el botón se queda
     * deshabilitado con su motivo propio y solo se pide la ficha. Con cualquier
     * otra, la búsqueda del hilo arranca ya, en paralelo con la ficha.
     */
    if (organizationId !== profile.orgId) {
      fetchThreadWithOrg(profile.orgId, organizationId)
        .then((id) => {
          if (!cancelled) setThreadId(id);
        })
        .catch(() => {
          // Un fallo aquí no es un fallo de la pantalla: es «no hay hilo».
          if (!cancelled) setThreadId(null);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [organizationId, profile.orgId]);

  if (loading) {
    return (
      <div className={styles.screen}>
        <p className={styles.loading} role="status">
          Cargando ficha…
        </p>
      </div>
    );
  }

  if (error !== null) {
    return (
      <div className={styles.screen}>
        <p className={styles.alert} role="alert">
          {error}
        </p>
        <button type="button" className={styles.backButton} onClick={onBack}>
          Volver al directorio
        </button>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className={styles.screen}>
        <p>Esta organización no está disponible.</p>
        <button type="button" className={styles.backButton} onClick={onBack}>
          Volver al directorio
        </button>
      </div>
    );
  }

  /**
   * `Contactar` solo hace algo si HAY hilo: es el único camino que el esquema
   * permite (crear un hilo libre sin referencia es capacidad de la mensajería,
   * no de esta pantalla). Sin hilo, el botón se pinta deshabilitado y con el
   * motivo en el `title`; no se simula un hilo que no existe.
   */
  const canContact = threadId !== null;
  const contactTitle =
    organizationId === profile.orgId ? OWN_ORG_TITLE : NO_THREAD_TITLE;

  return (
    <div className={styles.screen}>
      <p className={styles.eyebrow}>Directorio de Organizaciones</p>

      <nav className={styles.breadcrumb} aria-label="Ruta">
        <button type="button" className={styles.breadcrumbLink} onClick={onBack}>
          Empresas
        </button>
        <span aria-hidden="true">›</span>
        <span className={styles.breadcrumbCurrent}>{data.name}</span>
      </nav>

      <header className={styles.header}>
        <div className={styles.avatar} data-testid="org-avatar">
          {data.initials}
        </div>

        <div className={styles.headings}>
          <h1 className={styles.name}>{data.name}</h1>
          <div className={styles.meta}>
            <span className={styles.badge} data-testid="org-country">
              {data.countryLabel}
            </span>
            <span className={styles.favorites}>{favoritesLabel(data.favoriteCount)}</span>
            <span className={styles.status}>{data.status}</span>
          </div>
        </div>

        <button
          type="button"
          className={styles.contactButton}
          disabled={!canContact}
          title={canContact ? undefined : contactTitle}
          onClick={() => {
            if (threadId !== null) onOpenThread(threadId);
          }}
        >
          <i className="ti ti-message-circle" aria-hidden="true" />
          Contactar
        </button>
      </header>

      <div className={styles.cards}>
        <section className={styles.card} aria-label="Información general">
          <h2 className={styles.cardTitle}>Información general</h2>
          <dl className={styles.list}>
            <div className={styles.row}>
              <dt className={styles.label}>País</dt>
              <dd className={styles.value}>{data.countryLabel}</dd>
            </div>

            <div className={styles.row}>
              <dt className={styles.label}>Dirección</dt>
              {/* Una línea, un `<span>`: nunca un `<br>` ni un salto dentro de
                  una sola cadena. La lista ya viene compuesta de la capa de datos. */}
              <dd className={styles.value}>
                {data.addressLines.length > 0
                  ? data.addressLines.map((line, index) => (
                      <span key={`${index}-${line}`} className={styles.addressLine}>
                        {line}
                      </span>
                    ))
                  : '—'}
              </dd>
            </div>

            <div className={styles.row}>
              <dt className={styles.label}>Código postal</dt>
              <dd className={styles.value}>{orDash(data.postalCode)}</dd>
            </div>

            <div className={styles.row}>
              <dt className={styles.label}>Miembro desde</dt>
              <dd className={styles.value}>{orDash(data.memberSince)}</dd>
            </div>
          </dl>
        </section>

        <section className={styles.card} aria-label="Contacto público">
          <h2 className={styles.cardTitle}>Contacto público</h2>
          <dl className={styles.list}>
            <div className={styles.row}>
              <dt className={styles.label}>Teléfono</dt>
              <dd className={styles.value}>
                {data.phone.trim() !== '' ? (
                  <a href={telHref(data.phone)}>{data.phone}</a>
                ) : (
                  '—'
                )}
              </dd>
            </div>

            <div className={styles.row}>
              <dt className={styles.label}>Email</dt>
              <dd className={styles.value}>
                {data.email.trim() !== '' ? (
                  <a href={'mailto:' + data.email}>{data.email}</a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
          </dl>

          {/* El contacto público no depende de la visibilidad de inventario
              (`open-public-contact-data`): la nota lo dice tal cual. */}
          <p className={styles.note}>
            Los datos de contacto son visibles para todos los miembros de la plataforma,
            independientemente de la configuración de visibilidad de inventario.
          </p>
        </section>
      </div>
    </div>
  );
}
