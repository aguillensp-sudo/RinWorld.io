import type { MemberProfile } from '../../lib/session';

/**
 * ESQUELETO · VND-01 · Mis Ofertas.
 *
 * Devuelve `null` a propósito. Existe para que el contrato de aceptación se
 * pueda **compilar y ejecutar** antes de la corrida del arnés (F-047), y para
 * que se pueda comprobar que su rojo es **TOTAL** (F-058): un aserto que se
 * queda verde contra esto no está midiendo nada.
 *
 * Lo sobrescribe entero el Coder.
 */
export function SentOffers(_props: {
  profile: MemberProfile;
  onOpenThread?: (threadId: string) => void;
}) {
  return null;
}
