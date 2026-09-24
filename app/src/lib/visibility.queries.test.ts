import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Las escrituras de INV-07 no pueden dar por buena una fila que la RLS filtró:
 * PostgREST responde 204 SIN error y SIN filas, y la pantalla diría «guardado»
 * sin haber guardado nada. Se mockea el cliente y se comprueba que se PIDEN las
 * filas devueltas y que su ausencia es un error.
 */

const select = vi.fn();
const eq = vi.fn(() => ({ select }));
const update = vi.fn(() => ({ eq }));
const del = vi.fn(() => ({ eq }));
const from = vi.fn((_tabla: string) => ({ update, delete: del }));

vi.mock('./supabase', () => ({ supabase: { from: (t: string) => from(t) } }));

const { removeExclusion, saveVisibilityMode } = await import('./visibility');

beforeEach(() => {
  select.mockReset();
  from.mockClear();
  update.mockClear();
  del.mockClear();
  eq.mockClear();
});

describe('saveVisibilityMode', () => {
  it('actualiza solo el modo de su organización y pide la fila devuelta', async () => {
    select.mockResolvedValue({ data: [{ inventory_visibility_mode: 'RESTRINGIDA' }], error: null });
    await saveVisibilityMode('org-1', 'RESTRINGIDA');
    expect(from).toHaveBeenCalledWith('organizations');
    expect(update).toHaveBeenCalledWith({ inventory_visibility_mode: 'RESTRINGIDA' });
    expect(eq).toHaveBeenCalledWith('id', 'org-1');
    expect(select).toHaveBeenCalledWith('inventory_visibility_mode');
  });

  it('si la RLS filtra el UPDATE (sin error y sin filas) NO da por guardado: lanza', async () => {
    select.mockResolvedValue({ data: [], error: null });
    await expect(saveVisibilityMode('org-1', 'RESTRINGIDA')).rejects.toThrow(/No se pudo guardar/);
  });

  it('propaga el error de la base', async () => {
    select.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(saveVisibilityMode('org-1', 'VISIBLE_TODOS')).rejects.toThrow('boom');
  });
});

describe('removeExclusion', () => {
  it('borra por id y pide la fila devuelta', async () => {
    select.mockResolvedValue({ data: [{ id: 'x1' }], error: null });
    await removeExclusion('x1');
    expect(from).toHaveBeenCalledWith('inventory_exclusions');
    expect(eq).toHaveBeenCalledWith('id', 'x1');
    expect(select).toHaveBeenCalledWith('id');
  });

  it('un DELETE que no borra nada (RLS o ya no existe) es un error, no un éxito', async () => {
    select.mockResolvedValue({ data: [], error: null });
    await expect(removeExclusion('x1')).rejects.toThrow(/No se pudo quitar/);
  });
});
