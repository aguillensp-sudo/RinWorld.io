import styles from './Suspended.module.css';

interface Props {
  orgName: string;
  onSignOut: () => void;
}

/**
 * Pantalla de suspensión (`billing-subscription/automatic-suspension#2`,
 * `community-forum/active-account-access#2`): un miembro de una organización `SUSPENDED`
 * la ve EN LUGAR del shell, así que no llega al Panel ni al foro. Sin shell y sin VERA,
 * como el login. No hay HTML aprobado: es la mínima que la spec pide, y los datos se
 * conservan (`suspension-sin-purga`), por eso se dice.
 */
export function Suspended({ orgName, onSignOut }: Props) {
  return (
    <main className={styles.page} data-testid="org-suspended">
      <div className={styles.card}>
        <p className={styles.eyebrow}>Bearingworld.io</p>
        <h1 className={styles.title}>Organización suspendida</h1>
        <p className={styles.text}>
          El acceso de <strong>{orgName}</strong> a Bearingworld.io está suspendido. Mientras dure
          la suspensión no puedes entrar en la plataforma ni en el foro, y el inventario de tu
          organización no aparece en las búsquedas de otros miembros.
        </p>
        <p className={styles.text}>
          Tus datos se conservan íntegros: inventario, mensajes, claves de cifrado y favoritos.
          Para reactivar la cuenta, contacta con el operador de la plataforma.
        </p>
        <button type="button" className={styles.signOut} onClick={onSignOut}>
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}
