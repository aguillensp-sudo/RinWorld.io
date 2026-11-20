import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessagesTimeline } from './MessagesTimeline';
import { messageTimeline, TAB_TEXTS, type ThreadReference } from '../../lib/negotiation-rows';
import { ENCRYPTED_NOTICE, type ThreadItem } from '../../lib/thread-detail';

/**
 * CONTRATO DE ACEPTACIÓN · `MessagesTimeline` (`amend-msg-hilos-pestanas-y-etiqueta`).
 *
 * Escrito por Claude Code antes de la corrida del arnés; el Coder no lo ve. Las entradas salen
 * de `messageTimeline`, la de verdad.
 */

const A = 'org-a';
const B = 'org-b';
const NOW = new Date('2026-11-15T12:00:00Z');
let n = 0;

function item(over: Partial<ThreadItem>): ThreadItem {
  n += 1;
  return {
    id: `i${n}`,
    type: 'MENSAJE',
    senderOrgId: A,
    isOwn: true,
    createdAt: '2026-11-10T09:00:00Z',
    estadoChangedAt: null,
    partNumber: null,
    brand: null,
    offerState: null,
    inquiryState: null,
    respondsToItemId: null,
    supersededByItemId: null,
    content: null,
    raw: { ciphertext: `\\x${'ab'.repeat(20)}`, iv: `\\x${'07'.repeat(12)}`, wrappedKeyCount: 1 },
    ...over,
  };
}

const consulta = item({
  id: 'q',
  type: 'CONSULTA',
  partNumber: '6205-2RS',
  brand: 'SKF',
  inquiryState: 'Pendiente',
  createdAt: '2026-11-09T09:00:00Z',
  content: { kind: 'CONSULTA', quantity: 500, comment: null },
});
const mioGeneral = item({ id: 'm1', createdAt: '2026-11-11T09:00:00Z', content: { kind: 'MENSAJE', text: 'Hola, ¿qué tal?' } });
const mioEtiquetado = item({
  id: 'm2',
  createdAt: '2026-11-12T09:00:00Z',
  partNumber: '6205-2RS',
  brand: 'SKF',
  content: { kind: 'MENSAJE', text: '¿Podéis mejorar el plazo?' },
});
const suyo = item({
  id: 'm3',
  senderOrgId: B,
  isOwn: false,
  createdAt: '2026-11-13T09:00:00Z',
  partNumber: '6205-2RS',
  brand: 'SKF',
  content: { kind: 'MENSAJE', text: 'Sí, a 10 días.' },
});
const cifrado = item({ id: 'm4', senderOrgId: B, isOwn: false, createdAt: '2026-11-14T09:00:00Z', content: null });
const TODOS = [consulta, mioGeneral, mioEtiquetado, suyo, cifrado];

function montar(filter: ThreadReference | null = null) {
  const onClearFilter = vi.fn();
  render(
    <MessagesTimeline
      entries={messageTimeline(TODOS, filter)}
      allItems={TODOS}
      filter={filter}
      onClearFilter={onClearFilter}
      authorOf={(i) => (i.isOwn ? 'Rodamientos Ibéricos' : 'Nordwälz Lager')}
      now={NOW}
    />,
  );
  return { onClearFilter };
}

const elementos = () => screen.getAllByTestId('thread-item');
const elemento = (id: string) => elementos().find((e) => e.getAttribute('data-item-id') === id)!;

describe('sin filtro', () => {
  it('solo los mensajes, el más reciente primero, cada uno un `thread-item` con su id', () => {
    montar();
    expect(elementos().map((e) => e.getAttribute('data-item-id'))).toEqual(['m4', 'm3', 'm2', 'm1']);
  });

  it('el texto del mensaje, o el aviso de cifrado si no se puede leer', () => {
    montar();
    expect(elemento('m1')).toHaveTextContent('Hola, ¿qué tal?');
    expect(elemento('m4')).toHaveTextContent(ENCRYPTED_NOTICE);
  });

  it('el autor y la hora relativa de cada uno', () => {
    montar();
    expect(elemento('m3')).toHaveTextContent('Nordwälz Lager');
    expect(elemento('m2')).toHaveTextContent('Rodamientos Ibéricos');
    expect(elemento('m2')).toHaveTextContent(/hace 3 d/);
  });

  it('la etiqueta en `message-tag`, los de conversación general no llevan', () => {
    montar();
    expect(within(elemento('m2')).getByTestId('message-tag')).toHaveTextContent('6205-2RS · SKF');
    expect(within(elemento('m1')).queryByTestId('message-tag')).toBeNull();
  });

  it('sin mensajes, un aviso', () => {
    render(
      <MessagesTimeline
        entries={[]}
        allItems={[]}
        filter={null}
        onClearFilter={() => {}}
        authorOf={() => ''}
        now={NOW}
      />,
    );
    expect(screen.getByText(TAB_TEXTS.noMessages)).toBeInTheDocument();
  });
});

describe('sin selector de etiqueta', () => {
  it('ningún mensaje lleva un desplegable para cambiar la etiqueta (PO, 18-nov-2026)', () => {
    montar();
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});

describe('filtrada por una referencia', () => {
  const REF = { partNumber: '6205-2RS', brand: 'SKF' };

  it('arriba, «Referencia: … ✕», y la ✕ quita el filtro', async () => {
    const user = userEvent.setup();
    const { onClearFilter } = montar(REF);
    expect(screen.getByText(TAB_TEXTS.filterChip('6205-2RS · SKF'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: TAB_TEXTS.clearFilter }));
    expect(onClearFilter).toHaveBeenCalled();
  });

  it('sus mensajes y sus tarjetas, con la línea compacta y el estado; sin los generales', () => {
    montar(REF);
    expect(elementos().map((e) => e.getAttribute('data-item-id'))).toEqual(['m3', 'm2', 'q']);
    expect(elemento('q')).toHaveTextContent('Consulta · 500 ud.');
    expect(elemento('q')).toHaveTextContent('Pendiente');
  });

  it('sin filtro no hay chip', () => {
    montar();
    // Ancla: la lista está pintada. Sin ella, el aserto negativo lo cumple también un componente vacío.
    expect(elementos()).toHaveLength(4);
    expect(screen.queryByRole('button', { name: TAB_TEXTS.clearFilter })).toBeNull();
  });
});

describe('«Ver lo que ve el servidor»', () => {
  it('cerrado al montar; abierto, `server-view` enseña TODOS los elementos del hilo tal como los guarda la base', async () => {
    const user = userEvent.setup();
    montar();
    expect(screen.queryByTestId('server-view')).toBeNull();
    const boton = screen.getByRole('button', { name: TAB_TEXTS.serverViewOpen });
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    await user.click(boton);

    const panel = screen.getByTestId('server-view');
    // La consulta también: el panel es del hilo entero, no de la lista filtrada.
    expect(panel).toHaveTextContent('CONSULTA');
    expect(panel).toHaveTextContent('6205-2RS');
    expect(within(panel).getAllByText(`\\x${'ab'.repeat(20)}`)).toHaveLength(TODOS.length);
    expect(panel).not.toHaveTextContent('Hola, ¿qué tal?');

    await user.click(screen.getByRole('button', { name: TAB_TEXTS.serverViewClose }));
    expect(screen.queryByTestId('server-view')).toBeNull();
  });
});
