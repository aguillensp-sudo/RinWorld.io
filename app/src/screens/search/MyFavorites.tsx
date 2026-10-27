import { useEffect, useState } from 'react';
import { FavoriteConfirmDialog } from '../../components/FavoriteConfirmDialog';
import { fetchMyFavorites, type FavoriteRow } from '../../lib/favorites';
import { countryName, toggleFavorite } from '../../lib/search';
import { errorMessage, type MemberProfile } from '../../lib/session';
import styles from './MyFavorites.module.css';

const EYEBROW = 'Módulo 03 · Búsqueda Conversacional';
const TITLE = 'Mis favoritos';
const SUBTITLE =
  'Las distribuidoras que has marcado. La lista es tuya: no la ven los demás miembros de tu organización ni cambia el orden de los resultados.';

interface Props {
  profile: MemberProfile;
  /** Lleva a la ficha de la organización (DIR-02). */
  onOpenOrganization: (orgId: string) => void;
}

/**
 * Mis favoritos (F-280). Vive en Comprando, junto a «Mis watchers» y «Búsqueda por lotes», y la ve
 * cualquier miembro (el favorito es del miembro, no del perfil). Quitar pide la confirmación de
 * siempre (`FavoriteConfirmDialog`); marcar se hace desde la búsqueda o la ficha, no aquí.
 */
export function MyFavorites({ profile, onOpenOrganization }: Props) {
  const [rows, setRows] = useState<FavoriteRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<FavoriteRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchMyFavorites(profile.id)
      .then((next) => {
        if (active) setRows(next);
      })
      .catch((e: unknown) => {
        if (active) setLoadError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [profile.id]);

  /* Mismo nombre que en las demás pantallas: `favorites-system#2` exige que solo la confirmación escriba. */
  const confirmFavorite = async (): Promise<void> => {
    if (!removing) return;
    setBusy(true);
    setDialogError(null);
    try {
      await toggleFavorite(profile.id, removing.orgId, false);
      setRows((prev) => (prev ?? []).filter((r) => r.orgId !== removing.orgId));
      setNotice(`${removing.name} ya no está en tus favoritos.`);
      setRemoving(null);
    } catch (e: unknown) {
      setDialogError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.eyebrow}>{EYEBROW}</div>
      <h1 className={styles.title}>{TITLE}</h1>
      <p className={styles.subtitle}>{SUBTITLE}</p>

      {notice !== null && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {loadError !== null && (
        <p className={styles.alert} role="alert">
          {loadError}
        </p>
      )}

      {rows !== null && rows.length === 0 && (
        <div className={styles.empty} data-testid="favorites-empty">
          <p className={styles.emptyTitle}>Todavía no has marcado ninguna distribuidora.</p>
          <p className={styles.emptyHint}>
            Pulsa la estrella de una fila en la búsqueda, o «Añadir a favoritos» en la ficha de una organización.
          </p>
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <ul className={styles.list} data-testid="favorites-list">
          {rows.map((r) => (
            <li key={r.orgId} className={styles.row}>
              <button type="button" className={styles.orgLink} onClick={() => onOpenOrganization(r.orgId)}>
                {r.name}
              </button>
              <span className={styles.country}>{countryName(r.country)}</span>
              <button
                type="button"
                className={styles.remove}
                disabled={busy}
                aria-label={`Quitar a ${r.name} de favoritos`}
                onClick={() => {
                  setNotice(null);
                  setDialogError(null);
                  setRemoving(r);
                }}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      {removing && (
        <FavoriteConfirmDialog
          orgName={removing.name}
          adding={false}
          busy={busy}
          error={dialogError}
          onConfirm={() => void confirmFavorite()}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
