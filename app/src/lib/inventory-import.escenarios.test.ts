import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ESCENARIOS DE SPEC de `inventory-management` sobre la importación (nivel unit, sin base ni red).
 * Salen de `openspec/specs/inventory-management/spec.md`, no del código; cada `it` empieza por el
 * id del escenario de `openspec/v1/trazabilidad.csv`.
 */

const rpc = vi.fn();
vi.mock('./supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a) },
}));

import {
  FIELD_OPTIONS,
  MAX_FILE_BYTES,
  proposeMapping,
  columnsOf,
  readImportFile,
  runImport,
  type ParsedFile,
  type PlatformField,
} from './inventory-import';

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: { published: 2 }, error: null });
});

describe('inventory-management/canonical-schema', () => {
  /*
   * Escenario «unit_price cifrado E2EE» (canonical-schema#2)
   *   GIVEN un archivo de stock que incluye la columna `unit_price`
   *   WHEN  el sistema procesa la línea
   *   THEN  el valor queda cifrado E2EE antes de almacenarse
   *   AND   nunca se indexa en texto plano ni es accesible para el servidor
   *
   * Lo que este test puede asertar de verdad es la segunda mitad (el AND): el precio en claro
   * NUNCA viaja al servidor. La primera mitad (que el valor se cifre y se guarde) no se aserta
   * porque el producto no lo hace: ver la nota de la matriz.
   */
  it('inventory-management/canonical-schema#2 · el unit_price del archivo no llega en claro a la base (ni como campo ni como valor)', async () => {
    const file: ParsedFile = {
      name: 'stock.csv',
      headers: ['part_number', 'brand', 'quantity', 'location_country', 'unit_price'],
      rows: [
        ['6205-2RS', 'SKF', '850', 'ES', '4237.99'],
        ['NU216', 'FAG', '120', 'DE', '9187.55'],
      ],
    } as ParsedFile;

    // La columna de precio no se propone como campo de plataforma...
    const propuesta = proposeMapping(columnsOf(file));
    expect(propuesta.map((p) => p.field)).not.toContain('price');
    // ...y la opción `price` del desplegable sale deshabilitada (no se puede elegir).
    expect(FIELD_OPTIONS.find((o) => o.value === 'price')?.disabled).toBe(true);

    // Aunque el usuario fuerce el mapeo de esa columna a `price`, el precio no viaja.
    const mapping: PlatformField[] = ['part_number', 'brand', 'quantity', 'location_country', 'price'];
    await runImport(file, { mapping, policy: 'ACCUMULATE', profileName: null });

    expect(rpc).toHaveBeenCalledTimes(1);
    const [nombre, args] = rpc.mock.calls[0]!;
    expect(nombre).toBe('import_inventory');
    const enviado = JSON.stringify(args);
    // Ni el valor en claro...
    expect(enviado).not.toContain('4237.99');
    expect(enviado).not.toContain('9187.55');
    // ...ni ninguna clave de precio (ni en claro ni cifrada).
    expect(enviado).not.toMatch(/price/i);
    // Y las líneas sí se importaron (la prueba no es vacía).
    expect((args as { p_lines: unknown[] }).p_lines).toHaveLength(2);
  });
});

describe('inventory-management/inventory-upload-channels', () => {
  /*
   * Escenario «archivo supera límite de tamaño CAN-01» (inventory-upload-channels#2)
   *   GIVEN un miembro que intenta subir un archivo mayor de 50 MB
   *   WHEN  el sistema detecta el tamaño
   *   THEN  rechaza el archivo antes de procesarlo
   *   AND   muestra un mensaje con instrucción de comprimir o dividir el archivo
   *
   * Aquí, la capa de lectura: se rechaza sin leer el contenido. El mensaje se prueba en
   * `screens/inventory/Inventory.escenarios.test.tsx` (es lo que ve el miembro).
   */
  it('inventory-management/inventory-upload-channels#2 · un archivo de más de 50 MB se rechaza como too_big sin leer su contenido', async () => {
    expect(MAX_FILE_BYTES).toBe(50 * 1024 * 1024);
    const grande = new File(['Ref;Marca\n6205;SKF'], 'enorme.csv', { type: 'text/csv' });
    Object.defineProperty(grande, 'size', { value: 50 * 1024 * 1024 + 1 });
    // La lectura del contenido pasa por `FileReader`: si se rechaza antes de procesar, no se toca.
    const lecturas = [
      vi.spyOn(FileReader.prototype, 'readAsArrayBuffer'),
      vi.spyOn(FileReader.prototype, 'readAsText'),
    ];

    const r = await readImportFile(grande);

    expect(r).toEqual({ kind: 'too_big', name: 'enorme.csv' });
    for (const espia of lecturas) expect(espia).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    for (const espia of lecturas) espia.mockRestore();

    // Frontera: exactamente 50 MB sí se admite (la spec dice «mayor de 50 MB»).
    const justo = new File(['Ref;Marca;Uds;País\n6205;SKF;1;ES'], 'justo.csv', { type: 'text/csv' });
    Object.defineProperty(justo, 'size', { value: 50 * 1024 * 1024 });
    expect((await readImportFile(justo)).kind).toBe('ok');
  });
});
