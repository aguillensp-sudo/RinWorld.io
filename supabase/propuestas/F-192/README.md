# F-192 · privilegios mínimos en `public` — propuesta lista, sin aplicar

**Estado:** preparada y probada en el banco el 14-oct-2026. **No está aplicada en ninguna base.**
F-192 sigue siendo un riesgo aceptado por el PO (25-sep). Se aplica cuando salte su disparador:
**antes de tener datos reales de clientes o de abrir el registro a terceros** (`BACKLOG-V1.md`).

## Qué hay aquí

| Fichero | Destino cuando se aplique |
|---|---|
| `0065_privilegios_minimos_en_public.sql` | `supabase/migrations/NNNN_…sql`, con el siguiente número libre |
| `stub_privilegios_de_tablas.sql` | Añadir a `supabase/tests/00_auth_stub.sql`, después de la DEFAULT PRIVILEGE de funciones |
| `06_privilegios_asserts.sql` | `supabase/tests/`, llamado desde `run.sh` justo después de `01_schema_smoke.sql` |
| `probar.sh` | Se queda aquí. Prueba los tres ficheros sobre una copia de `supabase/` |

Los tres primeros van **juntos**. Si solo se añade el stub, fallan los asertos de `0028`, `0034` y `0035`: es lo
que F-192 midió. Sin el stub, el banco sigue siendo más estricto que la plataforma y `06` pasa sin medir nada.

## El criterio

**Un privilegio sin política que lo use está muerto**: la RLS ya lo niega. Por eso quitarlo no cambia lo
que la app puede hacer. Comprobado contra el catálogo de producción el 14-oct:

- Ninguna política de `public` se aplica a `anon` ni a `public`, así que a `anon` se le quita todo.
- A `authenticated` se le quitan `TRUNCATE`, `REFERENCES` y `TRIGGER` en todo. `TRUNCATE` es el único verbo que
  la RLS no filtra.
- Se le quita también cada `INSERT`/`UPDATE`/`DELETE` que no usa ninguna de sus políticas, tabla a tabla.
- Los seis triggers que escriben en otra tabla son `SECURITY DEFINER`; las seis vistas, `security_invoker`.
- Las escrituras directas del cliente (`app/src/lib/*.ts`) caen todas dentro de lo que se conserva:
  - `members.public_key`
  - `organizations`, `threads`, `thread_items` y `registration_requests` (update)
  - `inventory_lines` y `inventory_exclusions`
  - favoritos, watchers y foro (insert/delete)

**Lo que sí cambia:** una tabla nueva ya no nace abierta, y su migración tiene que conceder a `authenticated`
lo que usan sus políticas (como hizo `0035` a mano). Si se olvida, falla cerrado (`permission denied`, lo caza
la e2e). Si sobra un privilegio, lo caza `06` (regla C).

## Cómo se probó

```bash
bash supabase/propuestas/F-192/probar.sh
```

Resultado del 14-oct-2026:

1. **Ancla negativa** (privilegios de la plataforma, sin 0065): `06` falla con **182 incumplimientos**.
   - A: 66 de `anon`.
   - B: 57 de `TRUNCATE`/`REFERENCES`/`TRIGGER`.
   - C: 33 verbos sin política.
   - D: 6 vistas escribibles.
   - F: 20 en las DEFAULT PRIVILEGES.
2. **Con 0065:** `run.sh` entero en verde, y `06` en verde. Incluye `01_schema_smoke.sql`, que ejerce como
   `authenticated` las escrituras de la app.

## Al aplicarlo

1. Mover los tres ficheros a su sitio, renumerar la migración y correr `supabase/tests/run.sh`.
2. Aplicar por el MCP a **`bearingworld-e2e`** primero y correr la suite e2e entera contra él.
3. Aplicar por el MCP a producción. Releer del catálogo (`relacl`, `attacl`, `pg_default_acl`), no del `.sql` (F-146).
4. Marcar F-192 como cerrado en el registro y quitar la fila de `BACKLOG-V1.md`.
