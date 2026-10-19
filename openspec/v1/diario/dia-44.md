# Día 44 · 19-oct-2026

Una sesión, corriente C. Arranque desde el cierre del día 43.

- **Comprobaciones de relevo** (SQL en producción): 5 backups `ACTIVE` con verificador y 1 `CANCELLED` sin él; el cuerpo de
  `replace_key_backup` (`0053`) no cuenta intentos. CI de `1584750` verde, la de `2e5d17f` cancelada (sustituida).
- **`F-268`: las 21 divergencias.** Propuesta en `openspec/v1/propuestas/F-268-divergencias.md`. El PO aprobó todo el 19-oct;
  el idioma de VERA se queda como está (idioma del último mensaje, sin idioma de perfil: se vuelve a mirar con usuarios reales
  y mensajes ambiguos, `F-264` L6). Resultado: 17 aceptadas, 4 corregidas (`a9aeff1`): aviso de más de 50 MB, aviso de 5
  usuarios, y «Datos de hace X días…» / «Stock posiblemente desactualizado…» en la búsqueda a 8 y 31 días. Matriz: 86 CUBIERTO,
  17 DIVERGE aceptadas, 40 NO_IMPLEMENTADO, 35 PARCIAL, 4 SIN_PRUEBA, 3 FUERA.
- **`F-269`:** borrador de `0066_replace_key_backup_cuenta_intentos.sql` en `supabase/propuestas/F-269/`, con el cambio de
  cliente y las pruebas por escribir. Sin aplicar: cambia el tipo de retorno de `void` a tabla y es criptografía. Un `raise`
  revertiría el intento contado, por eso devuelve un estado. El hueco 2 (`begin_key_recovery` sin prueba) pide diseño aparte.
- **CI roja de `f252dbe`** (solo documentos): `watchers.spec.ts:75`, siembra de watchers envejecida en `bearingworld-e2e`.
  Resembrado por el MCP; `67cb2b5` salió verde. Registrado como `F-270`.
- **Entorno:** el worktree no tenía `app/node_modules`; se enlazó con `mklink /J` a la raíz (`CLAUDE.md` §11.1).
- **No se tocó** Vertex ni AWS. No se aplicó nada a producción. Queda sin hacer el borrador del caso a AWS para Sonnet 5.
