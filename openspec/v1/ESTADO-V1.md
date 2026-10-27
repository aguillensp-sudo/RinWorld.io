# ESTADO · V1 Bearingworld.io

**Aviso** El trabajo vive en `C:/Users/admin/proyectos/Bearing.io/BearingWorld.io` en
`mvp/bootstrap` (rama por defecto desde el 25-sep). Si te lanzan en un worktree `claude/…`, opera ahí
con paths absolutos; si nace en `43bb222`, es una sesión vieja: la receta está en `CLAUDE.md` §11.

**Qué es este fichero:** el relevo. Solo estado, **máximo 150 líneas** (un hook de git lo impide). Se
sobrescribe al cierre de cada día con el ritual de `CLAUDE.md` §11. Historia en `diario/`, decisiones en
`DECISIONES-V1.md`, hallazgos en `../mvp/findings/`, reglas en `CLAUDE.md`, deuda sin fecha en
`BACKLOG-V1.md`. La versión larga anterior: `git show d2df8d4:openspec/v1/ESTADO-V1.md`.

Empieza por §6 y luego §3.

---

**Día 49 de V1 · 27-oct-2026, ~16:00 UTC · Estado: CERRADO.** Entregable 6 (residencia UE) en stand-by indefinido por el PO: no se propone ni se pregunta. **VERA, D8: cerrado por el PO, no se toca.** Hoy: SRCH-01 en dos fases con sus pruebas e2e completas (tareas 0.3, 6.2–6.4 del change); `F-254` cerrado y `F-281` abierto; `F-280` cerrado (Mis favoritos + Favoritos recibidos, `0077`). Detalle en `diario/dia-49.md`.
---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| **e2e de SRCH-01 en dos fases** | Playwright local contra `bearingworld-e2e` (`run-e2e-against-e2e-project.mjs`), sin CI en curso (`gh run list --status in_progress` vacío) | `search.spec.ts` + `batch-search.spec.ts`: **26/26** (con setup y teardown). Nuevos: «Contiene», claves sueltas (y volver con la selección) y paginar las ofertas. Un primer intento con `6204` falló: la siembra tiene 1 clave; se usa el prefijo `6` |
| **Zona Anadolu (AS) frente a EU del guion de demo** | El mismo `search.spec.ts` («la zona por defecto (Europa) deja fuera a la distribuidora turca, y sin zona aparece») | Pasa |
| **Matriz** | `harness.core.trazabilidad.resumen()` y `problemas()` vacío | 110 CUBIERTO, 21 DIVERGE, 38 NO_IMPLEMENTADO, 13 PARCIAL, 0 SIN_PRUEBA, 3 FUERA = 185. Sin cambios: los 24 escenarios nuevos del change no caben en el CSV hasta archivar (`changes/amend-srch01-busqueda-en-dos-fases/matriz.md`: 23 CUBIERTO, 1 PARCIAL) |

## 2 · Dónde estamos, por corriente

- **Corriente A · Núcleo — CERRADA el 14-oct.** Su único cabo, `F-192`, cerrado el 20-oct con `0071`.
- **Fundación V1.** Entregables 1 a 5 hechos. **El 6 (residencia UE) está en stand-by (PO, 22-oct): no se trae a pendientes ni se pregunta** (`DECISIONES-V1.md`, `BACKLOG-V1.md`). VERA sigue en `api.anthropic.com`.
- **VERA.** `claude-sonnet-5` por `api.anthropic.com` (PO, 14-oct). Memoria de 20 intercambios (`F-101`), contexto de pantalla y rol, una línea tras buscar, `navegar` a siete pantallas, cupo de 150 llamadas por usuario y hora y `usage` en `vera_usage` (`0068`, `F-256`). `buscar_en_catalogo` devuelve ahora la frescura comparada y el plazo rotulado (`F-279`). La guía de pantallas dice que la ficha lleva botón de favorito y que el recuento cuenta usuarios.
- **Corriente B · Fábrica — EN MARCHA, sin cambios desde el 17-oct.** `INV-04` del arnés en `exp/inv-04-fabrica` (no se fusiona): verde en C1–C4, **C5 NO del PO** (`F-261`). La próxima serie parte del prompt con `_nota*` (`F-263`).
- **Corriente C · Verificación — ABIERTA.** Nivel 1 (`trazabilidad.csv`): **110 de 185 con prueba que corre en CI**, 13 parciales, 38 NO implementados, 21 divergencias (todas aceptadas; la nueva, `favorites-system#1`, 24-oct), **0 sin prueba**, 3 fuera. `dual-entry-routes#2` y `user-revocation#1` CUBIERTO por e2e de suite. Quedan 2 «solo e2e» que no pueden estar en CI: modelo real y SES. Niveles 4 y 5 aparcados.
- **Favoritos.** Tabla `favorite_distributors` por miembro (`PK member_id + distributor_org_id`), recuento por trigger. Estrella con confirmación en Comprando y Búsqueda por lotes; botón con confirmación en la ficha de otra organización; ninguno en la propia. «Mis favoritos» es un botón de Comprando (cualquier miembro) y «Favoritos recibidos» del Panel cuenta usuarios del mes por `favorites_received_this_month()` (`0077`, aplicada a las dos bases). Producción: 0 favoritos.

## 3 · Qué toca, en este orden

0. **JULSA es el primer miembro `ACTIVE` con ADR-001 completo.** Su privada vive SOLO en el navegador del PO: no borrar sus datos del sitio y **no pulsar «Generar nuevas claves» con esa cuenta**. Cada «Desbloquear» de `REC-01` y cada cambio de `SET-SEC-01` **cuenta una petición** (5 por 30 min, `0052`).
1. **Antes de CADA corrida contra `bearingworld-e2e`** (Playwright o arnés): `gh run list --branch mvp/bootstrap --status in_progress`, en ese momento y no una vez por sesión, y avisar a las demás sesiones vivas. **Tu propio push lanza el e2e de la CI** (~10 min): o esperas a que acabe o no tocas la instancia (`F-262`). Si `watchers.spec.ts` cae por «falta el estado …», mira primero si corrió `fixture.setup.ts` (`F-270`).
2. **Del PO:**
   - **`F-278` (e2e de la CI, plan Free):** un push de solo docs ya no corre e2e ni despliega (`c0407d0`). Queda **(c)**, Pro ≈ 35 $/mes, solo si un run con código vuelve a caer por una parada de la instancia.
   - **`F-269` §2** queda para después del arranque.
   - **Equivalencias de sufijos entre fabricantes (`F-281`; `F-254` cerrado el 27-oct):** el PO trae definiciones y avisa. **No se toca `part_key` ni `search.ts` para eso hasta entonces.**
   - **Suspensión:** residual en `F-275`: `vera_abrir_turno` no mira la suspensión.
   - **Semilla de demo:** quitar `VITE_DEMO_KEY_SEED` de Vercel de producción cuando se acerquen datos reales o terceros (`F-067`).
   - **Favoritos (`F-280`):** la base no impide marcar la propia organización; lo impide la interfaz. Si prefieres «Mis favoritos» en otro sitio que no sea el botón de Comprando, es mover el botón.
3. **VERA, D8: CERRADO por el PO (24-oct). No abrir el tema ni proponer cambios al prompt por esa ambigüedad:** él la prueba a mano. Toda llamada real, con su visto bueno (`VERA_REAL=1`, `VERA_REAL_CASOS`, `VERA_REAL_REPETIR`, `VERA_REAL_OUT` fuera del repo, `VERA_REAL_TOPE_USD`).
4. **Frontend:** el PO prepara cambios por su cuenta. **El plan móvil NO se propone hasta que él lo pida** (`BACKLOG-V1.md`). INV-04 se queda con la versión a mano (`F-261`).
5. **~12-nov:** comprobar que `inbox/` de S3 ya no conserva los primeros correos (borrado a 30 días).
6. **Lista previa a empujar:** `tsc --noEmit`, `vitest` entero (`--maxWorkers=50%` si hay otra sesión con tests), el banco si se tocó `supabase/` más allá de una función, la suite e2e si se tocó un e2e o el arnés (`F-230`), y `py -m harness.tests.test_checks` si se tocó una tarea, la matriz o un test de contrato (`F-251`, `F-125`). **Mira la CI del push anterior antes de empujar otro.** Un commit con `[skip ci]` salta la CI de todo su empuje: va en un empuje aparte. Nunca `vitest` con un e2e en marcha. **Una migración nueva se aplica por el MCP a las dos bases antes de empujar su fichero** (`F-277`, `entornos.md`).
7. **La matriz se edita con `harness.core.trazabilidad.leer_csv`/`escribir_csv`, y ninguna nota lleva `;`**: un `;` suelto parte la fila y la reescritura pierde la cola.
8. **El `localhost` del PO sirve la carpeta RAÍZ, no un worktree:** tras empujar, adelantarla con `git -C <raíz> merge --ff-only origin/mvp/bootstrap`, o el PO no ve nada. Su `app/.env` apunta a producción: lo que marque o escriba allí es real.

## 4 · Decisiones vivas

Todas en `DECISIONES-V1.md`. Las que más muerden al trabajar:

- **VERA es Sonnet 5** (`claude-sonnet-5`) por la API directa; la residencia UE está en stand-by (PO, 22-oct) y no se propone. La spec de `vera-agent` dice 4.6 y no se toca.
- **El proxy de VERA no lee datos; solo abre y cierra su turno en `vera_usage`, con el JWT del usuario y la clave anónima, nunca con la de servicio** (D-09-05 matizada, `F-256`). El cupo cuenta llamadas, no preguntas.
- **VERA: memoria de 20 intercambios, solo texto; los datos se vuelven a consultar; la pantalla manda sobre lo recordado.**
- **VERA no repite lo que la pantalla enseña**: tras buscar, una línea; Inventario se mueve solo con una lista; Hilos, texto breve.
- **Búsqueda por lotes: el tope de 5 s para 50 referencias se acepta como divergencia** (`F-274`). Los favoritos se piden una vez por lote; si se quiere cumplir el tope, la vía es la RPC de lote (`F-253`, backlog).
- **Pantalla nueva con cabecera o contenedor raíz → `cabeceras.test.ts` / `padding.test.ts`** (`F-209`), y a `veraScreenName` (`F-255`).
- **`demo_reanchor_freshness()` solo toca las seis de `demo_orgs.sql`** (`0059`). Se siembra antes de cada corrida con `npm run demo:reset`. No repone inventario.
- Las C5 se hacen contra **producción**, sin pulsar nada que escriba (`F-188`), salvo decisión del PO.
- El scroll propio va **en la plantilla de tarea del Coder** (`F-198`).
- Privilegios y RLS se comprueban **contra el catálogo** (`F-146`); **ninguna función de `public` la ejecuta `anon`**. Una política que llame a `app.f()` o `auth.f()` sin `(select …)` rompe el banco (`0062`).
- **Desde `0071` una tabla nueva de `public` nace cerrada**: su migración concede a `authenticated` lo que usan sus políticas (si se olvida, `permission denied`); `06_privilegios_asserts.sql` caza lo que sobre. **Un miembro de una organización no `APPROVED` no es miembro activo** (`0069`).
- **Fase B (`REG-05` → `06` → `07`)**: el paso no se guarda; solo el ADMIN `REGISTERED`. **La frase no sale nunca del navegador.**
- **El `localhost` del PO ejecuta la carpeta raíz contra producción** (§3.8): migración aditiva primero, cliente después.
- **La importación manual**: solo `ACTIVE` de una `APPROVED`; 20.000 filas por subida. El correo admite `.xlsx` de hasta 120.000 filas.
- **La CD despliega cuatro funciones sin JWT**: `access-request`, `register-organization`, `accept-invitation` e `ingest-email`.
- **Lo que no es del contrato de una tarea va a `*.fuera-de-contrato.test.tsx`** (`F-251`). Series de medición con **n = 5** (`F-225`).

## 5 · Bloqueos y deuda abierta

| | Qué | Quién lo quita |
|---|---|---|
| 🟡 | **`F-067`** · la semilla de demo va en el JS de producción | PO (disparador en `BACKLOG-V1.md`) |
| 🟡 | **`F-281`** · los sufijos de fabricante (2RS/DDU/LLU, 2Z/ZZ) no se reconocen como equivalentes; la lista previa deja elegir entre variantes | PO (definiciones) |
| 🟡 | **`F-278`** · paradas de la instancia Free de e2e (hasta 56 s); mitigado para los pushes de solo docs, no para los de código | PO (§3.2, opción c) si vuelve a caer un run con código |
| 🟡 | **Borrado a 30 días de S3** sin ver ejecutarse | Mirar ~12-nov |
| 🟡 | **`F-280`** · la propia organización solo se bloquea en la interfaz, no en la base | PO |

## 6 · Lo que este fichero NO sabe

- **Cuánto cuesta VERA por pregunta en uso real**: una sola pregunta medida (≈ 0,014 $ con caché caliente, dos llamadas). `vera_usage` ya lo registra; hacen falta más preguntas y más usuarios.
- **Si el cupo de 150 llamadas/hora molesta a un usuario de verdad**: nadie se ha acercado; una pregunta gasta de 1 a 7 llamadas.
- **Si VERA contesta igual de bien con usuarios reales**, mantiene el idioma en conversaciones largas (`F-264`) y acierta el control de B2 con peticiones ambiguas.
- **Por qué el lote de 50 dispersa tanto (6–39 s)**: la traza lo pone en paradas de la instancia, pero solo hay una corrida trazada limpia; 4 de las 6 del A/B coincidieron con la CI. No se ha medido en producción.
- **Por qué la suite local de la mañana dejó 9 búsquedas colgadas en «Buscando...»** en `bearingworld-e2e` mientras la CI salía verde: no se investigó más allá de los logs (paradas de 4–9 s, `F-259`).
- **Por qué la suite e2e local tardó 2,4 h** contra `bearingworld-e2e` (la CI, ~8 min) y si la paridad de `0061`–`0064` (`F-277`) estabiliza la instancia: sin medir. **De dónde salen las paradas de `F-278`**: el disco no (balance 99 %) ni nuestra carga; si Micro las quita, solo se sabe probándolo.
- **Qué ve el EDITOR `REGISTERED` al entrar** (`F-260`), y **si Inventario adopta bien el filtro que deja VERA**: nadie lo ha mirado en un navegador.
- **Por qué una pantalla del arnés con C1–C4 en verde no pasa C5** (`F-261`).
- **Si la pantalla de subida enseña el motivo del tope de 500.000 líneas**: la base lo da; la pantalla, sin comprobar.
- **Cuánto se gana con `0047`/`0051`/`0062`** con volumen, y cómo se comporta la búsqueda cruzada con volumen real en Supabase.
- **Si Argon2id (64 MiB) entra en un móvil modesto**: en un escritorio tarda ~400 ms y no bloquea; en un móvil, sin medir.
- **Si el umbral de zxcvbn (≥ 3) basta** contra un ataque offline al blob: es juicio, no medida.
- **Cómo se ve la pantalla de suspensión con una cuenta real**: nadie ha suspendido una organización real; la base ya la corta (`0069`), la pantalla solo se evalúa al cargar la sesión.
- **Si `billing_confirm_payment`, `billing_suspend_organization` y los verbos de `watcher_*` funcionan desde la pantalla con un cliente real.**
- **Cómo se ve en un navegador el diálogo de favoritos, el botón de la ficha y «Mis favoritos»**: el PO aún no los ha visto; solo hay pruebas de comportamiento, ninguna comprobación de diseño.
- **Si los favoritos de un miembro revocado siguen sumando al recuento**: deducido del código (`remove_member` solo cambia el estado), no probado.
- **Qué permisos tiene la clave de AWS de `ingest-email`**, si el MFA y el SSO de AWS están bien, y si un cliente real puede enviar sin DMARC ni DKIM (`F-252`).

---

*Cierre del Día 49 · 27-oct-2026 · Dirección Técnica, Nortex Systems*
