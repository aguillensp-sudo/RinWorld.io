# Día 30 de V1

**Día 30 de V1 · 6-oct-2026 · Estado: CERRADO.** Fecha de máquina: `2026-10-06 13:02 UTC` al arrancar, `14:28 UTC` al cerrar. Orden del PO:
«vamos a por las pantallas REG… procede a generar la REG-05, que debe ser la primera del grupo de 3».

> **EL DÍA EN CINCO LÍNEAS.**
>
> 1. **`REG-05` construida** (decimonovena pantalla, primera de la Fase B). Es explicativa: sin datos, sin red y sin criptografía, así que la
>    construye el Coder sin romper el Plan §4.3. La ve un ADMIN `REGISTERED`, dentro del shell; su botón lleva a un marcador de `REG-06`.
> 2. **La lista previa destapó `F-234`:** con las 18 303 líneas que el PO importó a las 11:34, `INV-01` no cargaba en producción (6–11 s y 500 por
>    el `statement_timeout`). Arreglado con **`0047`**: las políticas de `inventory_lines` evalúan sus funciones una vez por consulta (494 → 33 ms).
> 3. **Corrida 01 anulada** (regla 3): C2 agotó los 900 s por `F-234` y C4 dio un rojo falso por la palabra «importante» (**`F-236`**, arreglado).
>    Antes, un arranque murió sin coste por falta de `inputs.spec` (**`F-235`**).
> 4. **Corrida 02: VERDE en el intento 2** (0,049 $). El intento 1 solo cayó por un e2e ajeno (`ADMIN-02`, `F-225`).
> 5. **Revisión a mano: +7/−2** (indicador de pasos amontonado e icono de paso hecho). C5, del PO.

## La pantalla

`REG-05` no tenía spec en Markdown, solo HTML y PDF. Se escribió `openspec/v1/REG-05_spec.md` juntando la funcional (§3.3.2) y el HTML, con el
precedente de `LOGIN-01_spec.md`; manda el HTML (`F-170`): título, textos y botón son los suyos y no hay enlace «¿Cómo funciona esto?».

Wiring a mano en `App.tsx`: ADMIN + `REGISTERED` → `AppShell` con VERA `Asistente de registro` y `KeysIntro`; su botón cambia un estado local a
`passphrase` y pinta `BackupPassphrase` (marcador de `REG-06`). El paso no se guarda: al recargar se vuelve a `REG-05`, que no escribe nada.
Un usuario de `FRU` también nace `REGISTERED`, pero no entra: los pasos que pinta la pantalla no son los suyos (`F-217` sigue abierto).

Contrato: 17 de unidad, 1 de CSS y 6 e2e. Comprobado contra una referencia desechable (18 + 6 verdes). La prueba de scroll e2e se reescribió al
verla débil: `scrollIntoViewIfNeeded` desplaza también un `overflow: hidden`; con la rueda falla si se quita el scroll (comprobado).

## `F-234`, o la pregunta de las 20 000 filas

El relevo tenía abierta «cómo se comporta con 20 000 filas». Respuesta: la importación bien, la lectura no. Las políticas llamaban a
`app.current_org_id()` y `app.is_active_member()` —`SECURITY DEFINER`, no inlinables— por cada fila. Medido antes de tocar (transacción
deshecha), banco de esquema en verde, aplicada por el MCP y comprobada en `pg_policies`. `inventory.spec.ts`: de 0 a 13 de 16. Los 3 restantes
fallan por el dato (suponen ~15 líneas de demo en ALPHA) y siguen excusados en la tarea. Las demás tablas con el mismo patrón están sin revisar.

## Lo que costó

| Corrida | Intentos | Coste | Resultado |
|---|---|---|---|
| (arranque) | 0 | 0 $ | `KeyError: 'spec'` antes de llamar al modelo (`F-235`) |
| 01 | 2 | 0,096 $ | ANULADA: parada a mano en los checks del intento 2. El intento 2 no dejó JSON; filas con los números del log |
| 02 | 2 | 0,049 $ | VERDE |

En la corrida 01 el Coder esquivó el check roto escribiendo `impo{'r'}tante`. No llegó a comitearse como código (está en
`harness/metrics/REG-05/corrida-01/` como `.txt`), pero es el dato más interesante del día: un check falso no solo cobra de más, **empuja al
generador a escribir peor**.

## Siembras

`demo_watchers.sql` resembrada (había perdido el `PAUSED`). `npm run demo:reset` antes de cada corrida.
