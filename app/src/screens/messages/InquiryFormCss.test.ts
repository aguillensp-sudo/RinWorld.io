import { describe, expect, it } from 'vitest';
import css from './InquiryForm.module.css?raw';

/**
 * CONTRATO · MSG-03 §3.2 · el CSS del formulario de consulta. Escrito antes de la corrida.
 * Los colores, solo con tokens (C3 lo mide aparte); aquí, lo que el HTML aprobado distingue a la vista.
 */
function bloqueDe(selector: string): string {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const regex = new RegExp(`(?:^|\\})\\s*\\.${selector}\\s*\\{([^}]*)\\}`);
  return regex.exec(limpio)?.[1] ?? '';
}

describe('MSG-03 · CSS del formulario de consulta', () => {
  it('el aviso de duplicado va en ámbar (token de advertencia)', () => {
    expect(bloqueDe('banner')).toMatch(/color:\s*var\(--bw-warning\)/);
  });
  it('los campos heredados se ven apagados: fondo de superficie y cursor de no permitido', () => {
    const b = bloqueDe('readonly');
    expect(b).toMatch(/background:\s*var\(--bw-surface-mist\)/);
    expect(b).toMatch(/cursor:\s*not-allowed/);
  });
  it('el botón de enviar apagado se nota: opacidad reducida y cursor de no permitido', () => {
    const b = bloqueDe('submit:disabled');
    expect(b).toMatch(/opacity:\s*\.?\d/);
    expect(b).toMatch(/cursor:\s*not-allowed/);
  });
  it('la cantidad no inválida se marca con el color de peligro', () => {
    expect(bloqueDe('fieldError')).toMatch(/color:\s*var\(--bw-danger\)/);
  });
});
