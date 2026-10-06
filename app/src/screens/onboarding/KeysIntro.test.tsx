import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeysIntro } from './KeysIntro';

/**
 * CONTRATO DE ACEPTACIÓN · REG-05 · Introducción a las claves E2EE (`KeysIntro`).
 *
 * Escrito antes que el código y por Claude Code (`harness/README.md`). El Coder no
 * lo ve. La pantalla es explicativa: no tiene capa de datos, no llama a la red y no
 * toca criptografía (las claves las genera REG-07, a mano, Plan §4.3). Lo único que
 * hace es avisar al wiring con `onContinue`.
 *
 * Los textos son los del HTML aprobado, que manda sobre la spec funcional (`F-170`):
 * el botón es `Entendido, crear mi frase de seguridad` y no `Entendido — Generar mis
 * claves`, el título es `Antes de continuar, una cosa importante` y no hay enlace
 * `¿Cómo funciona esto?` (el HTML no lo dibuja).
 */

const onContinue = vi.fn<() => void>();
const fetchSpy = vi.fn();

beforeEach(() => {
  onContinue.mockReset();
  fetchSpy.mockReset();
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mount() {
  return render(<KeysIntro onContinue={onContinue} />);
}

const continuar = () => screen.getByRole('button', { name: 'Entendido, crear mi frase de seguridad' });

/** Texto de un elemento con los espacios colapsados (un `<br>` no aporta texto). */
const plano = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('REG-05 · KeysIntro · cabecera', () => {
  it('el título es el único <h1> y dice «Antes de continuar, una cosa importante»', () => {
    mount();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(plano(h1s[0]!)).toMatch(/^Antes de continuar,\s*una cosa importante$/);
  });

  it('lleva el antetítulo «Módulo 01 · Onboarding» (punto medio U+00B7)', () => {
    mount();
    expect(screen.getByText('Módulo 01 · Onboarding')).toBeInTheDocument();
  });

  it('se pinta entera al montar: sin estado de carga ni alertas', () => {
    mount();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('REG-05 · KeysIntro · los pasos del registro', () => {
  it('es una lista ordenada «Pasos del registro» con cuatro pasos en orden', () => {
    mount();
    const lista = screen.getByRole('list', { name: 'Pasos del registro' });
    expect(lista.tagName).toBe('OL');
    const pasos = within(lista).getAllByRole('listitem');
    expect(pasos.map(plano).map((t) => t.replace(/^[✓\d]\s*/, ''))).toEqual([
      'Solicitud',
      'Organización',
      'Seguridad',
      'Activación',
    ]);
  });

  it('el paso actual es «Seguridad», marcado con aria-current="step", y solo él', () => {
    mount();
    const pasos = within(screen.getByRole('list', { name: 'Pasos del registro' })).getAllByRole('listitem');
    const actuales = pasos.filter((li) => li.getAttribute('aria-current') === 'step');
    expect(actuales).toHaveLength(1);
    expect(plano(actuales[0]!)).toMatch(/Seguridad$/);
  });

  it('el paso actual lleva el número 3 y el pendiente el 4; los hechos, un icono y no un número', () => {
    mount();
    const pasos = within(screen.getByRole('list', { name: 'Pasos del registro' })).getAllByRole('listitem');
    expect(plano(pasos[2]!)).toMatch(/^3\s*Seguridad$/);
    expect(plano(pasos[3]!)).toMatch(/^4\s*Activación$/);
    expect(plano(pasos[0]!)).not.toMatch(/\d/);
    expect(plano(pasos[1]!)).not.toMatch(/\d/);
  });

  it('los cuatro <li> no llevan role explícito (F-131)', () => {
    mount();
    const lista = screen.getByRole('list', { name: 'Pasos del registro' });
    for (const li of Array.from(lista.querySelectorAll('li'))) expect(li.hasAttribute('role')).toBe(false);
  });
});

describe('REG-05 · KeysIntro · los tres bloques', () => {
  const BLOQUES: Array<[string, string]> = [
    [
      'Tus negociaciones son privadas',
      'Los precios y condiciones que intercambies en Bearingworld.io se cifran en tu dispositivo. Ni nosotros ni nadie puede leerlos.',
    ],
    [
      'Tú tienes la llave',
      'Para garantizar esa privacidad, vamos a generar un par de claves criptográficas únicas para ti.',
    ],
    [
      'Necesitas una frase de seguridad',
      'Guardaremos una copia cifrada de tu clave en nuestros servidores, protegida con una frase que solo tú conocerás. Si la pierdes, perderás el acceso a tu historial cifrado.',
    ],
  ];

  it('tres títulos <h2>, en este orden', () => {
    mount();
    expect(screen.getAllByRole('heading', { level: 2 }).map(plano)).toEqual(BLOQUES.map(([t]) => t));
  });

  it.each(BLOQUES)('«%s» lleva su descripción literal', (titulo, desc) => {
    mount();
    expect(screen.getByRole('heading', { level: 2, name: titulo })).toBeInTheDocument();
    expect(screen.getByText(desc)).toBeInTheDocument();
  });

  it('la marca es Bearingworld.io, nunca Rinworld', () => {
    const { container } = mount();
    expect(container.textContent).toContain('Bearingworld.io');
    expect(container.textContent).not.toMatch(/Rinworld/i);
  });

  it('los iconos son decorativos: todo <svg> lleva aria-hidden', () => {
    const { container } = mount();
    const svgs = Array.from(container.querySelectorAll('svg'));
    expect(svgs.length).toBeGreaterThanOrEqual(4);
    for (const svg of svgs) expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('REG-05 · KeysIntro · el aviso', () => {
  it('«Anota tu frase de seguridad en un lugar seguro.» va en <strong>, seguido de «No podemos recuperarla por ti.»', () => {
    mount();
    const fuerte = screen.getByText('Anota tu frase de seguridad en un lugar seguro.');
    expect(fuerte.tagName).toBe('STRONG');
    expect(plano(fuerte.parentElement!)).toBe('Anota tu frase de seguridad en un lugar seguro. No podemos recuperarla por ti.');
  });
});

describe('REG-05 · KeysIntro · continuar', () => {
  it('hay un único botón, de tipo button', () => {
    mount();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(continuar()).toHaveAttribute('type', 'button');
    expect(continuar()).toBeEnabled();
  });

  it('pulsarlo llama a onContinue una vez', async () => {
    mount();
    await userEvent.click(continuar());
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('no llama a la red ni al montar ni al pulsar', async () => {
    mount();
    await userEvent.click(continuar());
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
