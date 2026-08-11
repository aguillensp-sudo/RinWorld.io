import type { MemberProfile } from '../../lib/session';

/**
 * ESQUELETO · MSG-02 · Vista de un Hilo.
 *
 * Existe para que el contrato de aceptación se pueda **compilar y ejecutar antes
 * de gastar un token** (F-047): un `typecheck` con los módulos del Coder sin
 * escribir da rojo esperado, y ese rojo tapa el del contrato. Un contrato solo se
 * verifica contra una implementación, aunque sea vacía.
 *
 * Lo sobrescribe el artefacto del Coder. Si esto sigue aquí después de la corrida,
 * es que la corrida no escribió el fichero.
 */
export function Thread(_props: { profile: MemberProfile; threadId: string; now?: Date }) {
  return null;
}
