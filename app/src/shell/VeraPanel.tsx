import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './VeraPanel.module.css';
import { ask, type ProxyCall } from '../lib/vera';
import type { Screen } from '../lib/vera-tools';
import type { SearchCriteria } from '../lib/search';
import { errorMessage, type MemberProfile } from '../lib/session';

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
 * SIN AGENTE, VERA SIGUE DICIENDO QUE NO ESTÁ CONECTADA.
 *
 * El shell aprobado responde "Entendido. ¿Algo más?" a cualquier cosa, y eso
 * aquí no se copia: `CLAUDE.md` §7 dice que el riesgo #1 del proyecto es VERA
 * afirmando con aplomo algo que no sabe, y un eco enlatado en el andamiaje es
 * ese mismo fallo con otra cara.
 *
 * **El día 9 llegaron las herramientas, pero este camino no se borra**: el panel
 * se monta sin `agent` en los tests del shell y podría montarse así por un fallo
 * de cableado. Que en ese caso diga la verdad —que no está conectada— es lo que
 * impide que un cable suelto se vea como un agente funcionando.
 */
const NOT_WIRED =
  'Todavía no estoy conectada: no tengo acceso a mis herramientas. No puedo responder sobre inventario ni ofertas.';

/**
 * El modelo terminó sin texto. Pasa si agotó el tope de vueltas del bucle o si
 * devolvió solo llamadas a herramienta. **Una burbuja vacía sería peor que
 * esto**: parecería que VERA ha contestado y que la respuesta es nada.
 */
const SIN_RESPUESTA = 'No he podido terminar de responder. Vuelve a preguntármelo, por favor.';

/** Lo que hace falta para que el panel deje de ser andamiaje. */
export interface VeraAgent {
  profile: MemberProfile;
  navigate: (screen: Screen) => void;
  setCriteria: (criteria: SearchCriteria) => void;
  call: ProxyCall;
}

const GREETING = 'Hola. Soy VERA, tu asistente. ¿En qué puedo ayudarte?';

/**
 * El subtítulo de VERA es **de la pantalla, no del shell**.
 *
 * `Rinworld_app_shell.html` pone "Agente de búsqueda", pero el HTML aprobado de
 * INV-01 y su spec §5 dicen los dos **"Agente de inventario"** — y cuando el HTML
 * y el spec coinciden, no hay nada que decidir. El día 2 se copió el del shell base
 * y quedó fijo; se detectó el día 3 comparando las dos pantallas lado a lado.
 * Cada pantalla pasa el suyo. Ver F-025.
 */
const DEFAULT_SUBTITLE = 'Agente de búsqueda';

interface VeraProps {
  subtitle?: string;
  agent?: VeraAgent;
}

export function VeraPanel({ subtitle = DEFAULT_SUBTITLE, agent }: VeraProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState('');
  const [pensando, setPensando] = useState(false);
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

  const responde = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: prev.length, from: 'vera', text, at: hhmm(new Date()) },
    ]);
  }, []);

  const send = useCallback(async () => {
    const text = draft.trim();
    // Con una pregunta en vuelo no se manda otra: el bucle tiene estado
    // (historial, herramientas a medio ejecutar) y dos a la vez lo entrelazan.
    if (!text || pensando) return;

    setMessages((prev) => [
      ...prev,
      { id: prev.length, from: 'user', text, at: hhmm(new Date()) },
    ]);
    setDraft('');
    const ta = textareaRef.current;
    if (ta) ta.style.height = 'auto';

    if (!agent) {
      responde(NOT_WIRED);
      return;
    }

    setPensando(true);
    try {
      const r = await ask(
        text,
        { profile: agent.profile, navigate: agent.navigate, setCriteria: agent.setCriteria },
        agent.call,
      );
      responde(r.text || SIN_RESPUESTA);
    } catch (e) {
      /*
       * El fallo se pinta EN EL HILO, con su motivo. Tragárselo dejaría el panel
       * con la pregunta del usuario y sin respuesta, que se lee como que VERA ha
       * decidido no contestar — y el motivo real (la clave sin poner, la sesión
       * caducada) se quedaría solo en la consola.
       */
      responde(errorMessage(e));
    } finally {
      setPensando(false);
    }
  }, [draft, pensando, agent, responde]);

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
          <div className={styles.bwvsub} data-testid="vera-subtitle">
            {subtitle}
          </div>
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
        {pensando ? (
          <div className={`${styles.bwmsg} ${styles.v}`} data-testid="vera-pensando">
            <div className={styles.bwbub}>Consultando…</div>
          </div>
        ) : null}
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
                void send();
              }
            }}
          />
          <button
            className={styles.bwsnd}
            onClick={() => void send()}
            aria-label="Enviar"
            disabled={pensando}
          >
            →
          </button>
        </div>
      </div>
    </aside>
  );
}
