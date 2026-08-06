# Esquema Supabase — MVP Bearingworld.io

Escrito el 6-ago-2026 (día 2) contra `openspec/mvp/Dia-02_decisiones_esquema.md`, aprobado por
el PO. Las tres migraciones se aplican en orden y **no** se han aplicado todavía al proyecto
remoto (`troxminloxkjwihwfevs`, eu-west-1).

| Fichero | Contenido |
|---|---|
| `migrations/0001_organizations_and_members.sql` | Organizaciones, miembros, roles, máquina de estados del miembro, los cuatro campos de backup E2EE, helpers de sesión y RLS base |
| `migrations/0002_inventory.sql` | Líneas de inventario con la frontera de cifrado, índices de búsqueda, INV-07 (modo + exclusiones) y lectura cruzada entre organizaciones |
| `migrations/0003_threads_and_items.sql` | Hilos, tarjetas, las tres máquinas de estados, claves de contenido envueltas y RLS de mensajería |

## Verificación

```bash
bash supabase/tests/run.sh
```

Levanta un Postgres 16 desechable en Docker, aplica un stub de `auth` (para poder probar sin
el stack de Supabase ni tocar el remoto), corre las tres migraciones y ejecuta 30 asertos.
Cada aserto negativo imprime su `sqlstate`: `23514` CHECK, `23505` índice único, `P0001`
trigger. Si una sentencia del test falla por sintaxis o por nombre (`42xxx`), el runner lo
declara **TEST ROTO** en vez de contarlo como invariante verificada — sin eso, un typo en el
test se disfrazaría de esquema correcto.

Estado a 6-ago-2026: **verde, 30/30.**

## Siete decisiones de implementación que el documento de la puerta no cubría

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

## Lo que falta del día 2

- Aplicar las migraciones al proyecto remoto y crear las dos cuentas de prueba.
- Scaffold React+TS+Vite con el shell, y Vitest + Playwright en CI.
- Meter `supabase/tests/run.sh` en el pipeline junto a Vitest.
