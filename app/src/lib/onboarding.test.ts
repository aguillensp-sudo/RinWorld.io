import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const invoke = vi.fn();

vi.mock('./supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
  },
}));

const {
  LIMIT_MESSAGE,
  LIMIT_TITLE,
  activateOwnMembership,
  canRegister,
  fetchSeatsUsed,
  firstName,
  isValidName,
  isValidPassword,
  registerAdditionalMember,
  welcomeView,
} = await import('./onboarding');

/**
 * La lógica de REG-09 y FRU. Sin React. Esta capa la escribe Claude Code, no el
 * Coder (`CLAUDE.md` §3): estos tests son los míos, no el contrato del arnés. Los
 * ejemplos son los del HTML aprobado de REG-09: solo el ADMIN no muestra contador,
 * con uno añadido dice `2 de 5`, y con cinco cambia el título y quita el botón.
 */

beforeEach(() => {
  rpc.mockReset();
  invoke.mockReset();
});

describe('firstName', () => {
  it('toma el primer nombre', () => expect(firstName('Juan Martínez', 'j@x.com')).toBe('Juan'));
  it('con espacios de sobra sigue tomando el primero', () => expect(firstName('  Ana   Ruiz ', 'a@x.com')).toBe('Ana'));
  it('sin nombre cae al email antes de la arroba', () => expect(firstName(null, 'ana.g@x.com')).toBe('ana.g'));
  it('con el nombre en blanco también', () => expect(firstName('   ', 'ana@x.com')).toBe('ana'));
});

describe('welcomeView', () => {
  it('solo el ADMIN: título de bienvenida, sin contador y con botón de añadir', () => {
    expect(welcomeView('Juan', 1)).toEqual({
      title: '¡Bienvenido a Bearingworld.io, Juan!',
      question: '¿Deseas añadir usuarios ahora?',
      counter: null,
      canAdd: true,
    });
  });

  it('con uno añadido dice 2 de 5 (el ADMIN cuenta) y pregunta por otro', () => {
    expect(welcomeView('Juan', 2)).toEqual({
      title: '¿Quieres añadir otro usuario?',
      question: '¿Deseas añadir otro usuario?',
      counter: '2 de 5 usuarios registrados',
      canAdd: true,
    });
  });

  it('con cuatro sigue pudiendo añadir uno más', () => {
    const v = welcomeView('Juan', 4);
    expect(v.counter).toBe('4 de 5 usuarios registrados');
    expect(v.canAdd).toBe(true);
  });

  it('con cinco: equipo al completo, el aviso del límite y sin botón de añadir', () => {
    expect(welcomeView('Juan', 5)).toEqual({
      title: LIMIT_TITLE,
      question: LIMIT_MESSAGE,
      counter: '5 de 5 usuarios registrados',
      canAdd: false,
    });
    expect(LIMIT_TITLE).toBe('¡Equipo al completo!');
    expect(LIMIT_MESSAGE).toBe('Has alcanzado el límite de 5 usuarios por organización.');
  });

  it('más de cinco (una invitación de más) se trata como el límite', () => {
    expect(welcomeView('Juan', 6).canAdd).toBe(false);
  });
});

describe('isValidName', () => {
  it('pide al menos 2 caracteres', () => {
    expect(isValidName('A')).toBe(false);
    expect(isValidName(' A ')).toBe(false);
    expect(isValidName('Al')).toBe(true);
  });
  it('y como mucho 100', () => {
    expect(isValidName('x'.repeat(100))).toBe(true);
    expect(isValidName('x'.repeat(101))).toBe(false);
  });
});

describe('isValidPassword', () => {
  it.each([
    ['Abcdefghi1!', true],
    ['Abcdefgh1!', true],
    ['Abcdefg1!', false], // 9 caracteres
    ['abcdefghi1!', false], // sin mayúscula
    ['ABCDEFGHI1!', false], // sin minúscula
    ['Abcdefghij!', false], // sin número
    ['Abcdefghij1', false], // sin símbolo
  ])('%s → %s', (pw, ok) => expect(isValidPassword(pw)).toBe(ok));
});

describe('canRegister', () => {
  const ok = {
    fullName: 'María López García',
    email: 'maria.lopez@rodamientosdelsur.es',
    password: 'Abcdefghi1!',
    repeat: 'Abcdefghi1!',
    acceptedTerms: true,
  };

  it('con todo válido se puede', () => expect(canRegister(ok, false)).toBe(true));
  it('un email que ya tiene cuenta lo bloquea', () => expect(canRegister(ok, true)).toBe(false));
  it('sin T&C no', () => expect(canRegister({ ...ok, acceptedTerms: false }, false)).toBe(false));
  it('contraseñas distintas no', () => expect(canRegister({ ...ok, repeat: 'Otra1234567!' }, false)).toBe(false));
  it('contraseña floja no', () => expect(canRegister({ ...ok, password: 'abc', repeat: 'abc' }, false)).toBe(false));
  it('email mal formado no', () => expect(canRegister({ ...ok, email: 'esto no' }, false)).toBe(false));
  it('nombre corto no', () => expect(canRegister({ ...ok, fullName: 'M' }, false)).toBe(false));
});

describe('red', () => {
  it('fetchSeatsUsed devuelve el número de la función', async () => {
    rpc.mockResolvedValue({ data: 3, error: null });
    await expect(fetchSeatsUsed()).resolves.toBe(3);
    expect(rpc).toHaveBeenCalledWith('onboarding_seats_used');
  });

  it('fetchSeatsUsed propaga el error de la base', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('nope') });
    await expect(fetchSeatsUsed()).rejects.toThrow('nope');
  });

  it('activateOwnMembership llama a la función y propaga el error', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(activateOwnMembership()).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('activate_own_membership');
    rpc.mockResolvedValueOnce({ data: null, error: new Error('no pendiente') });
    await expect(activateOwnMembership()).rejects.toThrow('no pendiente');
  });

  it('registerAdditionalMember manda nombre, email y contraseña recortados', async () => {
    invoke.mockResolvedValue({ data: { registered: true }, error: null });
    await registerAdditionalMember({ fullName: ' María López ', email: ' m@x.es ', password: 'Abcdefghi1!' });
    expect(invoke).toHaveBeenCalledWith('register-additional-member', {
      body: { full_name: 'María López', email: 'm@x.es', password: 'Abcdefghi1!' },
    });
  });

  it('un rechazo de la función se dice con SU motivo, leído del cuerpo', async () => {
    const context = new Response(JSON.stringify({ error: 'Este email ya tiene cuenta en Bearingworld.io.' }), { status: 409 });
    invoke.mockResolvedValue({ data: null, error: Object.assign(new Error('non-2xx'), { context }) });
    await expect(
      registerAdditionalMember({ fullName: 'María', email: 'm@x.es', password: 'Abcdefghi1!' }),
    ).rejects.toThrow('Este email ya tiene cuenta en Bearingworld.io.');
  });

  it('si el cuerpo no es JSON cae al mensaje genérico, no al de la excepción de parseo', async () => {
    const context = new Response('<html>502</html>', { status: 502 });
    invoke.mockResolvedValue({ data: null, error: Object.assign(new Error('non-2xx'), { context }) });
    await expect(
      registerAdditionalMember({ fullName: 'María', email: 'm@x.es', password: 'Abcdefghi1!' }),
    ).rejects.toThrow('No se pudo registrar al usuario.');
  });
});
