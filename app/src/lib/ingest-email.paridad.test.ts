/**
 * Paridad entre las reglas de importación del navegador (`inventory-import.ts`) y su copia en la
 * función de borde `ingest-email` (`supabase/functions/ingest-email/import-core.ts`).
 *
 * La copia existe porque la función se despliega desde `supabase/` y la app desde `app/`. Lo que
 * impide que se separen es este test: los mismos archivos por las dos y el mismo resultado.
 * Si falla, alguien cambió una regla en un sitio y no en el otro.
 */
import { describe, expect, it } from 'vitest';
import * as web from './inventory-import';
import * as fn from '../../../supabase/functions/ingest-email/import-core';

const ARCHIVOS: { nombre: string; texto: string }[] = [
  {
    nombre: 'punto-y-coma.csv',
    texto: 'Referencia;Marca;Cantidad;País;Plazo;Notas\n6205-2RS;SKF;1.200;España;5;stock propio\nNU 210;FAG;40;DE;;\n22212;NSK;0;Francia;12;',
  },
  { nombre: 'tabs.tsv', texto: 'part_number\tbrand\tquantity\tlocation_country\n6004\tNTN\t10\tit\n7208\tINA\t3\tPT\n' },
  {
    nombre: 'con-errores.csv',
    texto: 'ref,marca,cant,pais\n,SKF,1,ES\nX1,SKF,abc,ES\nX2,SKF,-4,ES\nX3,SKF,5,Narnia\nX4,SKF,1,ES\nX4,SKF,2,ES\n',
  },
  { nombre: 'comillas.csv', texto: '\uFEFF"Ref","Marca","Cantidad","País"\n"6205, 2RS","SK""F",7,ES\r\n"30205","TIMKEN",9,US\r\n' },
  { nombre: 'vacio.csv', texto: '\n\n' },
];

const MAPEO: web.PlatformField[] = ['part_number', 'brand', 'quantity', 'location_country', 'lead_time_days', 'notes'];

describe('paridad navegador ↔ función de borde', () => {
  for (const { nombre, texto } of ARCHIVOS) {
    it(`lee y valida igual: ${nombre}`, () => {
      const a = web.parseImportText(nombre, texto);
      const b = fn.parseImportText(nombre, texto);
      expect(b).toEqual(a);
      if (a === null || b === null) return;
      expect(fn.headerSignature(b.headers)).toBe(web.headerSignature(a.headers));
      const mapeo = MAPEO.slice(0, a.headers.length);
      for (const pais of [undefined, 'ES']) {
        expect(fn.buildLines(b, mapeo, pais)).toEqual(web.buildLines(a, mapeo, pais));
      }
    });
  }

  it('aplica un perfil guardado igual, y rechaza los mismos perfiles rotos', () => {
    const f = web.parseImportText('x.csv', ARCHIVOS[0]!.texto)!;
    const perfiles: unknown[] = [
      MAPEO,
      ['ignore', 'brand', 'quantity', 'location_country', 'lead_time_days', 'notes'],
      ['part_number', 'part_number', 'quantity', 'location_country', 'lead_time_days', 'notes'],
      ['price', 'brand', 'quantity', 'location_country', 'lead_time_days', 'notes'],
      ['part_number', 'brand'],
      'no es una lista',
      null,
    ];
    for (const p of perfiles) {
      expect(fn.applyProfileMapping(fn.columnsOf(f), p)).toEqual(web.applyProfileMapping(web.columnsOf(f), p));
    }
  });

  it('decodifica igual UTF-8 y Windows-1252', () => {
    const utf8 = new TextEncoder().encode('País;Año').buffer;
    const w1252 = new Uint8Array([0x50, 0x61, 0xed, 0x73]).buffer; // «País» como lo exporta Excel
    expect(fn.decodeText(utf8)).toBe(web.decodeText(utf8));
    expect(fn.decodeText(w1252)).toBe(web.decodeText(w1252));
    expect(fn.decodeText(w1252)).toBe('País');
  });

  it('infiere familia, país y cantidad igual', () => {
    for (const p of ['6205-2RS', 'NU 210', '22212', '30205', '51108', '7208', '1208', 'ZZZ']) {
      expect(fn.inferFamily(p)).toBe(web.inferFamily(p));
    }
    for (const c of ['es', 'España', 'germany', 'Reino Unido', 'xx1', '']) {
      expect(fn.normalizeCountry(c)).toBe(web.normalizeCountry(c));
    }
    for (const q of ['12', '1.200', '-3', '1,5', 'abc', '']) {
      expect(fn.parseQuantity(q)).toEqual(web.parseQuantity(q));
    }
  });

  it('exige los mismos obligatorios', () => {
    for (const m of [MAPEO, MAPEO.slice(0, 3), ['part_number', 'brand', 'quantity'] as web.PlatformField[]]) {
      for (const pais of [undefined, null, 'ES', '—']) {
        expect(fn.missingRequired(m, pais)).toEqual(web.missingRequired(m, pais));
      }
    }
  });
});
