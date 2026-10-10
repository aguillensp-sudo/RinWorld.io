# Día 36 · 10-oct-2026

D4 del microplan: alta real de dos empresas, catálogo de la vendedora, ensayo 1, cobros y frescura. Cerrado al final del día.

## D4
- Alta de las dos empresas por el recorrido completo, hecha por el PO a mano: Nakishita Nakamoto Inc. (JP) y Rey Transmisiones (CU). Las dos `APPROVED`, ADMIN `ACTIVE` con clave pública y
  backup, y un EDITOR `REGISTERED` cada una. Rey Transmisiones subió 29 líneas por `INV-02`/`INV-03`; Nakishita, ninguna. Ensayo 1 hecho y aprobado por el PO.
- `contact@nortexsys.com` daba «ya pertenece a otra organización»: era un miembro `CANCELLED` de JULSA y un usuario de acceso de una prueba anterior. El PO usó otros correos.
- País de Rey Transmisiones (solicitud `ZW`, organización `CU`): el PO lo cambió a mano en `REG-01`. No era un fallo.
- Cobros resembrados con `demo_billing.sql` (ocho organizaciones; Cuscinetti `ACTIVE`, vence 20-oct).
- Frescura: `demo_reanchor_freshness()` no valía con una empresa real (`F-247`, `0059`). Re-anclado: 221 líneas movidas 4 d 5 h; 113 de 187 publicadas bajan de 7 días.

## Código
- `INV-04` fase 1 (`0057`): tablas `ingest_*`, RLS solo ADMIN, RPC de dirección y remitentes, purga. Banco de esquema (5 bloques). Aplicada a producción y a `bearingworld-e2e`.
- `DIR-02` (`0058`): nombre de la persona administradora en la ficha, por `organization_admin_name`. Spec `organization-directory` enmendada. `DIR-01` se queda con los países que hay.
- Siembra de una séptima organización sin hilo (`demo_org_sin_hilo.sql`). Primero la puse en `demo_orgs.sql` y rompió el banco del catálogo (exige inventario a todas): CI roja de `34551fe`. Movida.
- `Contactar` en `SRCH-01`/`SRCH-02`: primero a la ficha (opción A, mal), luego como pide la spec: con hilo abre el hilo, sin hilo la ficha con «Primer mensaje» abierto. Spec `conversational-search` enmendada.
- VERA (`F-246`): prompt sin descripciones de interfaz inventadas; dos afirmaciones caducadas («solo cinco pantallas») corregidas; guía verificada de la subida de inventario con test que exige
  que cada nombre exista en el código. El PO comprobó que contesta cómo subir inventario; sobre `Visibilidad` dice que no conoce los controles (esperado: no está en la guía).
- Tipografía de cabeceras del shell: título 28, eyebrow 14, subtítulo 14 (`--bw-size-subtitle`); onboarding aparte. 58 declaraciones fijadas en `cabeceras.test.ts`; contratos de `INV-02`/`INV-03` actualizados.
- Padding de pantalla único 24/28/40 (`--bw-screen-pad`) en 20 pantallas; `MSG-02` a su manera. Contenido a la izquierda en `INV-01/02/03`, `INVT-01` y `SET-SEC-01`. `padding.test.ts`.
- e2e `search-contactar.spec.ts` (solo lectura, 3 casos) y reseteo de demo que repone los hilos que falten (`F-248`): la CI cancelada dejó a `bearingworld-e2e` sin el hilo Alpha–Beta.

## Lecciones
- Una afirmación sobre la interfaz es un dato como otro: si no está comprobada contra la pantalla, VERA no la dice. La guía solo vale con el test que ata cada nombre al código.
- Un helper de demo escrito cuando solo había siembra se rompe en cuanto hay datos reales (`F-247`). Lo mismo valió para `demo_orgs.sql` y el banco del catálogo.
- `cancel-in-progress` + un test que borra y repone estado compartido = base rota entre corridas (`F-248`). Correr el banco y `vitest` entero antes de empujar habría evitado `34551fe` en rojo.
- Mi interpretación de la opción A para `Contactar` no se contrastó con la spec; el PO tuvo que pedirlo.
