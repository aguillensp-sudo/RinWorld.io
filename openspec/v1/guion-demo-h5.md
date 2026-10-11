# Guion · Demo H5 — dos empresas negociando de punta a punta

> **Ensayo 2 hecho el 11-oct-2026, sin incidencias (PO).** Se hizo entre **Fulano S.A** (BB, alta real del
> 10-oct) y **Rey Transmisiones**, no con Nakishita: el hilo acabó en `ACUERDO ALCANZADO` a las 08:37 UTC
> (consulta → oferta → contraoferta → aceptada; `thread_items` en producción). **Sin fecha de demo: la
> congelación de §5 no rige** y los datos del ensayo se quedan (`DECISIONES-V1.md`, 11-oct). Si se fija
> fecha, este guion vale con la pareja que se elija; la referencia `6204` SKF sigue siendo solo de Rey.

> Entregable de **D5** de `plan-demo-h5.md` §4. Escrito el 11-oct-2026. Los nombres de los botones
> están copiados de `app/e2e/zz-h5-negociacion.spec.ts`, que los recorre en la CI; el estado de las
> dos empresas, de una consulta a producción del mismo 11-oct (§1). **No se cambia nada del código
> ni de producción a partir de aquí hasta la demo** (§5).

## 1 · Punto de partida (producción, 11-oct 07:45 UTC)

| Qué | Estado |
|---|---|
| **Nakishita Nakamoto Inc.** (JP) · compradora | `APPROVED`. ADMIN `ACTIVE` con clave pública; un EDITOR `REGISTERED` sin clave |
| **Rey Transmisiones** (CU) · vendedora | `APPROVED`. ADMIN `ACTIVE` con clave pública; un EDITOR `REGISTERED` sin clave. 29 líneas `PUBLISHED`, subidas el 10-oct |
| Hilo entre las dos | **No existe.** Lo crea la consulta del paso 2 (`create_inquiry` busca o crea) |
| Referencia de la demo | **`6204` SKF**, 10 uds., CU: solo la tiene Rey, así que el filtro deja **una fila** |

Los dos EDITOR sin clave no bloquean nada (`0056`: la CEK va solo a miembros `ACTIVE` con clave),
pero **no se entra con ellos durante la demo**.

## 2 · Antes de empezar (T−30 min)

1. **Dos navegadores, los mismos donde se generaron las claves**: Nakishita en el A y Rey en el B. La
   privada vive en el IndexedDB de ese navegador (`plan-demo-h5.md` §6). Nada de ventanas privadas.
2. Sesión ya abierta en los dos con el **ADMIN**. Si alguno pide `Desbloquear` (`REC-01`), cada intento
   cuenta: 5 por 30 min y acertar no reinicia (`0052`). Frase a mano antes de teclear.
3. Frescura: este agente (o el PO, en el SQL Editor) corre `select public.demo_reanchor_freshness();`.
   Solo toca las seis de demo, no a Nakishita ni a Rey (`0059`). Si la demo cae después del ~20-oct,
   además `supabase/seed/demo_billing.sql` (Cuscinetti deja de estar `ACTIVE` el 20-oct).
4. **No** correr `npm run demo:reset` ni ningún e2e contra producción (reponen hilos de demo, `F-095`).
5. Zoom del navegador al 100 %, notificaciones del sistema apagadas, la grabación de respaldo a mano (§4).

## 3 · El recorrido (objetivo: ≤ 8 min)

| # | Navegador | Qué se hace | Qué se enseña / se dice | Min. |
|---|---|---|---|---|
| 1 | A · Nakishita | `Comprando` → `Resultados de búsqueda` → `Añadir filtro` → Campo `Ref`, Valor `6204` → `Añadir` | Un comprador japonés encuentra stock de un distribuidor cubano al que no conocía. La fila no enseña precio: va cifrado | 1:00 |
| 1b | A | *(opcional)* preguntar a VERA cómo subir inventario | VERA solo contesta desde su guía verificada; fuera de ella dice que no lo sabe (`F-246`). **No preguntarle por `Visibilidad` ni por otras pantallas** | 0:45 |
| 2 | A | Marcar la casilla de la fila de Rey → `Consultar` | Sale el aviso de consulta enviada. Se abre el hilo entre las dos | 0:30 |
| 3 | B · Rey | `Hilos` → hilo con Nakishita → `Responder con oferta` → `Precio unitario` (p. ej. `12,50`) → `Enviar oferta` | La consulta queda «Respondida con oferta». El precio se cifra en el navegador de Rey | 1:15 |
| 4 | A | `Panel` → hilo con Rey → `Contra-ofertar` → `Precio unitario` `11,80` → `Enviar contraoferta` | La oferta anterior queda «Superada por contraoferta» | 1:00 |
| 5 | B | `Panel` → hilo → **`Ver lo que ve el servidor`** | **El momento de la demo**: el servidor guarda estado y fechas en claro, y precio y cantidad como texto cifrado que no puede leer | 1:00 |
| 6 | B | `Aceptar oferta` (confirma) | El hilo pasa a `ACUERDO ALCANZADO` | 0:30 |
| 7 | A | `Panel` → hilo | Nakishita ve el mismo `ACUERDO ALCANZADO` desde su lado | 0:30 |

**Después del ensayo, el hilo se queda.** Hay un hilo por pareja de empresas (`threads_pair_uniq`), así que
la demo real reutiliza el del ensayo 2. Funciona: `app.derive_thread_state` (leída de `pg_proc` el 11-oct)
no bloquea una consulta nueva en un hilo con acuerdo, solo deriva el estado (consulta pendiente → `CON
CONSULTA PENDIENTE`; aceptada después → `ACUERDO ALCANZADO`). El problema es otro: **el público verá en el
hilo la negociación del ensayo**. Hay dos salidas: (a) se deja así y se cuenta como una negociación
anterior; (b) antes de la demo se borra el hilo Nakishita↔Rey en producción, con SQL y con el visto bueno
del PO, porque es irreversible. **Decide el PO** (§6).

## 4 · Plan B

- **Si falla el alta o la clave de una de las dos** (`plan-demo-h5.md` §6): negociar Nakishita o Rey contra
  una cuenta de prueba (`E2E_ALPHA_*` / `E2E_BETA_*` de `app/.env`) y **no enseñar** el panel del servidor.
- **Si se cae la red o Vercel**: la grabación de respaldo del ensayo 2, con este mismo guion.
- **Si VERA no contesta o contesta algo raro**: se cierra el panel y se sigue. No se improvisa otra pregunta.
- **Lo que no se pulsa nunca**: «Generar nuevas claves» (borra el backup), `Suspender manualmente`
  (no pide confirmación), nada en la cuenta de JULSA.

## 5 · Congelación (desde el final del ensayo 2 hasta la demo)

- **Ni despliegues ni pushes que desplieguen**: cualquier push a `mvp/bootstrap` sin `[skip ci]` dispara el
  *job* `deploy` (`ci.yml`). Los commits de documentación de estos días llevan `[skip ci]`.
- Ni e2e locales contra producción, ni `demo:reset`, ni migraciones.
- Lo único permitido: `demo_reanchor_freshness()` y `demo_billing.sql` el día de la demo.

## 6 · Ensayo 2 — hoja para rellenar

| # | Min. objetivo | Min. real | ¿Incidencia? |
|---|---|---|---|
| 1 | 1:00 | | |
| 1b | 0:45 | | |
| 2 | 0:30 | | |
| 3 | 1:15 | | |
| 4 | 1:00 | | |
| 5 | 1:00 | | |
| 6 | 0:30 | | |
| 7 | 0:30 | | |
| **Total** | **6:30** | | |

Pendiente del PO: fecha de la demo; cómo se rehace la pasada tras el ensayo (§3); si el ensayo 1 dejó
algún arreglo (no se recogió ninguno el 10-oct).
