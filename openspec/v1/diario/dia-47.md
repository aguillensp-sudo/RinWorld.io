# Día 47 · 22-oct-2026

- **Residencia UE de VERA (entregable 6):** el PO la pone en stand-by indefinido («nadie va a exigir residencia en la EU»). Reflejado en `CLAUDE.md` §3, `ESTADO-V1.md`, `BACKLOG-V1.md` y `DECISIONES-V1.md`; el caso AWS 179223756600857 sigue abierto sin urgencia.
- **Pasada del runner de VERA (`F-279`):** A24, L6 y B7 turno 1 bien; B7 turno 2 falla; D7 (caso nuevo) no ejercita la regla de las tres opciones; D2 propone quitar un filtro. 0,19 $ en total.
- **Cuatro «solo e2e» a mano:** `access-request` real y revocación contra `bearingworld-e2e`, y un correo real de JULSA contra producción (~6 s). La matriz no cambia: son muestras, no pruebas de suite.
- **CI:** `d449e56` salió roja por la siembra de cobros caducada de `bearingworld-e2e` (`admin-billing.spec.ts:85`, `F-094`); resembrada con `demo_billing.sql` y relanzado el job, verde con despliegue.
- **Lo que el PO decidió o dejó a medias:** objetivo «completa los tres pasos sin supervisión» sin cumplir: los dos e2e de suite y el frontend (suyo) siguen sin hacerse. Pidió no repetir respuestas al hook.
