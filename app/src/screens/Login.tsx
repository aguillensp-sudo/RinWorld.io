/**
 * ESQUELETO · LOGIN-01. Devuelve `null` a propósito.
 *
 * Existe para que el contrato de aceptación se pueda compilar y ejecutar antes de
 * la corrida (F-047), y para comprobar que su rojo es TOTAL (F-058). Lo
 * sobrescribe entero el Coder.
 */
export function Login(_props: {
  onSubmit: (email: string, password: string) => Promise<boolean>;
  error: string | null;
}) {
  return null;
}
