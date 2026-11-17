import { useId, useState } from 'react';
import {
  TAB_TEXTS,
  matchReferences,
  normalizeRef,
  referenceLabel,
  type ThreadReference,
  type ThreadReferenceOption,
} from '../../lib/negotiation-rows';
import styles from './TagCombobox.module.css';

/**
 * «Sobre:» (spec `message-reference-tag`): la etiqueta del mensaje que se va a escribir.
 *
 * Un campo en el que se escribe, como el buscador del hilo y la búsqueda de Comprando (PO,
 * 17-nov-2026): al escribir se despliegan DEBAJO las referencias del hilo que coinciden, en
 * orden alfanumérico (`threadReferences`), y se elige una. «Conversación general» está siempre
 * en la lista, la primera. La etiqueta no se escribe a mano: lo escrito solo filtra; el valor
 * cambia al elegir una opción, y al salir del campo sin elegir vuelve a verse lo elegido.
 *
 * Montaje escrito a mano (`Thread.tsx`), no del arnés.
 */
export function TagCombobox({
  references,
  value,
  onChange,
}: {
  references: ThreadReferenceOption[];
  /** La referencia elegida; `null` = conversación general; `undefined` = sin elegir. */
  value: ThreadReference | null | undefined;
  onChange: (next: ThreadReference | null) => void;
}) {
  const listId = useId();
  /** Lo que se está escribiendo; `null` = no se está escribiendo y se ve lo elegido. */
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const shown = value === undefined ? '' : value === null ? TAB_TEXTS.generalConversation : referenceLabel(value);
  const text = query ?? shown;

  // Escribiendo: las que coinciden. Sin escribir (o con el texto de lo ya elegido): todas.
  const filtering = query !== null && query.trim() !== '' && query !== shown;
  const refs = filtering ? matchReferences(references, query) : references;
  const general = !filtering || normalizeRef(TAB_TEXTS.generalConversation).includes(normalizeRef(query ?? ''));
  const options: { label: string; ref: ThreadReference | null }[] = [
    ...(general ? [{ label: TAB_TEXTS.generalConversation, ref: null }] : []),
    ...refs.map((r) => ({ label: r.label, ref: { partNumber: r.partNumber, brand: r.brand } })),
  ];

  const choose = (i: number) => {
    const o = options[i];
    if (!o) return;
    onChange(o.ref);
    setQuery(null);
    setOpen(false);
  };

  return (
    <div className={styles.root}>
      <label className={styles.label} htmlFor={`${listId}-input`}>
        {TAB_TEXTS.tagLabel}
      </label>
      <div className={styles.field}>
        <input
          id={`${listId}-input`}
          className={styles.input}
          type="text"
          role="combobox"
          aria-label={TAB_TEXTS.tagLabel}
          aria-expanded={open}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={TAB_TEXTS.tagPlaceholder}
          value={text}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onBlur={() => {
            setOpen(false);
            setQuery(null);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, options.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && open) {
              e.preventDefault();
              choose(active);
            } else if (e.key === 'Escape') {
              setOpen(false);
              setQuery(null);
            }
          }}
        />
        {open && options.length > 0 && (
          <ul id={`${listId}-list`} role="listbox" aria-label={TAB_TEXTS.tagOptionsLabel} className={styles.list}>
            {options.map((o, i) => (
              <li
                key={o.label}
                role="option"
                aria-selected={i === active}
                className={`${styles.option ?? ''} ${i === active ? (styles.optionActive ?? '') : ''}`.trim()}
                // `mousedown` y no `click`: el `blur` del campo cerraría la lista antes del clic.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(i);
                }}
              >
                {o.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
