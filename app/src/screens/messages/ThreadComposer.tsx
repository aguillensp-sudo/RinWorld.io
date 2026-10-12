import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { INQUIRY_FORM_TEXTS, INQUIRY_PICKER_TEXTS, type InquiryDraft } from '../../lib/inquiry-form';
import { countryName, type OrgLine } from '../../lib/search';
import type { OfferContent } from '../../lib/thread-detail';
import type { VeraDraft } from '../../lib/vera-tools';
import { InquiryFormModal } from './InquiryFormModal';
import { InquiryLinePicker } from './InquiryLinePicker';
import { OfferCounterForm, type OfferDraft } from './OfferCounterForm';
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
/** Lo que `Crear consulta` necesita del hilo: a quién se pregunta y cómo se envía. */
export interface InquiryCreation {
  counterpartyId: string;
  counterpartyName: string;
  ownOrgId: string;
  /** Cifra y envía. Devuelve el motivo del fallo o `null` si salió bien (el formulario lo enseña dentro). */
  onSubmit: (line: OrgLine, draft: InquiryDraft) => Promise<string | null>;
}

export function ThreadComposer({
  onSend,
  onCreateOffer,
  inquiry,
  veraDraft,
  onVeraDraftHandled,
}: {
  /** `Crear consulta` (MSG-03 §3.2, F-249). Sin esta prop el botón no se pinta. */
  inquiry?: InquiryCreation;
  /**
   * Lo que VERA ha pedido preparar (MSG-03 §5, F-249): abre el formulario de consulta o de oferta con lo que
   * dijo el usuario ya escrito. NO envía: lo revisa y lo envía el usuario. Se consume una sola vez.
   */
  veraDraft?: VeraDraft | null;
  onVeraDraftHandled?: () => void;
  /** Oferta directa en el hilo (0055). Sin esta prop el botón no se pinta. */
  onCreateOffer?: (reference: { partNumber: string; brand: string }, content: OfferContent) => Promise<boolean>;
  /** Devuelve si el envío salió bien. El campo solo se vacía cuando sí: perder
   *  lo escrito porque la red falló es la peor forma de gestionar un error. */
  onSend: (text: string) => Promise<boolean>;
}) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const cursorTrasSalto = useRef<number | null>(null);
  // El cursor de un textarea controlado salta al final cuando React reescribe el valor:
  // se restaura en el mismo ciclo del render, antes de que llegue la siguiente tecla.
  useLayoutEffect(() => {
    if (cursorTrasSalto.current === null) return;
    campoRef.current?.setSelectionRange(cursorTrasSalto.current, cursorTrasSalto.current);
    cursorTrasSalto.current = null;
  }, [texto]);
  const [ofertando, setOfertando] = useState(false);
  /** Paso de `Crear consulta`: `'elegir'` la línea, o la línea elegida con su formulario abierto. */
  const [consulta, setConsulta] = useState<'elegir' | OrgLine | null>(null);
  const [consultaBusy, setConsultaBusy] = useState(false);
  /** Fallo del último envío; el aviso de duplicado de la spec §6 tiene su propio sitio en el formulario. */
  const [consultaError, setConsultaError] = useState<string | null>(null);
  /** Lo que VERA dejó escrito para la consulta: arranca el selector y el formulario. */
  const [consultaVera, setConsultaVera] = useState<{ reference: string; brand: string; quantity: string; notes: string } | null>(null);
  /** Idem para la oferta directa. `nonce` remonta el formulario si VERA vuelve a pedir otra. */
  const [ofertaVera, setOfertaVera] = useState<{ nonce: number; reference: string; brand: string; draft: Partial<OfferDraft> } | null>(null);

  const cerrarConsulta = () => {
    setConsulta(null);
    setConsultaError(null);
    setConsultaVera(null);
  };

  useEffect(() => {
    if (!veraDraft) return;
    if (veraDraft.kind === 'consulta') {
      if (inquiry) {
        setOfertando(false);
        setOfertaVera(null);
        setConsultaError(null);
        setConsultaVera({
          reference: veraDraft.reference,
          brand: veraDraft.brand,
          quantity: String(veraDraft.quantity),
          notes: veraDraft.notes ?? '',
        });
        setConsulta('elegir');
      }
    } else if (onCreateOffer) {
      cerrarConsulta();
      const draft: Partial<OfferDraft> = {};
      if (veraDraft.quantity !== null) draft.quantity = String(veraDraft.quantity);
      if (veraDraft.leadTimeDays !== null) draft.leadTimeDays = String(veraDraft.leadTimeDays);
      if (veraDraft.currency !== null) {
        draft.currency = veraDraft.currency;
        draft.shippingCostCurrency = veraDraft.currency;
      }
      if (veraDraft.notes !== null) draft.notes = veraDraft.notes;
      // El precio unitario NO se rellena nunca desde VERA (MSG-03 §4.2 y §7): queda vacío.
      setOfertaVera({ nonce: veraDraft.nonce, reference: veraDraft.reference, brand: veraDraft.brand, draft });
      setOfertando(true);
    }
    onVeraDraftHandled?.();
    // Solo cuando llega una petición nueva: el resto de dependencias se leen frescas dentro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veraDraft?.nonce]);

  const enviarConsulta = async (line: OrgLine, draft: InquiryDraft) => {
    if (!inquiry || consultaBusy) return;
    setConsultaBusy(true);
    setConsultaError(null);
    try {
      const fallo = await inquiry.onSubmit(line, draft);
      if (fallo === null) cerrarConsulta();
      else setConsultaError(fallo);
    } finally {
      setConsultaBusy(false);
    }
  };

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
          ref={campoRef}
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
                cursorTrasSalto.current = a + 1;
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
        {inquiry && (
          <button type="button" className={styles.offerButton} onClick={() => setConsulta('elegir')}>
            {INQUIRY_PICKER_TEXTS.button}
          </button>
        )}
        {onCreateOffer && (
          <button type="button" className={styles.offerButton} onClick={() => setOfertando(true)}>
            Crear oferta
          </button>
        )}
        <span className={styles.encryptHint}>Cifrado E2EE antes del envío</span>
      </div>
      {inquiry && consulta === 'elegir' && (
        <InquiryLinePicker
          counterpartyId={inquiry.counterpartyId}
          counterpartyName={inquiry.counterpartyName}
          ownOrgId={inquiry.ownOrgId}
          onPick={(l) => setConsulta(l)}
          onCancel={cerrarConsulta}
          {...(consultaVera
            ? { initialTerm: consultaVera.reference, autoPick: { brand: consultaVera.brand } }
            : {})}
        />
      )}
      {inquiry && consulta !== null && consulta !== 'elegir' && (
        <InquiryFormModal
          key={consulta.id}
          index={0}
          total={1}
          reference={consulta.partNumber}
          brand={consulta.brand}
          country={countryName(consulta.country)}
          duplicate={consultaError === INQUIRY_FORM_TEXTS.duplicateWarning}
          busy={consultaBusy}
          error={consultaError === INQUIRY_FORM_TEXTS.duplicateWarning ? null : consultaError}
          onSubmit={(draft) => void enviarConsulta(consulta, draft)}
          onCancel={cerrarConsulta}
          {...(consultaVera ? { initialQuantity: consultaVera.quantity, initialNotes: consultaVera.notes } : {})}
        />
      )}
      {ofertando && onCreateOffer && (
        <OfferCounterForm
          key={ofertaVera?.nonce ?? 0}
          partNumber={ofertaVera?.reference ?? ''}
          brand={ofertaVera?.brand ?? ''}
          {...(ofertaVera ? { initialDraft: ofertaVera.draft } : {})}
          referenceEditable
          title="Crear oferta"
          hint="Oferta directa en este hilo. Indica la referencia y las condiciones."
          submitLabel="Enviar oferta"
          onCancel={() => {
            setOfertando(false);
            setOfertaVera(null);
          }}
          onSubmit={async (content, reference) => {
            const ok = await onCreateOffer(reference, content);
            if (ok) {
              setOfertando(false);
              setOfertaVera(null);
            }
            return ok;
          }}
        />
      )}
    </div>
  );
}
