import { describe, expect, it } from 'vitest';
import {
  canRemove,
  capacityDetail,
  capacityDots,
  capacityLabel,
  expiresInLabel,
  freeSeats,
  isValidEmail,
  limitReached,
  memberStateLabel,
  normalizeEmail,
  pendingCount,
  roleLabel,
  seatsUsed,
  sentAtLabel,
  toInvitationRow,
  toTeamMember,
  type InvitationRow,
  type TeamMember,
} from './invitations';

/**
 * La lógica pura de INVT-01. Sin base y sin React.
 *
 * Esta capa la escribe Claude Code, no el Coder (`CLAUDE.md` §3), así que estos
 * tests **no son el contrato del arnés**: son los míos. El ejemplo es el del HTML
 * aprobado: dos usuarios y una invitación pendiente = `2/5`, dos plazas libres.
 */

function miembro(id: string, over: Partial<TeamMember> = {}): TeamMember {
  return { id, fullName: id, email: `${id}@empresa.test`, role: 'EDITOR', state: 'ACTIVE', ...over };
}

function inv(id: string, status: InvitationRow['status'], over: Partial<InvitationRow> = {}): InvitationRow {
  return { id, email: `${id}@empresa.test`, status, sentAt: '2026-06-24T09:42:00Z', daysLeft: status === 'Pendiente' ? 5 : null, ...over };
}

const DOS = [miembro('ana', { role: 'ADMIN' }), miembro('luis')];
const UNA_PENDIENTE = [inv('carlos', 'Pendiente'), inv('pedro', 'Aceptada'), inv('marta', 'Expirada')];

describe('plazas', () => {
  it('solo las PENDIENTES ocupan plaza: las aceptadas ya son usuarios y las expiradas liberan la suya', () => {
    expect(pendingCount(UNA_PENDIENTE)).toBe(1);
    expect(seatsUsed(DOS, UNA_PENDIENTE)).toBe(3);
    expect(freeSeats(DOS, UNA_PENDIENTE)).toBe(2);
  });

  it('el ejemplo del diseño: 2 usuarios + 1 pendiente = «2/5», «1 invitación pendiente · 2 plazas libres»', () => {
    expect(capacityLabel(DOS)).toBe('2/5');
    expect(capacityDetail(DOS, UNA_PENDIENTE)).toBe('· 1 invitación pendiente · 2 plazas libres');
  });

  it('singular y plural', () => {
    expect(capacityDetail(DOS, [])).toBe('· 0 invitaciones pendientes · 3 plazas libres');
    const cuatro = [miembro('a'), miembro('b'), miembro('c'), miembro('d')];
    expect(capacityDetail(cuatro, [])).toBe('· 0 invitaciones pendientes · 1 plaza libre');
  });

  it('los cinco puntos: usuarios, pendientes, libres, en ese orden', () => {
    expect(capacityDots(DOS, UNA_PENDIENTE)).toEqual(['used', 'used', 'inv', 'free', 'free']);
    expect(capacityDots([], [])).toEqual(['free', 'free', 'free', 'free', 'free']);
  });

  it('nunca pinta más de cinco puntos, aunque los datos digan más', () => {
    const seis = [1, 2, 3, 4, 5, 6].map((n) => miembro(`m${n}`));
    expect(capacityDots(seis, [inv('x', 'Pendiente')])).toHaveLength(5);
    expect(capacityDots(seis, [inv('x', 'Pendiente')]).every((d) => d === 'used')).toBe(true);
  });

  it('el límite se alcanza con 5 entre usuarios y pendientes', () => {
    const tres = [miembro('a'), miembro('b'), miembro('c')];
    expect(limitReached(tres, [inv('x', 'Pendiente')])).toBe(false);
    expect(limitReached(tres, [inv('x', 'Pendiente'), inv('y', 'Pendiente')])).toBe(true);
    // Una expirada NO cuenta: por eso Reenviar tiene que volver a comprobar el límite.
    expect(limitReached(tres, [inv('x', 'Pendiente'), inv('y', 'Expirada')])).toBe(false);
  });
});

describe('emails', () => {
  it('se normalizan como en la base: sin espacios y en minúsculas', () => {
    expect(normalizeEmail('  Nuevo@Empresa.TEST ')).toBe('nuevo@empresa.test');
  });

  it('la forma mínima: algo, arroba, algo, punto, algo', () => {
    expect(isValidEmail('carlos@aceroindustrial.com')).toBe(true);
    expect(isValidEmail(' Carlos@Acero.com ')).toBe(true);
    expect(isValidEmail('carlos')).toBe(false);
    expect(isValidEmail('carlos@acero')).toBe(false);
    expect(isValidEmail('car los@acero.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('etiquetas', () => {
  it('«24 jun 2026 · 11:42», en hora local', () => {
    // Construido con el constructor LOCAL para que el test no dependa de la zona horaria.
    const iso = new Date(2026, 5, 24, 11, 42).toISOString();
    expect(sentAtLabel(iso)).toBe('24 jun 2026 · 11:42');
    expect(sentAtLabel(new Date(2026, 5, 1, 9, 5).toISOString())).toBe('01 jun 2026 · 09:05');
  });

  it('una fecha ilegible da cadena vacía, no «NaN»', () => {
    expect(sentAtLabel('no es una fecha')).toBe('');
  });

  it('«Expira en»: días, en singular si es uno, guion si no hay', () => {
    expect(expiresInLabel(5)).toBe('5 días');
    expect(expiresInLabel(1)).toBe('1 día');
    expect(expiresInLabel(null)).toBe('—');
  });

  it('rol y estado de usuario', () => {
    expect(roleLabel('ADMIN')).toBe('Admin');
    expect(roleLabel('EDITOR')).toBe('Editor');
    expect(memberStateLabel('ACTIVE')).toBe('Activo');
    expect(memberStateLabel('SUSPENDED')).toBe('Suspendido');
    expect(memberStateLabel('KEY_ACTIVE')).toBe('En alta');
  });
});

describe('canRemove', () => {
  it('solo un Editor, y nunca uno mismo', () => {
    expect(canRemove(miembro('luis'), 'ana')).toBe(true);
    expect(canRemove(miembro('ana', { role: 'ADMIN' }), 'ana')).toBe(false);
    expect(canRemove(miembro('otro', { role: 'ADMIN' }), 'ana')).toBe(false);
    expect(canRemove(miembro('ana'), 'ana')).toBe(false);
  });
});

describe('el mapeo', () => {
  it('una invitación: el estado desconocido cae en Pendiente y los días nulos se quedan nulos', () => {
    expect(toInvitationRow({ id: 'i', email: 'a@b.co', status: 'Aceptada', sent_at: '2026-06-18T09:10:00Z', days_left: null }))
      .toEqual({ id: 'i', email: 'a@b.co', status: 'Aceptada', sentAt: '2026-06-18T09:10:00Z', daysLeft: null });
    expect(toInvitationRow({ id: 'i', email: 'a@b.co', status: '¿?', sent_at: 'x', days_left: 3 }).status).toBe('Pendiente');
  });

  it('un usuario sin nombre se pinta con su email; el rol raro cae en Editor', () => {
    expect(toTeamMember({ id: 'u', full_name: null, email: 'u@e.co', role: 'EDITOR', state: 'ACTIVE' }).fullName).toBe('u@e.co');
    expect(toTeamMember({ id: 'u', full_name: '  ', email: 'u@e.co', role: 'EDITOR', state: 'ACTIVE' }).fullName).toBe('u@e.co');
    expect(toTeamMember({ id: 'u', full_name: 'Ana', email: 'u@e.co', role: 'ADMIN', state: 'ACTIVE' }).role).toBe('ADMIN');
    expect(toTeamMember({ id: 'u', full_name: 'Ana', email: 'u@e.co', role: 'RARO', state: 'ACTIVE' }).role).toBe('EDITOR');
  });
});
