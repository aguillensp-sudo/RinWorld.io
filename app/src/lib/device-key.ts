import type { SessionKeyPair } from './crypto';

/**
 * La copia de la clave privada EN ESTE DISPOSITIVO (ADR-001 §7.2, paso 7: *«stored
 * in IndexedDB»*).
 *
 * Desde REG-07 el par de un miembro deja de ser de sesión: nace una vez, su backup
 * cifrado va al servidor y la privada se queda aquí para las sesiones siguientes en
 * este navegador. Sin esta copia, cada recarga obligaría a teclear la frase de
 * seguridad (REC-01, que aún no existe).
 *
 * **Se guarda la `CryptoKey` NO EXTRAÍBLE, nunca sus bytes.** IndexedDB clona la
 * clave tal cual (structured clone), y una clave no extraíble no deja sacar sus
 * bytes ni a esta app: un XSS podría *usarla* mientras la pestaña está abierta,
 * pero no llevársela. Es la diferencia con el `localStorage` que `keys.ts` descarta.
 *
 * Por miembro (`memberId`), así que dos cuentas en el mismo navegador no se pisan.
 * Cerrar sesión NO la borra: es la copia del dispositivo, no la de la sesión.
 *
 * Ningún fallo de aquí es fatal ni lleva material de clave en un mensaje: sin
 * IndexedDB (modo privado de algunos navegadores) se guarda `false` o se lee `null`
 * y el llavero se queda sin la copia, que es lo mismo que estar en otro dispositivo.
 */

const DB_NAME = 'bearingworld-keys';
const DB_VERSION = 1;
const STORE = 'device-keys';

interface StoredKey {
  privateKey: CryptoKey;
  publicKey: Uint8Array;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

/** Guarda el par de `memberId` en este dispositivo. `false` si el navegador no deja. */
export async function saveDeviceKey(memberId: string, pair: SessionKeyPair): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  try {
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      const value: StoredKey = { privateKey: pair.privateKey, publicKey: pair.publicKey };
      tx.objectStore(STORE).put(value, memberId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  } finally {
    db.close();
  }
}

/** El par de `memberId` guardado en este dispositivo, o `null`. */
export async function loadDeviceKey(memberId: string): Promise<SessionKeyPair | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    return await new Promise<SessionKeyPair | null>((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(memberId);
      request.onsuccess = () => {
        const v = request.result as Partial<StoredKey> | undefined;
        // `ArrayBuffer.isView` y no `instanceof Uint8Array`: lo clonado puede venir
        // de otro reino (otro `Uint8Array` global) y `instanceof` diría que no.
        resolve(
          v && v.privateKey && ArrayBuffer.isView(v.publicKey)
            ? { privateKey: v.privateKey, publicKey: new Uint8Array(v.publicKey.buffer, v.publicKey.byteOffset, v.publicKey.byteLength) }
            : null,
        );
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  } finally {
    db.close();
  }
}
