import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();

vi.mock('./supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

const {
  COUNTRY_OPTIONS,
  EMPTY_ACCESS_REQUEST,
  FIELD_ERRORS,
  POLL_INTERVAL_MS,
  blurError,
  canSubmitAccessRequest,
  clearWaitingRequest,
  fetchAccessRequestStatus,
  isFieldValid,
  isFinalState,
  loadWaitingRequest,
  requestSummary,
  saveWaitingRequest,
  submitAccessRequest,
  waitView,
} = await import('./access-request');

/**
 * La lógica de REG-00 y REG-00-WAIT. Sin React. Esta capa la escribe Claude Code,
 * no el Coder (`CLAUDE.md` §3): estos tests son los míos, no el contrato del
 * arnés. Los datos de ejemplo son los de la spec (`John Reece`, `Bearings`) y los
 * del HTML aprobado de la espera (`Carlos Ruiz`, `Distribuciones Ruiz SL`).
 */

const VALID = {
  email: 'carlos.ruiz@distribucionesruiz.com',
  fullName: 'Carlos Ruiz',
  orgName: 'Distribuciones Ruiz SL',
  country: 'ES',
  phone: '+34 963 456 789',
  website: 'https://www.distribucionesruiz.com',
};

beforeEach(() => {
  invoke.mockReset();
  sessionStorage.clear();
});

describe('los países', () => {
  it('son los 194 del HTML aprobado, en inglés con su código', () => {
    expect(COUNTRY_OPTIONS).toHaveLength(194);
    expect(COUNTRY_OPTIONS[0]).toEqual(['AF', 'Afghanistan (AF)']);
    expect(COUNTRY_OPTIONS.find(([c]) => c === 'US')?.[1]).toBe('United States of America (US)');
  });

  it('cada texto termina con su propio código', () => {
    for (const [code, label] of COUNTRY_OPTIONS) expect(label.endsWith(`(${code})`)).toBe(true);
  });
});

describe('isFieldValid', () => {
  it('email con formato', () => {
    expect(isFieldValid('email', 'john@bearings.com')).toBe(true);
    expect(isFieldValid('email', 'john@bearings')).toBe(false);
    expect(isFieldValid('email', '  john@bearings.com  ')).toBe(true);
  });
  it('nombre de 2 caracteres o más', () => {
    expect(isFieldValid('fullName', 'Jo')).toBe(true);
    expect(isFieldValid('fullName', ' J ')).toBe(false);
  });
  it('organización de 2 a 120', () => {
    expect(isFieldValid('orgName', 'Bearings')).toBe(true);
    expect(isFieldValid('orgName', 'x'.repeat(121))).toBe(false);
  });
  it('país de la lista, no cualquier código', () => {
    expect(isFieldValid('country', 'ES')).toBe(true);
    expect(isFieldValid('country', 'XX')).toBe(false);
    expect(isFieldValid('country', '')).toBe(false);
  });
  it('teléfono: basta con que haya algo', () => {
    expect(isFieldValid('phone', '+1')).toBe(true);
    expect(isFieldValid('phone', '   ')).toBe(false);
  });
  it('sitio web que empieza por https://', () => {
    expect(isFieldValid('website', 'https://www.bearings.com')).toBe(true);
    expect(isFieldValid('website', 'http://www.bearings.com')).toBe(false);
    expect(isFieldValid('website', 'www.bearings.com')).toBe(false);
  });
});

describe('blurError', () => {
  it('email, nombre y organización vacíos no se quejan', () => {
    expect(blurError('email', '')).toBeNull();
    expect(blurError('fullName', '  ')).toBeNull();
    expect(blurError('orgName', '')).toBeNull();
  });
  it('email mal escrito dice el texto del HTML', () => {
    expect(blurError('email', 'john@')).toBe('Introduce un email válido');
  });
  it('país, teléfono y web vacíos SÍ se quejan', () => {
    expect(blurError('country', '')).toBe(FIELD_ERRORS.country);
    expect(blurError('phone', '')).toBe('Introduce un teléfono de contacto');
    expect(blurError('website', '')).toBe('La URL debe comenzar por https://');
  });
  it('un valor válido no tiene error', () => {
    for (const f of Object.keys(VALID) as (keyof typeof VALID)[]) expect(blurError(f, VALID[f])).toBeNull();
  });
});

describe('canSubmitAccessRequest', () => {
  it('vacío no', () => expect(canSubmitAccessRequest(EMPTY_ACCESS_REQUEST)).toBe(false));
  it('los seis válidos sí', () => expect(canSubmitAccessRequest(VALID)).toBe(true));
  it('basta un campo mal para que no', () => {
    expect(canSubmitAccessRequest({ ...VALID, website: 'http://x.com' })).toBe(false);
  });
});

describe('submitAccessRequest', () => {
  it('manda a la función los datos recortados y el email en minúsculas', async () => {
    invoke.mockResolvedValue({ data: { id: 'r-1', submitted_at: '2026-09-28T11:23:00Z' }, error: null });
    const out = await submitAccessRequest({ ...VALID, email: '  Carlos.Ruiz@DistribucionesRuiz.com ', fullName: ' Carlos Ruiz ' });
    expect(invoke).toHaveBeenCalledWith('access-request', {
      body: {
        action: 'submit',
        email: 'carlos.ruiz@distribucionesruiz.com',
        full_name: 'Carlos Ruiz',
        org_name: 'Distribuciones Ruiz SL',
        country: 'ES',
        phone: '+34 963 456 789',
        website: 'https://www.distribucionesruiz.com',
      },
    });
    expect(out).toEqual({ id: 'r-1', submittedAt: '2026-09-28T11:23:00Z', form: VALID });
  });

  it('un 409 trae el mensaje del servidor', async () => {
    const context = new Response(JSON.stringify({ error: 'Ya hay una solicitud en revisión con este email.' }), { status: 409 });
    invoke.mockResolvedValue({ data: null, error: { context } });
    await expect(submitAccessRequest(VALID)).rejects.toThrow('Ya hay una solicitud en revisión con este email.');
  });

  it('sin cuerpo legible, el mensaje genérico', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(submitAccessRequest(VALID)).rejects.toThrow('No se pudo enviar la solicitud.');
  });

  it('una respuesta sin id es un error, no un éxito', async () => {
    invoke.mockResolvedValue({ data: {}, error: null });
    await expect(submitAccessRequest(VALID)).rejects.toThrow('No se pudo enviar la solicitud.');
  });
});

describe('fetchAccessRequestStatus', () => {
  it('pide el estado por el token', async () => {
    invoke.mockResolvedValue({ data: { state: 'REJECTED', rejection_reason: 'No es del sector.' }, error: null });
    await expect(fetchAccessRequestStatus('r-1')).resolves.toEqual({ state: 'REJECTED', rejectionReason: 'No es del sector.' });
    expect(invoke).toHaveBeenCalledWith('access-request', { body: { action: 'status', id: 'r-1' } });
  });
  it('un estado desconocido es un error', async () => {
    invoke.mockResolvedValue({ data: { state: 'RARO' }, error: null });
    await expect(fetchAccessRequestStatus('r-1')).rejects.toThrow('No se pudo consultar la solicitud.');
  });
});

describe('la espera', () => {
  it('pregunta cada 60 s (Módulo 01 §3.2B.2)', () => expect(POLL_INTERVAL_MS).toBe(60_000));

  it('solo PENDING_REVIEW sigue esperando', () => {
    expect(isFinalState('PENDING_REVIEW')).toBe(false);
    expect(isFinalState('INVITED_APPROVED')).toBe(true);
    expect(isFinalState('REJECTED')).toBe(true);
    expect(isFinalState('CANCELLED')).toBe(true);
  });

  it('sin estado todavía se pinta en revisión', () => {
    const v = waitView(null);
    expect(v.phase).toBe('review');
    expect(v.title).toBe('Tu solicitud está en revisión');
    expect(v.badge).toBe('EN REVISIÓN');
    expect(v.spinnerLabel).toBe('Revisando solicitud...');
    expect(v.notice).toBeNull();
  });

  it('aprobada', () => {
    const v = waitView({ state: 'INVITED_APPROVED', rejectionReason: null });
    expect(v.phase).toBe('approved');
    expect(v.badge).toBe('APROBADO');
    expect(v.notice?.strong).toBe('¡Tu solicitud ha sido aprobada!');
  });

  it('rechazada, con el motivo del Operador', () => {
    const v = waitView({ state: 'REJECTED', rejectionReason: 'La organización no cumple los requisitos de membresía actuales.' });
    expect(v.phase).toBe('rejected');
    expect(v.badge).toBe('NO APROBADO');
    expect(v.notice).toEqual({
      strong: 'Tu solicitud no ha sido aprobada en este momento.',
      detail: 'La organización no cumple los requisitos de membresía actuales.',
    });
  });

  it('cancelada se pinta como rechazada sin motivo', () => {
    const v = waitView({ state: 'CANCELLED', rejectionReason: null });
    expect(v.phase).toBe('rejected');
    expect(v.notice?.detail).toBe('');
  });

  it('el resumen enseña el país en español', () => {
    expect(requestSummary(VALID)).toEqual([
      { label: 'Email', value: 'carlos.ruiz@distribucionesruiz.com' },
      { label: 'Nombre y apellidos', value: 'Carlos Ruiz' },
      { label: 'Organización', value: 'Distribuciones Ruiz SL' },
      { label: 'País', value: 'España' },
      { label: 'Teléfono', value: '+34 963 456 789' },
      { label: 'Sitio web', value: 'https://www.distribucionesruiz.com' },
    ]);
  });
});

describe('la solicitud en espera vive en sessionStorage', () => {
  const request = { id: 'r-1', submittedAt: '2026-09-28T11:23:00Z', form: VALID };

  it('se guarda y se recupera', () => {
    saveWaitingRequest(request);
    expect(loadWaitingRequest()).toEqual(request);
  });
  it('se borra', () => {
    saveWaitingRequest(request);
    clearWaitingRequest();
    expect(loadWaitingRequest()).toBeNull();
  });
  it('algo corrupto no se toma por una solicitud', () => {
    sessionStorage.setItem('bw.accessRequest', '{"id":1}');
    expect(loadWaitingRequest()).toBeNull();
    sessionStorage.setItem('bw.accessRequest', 'no-json');
    expect(loadWaitingRequest()).toBeNull();
  });
});
