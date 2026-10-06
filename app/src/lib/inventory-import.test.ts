import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const maybeSingle = vi.fn();
vi.mock('./supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => ({ select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: () => maybeSingle() }) }) }) }),
  },
}));

import {
  CONFIDENCE,
  defaultCountryNotice,
  usableDefaultCountry,
  ERROR_TYPES,
  FIELD_OPTIONS,
  MAX_LINES_PER_UPLOAD,
  applyProfileMapping,
  assignField,
  buildLines,
  canConfirm,
  columnsOf,
  confidenceLabel,
  confidenceTone,
  detectDelimiter,
  fetchProfile,
  fileStats,
  headerSignature,
  inferFamily,
  isValidProfileName,
  lineLimitWarning,
  missingRequired,
  missingRequiredMessage,
  normalizeCountry,
  parseDelimited,
  parseImportText,
  parseQuantity,
  profileBannerText,
  proposeMapping,
  readImportFile,
  runImport,
  unreadableSummary,
  type ParsedFile,
  type PlatformField,
} from './inventory-import';

const SPEC_CSV = [
  'Ref.;Fabricante;Uds.;País;PVP;Obs.',
  '6205-2RS/C3;SKF;850;ES;4.20;Stock almacén',
  'NU216;FAG;1.200;Alemania;9,10;',
  '22205;Timken;3;fr;;',
].join('\r\n');

describe('lectura del archivo', () => {
  it('detecta el delimitador por la cabecera, ignorando lo que va entre comillas', () => {
    expect(detectDelimiter('a;b;c')).toBe(';');
    expect(detectDelimiter('a,b,c')).toBe(',');
    expect(detectDelimiter('a\tb\tc')).toBe('\t');
    expect(detectDelimiter('"a;b",c,d')).toBe(',');
  });

  it('parte CSV con comillas dobladas y saltos de línea entre comillas', () => {
    expect(parseDelimited('a,"b ""x"" c","l1\nl2"\n1,2,3', ',')).toEqual([
      ['a', 'b "x" c', 'l1\nl2'],
      ['1', '2', '3'],
    ]);
  });

  it('quita el BOM, recorta cabeceras y descarta filas vacías', () => {
    const f = parseImportText('x.csv', '﻿ Ref ;Marca\n\n6205;SKF\n;\n')!;
    expect(f.headers).toEqual(['Ref', 'Marca']);
    expect(f.rows).toEqual([['6205', 'SKF']]);
  });

  it('un archivo sin cabecera es null', () => {
    expect(parseImportText('x.csv', '\n \n')).toBeNull();
  });

  it('XLSX y XLS no se leen todavía: unsupported', async () => {
    const r = await readImportFile(new File(['x'], 'inventario.xlsx'));
    expect(r).toEqual({ kind: 'unsupported', name: 'inventario.xlsx' });
    expect((await readImportFile(new File(['x'], 'a.XLS'))).kind).toBe('unsupported');
  });

  it('CSV, TSV y TXT se leen', async () => {
    const r = await readImportFile(new File([SPEC_CSV], 'inv.csv'));
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.file.rows).toHaveLength(3);
    expect((await readImportFile(new File(['a\tb\n1\t2'], 'inv.TSV'))).kind).toBe('ok');
    expect((await readImportFile(new File(['a|b\n1|2'], 'inv.txt'))).kind).toBe('ok');
  });

  it('decodifica UTF-8 y, si no lo es, Windows-1252 (CSV de Excel en español)', async () => {
    const latin1 = new Uint8Array([0x50, 0x61, 0xed, 0x73, 0x0a, 0x45, 0x53]); // "País\nES" en 1252
    const r = await readImportFile(new File([latin1], 'a.csv'));
    expect(r.kind === 'ok' && r.file.headers).toEqual(['País']);
    const utf8 = await readImportFile(new File(['País\nES'], 'b.csv'));
    expect(utf8.kind === 'ok' && utf8.file.headers).toEqual(['País']);
  });

  it('un archivo vacío es empty', async () => {
    expect((await readImportFile(new File([''], 'v.csv'))).kind).toBe('empty');
  });
});

describe('columnas y propuesta', () => {
  const file = parseImportText('inv.csv', SPEC_CSV)!;
  const columns = columnsOf(file);

  it('cada columna lleva su primer valor no vacío como ejemplo', () => {
    expect(columns.map((c) => c.example)).toEqual(['6205-2RS/C3', 'SKF', '850', 'ES', '4.20', 'Stock almacén']);
  });

  it('propone los cuatro obligatorios por sinónimo, y nunca el precio', () => {
    const p = proposeMapping(columns);
    expect(p.map((x) => x.field)).toEqual(['part_number', 'brand', 'quantity', 'location_country', 'ignore', 'notes']);
    expect(p[0]?.confidence).toBe(CONFIDENCE.synonym);
    expect(p[4]?.confidence).toBe(CONFIDENCE.none);
    expect(p[5]?.confidence).toBe(CONFIDENCE.partial);
  });

  it('el nombre canónico es la confianza más alta', () => {
    const p = proposeMapping([{ index: 0, header: 'part_number', example: '' }]);
    expect(p[0]).toEqual({ field: 'part_number', confidence: CONFIDENCE.canonical });
  });

  it('un campo va a una sola columna: gana la de más confianza', () => {
    const p = proposeMapping([
      { index: 0, header: 'Stock', example: '' },
      { index: 1, header: 'quantity', example: '' },
    ]);
    expect(p.map((x) => x.field)).toEqual(['ignore', 'quantity']);
  });

  it('a igualdad de confianza, la primera', () => {
    const p = proposeMapping([
      { index: 0, header: 'Uds', example: '' },
      { index: 1, header: 'Cantidad', example: '' },
    ]);
    expect(p.map((x) => x.field)).toEqual(['quantity', 'ignore']);
  });

  it('estructura desconocida: todo a ignorar con confianza baja', () => {
    const p = proposeMapping([
      { index: 0, header: 'X1', example: '' },
      { index: 1, header: '', example: '' },
    ]);
    expect(p).toEqual([
      { field: 'ignore', confidence: CONFIDENCE.none },
      { field: 'ignore', confidence: CONFIDENCE.none },
    ]);
  });

  it('tonos de confianza: verde > 85, amarillo 60–85, rojo < 60 (85 es amarillo, F-170)', () => {
    expect(confidenceTone(86)).toBe('hi');
    expect(confidenceTone(85)).toBe('mid');
    expect(confidenceTone(60)).toBe('mid');
    expect(confidenceTone(59)).toBe('lo');
    expect(confidenceLabel(97)).toBe('97%');
  });
});

describe('mapeo editable', () => {
  const base: PlatformField[] = ['part_number', 'brand', 'quantity', 'location_country', 'ignore'];

  it('asignar un campo ya usado lo quita de la otra columna', () => {
    expect(assignField(base, 4, 'brand')).toEqual(['part_number', 'ignore', 'quantity', 'location_country', 'brand']);
  });

  it('ignorar puede repetirse', () => {
    expect(assignField(base, 0, 'ignore')).toEqual(['ignore', 'brand', 'quantity', 'location_country', 'ignore']);
  });

  it('obligatorios que faltan y el tooltip del botón (spec §6)', () => {
    expect(missingRequired(base)).toEqual([]);
    expect(missingRequiredMessage(base)).toBeNull();
    const m: PlatformField[] = ['ignore', 'ignore', 'quantity', 'location_country'];
    expect(missingRequired(m)).toEqual(['part_number', 'brand']);
    expect(missingRequiredMessage(m)).toBe('Debes mapear las columnas: part_number, brand');
  });

  it('nombre del perfil: 3 a 50 caracteres sin contar los bordes', () => {
    expect(isValidProfileName('  ab ')).toBe(false);
    expect(isValidProfileName('abc')).toBe(true);
    expect(isValidProfileName('x'.repeat(50))).toBe(true);
    expect(isValidProfileName('x'.repeat(51))).toBe(false);
  });

  it('límite por subida', () => {
    expect(lineLimitWarning(MAX_LINES_PER_UPLOAD)).toBeNull();
    expect(lineLimitWarning(20001)).toBe(
      'El archivo tiene 20.001 filas y el máximo por subida es 20.000. Divídelo en varios archivos.',
    );
  });

  it('canConfirm junta las tres reglas', () => {
    const ok = { mapping: base, saveProfile: false, profileName: '', rowCount: 3 };
    expect(canConfirm(ok)).toBe(true);
    expect(canConfirm({ ...ok, mapping: ['ignore'] })).toBe(false);
    expect(canConfirm({ ...ok, saveProfile: true, profileName: 'ab' })).toBe(false);
    expect(canConfirm({ ...ok, saveProfile: true, profileName: 'Formato ERP' })).toBe(true);
    expect(canConfirm({ ...ok, rowCount: 20001 })).toBe(false);
  });

  it('pills del bloque del archivo, con millares y singulares', () => {
    expect(fileStats({ headers: Array(6).fill('h'), rows: Array(1247).fill([]) })).toEqual({
      rows: '1.247 filas',
      columns: '6 columnas',
      sample: 'Muestra: 10 filas',
    });
    expect(fileStats({ headers: ['h'], rows: [[]] })).toEqual({ rows: '1 fila', columns: '1 columna', sample: 'Muestra: 1 fila' });
  });

  it('las opciones del desplegable son las del HTML aprobado y solo price está deshabilitada', () => {
    expect(FIELD_OPTIONS.map((o) => o.label)).toEqual([
      'part_number — Referencia del rodamiento *',
      'brand — Marca / Fabricante *',
      'quantity — Cantidad disponible *',
      'location_country — País de stock *',
      'price — Precio (E2EE)',
      'lead_time_days — Plazo de entrega',
      'notes — Notas adicionales',
      '— Ignorar esta columna —',
    ]);
    expect(FIELD_OPTIONS.filter((o) => o.disabled).map((o) => o.value)).toEqual(['price']);
  });
});

describe('perfiles', () => {
  const cols = columnsOf(parseImportText('x.csv', 'Ref;Marca;Uds;Pais\n1;2;3;4')!);

  it('la firma no depende de acentos, mayúsculas ni puntuación', () => {
    expect(headerSignature(['Ref.', 'País'])).toBe(headerSignature(['REF', 'pais']));
  });

  it('aplica un perfil válido', () => {
    expect(applyProfileMapping(cols, ['brand', 'part_number', 'quantity', 'location_country'])).toEqual([
      'brand',
      'part_number',
      'quantity',
      'location_country',
    ]);
  });

  it('rechaza un perfil de otra longitud, con campos desconocidos o con price', () => {
    expect(applyProfileMapping(cols, ['brand'])).toBeNull();
    expect(applyProfileMapping(cols, ['x', 'brand', 'quantity', 'ignore'])).toBeNull();
    expect(applyProfileMapping(cols, ['price', 'brand', 'quantity', 'ignore'])).toBeNull();
    expect(applyProfileMapping(cols, 'nope')).toBeNull();
  });

  it('banner de perfil aplicado, verbatim de la spec', () => {
    expect(profileBannerText('Formato Excel mensual')).toBe(
      'Hemos aplicado automáticamente el perfil "Formato Excel mensual". Revisa que todo sea correcto.',
    );
  });

  it('fetchProfile es tolerante: un error es null', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'relation does not exist' } });
    expect(await fetchProfile('a|b')).toBeNull();
    maybeSingle.mockRejectedValueOnce(new Error('red'));
    expect(await fetchProfile('a|b')).toBeNull();
    maybeSingle.mockResolvedValueOnce({ data: { name: 'P', mapping: ['brand'] }, error: null });
    expect(await fetchProfile('a|b')).toEqual({ name: 'P', mapping: ['brand'] });
  });
});

describe('validación de líneas', () => {
  it('familia por la forma de la referencia (las cinco de la siembra y dos más)', () => {
    expect(inferFamily('6205-2RS/C3')).toBe('Rodamiento rigido de bolas');
    expect(inferFamily('16004')).toBe('Rodamiento rigido de bolas');
    expect(inferFamily('32012X')).toBe('Rodamiento de rodillos conicos');
    expect(inferFamily('NU216')).toBe('Rodamiento de rodillos cilindricos');
    expect(inferFamily('nj 306')).toBe('Rodamiento de rodillos cilindricos');
    expect(inferFamily('22205')).toBe('Rodamiento de rodillos a rotula');
    expect(inferFamily('51104')).toBe('Rodamiento axial de bolas');
    expect(inferFamily('7205B')).toBe('Rodamiento de bolas de contacto angular');
    expect(inferFamily('1205')).toBe('Rodamiento de bolas a rotula');
    expect(inferFamily('ABC-1')).toBeNull();
  });

  it('país: ISO-2 en cualquier caja o nombre conocido', () => {
    expect(normalizeCountry('es')).toBe('ES');
    expect(normalizeCountry(' España ')).toBe('ES');
    expect(normalizeCountry('Germany')).toBe('DE');
    expect(normalizeCountry('Narnia')).toBeNull();
  });

  it('cantidad: entero, con punto de millares; decimal y texto no', () => {
    expect(parseQuantity('850')).toBe(850);
    expect(parseQuantity('1.200')).toBe(1200);
    expect(parseQuantity('-3')).toBe(-3);
    expect(parseQuantity('4.5')).toBeNaN();
    expect(parseQuantity('10 uds')).toBeNaN();
  });

  it('construye las líneas válidas y una fila de error por línea mala, con la fila del archivo', () => {
    const file: ParsedFile = {
      name: 'x.csv',
      headers: ['Ref', 'Marca', 'Uds', 'Pais', 'Plazo', 'Notas'],
      rows: [
        ['6205', 'SKF', '1.200', 'España', '3', ' nota '],
        ['', 'SKF', '1', 'ES', '', ''],
        ['6206', 'SKF', '4.5', 'ES', '', ''],
        ['6207', 'SKF', '-1', 'ES', '', ''],
        ['6208', 'SKF', '1', 'Narnia', '', ''],
        ['6209', 'SKF', '1', 'ES', 'pronto', ''],
        ['ABC', 'SKF', '1', 'ES', '', ''],
        ['6205', 'skf', '2', 'es', '', ''],
      ],
    };
    const { lines, errors } = buildLines(file, ['part_number', 'brand', 'quantity', 'location_country', 'lead_time_days', 'notes']);
    expect(lines).toEqual([
      {
        part_number: '6205',
        brand: 'SKF',
        quantity: 1200,
        location_country: 'ES',
        product_family: 'Rodamiento rigido de bolas',
        lead_time_days: 3,
        notes: 'nota',
      },
    ]);
    expect(errors).toEqual([
      { row: 3, column: 'Ref', errorType: ERROR_TYPES.empty, received: null },
      { row: 4, column: 'Uds', errorType: ERROR_TYPES.quantity, received: '4.5' },
      { row: 5, column: 'Uds', errorType: ERROR_TYPES.negative, received: '-1' },
      { row: 6, column: 'Pais', errorType: ERROR_TYPES.country, received: 'Narnia' },
      { row: 7, column: 'Plazo', errorType: ERROR_TYPES.leadTime, received: 'pronto' },
      { row: 8, column: 'Ref', errorType: ERROR_TYPES.family, received: 'ABC' },
      { row: 9, column: 'Ref', errorType: ERROR_TYPES.duplicate, received: '6205' },
    ]);
  });

  it('las columnas ignoradas no viajan', () => {
    const file: ParsedFile = { name: 'x', headers: ['Ref', 'Marca', 'Uds', 'Pais', 'Obs'], rows: [['6205', 'SKF', '1', 'ES', 'hola']] };
    const { lines } = buildLines(file, ['part_number', 'brand', 'quantity', 'location_country', 'ignore']);
    expect(lines[0]?.notes).toBeNull();
    expect(lines[0]?.lead_time_days).toBeNull();
  });
});

describe('país por defecto (la organización)', () => {
  const file: ParsedFile = { name: 'x.csv', headers: ['Ref', 'Marca', 'Uds'], rows: [['6205', 'SKF', '5'], ['NU216', 'FAG', '3']] };
  const mapping: PlatformField[] = ['part_number', 'brand', 'quantity'];

  it('un país de organización usable es un ISO-2 en mayúsculas; «—» y vacío no', () => {
    expect(usableDefaultCountry(' es ')).toBe('ES');
    expect(usableDefaultCountry('—')).toBeNull();
    expect(usableDefaultCountry('')).toBeNull();
    expect(usableDefaultCountry(undefined)).toBeNull();
    expect(usableDefaultCountry('España')).toBeNull();
  });

  it('sin país por defecto el país sigue siendo obligatorio (la regla de la spec)', () => {
    expect(missingRequired(mapping)).toEqual(['location_country']);
    expect(missingRequiredMessage(mapping)).toBe('Debes mapear las columnas: location_country');
    expect(canConfirm({ mapping, saveProfile: false, profileName: '', rowCount: 2 })).toBe(false);
  });

  it('con país por defecto deja de serlo, pero los otros tres siguen siéndolo', () => {
    expect(missingRequired(mapping, 'ES')).toEqual([]);
    expect(missingRequired(['part_number', 'ignore', 'quantity'], 'ES')).toEqual(['brand']);
    expect(canConfirm({ mapping, saveProfile: false, profileName: '', rowCount: 2, defaultCountry: 'ES' })).toBe(true);
  });

  it('el aviso solo sale si no hay columna de país y hay país que usar', () => {
    expect(defaultCountryNotice(mapping, 'ES')).toBe(
      'Tu archivo no trae país: todas las líneas se importarán con ES, el país de tu organización.',
    );
    expect(defaultCountryNotice(mapping, '—')).toBeNull();
    expect(defaultCountryNotice([...mapping, 'location_country'], 'ES')).toBeNull();
  });

  it('buildLines rellena el país de las líneas; sin él, cada fila es un error', () => {
    const ok = buildLines(file, mapping, 'pt');
    expect(ok.errors).toEqual([]);
    expect(ok.lines.map((l) => l.location_country)).toEqual(['PT', 'PT']);
    const bad = buildLines(file, mapping);
    expect(bad.lines).toEqual([]);
    expect(bad.errors).toHaveLength(2);
  });

  it('una columna de país en el archivo manda sobre el país por defecto', () => {
    const f: ParsedFile = { name: 'x', headers: ['Ref', 'Marca', 'Uds', 'Pais'], rows: [['6205', 'SKF', '5', 'DE']] };
    const { lines } = buildLines(f, ['part_number', 'brand', 'quantity', 'location_country'], 'ES');
    expect(lines[0]?.location_country).toBe('DE');
  });

  it('runImport manda el país por defecto en las líneas', async () => {
    rpc.mockReset().mockResolvedValueOnce({ data: { published: 2, removed: null }, error: null });
    await runImport(file, { mapping, policy: 'ACCUMULATE', profileName: null, defaultCountry: 'ES' });
    expect(rpc.mock.calls[0]?.[1].p_lines.map((l: { location_country: string }) => l.location_country)).toEqual(['ES', 'ES']);
  });
});

describe('sinónimos de la referencia', () => {
  it.each(['Item Number', 'ITEM NO.', 'Item', 'Part', 'Material', 'Nº Parte', 'Artikelnummer', 'Part Num'])('«%s» es la referencia', (h) => {
    expect(proposeMapping([{ index: 0, header: h, example: '' }])[0]?.field).toBe('part_number');
  });

  it('«Item Type» no le quita la referencia a «Item Number»', () => {
    const p = proposeMapping([
      { index: 0, header: 'Item Type', example: '' },
      { index: 1, header: 'Item Number', example: '' },
    ]);
    expect(p.map((x) => x.field)).toEqual(['ignore', 'part_number']);
  });
});

describe('runImport', () => {
  beforeEach(() => rpc.mockReset());
  const file = parseImportText('inv.csv', SPEC_CSV)!;
  const mapping: PlatformField[] = ['part_number', 'brand', 'quantity', 'location_country', 'ignore', 'ignore'];
  let t = 0;
  const clock = () => (t += 500);

  it('manda las líneas válidas y devuelve el resumen de INV-03', async () => {
    rpc.mockResolvedValueOnce({ data: { published: 3, removed: 7 }, error: null });
    const s = await runImport(file, { mapping, policy: 'REPLACE', profileName: null }, clock);
    expect(rpc).toHaveBeenCalledWith('import_inventory', expect.objectContaining({ p_policy: 'REPLACE', p_profile_name: null, p_mapping: null }));
    const sent = rpc.mock.calls[0]?.[1].p_lines;
    expect(sent).toHaveLength(3);
    expect(sent[1]).toMatchObject({ part_number: 'NU216', quantity: 1200, location_country: 'DE' });
    expect(s).toMatchObject({ processed: 3, published: 3, failed: 0, removed: 7, seconds: 0.5, errors: [] });
    expect(s.sample[0]).toEqual({ partNumber: '6205-2RS/C3', brand: 'SKF', quantity: 850, country: 'ES', status: 'PUBLISHED' });
  });

  it('con perfil, manda su nombre, la firma y el mapeo', async () => {
    rpc.mockResolvedValueOnce({ data: { published: 3, removed: null }, error: null });
    const s = await runImport(file, { mapping, policy: 'ACCUMULATE', profileName: 'Formato ERP' }, clock);
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({
      p_profile_name: 'Formato ERP',
      p_header_signature: headerSignature(file.headers),
      p_mapping: mapping,
    });
    expect(s.removed).toBeNull();
  });

  it('sin ninguna línea válida no llama a la base y sale en fallo con los errores', async () => {
    const bad: ParsedFile = { name: 'x', headers: ['Ref', 'Marca', 'Uds', 'Pais'], rows: [['ABC', 'SKF', '1', 'ES']] };
    const s = await runImport(bad, { mapping: ['part_number', 'brand', 'quantity', 'location_country'], policy: 'ACCUMULATE', profileName: null }, clock);
    expect(rpc).not.toHaveBeenCalled();
    expect(s).toMatchObject({ processed: 1, published: 0, failed: 1, removed: null, sample: [] });
  });

  it('si la base rechaza el lote, lanza con su mensaje', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Límite de inventario alcanzado' } });
    await expect(runImport(file, { mapping, policy: 'ACCUMULATE', profileName: null }, clock)).rejects.toThrow(
      'Límite de inventario alcanzado',
    );
  });

  it('un archivo ilegible es un resumen de fallo', () => {
    expect(unreadableSummary()).toEqual({ processed: 0, published: 0, failed: 0, removed: null, seconds: null, sample: [], errors: [] });
  });
});
