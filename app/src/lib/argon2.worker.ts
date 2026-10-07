/**
 * Argon2id fuera del hilo principal (ADR-001 §9: *«must run off the main thread»*).
 *
 * Con los parámetros de ADR-001 (64 MiB, 3 pasadas, 4 carriles) una derivación tarda
 * ~0,3 s en un portátil y más en un equipo modesto: en el hilo principal congelaría
 * la pantalla de REG-07 justo mientras gira el rodamiento que dice que se está
 * trabajando. Este worker no sabe nada de la app: recibe bytes, devuelve bytes.
 *
 * La frase llega ya en UTF-8 y se borra aquí en cuanto se ha usado. El error que se
 * devuelve no lleva ni la frase ni la clave (ADR-001 §8).
 */
import { argon2id } from 'hash-wasm';

export interface Argon2Request {
  password: Uint8Array;
  salt: Uint8Array;
  m: number;
  t: number;
  p: number;
}

export type Argon2Response = { ok: true; key: Uint8Array } | { ok: false };

/** Lo poco del ámbito del worker que hace falta, sin mezclar la lib `webworker` con la del DOM. */
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<Argon2Request>) => void) | null;
  postMessage(message: Argon2Response, transfer?: Transferable[]): void;
};

scope.onmessage = async (event: MessageEvent<Argon2Request>) => {
  const { password, salt, m, t, p } = event.data;
  try {
    const key = await argon2id({
      password,
      salt,
      memorySize: m,
      iterations: t,
      parallelism: p,
      hashLength: 32,
      outputType: 'binary',
    });
    const response: Argon2Response = { ok: true, key };
    scope.postMessage(response, [key.buffer]);
  } catch {
    const response: Argon2Response = { ok: false };
    scope.postMessage(response);
  } finally {
    password.fill(0);
  }
};
