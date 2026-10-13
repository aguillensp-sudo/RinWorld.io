# INV-04 · Medidas de la función `ingest-email` (13-oct-2026)

Medido en Node 24 (V8, el mismo motor que Deno) con `postal-mime@2.4.3` y el `import-core.ts` desplegado,
sobre un correo MIME con un CSV en base64 (`Referencia,Marca,Cantidad,Pais,Plazo,Notas`). CPU de usuario+sistema
del proceso; memoria = RSS del proceso (la base de Node ronda 60 MB). **No es una medida dentro de Supabase**:
el tiempo de CPU allí puede ser mayor; lo que se mide es el orden de magnitud y la forma de la curva.

| Filas | CSV | Correo | `PostalMime` | `parseImportText` | `buildLines` | Pico RSS |
|---|---|---|---|---|---|---|
| 1.000 | 0,05 MB | 0,1 MB | 16 ms | 0 ms | 31 ms | 70 MB |
| 20.000 (tope de la spec) | 1,0 MB | 1,4 MB | 63 ms | 125 ms | 31 ms | 131 MB |
| 500.000 | 27,2 MB | 37,3 MB | 594 ms | 1.953 ms | 1.546 ms | **1.022 MB** |

Conclusiones:

- **20.000 filas caben de sobra**: ~0,3 s de CPU y ~70 MB sobre la base. El tope de filas de la spec se mantiene.
- **El problema no son las filas sino los bytes.** La función descodifica el MIME entero en memoria y valida las
  filas después de leerlas todas, así que un correo de 37 MB desborda los 256 MB de la plataforma (≈ 16 veces su
  tamaño tras `PostalMime`) y los 2 s de CPU.
- **Decisión tomada aquí, a confirmar por el PO:** el tope de tamaño de la fase 2 baja de 40 MB a **5 MB**
  (`MAX_MAIL_BYTES`). Un CSV de 20.000 filas pesa ~1 MB. Los 40 MB (y el `.xlsx`) vuelven con la fase 3, fuera
  de la función de borde.
- **Sin medir:** el tiempo de CPU real dentro de Supabase y la latencia de S3. El primer correo grande real
  (hasta 5 MB) lo dirá en los registros de la función.

Reproducir: `node --expose-gc medir.mjs <filas> <raíz del repo>` (el guion está en `harness/metrics/inv04-medir-funcion.mjs`).
