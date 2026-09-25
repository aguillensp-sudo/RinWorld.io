# Día 21 de V1

**Día 21 de V1 · 21-sep-2026 · Estado: CERRADO.** `F-184` cerrado (ruido de Node heredado por
los workers de Playwright). Tres C5 dadas por el PO en producción sin pulsar nada que
escriba (`ADMIN-02`, `FORO-02`, `FORO-03`), con dos reparos de foro arreglados y
confirmados a ojo por el PO (`F-186`: doble «x» en el buscador, último comentario de un
hilo cortado por falta de scroll propio — tercera vez tras `F-088`/`F-093`, con una
sospecha sin comprobar sobre `Forum.module.css`/`AdminBilling.module.css`). Remedición a
seis pantallas hecha: «Funciona con supervisión», cifras 7 y 8 sin veredicto. Cuatro
fallos propios de la sesión, dichos y corregidos; `F-187` (errata del relevo del Día 20).
`F-188` abierto: el desarrollo local apunta a producción, no al staging que decía
`entornos.md`. El detalle completo —las siete líneas, las fuentes de §1 y las decisiones
vivas— vive en `git show 3921781:openspec/v1/ESTADO-V1.md`, no se repite aquí.


---

## Lo comprobado ese día (antes en §1 de ESTADO-V1, 21-sep)

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-09-21`, 09:36 UTC al cerrar |
| Que `F-184` viene de `NO_COLOR` heredado por los workers de Playwright | Playwright mínimo en el scratchpad con tres entornos, y lectura de `runner/index.js` (`FORCE_COLOR: "1"` fijo en `WorkerHost` y en el `webServer`) | Con `NO_COLOR`: 4 avisos con 3 tests fallando, con y sin `FORCE_COLOR=0`. Sin `NO_COLOR`: 0 |
| Que el arreglo quita el ruido en el flujo real | `harness.graph.nodes.test_runner.run_cmd`, antes (entorno viejo inyectado) y después | 8 líneas de ruido a **0** (84 a 68 líneas totales) |
| Que el arnés sigue entero | `python -m harness.tests.test_checks` | exit 0, «Todas en verde» — tres veces: tras el arreglo, tras las filas de C5 y al cerrar la remedición |
| Que la app sigue entera tras `F-186` | `npx vitest run` y `npm run typecheck` | **954 pasan**, 23 saltados; typecheck limpio |
| **Que las dos pruebas de CSS nuevas vigilan algo** | El mismo regex contra el CSS de `HEAD` anterior | El bloque `.page` de `FORO-02`/`FORO-03` no traía `overflow-y`, y `SearchField` no traía la regla. **La primera versión del regex fallaba también CON el arreglo** (un comentario precede a `.page` en los dos ficheros) **y mi comprobación «contra el anterior» daba fallo por el motivo equivocado**; se corrigió el regex y se repitió |
| Que producción sirve el arreglo | Descarga del CSS desplegado y `grep` de `webkit-search-cancel-button` | 1 coincidencia en `/assets/index-M_JsV-S-.css` — por contenido, no por `HTTP 200` (`F-168`) |
| La CI | `gh run view` job a job sobre `9850b89` y `c26ad66` | Los **seis jobs** en verde en los dos, incluidos los dos despliegues. La del commit de cierre se mira tras el push |
| Que la base no se movió durante las C5 | SQL por el MCP, al cerrar | 3 pagos, 2 eventos de estado, 3 solicitudes (todas `PENDING_REVIEW`), 8 hilos, 20 publicaciones, 5 reacciones, 8 organizaciones: **la siembra** |
| El estado de la siembra de cobros antes de la C5 | SQL sobre `billing_org_status` | Los cuatro estados; **Cuscinetti a 9 días: vence el 30-sep** y entonces cambia de estado |
| Que el Operador podía entrar | SQL sobre `auth.users` y `platform_operators` | Confirmado, sin bloqueo ni borrado, en `platform_operators`, último acceso 20-sep 18:21 UTC. Lo que el PO veía era `Solicitudes` (3 pendientes) y no `Cobros` |
| Que `npm run dev` apunta a producción | `app/.env`, solo el ref y no la clave | `troxminloxkjwihwfevs` (`F-188`) |
| **Las tres C5** | El PO, en el chat | `ADMIN-02` «aprobada total»; `FORO-02` y `FORO-03` aprobadas; el arreglo de `F-186`, «perfecto, arreglado» |
| **Las ocho cifras a seis pantallas** | `harness-metrics.csv`; `git` (líneas tocadas desde el commit del Coder); `orchestration-metrics.csv` refrescado con el medidor | `FORO-02` 14,5 % (+16/−77 de 641), `FORO-03` 0,8 % (+6/−0 de 752), `ADMIN-02` 0 % (de 1 594). Cifra 7: techo de `ADMIN-02` 190,50 $ en tres sesiones, sin mediana válida |
| Que `F-161`/`F-162` NO cuentan las escaladas por el instrumento para la cifra 2 | Las filas del registro y las notas del CSV | Lo dicen las dos. **El relevo del Día 20 decía lo contrario** (`F-187`) |
| **Que el resultado visual de `F-186` es el bueno** | **No lo he verificado yo**: solo tests, y que el CSS llega a producción | Lo confirmó el PO a ojo en su localhost |
