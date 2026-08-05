# SP-3 · ¿Propaga Supabase Realtime?

**Material de evaluación, NO código del MVP.** Mide si Supabase Realtime propaga inserts
entre dos sesiones independientes sin refrescar, con latencia < 1 s, sin perder ninguno de
20 inserts seguidos, y si la suscripción se reconecta sola tras cortar el socket.

- Proyecto Supabase: **MVP_RinWorld.io** (`troxminloxkjwihwfevs`, eu-west-1).
- Tabla `spike_messages` (creada por migración `sp3_spike_messages_realtime`) — **se tira al cerrar el spike**.
- `realtime_spike.mjs` — dos clientes supabase-js: suscriptor (anon) + publicador (service).
  Lee `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_KEY` de `process.env`.

## Ejecutar

```powershell
foreach ($n in 'SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_KEY') {
  Set-Item "Env:$n" ([Environment]::GetEnvironmentVariable($n,'User'))
}
npm install
node realtime_spike.mjs
```

## Criterio de éxito (plan Día 1 §4)

- Insert en una sesión → aparece en la otra sin refrescar
- Latencia < 1 s
- Sobrevive a 20 inserts seguidos sin perder ninguno
- La suscripción se reconecta sola tras cortar/restaurar
