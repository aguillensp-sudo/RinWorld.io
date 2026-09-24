import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WatcherRow } from '../../lib/watchers';
import { WatcherCard } from './WatcherCard';

/**
 * CONTRATO DE ACEPTACIÓN · SRCH-03 · tarjeta (`WatcherCard`).
 *
 * Escrito antes que el código y por Claude Code. El Coder no lo ve. La tarjeta es
 * PRESENTACIONAL: nada de red y nada de estado propio. Los ejemplos son los de la
 * spec §3 («Datos de ejemplo»).
 */

const NOW = new Date('2026-09-24T12:00:00Z');
const haceH = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

function row(over: Partial<WatcherRow> = {}): WatcherRow {
  return {
    id: 'w-1',
    partNumber: '6308-ZZ',
    minQuantity: 100,
    brand: null,
    zone: 'EU',
    country: null,
    emailChannel: true,
    state: 'ACTIVE',
    createdAt: haceH(72),
    expiresAt: '2026-10-21T12:00:00Z',
    daysRemaining: 27,
    renewalDaysLeft: null,
    triggeredAt: null,
    triggeredDistributor: null,
    triggeredQuantity: null,
    triggeredCountry: null,
    ...over,
  };
}

function handlers() {
  return {
    onPause: vi.fn(),
    onResume: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onRenew: vi.fn(),
    onLetExpire: vi.fn(),
    onViewResults: vi.fn(),
  };
}

function montar(r: WatcherRow, busy = false) {
  const h = handlers();
  render(<WatcherCard row={r} now={NOW} busy={busy} {...h} />);
  return h;
}

const botones = () => screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);

describe('WatcherCard · ACTIVE', () => {
  it('es un article con nombre, y pinta referencia, estado y condiciones', () => {
    montar(row());
    const card = screen.getByRole('article', { name: 'Watcher 6308-ZZ' });
    expect(card).toHaveAttribute('data-state', 'ACTIVE');
    expect(within(card).getByText('6308-ZZ')).toBeInTheDocument();
    expect(within(card).getByText('ACTIVE')).toBeInTheDocument();
    expect(within(card).getByText('Cantidad mín: 100 u · Marca: cualquiera · País: Europa')).toBeInTheDocument();
  });

  it('fecha de creación relativa y días restantes', () => {
    montar(row());
    expect(screen.getByText('Creado: Hace 3 días')).toBeInTheDocument();
    expect(screen.getByText('27 días restantes')).toBeInTheDocument();
  });

  it('los días restantes van en naranja por debajo de 5, y no antes', () => {
    const { unmount } = render(
      <WatcherCard row={row({ daysRemaining: 4 })} now={NOW} busy={false} {...handlers()} />,
    );
    expect(screen.getByText('4 días restantes')).toHaveAttribute('data-tone', 'warn');
    unmount();
    render(<WatcherCard row={row({ daysRemaining: 27 })} now={NOW} busy={false} {...handlers()} />);
    expect(screen.getByText('27 días restantes')).toHaveAttribute('data-tone', 'normal');
  });

  it('canales: In-app siempre; Email solo si está configurado', () => {
    const { unmount } = render(<WatcherCard row={row()} now={NOW} busy={false} {...handlers()} />);
    expect(screen.getByText('In-app')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    unmount();
    render(<WatcherCard row={row({ emailChannel: false })} now={NOW} busy={false} {...handlers()} />);
    expect(screen.getByText('In-app')).toBeInTheDocument();
    expect(screen.queryByText('Email')).not.toBeInTheDocument();
  });

  it('acciones: Pausar, Editar y Eliminar, con el nombre de la referencia en el aria-label', () => {
    montar(row());
    expect(botones()).toEqual(['Pausar — 6308-ZZ', 'Editar — 6308-ZZ', 'Eliminar — 6308-ZZ']);
  });

  it('cada botón llama a su callback con la fila entera', async () => {
    const r = row();
    const h = montar(r);
    await userEvent.click(screen.getByRole('button', { name: 'Pausar — 6308-ZZ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Editar — 6308-ZZ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar — 6308-ZZ' }));
    expect(h.onPause).toHaveBeenCalledWith(r);
    expect(h.onEdit).toHaveBeenCalledWith(r);
    expect(h.onDelete).toHaveBeenCalledWith(r);
    expect(h.onResume).not.toHaveBeenCalled();
  });
});

describe('WatcherCard · PAUSED', () => {
  const paused = row({
    partNumber: '7210-BECBP',
    minQuantity: 10,
    brand: 'SKF',
    zone: null,
    country: 'ES',
    emailChannel: false,
    state: 'PAUSED',
    createdAt: haceH(18 * 24),
    daysRemaining: 12,
  });

  it('Reactivar en lugar de Pausar, y los días llevan «(pausado)»', async () => {
    const h = montar(paused);
    expect(botones()).toEqual(['Reactivar — 7210-BECBP', 'Editar — 7210-BECBP', 'Eliminar — 7210-BECBP']);
    expect(screen.getByText('12 días restantes (pausado)')).toBeInTheDocument();
    expect(screen.getByText('Cantidad mín: 10 u · Marca: SKF · País: España')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reactivar — 7210-BECBP' }));
    expect(h.onResume).toHaveBeenCalledWith(paused);
  });
});

describe('WatcherCard · TRIGGERED', () => {
  const trig = row({
    partNumber: 'NU2210-E-TVP2',
    minQuantity: 50,
    brand: 'FAG',
    zone: null,
    emailChannel: false,
    state: 'TRIGGERED',
    daysRemaining: null,
    triggeredAt: haceH(2),
    triggeredDistributor: 'Schaeffler Iberia SL',
    triggeredQuantity: 120,
    triggeredCountry: 'ES',
  });

  it('texto del disparo y Ver resultados; sin días restantes ni Pausar', async () => {
    const h = montar(trig);
    expect(screen.getByRole('article')).toHaveAttribute('data-state', 'TRIGGERED');
    expect(screen.getByText('Stock detectado el 24 Sep 2026 — Schaeffler Iberia SL · 120 u · ES')).toBeInTheDocument();
    expect(screen.queryByText(/restantes/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pausar|Editar/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver resultados' }));
    expect(h.onViewResults).toHaveBeenCalledWith(trig);
    expect(screen.getByRole('button', { name: 'Eliminar — NU2210-E-TVP2' })).toBeInTheDocument();
  });
});

describe('WatcherCard · PENDIENTE RENOVACIÓN', () => {
  const pend = row({
    partNumber: '22316-E',
    minQuantity: 20,
    zone: null,
    emailChannel: false,
    state: 'PENDIENTE RENOVACIÓN',
    daysRemaining: null,
    renewalDaysLeft: 2,
  });

  it('Expira en, y los dos botones de la spec', async () => {
    const h = montar(pend);
    expect(screen.getByText('PENDIENTE RENOVACIÓN')).toBeInTheDocument();
    expect(screen.getByText('Expira en: 2 días')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mantener activo 30 días más' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dejar que expire' }));
    expect(h.onRenew).toHaveBeenCalledWith(pend);
    expect(h.onLetExpire).toHaveBeenCalledWith(pend);
    expect(screen.queryByRole('button', { name: /Pausar|Reactivar|Editar/ })).not.toBeInTheDocument();
  });
});

describe('WatcherCard · EXPIRED', () => {
  it('solo se puede eliminar', () => {
    montar(row({ partNumber: '6205-2RS', state: 'EXPIRED', daysRemaining: null }));
    expect(screen.getByText('EXPIRED')).toBeInTheDocument();
    expect(botones()).toEqual(['Eliminar — 6205-2RS']);
  });
});

describe('WatcherCard · busy', () => {
  it('con una acción en vuelo, todos los botones quedan deshabilitados', () => {
    montar(row(), true);
    for (const b of screen.getAllByRole('button')) expect(b).toBeDisabled();
  });
});
