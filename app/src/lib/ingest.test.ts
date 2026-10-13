import { describe, expect, it } from 'vitest';
import { canManageIngest, DEFAULT_INGEST_DOMAIN, ingestAddress, isValidSenderEmail, reasonLabel, REASON_LABELS } from './ingest';

describe('lib/ingest', () => {
  it('la dirección es ingest-<token>@<dominio>', () => {
    expect(ingestAddress('5ahwrsg5e7xx')).toBe(`ingest-5ahwrsg5e7xx@${DEFAULT_INGEST_DOMAIN}`);
    expect(ingestAddress('abc', 'otro.dominio.com')).toBe('ingest-abc@otro.dominio.com');
  });

  it('solo el ADMIN gestiona el canal', () => {
    expect(canManageIngest('ADMIN')).toBe(true);
    expect(canManageIngest('EDITOR')).toBe(false);
  });

  it('valida el email del remitente igual que add_ingest_sender', () => {
    for (const ok of ['a@b.co', ' A.B@Empresa.com ']) expect(isValidSenderEmail(ok)).toBe(true);
    for (const mal of ['', '   ', 'sin-arroba', 'a@b', 'a b@c.com', `${'x'.repeat(250)}@b.co`]) {
      expect(isValidSenderEmail(mal)).toBe(false);
    }
  });

  it('cada motivo del historial que escribe la función tiene su texto', () => {
    // Los de `Reason` en supabase/functions/ingest-email/mail-rules.ts.
    for (const r of [
      'DIRECCION_INEXISTENTE', 'AUTENTICACION', 'VIRUS', 'REMITENTE_NO_AUTORIZADO', 'TAMANO',
      'EXTENSION', 'FORMATO_NO_RECONOCIDO', 'SIN_FILAS_VALIDAS', 'ERROR_INTERNO',
    ]) {
      expect(REASON_LABELS[r]).toBeTruthy();
    }
    expect(reasonLabel(null)).toBeNull();
    expect(reasonLabel('LO_QUE_SEA')).toBe('Motivo desconocido');
  });
});
