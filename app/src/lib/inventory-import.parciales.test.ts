import { describe, expect, it } from 'vitest';
import {
  ANALYSED_SAMPLE_ROWS,
  columnsOf,
  isAcceptedUpload,
  proposeMapping,
  readImportFile,
} from './inventory-import';

/**
 * PARCIALES · inventory-management/inventory-upload-channels#1
 *
 * GIVEN un miembro en INV-01 que arrastra un archivo .csv de 50 MB o menos
 * WHEN el archivo es recibido por el Ingestion Service
 * THEN el sistema extrae las primeras 10 filas y las envía al AI CSV Mapper
 * AND presenta la pantalla INV-02 con el mapeo propuesto en menos de 15 segundos
 *
 * Escrito desde la spec. La cadena lectura -> muestra de 10 filas -> propuesta es
 * toda local (sin red), así que los 15 s se miden de verdad con un archivo del
 * tope de líneas de una subida.
 */

describe('inventory-management/inventory-upload-channels (parciales)', () => {
  it('inventory-management/inventory-upload-channels#1 · un CSV válido de 20.000 filas da la propuesta, calculada solo sobre las 10 primeras filas, en menos de 15 s', async () => {
    // Las filas 11 en adelante traen un valor en "Notas"; las 10 primeras, no.
    // Si el mapper mirase más de 10 filas, el ejemplo de "Notas" no estaría vacío.
    const filas = ['Referencia;Marca;Cantidad;País;Notas'];
    for (let i = 1; i <= 20000; i++) {
      filas.push(`6205-${i};SKF;${i};ES;${i > ANALYSED_SAMPLE_ROWS ? 'solo-tras-la-fila-10' : ''}`);
    }
    const archivo = new File([filas.join('\n')], 'inventario.csv', { type: 'text/csv' });
    expect(isAcceptedUpload(archivo)).toBe(true); // 50 MB o menos y .csv

    const t0 = performance.now();
    const leido = await readImportFile(archivo);
    expect(leido.kind).toBe('ok');
    if (leido.kind !== 'ok') throw new Error('no se leyó');
    const columnas = columnsOf(leido.file);
    const propuesta = proposeMapping(columnas);
    const segundos = (performance.now() - t0) / 1000;

    // THEN la propuesta existe, columna a columna, con el campo canónico esperado
    expect(propuesta.map((p) => p.field)).toEqual(['part_number', 'brand', 'quantity', 'location_country', 'notes']);
    // AND se extrae solo la muestra de las primeras 10 filas
    expect(ANALYSED_SAMPLE_ROWS).toBe(10);
    expect(columnas[0]?.example).toBe('6205-1');
    expect(columnas[4]?.example).toBe(''); // el primer valor de "Notas" está en la fila 11
    // AND en menos de 15 segundos
    expect(segundos).toBeLessThan(15);
  });

  it('inventory-management/inventory-upload-channels#1 · un archivo de más de 50 MB no llega a la propuesta', async () => {
    const grande = new File(['Referencia;Marca\n'], 'grande.csv');
    Object.defineProperty(grande, 'size', { value: 50 * 1024 * 1024 + 1 });
    expect(isAcceptedUpload(grande)).toBe(false);
    expect((await readImportFile(grande)).kind).toBe('too_big');
  });
});
