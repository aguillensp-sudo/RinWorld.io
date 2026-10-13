# INV-04 · Medidas de lectura de `.xlsx` (13-oct-2026)

Una hoja, solo valores, textos en `sharedStrings` como los escribe Excel; columnas `Referencia,Marca,Cantidad,Pais,Plazo,Notas`.
Medido en Node 24 con `fflate@0.8.2` (descomprime la hoja entera en memoria) y un recorrido por `indexOf` sin DOM (Deno no tiene `DOMParser`,
así que el lector de `app/src/lib/xlsx-reader.ts` no sirve tal cual en la función). Fichero leído desde disco en un proceso aparte.
**No es una medida dentro de Supabase.** La memoria es el RSS (la base de Node ronda 48 MB).

| Filas | `.xlsx` | Hoja sin comprimir | CPU | RSS pico |
|---|---|---|---|---|
| 20.000 | 0,6 MB | 4,2 MB | 156 ms | 70 MB |
| 50.000 | 1,5 MB | ~11 MB | 250 ms | 83 MB |
| 100.000 | 3,1 MB | 21 MB | 359 ms | 130 MB |
| 200.000 | 6,2 MB | 44 MB | 750 ms | **213 MB** |

- La CPU no es el límite (200.000 filas ≈ 0,75 s de 2 s). **La memoria sí**: 200.000 filas llegan a 213 MB de los 256 MB.
- La medida **no incluye** `buildLines` ni el JSON de la RPC, que en el CSV de 500.000 filas añadieron memoria y ~1,5 s. Con esos pasos,
  200.000 filas **no caben con margen**; 100.000 sí.
- El fichero de prueba pesa más que los reales del PO (200.000 filas en menos de 2 MB): la columna `Notas` es única por fila.
- Hace falta un tope de bytes **descomprimidos** (zip bomb): un zip de 2 MB puede esconder gigas.

Reproducir: `node --expose-gc inv04-xlsx-generar.mjs <filas> gen` y `node inv04-xlsx-leer.mjs x<filas>.xlsx` (con `npm i fflate@0.8.2`).
