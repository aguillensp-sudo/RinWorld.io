import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  previewLabel,
  relativeTime,
  THREAD_STATES,
  type ThreadSummary,
} from '../../lib/threads';

/**
 * CONTRATO DE ACEPTACIÓN · MSG-01 · lista de hilos.
 *
 * Escrito **antes** que el código y por Claude Code, no por el Coder
 * (`Plan §6`, `CLAUDE.md` §3). El Coder no ve este fichero: si lo viera,
 * escribiría para el test en vez de para la spec, que es la misma degradación por
 * otra puerta.
 *
 * Lo que este fichero fija es el **panel de contenido**, nunca el shell (F-025):
 * el armazón tiene su contrato y sus tests desde el día 2, y volver a juzgarlo
 * aquí solo produciría falsos rojos.
 *
 * Y una regla de forma que ya nos costó un día: **se compara contra la función de
 * formato, nunca contra el literal del mock** (F-024). El bloque "Datos de
 * ejemplo" de la spec escribe `hace 2h`; lo que el CLDR de `es` produce es
 * `hace 2 h`. Manda el CLDR.
 */

const NOW = new Date('2026-08-08T12:00:00Z');

function thread(over: Partial<ThreadSummary> = {}): ThreadSummary {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    counterpartyName: 'Nordwälz Lager',
    counterpartyCountry: 'DE',
    state: 'ABIERTO',
    lastItemAt: new Date(NOW.getTime() - 2 * 3600_000).toISOString(),
    lastItem: { type: 'MENSAJE', partNumber: null, isOwn: false },
    ...over,
  };
}

const { ThreadList } = await import('./ThreadList');

describe('MSG-01 · ThreadList', () => {
  it('pinta una fila por hilo', () => {
    render(
      <ThreadList
        threads={[thread(), thread({ id: 'b', counterpartyName: 'Cuscinetti Padana' })]}
        now={NOW}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('respeta el orden que recibe y no reordena por su cuenta', () => {
    // El orden por actividad descendente es del servidor (`last_item_at desc`).
    // Si el componente reordenara, la página 2 saldría descolocada respecto a la 1.
    const viejo = thread({ id: 'a', counterpartyName: 'Anadolu Rulman' });
    const nuevo = thread({ id: 'b', counterpartyName: 'Roulements Rhône' });
    render(<ThreadList threads={[viejo, nuevo]} now={NOW} onOpen={vi.fn()} />);

    const filas = screen.getAllByRole('listitem');
    expect(within(filas[0]!).getByText('Anadolu Rulman')).toBeInTheDocument();
    expect(within(filas[1]!).getByText('Roulements Rhône')).toBeInTheDocument();
  });

  it('enseña la contraparte con su badge de país', () => {
    render(<ThreadList threads={[thread()]} now={NOW} onOpen={vi.fn()} />);
    const fila = screen.getByRole('listitem');
    expect(within(fila).getByText('Nordwälz Lager')).toBeInTheDocument();
    expect(within(fila).getByText('DE')).toBeInTheDocument();
  });

  it('el nombre de la contraparte va con sus diacríticos', () => {
    // F-019: `organizations.name` es contenido de demo. Las dos organizaciones
    // nacieron en ASCII y el socio iba a leer "Nordwaelz Lager" en pantalla.
    render(<ThreadList threads={[thread()]} now={NOW} onOpen={vi.fn()} />);
    expect(screen.queryByText(/Nordwaelz|Nordwalz/)).not.toBeInTheDocument();
  });

  describe('vista previa — solo metadatos, nunca contenido descifrado', () => {
    it('un mensaje libre no revela su texto', () => {
      render(<ThreadList threads={[thread()]} now={NOW} onOpen={vi.fn()} />);
      expect(screen.getByText('Mensaje libre')).toBeInTheDocument();
    });

    it('una consulta enseña tipo y referencia', () => {
      render(
        <ThreadList
          threads={[
            thread({ lastItem: { type: 'CONSULTA', partNumber: 'NU2210-E-TVP2', isOwn: false } }),
          ]}
          now={NOW}
          onOpen={vi.fn()}
        />,
      );
      expect(screen.getByText('Tarjeta de consulta · NU2210-E-TVP2')).toBeInTheDocument();
    });

    it('una oferta enseña tipo y referencia, y ni una cifra', () => {
      // Lo que va cifrado en `thread_items.content_ciphertext` son las cifras:
      // precio, cantidad, plazo. Si alguna apareciera aquí, la frontera E2EE
      // estaría rota en la pantalla de entrada a la mensajería.
      render(
        <ThreadList
          threads={[
            thread({ lastItem: { type: 'OFERTA', partNumber: '6205-2RS', isOwn: false } }),
          ]}
          now={NOW}
          onOpen={vi.fn()}
        />,
      );
      const fila = screen.getByRole('listitem');
      expect(within(fila).getByText('Tarjeta de oferta · 6205-2RS')).toBeInTheDocument();
      expect(within(fila).queryByText(/\d+\s*(u|unidades|€|EUR)/)).not.toBeInTheDocument();
    });

    it('un hilo sin elementos no se inventa una vista previa', () => {
      render(<ThreadList threads={[thread({ lastItem: null })]} now={NOW} onOpen={vi.fn()} />);
      expect(screen.getByText(previewLabel(null))).toBeInTheDocument();
    });
  });

  describe('badge de estado', () => {
    it.each(THREAD_STATES)('pinta el literal exacto de %s', (state) => {
      // Los cinco salen del CHECK de la migración 0003. Ni se traducen ni se
      // abrevian: el badge es la lectura directa de `threads.state`.
      render(<ThreadList threads={[thread({ state })]} now={NOW} onOpen={vi.fn()} />);
      expect(screen.getByText(state)).toBeInTheDocument();
    });
  });

  it('el timestamp sale de relativeTime, no de un literal', () => {
    // F-024 en una línea: se compara contra la función, no contra "hace 2h".
    const t = thread();
    render(<ThreadList threads={[t]} now={NOW} onOpen={vi.fn()} />);
    expect(screen.getByText(relativeTime(t.lastItemAt, NOW))).toBeInTheDocument();
  });

  it('abrir un hilo avisa con su id', async () => {
    const onOpen = vi.fn();
    render(<ThreadList threads={[thread({ id: 'abc' })]} now={NOW} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: /Nordwälz Lager/ }));
    expect(onOpen).toHaveBeenCalledWith('abc');
  });

  describe('estado vacío', () => {
    it('dice qué hacer, con el texto de la spec §6', () => {
      render(<ThreadList threads={[]} now={NOW} onOpen={vi.fn()} />);
      expect(
        screen.getByText(
          'Todavía no tienes ninguna conversación. Usa el Directorio para contactar con otras organizaciones.',
        ),
      ).toBeInTheDocument();
    });

    it('y el botón al Directorio va deshabilitado, diciendo por qué', () => {
      // DIR-01 no está entre las 8 pantallas del alcance (Plan §9). El control se
      // queda —quitarlo dejaría el estado vacío sin salida visible— pero
      // deshabilitado y con el motivo, igual que el botón de subida de INV-01
      // (F-023 e). Un botón que parece pulsable y no lleva a ningún sitio es el
      // riesgo #1 de CLAUDE.md §7 llevado a la interfaz.
      render(<ThreadList threads={[]} now={NOW} onOpen={vi.fn()} />);
      const boton = screen.getByRole('button', { name: /Ir al Directorio/ });
      expect(boton).toBeDisabled();
      expect(screen.getByText(/fuera del MVP/i)).toBeInTheDocument();
    });

    it('sin hilos no hay lista vacía colgando', () => {
      render(<ThreadList threads={[]} now={NOW} onOpen={vi.fn()} />);
      expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    });
  });

  describe('lo que el mock promete y el MVP no tiene', () => {
    it('no pinta punto ni recuento de no leídos', () => {
      // El esquema no tiene NINGÚN seguimiento de lectura: ni `read_at`, ni
      // `last_read_at`, ni tabla de recibos. El "punto azul + recuento" de la
      // spec §3 no tiene de dónde salir, y un recuento inventado delante del
      // socio es exactamente F-023 otra vez. Ver F-027.
      render(<ThreadList threads={[thread()]} now={NOW} onOpen={vi.fn()} />);
      expect(screen.queryByTestId('unread-count')).not.toBeInTheDocument();
      expect(screen.queryByText(/no le[íi]dos?/i)).not.toBeInTheDocument();
    });

    it('no pinta el bloque de passphrase', () => {
      // En el MVP las claves viven en memoria de sesión y no hay passphrase,
      // backup ni recuperación (CLAUDE.md §4; Plan §9 "Fuera"). Un botón
      // "Introducir frase de seguridad" que no puede hacer nada es una promesa.
      render(<ThreadList threads={[thread()]} now={NOW} onOpen={vi.fn()} />);
      expect(screen.queryByText(/frase de seguridad/i)).not.toBeInTheDocument();
    });

    it('y la vista previa no se tapa con puntitos', () => {
      // La spec §3 los pide si la passphrase no está activa; la §7 dice que la
      // vista previa nunca muestra contenido descifrado. Si nunca lo muestra, no
      // hay nada que tapar: tipo y referencia son metadatos en claro en
      // `thread_items`. Se resuelve a favor de §7. Ver F-027.
      render(<ThreadList threads={[thread()]} now={NOW} onOpen={vi.fn()} />);
      expect(screen.queryByText(/•\s*•\s*•/)).not.toBeInTheDocument();
    });
  });
});
