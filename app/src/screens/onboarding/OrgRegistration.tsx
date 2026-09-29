interface Props {
  /** El token del enlace `#registro?token=…` que el Operador envió al solicitante. */
  token: string;
  /** La cuenta se creó y la sesión está iniciada: el wiring limpia la URL y sale de esta pantalla. */
  onRegistered: () => void;
  /** El enlace no vale y el visitante pulsa «Volver al inicio de sesión»: el wiring vuelve al login. */
  onBackToLogin: () => void;
}

/**
 * MARCADOR de REG-01 · FRO. La tarea del arnés (`harness/tasks/REG-01.json`) sustituye
 * este fichero y su `.module.css`. Existe para que `App.tsx` compile y el e2e tenga una
 * ruta real que visitar antes de la corrida.
 */
export function OrgRegistration(_props: Props) {
  return <div data-testid="reg01-placeholder" />;
}
