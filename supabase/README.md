# Esquema Supabase — MVP Bearingworld.io

Escrito el 6-ago-2026 (día 2) contra `openspec/mvp/Dia-02_decisiones_esquema.md`, aprobado por
el PO. **Aplicado al proyecto remoto `troxminloxkjwihwfevs` (MVP_RinWorld.io, eu-west-1,
Postgres 17) el 6-ago-2026**, con las dos cuentas de desarrollo sembradas y el login verificado
contra la API real.

| Fichero | Contenido |
|---|---|
| `migrations/0001_organizations_and_members.sql` | Organizaciones, miembros, roles, máquina de estados del miembro, los cuatro campos de backup E2EE, helpers de sesión y RLS base |
| `migrations/0002_inventory.sql` | Líneas de inventario con la frontera de cifrado, índices de búsqueda, INV-07 (modo + exclusiones) y lectura cruzada entre organizaciones |
| `migrations/0003_threads_and_items.sql` | Hilos, tarjetas, las tres máquinas de estados, claves de contenido envueltas y RLS de mensajería |
| `migrations/0004_lint_fixes.sql` | Correcciones del linter de Supabase: `search_path` en dos funciones y `pg_trgm` fuera de `public` |
| `migrations/0005_lead_time_and_favorites.sql` | `lead_time_days` en claro (chip de filtro y columna ordenable de SRCH-01) y favoritos por distribuidora. Ver F-018 |
| `migrations/0006_favorite_count_without_view.sql` | Bloquea la escritura de `favorite_count` desde el cliente y hace el backfill. **Su nombre engaña:** la vista agregada que iba a sustituir no llegó a git, y el contador ya está en 0005 — ver F-021 |
| `seed/dev_accounts.sql` | Las dos organizaciones y las dos cuentas. Idempotente. Las contraseñas entran por variable, nunca en el fichero |
| `seed/demo_orgs.sql` | Las **seis** organizaciones de la demo (decisión del PO, 7-ago) y la corrección de los diacríticos de las dos primeras. Ver F-019 |
| `seed/catalog_demo.sql` | Catálogo de demo: **215 líneas** generadas por el Coder el 7-ago y aplicadas sin corregir. Diseñado hacia atrás desde `openspec/mvp/guion-demo-y-siembra.md`. Ver F-022 |

## Estado en el remoto

Verificado por API (`/auth/v1/token` + PostgREST), no por inspección de la base:

| Cuenta | Organización | Rol | Estado | Ve |
|---|---|---|---|---|
| `alpha@bearingworld.test` | Rodamientos Ibéricos (ES) | ADMIN | ACTIVE | sus 3 líneas + las 2 PUBLISHED de Beta |
| `beta@bearingworld.test` | Nordwälz Lager (DE) | ADMIN | ACTIVE | sus 3 líneas + las 2 PUBLISHED de Alpha |

Ninguna ve el `DRAFT` de la otra ni su `ARCHIVED`, ni a los miembros de la otra. Las dos ven
las dos organizaciones (directorio, `status = APPROVED`).

`get_advisors` queda con **un solo aviso**: `auth_leaked_password_protection` desactivado. Es
configuración de Auth del proyecto, no del esquema — decisión del PO, no se toca desde una
migración.

## Verificación

```bash
bash supabase/tests/run.sh
```

Levanta un Postgres 16 desechable en Docker, aplica un stub de `auth` (para poder probar sin
el stack de Supabase ni tocar el remoto) y corre **dos fases en dos bases separadas**:

| Fase | Base | Qué prueba |
|---|---|---|
| 1 · esquema | `postgres` | **35 asertos**: que la base dice "no" donde los specs cerrados exigen que diga no |
| 2 · catálogo | `bwcatalog` | **30 asertos** sobre la siembra del día 3: la demo del guion funciona sobre esos datos, y pasarla dos veces no duplica |

Van en bases distintas porque la fase 1 deja sus propias organizaciones y líneas, y los
recuentos del catálogo no pueden contar con datos ajenos. La fase 2 ejecuta
`seed/demo_orgs.sql` y `seed/catalog_demo.sql` **tal cual**, sin copia intermedia: un test
que prueba una copia prueba otra cosa que lo que se despliega.

Cada aserto negativo imprime su `sqlstate`: `23514` CHECK, `23505` índice único, `P0001`
trigger. Si una sentencia del test falla por sintaxis o por nombre (`42xxx`), el runner lo
declara **TEST ROTO** en vez de contarlo como invariante verificada — sin eso, un typo en el
test se disfrazaría de esquema correcto. Y los asertos positivos imprimen su etiqueta uno a
uno: es la única forma de distinguir "30 asertos pasaron" de "el fichero se ejecutó y no
comprobó nada", que es el fallo de F-015.

Estado a 7-ago-2026: **verde, 65/65.** (35 de esquema · 30 de catálogo.)

> El recuento de la fase 1 venía diciendo **34** desde el día 2 y son **35**: un aserto mal
> contado a mano. Ahora los cuenta el propio runner (`grep -c` sobre sus `NOTICE OK`), que es
> justo lo que F-015 pedía — leer el número de asertos *ejecutados*, no el que uno recuerda.

## Ocho decisiones de implementación que el documento de la puerta no cubría

Ninguna contradice un spec cerrado, pero todas son revisables:

1. **`public.members`, no `users`.** `e2ee-key-management · schema-desde-dia-uno` dice "la tabla
   `users`". En Supabase `auth.users` es gestionada y no se extiende, así que el perfil vive en
   `public.members` **con la PK siendo `auth.users.id`**. Así `member_id = auth.uid()`, que es
   justo el identificador que `key-wrapping` usa como AAD y `local-storage` como sufijo de
   IndexedDB. Los cuatro campos de backup existen desde la primera migración y son nullable: el
   requisito se cumple.

2. **Un solo blob cifrado por elemento**, no una columna `bytea` por campo comercial.
   `RNG-VND-01` lista ocho campos cifrados, pero nada del servidor necesita distinguirlos —
   todo lo que el servidor usa está en claro al lado. Un blob es menos superficie y filtra menos
   por longitud de campo. Si algún día hace falta granularidad, es una migración de datos
   cifrados: la peor. Merece una segunda mirada ahora y no en el día 8.

3. **`thread_item_keys` es tabla nueva y no estaba en el documento.** La fuerza una combinación
   del spec: `e2ee-content-encryption` cifra "usando las claves X25519 **del miembro**", pero los
   hilos son entre **organizaciones**, y una organización tiene un ADMIN más N EDITOR. Un ECDH
   directo entre dos personas dejaría fuera al resto de su propia organización. Así que cada
   elemento tiene su clave de contenido y se guarda envuelta una vez por destinatario. En el MVP
   son dos filas por elemento.

4. **La consulta única por línea se acota a la organización compradora, no al usuario.**
   `inquiry-card` dice "por el mismo comprador", que es ambiguo. El aviso de SRCH-01 dice "Ya has
   consultado esta referencia con **este distribuidor**", que se lee como organización. Si la
   intención era por usuario, es cambiar un índice único.

5. **`inventory_lines.status` tiene cuatro estados, con `DELETED`.** Lo exige
   `inventory-line-lifecycle`. INV-01 solo pinta tres (DRAFT/PUBLISHED/ARCHIVED) y el documento
   de la puerta repetía los tres de la pantalla. Manda el spec.

6. **Las ofertas no llevan `inventory_line_id`.** La consulta sí (lo necesita la regla de línea
   consultada); la oferta hereda `part_number` y `brand` pero no queda atada a una línea, que
   puede desaparecer en un reemplazo total sin invalidar la negociación.

7. **`organizations` es escribible por el ADMIN en una sola columna.** Sin política de UPDATE,
   INV-07 no podría cambiar el modo de visibilidad; con ella abierta, un cliente podría
   cambiarse el nombre o el `status` que aprueba el operador. Un trigger acota el permiso a
   `inventory_visibility_mode` y deja el resto al operador (`operator-approval`).

8. **El recuento de favoritos es un contador desnormalizado, no una vista.** La estrella de cada
   uno vive tras RLS por miembro, pero el número de la columna 9 de SRCH-01 es de toda la
   plataforma, y con RLS restringida no se puede agregar desde el cliente. La primera versión usó
   una vista agregada; el linter la marcó como `security_definer_view` a nivel **ERROR**, porque
   una vista se ejecuta con los privilegios de su dueño y lee por encima de RLS. Un contador en
   `organizations` mantenido por trigger no necesita ningún privilegio especial, y el cliente no
   lo puede escribir (lo bloquea `guard_organization_columns`). No choca con RNG-SRCH-08: esa
   regla prohíbe crear o modificar **favoritos** automáticamente, no cachear su recuento.

## Notas de RLS

- Los helpers de `app` son `SECURITY DEFINER` **a propósito**: una política sobre `members` que
  consultara `members` entraría en recursión infinita. Es el patrón, no un atajo.
- `app.guard_member_privileges()` y `app.guard_organization_columns()` son los únicos triggers
  que **no** pueden ser `SECURITY DEFINER`: distinguen al cliente del `service_role` por
  `current_user`, y con `SECURITY DEFINER` ese valor pasa a ser el dueño de la función y la
  guarda se desactivaría a sí misma siempre.
- La exclusión de INV-07 se evalúa **dentro** de la política de lectura, no en un job ni en una
  vista materializada. Es lo que hace que el efecto sea inmediato, como pide el spec.
- Los `GRANT` van explícitos aunque Supabase los daría por *default privileges*: es lo que
  permite aplicar y probar estas migraciones en un Postgres pelado.

## Pendiente

- **Habilitar Realtime.** Ojo con el plan §3, que lo pide "sobre `threads`, `messages`, `offers`":
  esas dos últimas tablas no existen. El spec cerrado tiene **un** hilo con elementos de tipo
  mezclado, así que Realtime va sobre `threads` y `thread_items`.
- **Catálogo sembrado** (día 3, Coder), diseñado desde `openspec/mvp/guion-demo-y-siembra.md`.
