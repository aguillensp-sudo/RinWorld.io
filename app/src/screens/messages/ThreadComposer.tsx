import { useState } from 'react';
import type { OfferContent } from '../../lib/thread-detail';
import { OfferCounterForm } from './OfferCounterForm';
import styles from './ThreadComposer.module.css';

/**
 * Pie de composición de MSG-02.
 *
 * ── POR QUÉ ESTE COMPONENTE SÍ CAMBIÓ EL DÍA 8, Y NO CONTRADICE A D-07-05 ────
 *
 * `ESTADO.md` del día 7 avisa: *"El día 8 se rellena `decryptItem()` y no se
 * toca ningún `.tsx`. Si alguien se encuentra editando un componente, la costura
 * estaba mal puesta"*. **Esa regla es sobre el DESCIFRADO, y se ha cumplido**:
 * `ThreadHistory` no se ha tocado ni una línea y sigue pintando las dos ramas
 * igual que ayer.
 *
 * Lo que cambia aquí es otra cosa: **el envío**, que el PO metió en el día 8 con
 * D-08-02 y que el día 7 no existía en ninguna forma. El pie pasó de no tener
 * props —*"se pinta igual en los cinco estados del hilo"*— a tener una, porque
 * ahora hace algo. Sigue montándose en los cinco estados (D-07-01): quien decide
 * montarlo es la pantalla, y eso no ha cambiado.
 *
 * ── LO QUE SIGUE DESHABILITADO Y POR QUÉ ────────────────────────────────────
 *
 * `Crear oferta` abre MSG-03, que queda fuera del MVP. Su motivo va en texto
 * visible y no en un `title`, por F-023 e: un control inerte sin explicación se
 * lee como avería.
 *
 * El botón de enviar se deshabilita **solo** cuando no hay nada que enviar o hay
 * un envío en curso. Eso no lleva motivo escrito y es deliberado: un campo vacío
 * explica su propio botón gris, y un cartel permanente diciendo "escribe algo"
 * sería ruido en los cinco estados del hilo.
 */
export function ThreadComposer({
  onSend,
  onCreateOffer,
}: {
  /** Oferta directa en el hilo (0055). Sin esta prop el botón no se pinta. */
  onCreateOffer?: (reference: { partNumber: string; brand: string }, content: OfferContent) => Promise<boolean>;
  /** Devuelve si el envío salió bien. El campo solo se vacía cuando sí: perder
   *  lo escrito porque la red falló es la peor forma de gestionar un error. */
  onSend: (text: string) => Promise<boolean>;
}) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ofertando, setOfertando] = useState(false);

  const vacio = texto.trim().length === 0;

  const enviar = async () => {
    if (vacio || enviando) return;
    setEnviando(true);
    try {
      if (await onSend(texto.trim())) setTexto('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={styles.composer}>
      <div className={styles.inputRow}>
        <textarea
          className={styles.textarea}
          name="mensaje"
          aria-label="Escribe un mensaje"
          placeholder="Escribe un mensaje..."
          rows={1}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
            if (e.altKey || e.shiftKey) {
              // Alt+Enter (y Shift+Enter) = salto de línea. El navegador no lo
              // inserta con Alt, así que se hace a mano en la posición del cursor.
              if (e.altKey) {
                e.preventDefault();
                const el = e.currentTarget;
                const { selectionStart: a, selectionEnd: b } = el;
                setTexto(texto.slice(0, a) + String.fromCharCode(10) + texto.slice(b));
                requestAnimationFrame(() => el.setSelectionRange(a + 1, a + 1));
              }
              return;
            }
            e.preventDefault();
            void enviar();
          }}
          disabled={enviando}
        />
        <button
          type="button"
          className={styles.sendButton}
          aria-label="Enviar mensaje"
          disabled={vacio || enviando}
          onClick={() => {
            void enviar();
          }}
        >
          →
        </button>
      </div>
      <div className={styles.subRow}>
        {onCreateOffer && (
          <button type="button" className={styles.offerButton} onClick={() => setOfertando(true)}>
            Crear oferta
          </button>
        )}
        <span className={styles.encryptHint}>Cifrado E2EE antes del envío</span>
      </div>
      {ofertando && onCreateOffer && (
        <OfferCounterForm
          partNumber=""
          brand=""
          referenceEditable
          title="Crear oferta"
          hint="Oferta directa en este hilo. Indica la referencia y las condiciones."
          submitLabel="Enviar oferta"
          onCancel={() => setOfertando(false)}
          onSubmit={async (content, reference) => {
            const ok = await onCreateOffer(reference, content);
            if (ok) setOfertando(false);
            return ok;
          }}
        />
      )}
    </div>
  );
}
