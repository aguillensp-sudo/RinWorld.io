import { describe, expect, it } from 'vitest';
import {
  dateLabel,
  latestOfferLine,
  latestQueryLine,
  metricLabel,
  monthStart,
  subtitleLabel,
  type PanelHighlight,
} from './panel';

/**
 * La lógica pura de PANEL-01.
 *
 * **Estos tests son míos, no el contrato del arnés** — el contrato vive en
 * `screens/panel/Panel.test.tsx` y el Coder no lo ve (`CLAUDE.md` §3).
 *
 * Lo que más se prueba aquí es el guion: es la pieza que impide que una métrica
 * sin fuente de datos se pinte como un cero, y un cero en este panel afirma algo
 * —por `RNG-PANEL-02`— en vez de callarlo.
 */

const H: PanelHighlight = { partNumber: '6205-2RS', orgName: 'NSK Europe Ltd', at: '2026-08-11T10:00:00Z' };

describe('metricLabel · la raya no es un cero', () => {
  it('null se pinta con raya', () => {
    expect(metricLabel(null)).toBe('—');
  });

  /**
   * Ancla positiva en el mismo `it` (F-074): sin ella, una implementación que
   * devolviera siempre la raya pasaría el aserto de arriba.
   */
  it('un cero de verdad se pinta como cero, no como raya', () => {
    expect(metricLabel(0)).toBe('0');
    expect(metricLabel(0)).not.toBe('—');
  });

  it('un número se pinta tal cual', () => {
    expect(metricLabel(7)).toBe('7');
  });
});

describe('subtitleLabel · CA-PANEL-01', () => {
  it('lleva el nombre y la fecha en el formato de la spec', () => {
    // 30 de junio de 2026 fue martes: el ejemplo literal de la spec §3.
    const s = subtitleLabel('Alpha Uno', 'alpha@bearingworld.io', new Date(2026, 5, 30, 12));
    expect(s).toBe('Bienvenido, Alpha Uno. Hoy es martes 30/06/2026.');
  });

  it('las cifras van a dos dígitos, que es lo que dice DD/MM/AAAA', () => {
    const s = subtitleLabel('Alpha Uno', 'alpha@bearingworld.io', new Date(2026, 0, 5, 12));
    expect(s).toContain('05/01/2026');
    expect(s).not.toContain('5/1/2026');
  });

  it('sin nombre completo cae al email en vez de saludar a nadie', () => {
    const s = subtitleLabel(null, 'alpha@bearingworld.io', new Date(2026, 5, 30, 12));
    expect(s).toContain('alpha@bearingworld.io');
  });

  it('un nombre en blanco cuenta como ausente', () => {
    const s = subtitleLabel('   ', 'alpha@bearingworld.io', new Date(2026, 5, 30, 12));
    expect(s).toContain('alpha@bearingworld.io');
  });
});

describe('las líneas de detalle', () => {
  it('la de ofertas lleva referencia, organización y fecha', () => {
    expect(latestOfferLine(H)).toBe('Más reciente: 6205-2RS · NSK Europe Ltd (11 ago 2026)');
  });

  it('la de consultas no lleva fecha, que la spec no la pide', () => {
    expect(latestQueryLine(H)).toBe('Última consulta: 6205-2RS · NSK Europe Ltd');
  });

  it('sin nada que enseñar lo dice, no deja la línea a medias', () => {
    expect(latestOfferLine(null)).toBe('Sin ofertas pendientes');
    expect(latestQueryLine(null)).toBe('Sin consultas pendientes');
  });

  /**
   * `part_number` es nullable en `thread_items` (`0003:101`): un MENSAJE suelto
   * no lleva referencia. Sin este caso, la línea diría "Más reciente: null · …".
   */
  it('una referencia ausente sale como raya, nunca como "null"', () => {
    const sinRef = { ...H, partNumber: null };
    expect(latestOfferLine(sinRef)).toContain('—');
    expect(latestOfferLine(sinRef)).not.toContain('null');
  });
});

describe('dateLabel', () => {
  /**
   * `DD Mmm YYYY`, que es el del HTML aprobado (`29 Jun 2026`) — y NO el
   * `DD/MM/AAAA` del subtítulo. Son dos formatos distintos en la misma pantalla.
   */
  it('formatea como las tarjetas del HTML aprobado, no como el subtítulo', () => {
    expect(dateLabel('2026-08-11T10:00:00Z')).toBe('11 ago 2026');
    expect(dateLabel('2026-08-11T10:00:00Z')).not.toContain('/');
  });

  it('sin fecha, raya', () => {
    expect(dateLabel(null)).toBe('—');
  });
});

describe('monthStart', () => {
  it('es el día 1 del mes que se está mirando', () => {
    const iso = monthStart(new Date(2026, 7, 13, 18, 30));
    const d = new Date(iso);
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(7);
    expect(d.getFullYear()).toBe(2026);
  });

  /**
   * En hora LOCAL, no UTC. En España el día 1 a las 00:30 es todavía del mes
   * anterior en UTC, y esa oferta se caería de la cuenta del mes sin avisar.
   */
  it('el corte es local: la medianoche del día 1 entra en el mes', () => {
    const iso = monthStart(new Date(2026, 7, 1, 0, 30));
    expect(new Date(iso).getMonth()).toBe(7);
    expect(new Date(iso).getDate()).toBe(1);
  });
});
