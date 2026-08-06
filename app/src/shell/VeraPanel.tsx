import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './VeraPanel.module.css';

interface Message {
  id: number;
  from: 'vera' | 'user';
  text: string;
  at: string;
}

function hhmm(d: Date): string {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * VERA NO ESTÁ CONECTADA. El shell aprobado responde "Entendido. ¿Algo más?" a
 * cualquier cosa, y eso aquí no se copia: CLAUDE.md §7 dice que el riesgo #1 del
 * proyecto es VERA afirmando con aplomo algo que no sabe. Un eco enlatado en el
 * andamiaje es exactamente ese fallo con otra cara — delante del socio se lee
 * como un agente que funciona. Hasta el día 9 (herramientas + Edge Function
 * proxy), VERA dice que no está conectada. El panel, el arrastre y el colapso sí
 * son los definitivos.
 */
const NOT_WIRED =
  'Todavía no estoy conectada: mis herramientas de búsqueda llegan el día 9. Hasta entonces no puedo responder sobre inventario ni ofertas.';

const GREETING = 'Hola. Soy VERA, tu asistente. ¿En qué puedo ayudarte?';

export function VeraPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, from: 'vera', text: GREETING, at: hhmm(new Date()) },
  ]);

  const panelRef = useRef<HTMLElement | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  // Arrastre del handle. Rango 32px … 50% del área principal, como §4.
  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent) => {
      const main = panelRef.current?.parentElement;
      if (!main) return;
      const mainWidth = main.clientWidth;
      const next = mainWidth - (e.clientX - main.getBoundingClientRect().left);
      const min = 32;
      const max = mainWidth * 0.5;
      if (next >= min && next <= max) setWidth(next);
    };
    const onUp = () => setDragging(false);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    const at = hhmm(new Date());
    setMessages((prev) => [
      ...prev,
      { id: prev.length, from: 'user', text, at },
      { id: prev.length + 1, from: 'vera', text: NOT_WIRED, at },
    ]);
    setDraft('');
    const ta = textareaRef.current;
    if (ta) ta.style.height = 'auto';
  }, [draft]);

  const cls = [styles.bwvera, collapsed ? styles.col : '', dragging ? styles.dragging : '']
    .filter(Boolean)
    .join(' ');

  return (
    <aside
      ref={panelRef}
      className={cls}
      aria-label="VERA"
      {...(width !== null && !collapsed ? { style: { width: `${width}px` } } : {})}
    >
      <div
        className={styles.bwveraResize}
        data-testid="vera-resize"
        onMouseDown={(e) => {
          e.preventDefault();
          setCollapsed(false);
          setDragging(true);
        }}
      />
      <button
        className={styles.bwveratg}
        onClick={toggle}
        aria-label={collapsed ? 'Expandir VERA' : 'Colapsar VERA'}
      >
        <i className={collapsed ? 'ti ti-chevron-left' : 'ti ti-chevron-right'} />
      </button>
      {/* Sin aria-label: su nombre accesible es su texto, "VERA". Si llevara
          aria-label="Expandir VERA" habría dos botones con ese mismo nombre
          cuando el panel está colapsado, y ninguna consulta por rol sería
          unívoca — ni en los tests ni para un lector de pantalla. */}
      <button className={styles.bwveralbl} onClick={toggle}>
        VERA
      </button>

      <div className={styles.bwvh}>
        <div className={styles.bwvico}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="#B8924A" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="5.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            <circle cx="12" cy="12" r="2.5" stroke="#B8924A" strokeWidth="1.5" />
            <circle cx="12" cy="6" r="1.3" fill="rgba(255,255,255,0.5)" />
            <circle cx="12" cy="18" r="1.3" fill="rgba(255,255,255,0.5)" />
            <circle cx="6" cy="12" r="1.3" fill="rgba(255,255,255,0.5)" />
            <circle cx="18" cy="12" r="1.3" fill="rgba(255,255,255,0.5)" />
          </svg>
        </div>
        <div>
          <div className={styles.bwvname}>VERA</div>
          <div className={styles.bwvsub}>Agente de búsqueda</div>
        </div>
        <div className={styles.bwvdot} />
      </div>

      <div className={styles.bwchat} ref={chatRef} data-testid="vera-chat">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`${styles.bwmsg} ${m.from === 'user' ? styles.u : styles.v}`}
          >
            <div className={styles.bwbub}>{m.text}</div>
            <div className={styles.bwts}>{m.at}</div>
          </div>
        ))}
      </div>

      <div className={styles.bwia}>
        <div className={styles.bwir}>
          <textarea
            ref={textareaRef}
            className={styles.bwinpa}
            placeholder="Pregunta a VERA..."
            rows={1}
            value={draft}
            aria-label="Pregunta a VERA"
            onChange={(e) => {
              setDraft(e.target.value);
              const el = e.target;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 72)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button className={styles.bwsnd} onClick={send} aria-label="Enviar">
            →
          </button>
        </div>
      </div>
    </aside>
  );
}
