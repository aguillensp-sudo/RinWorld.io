// SP-3 · ¿Propaga Supabase Realtime entre dos sesiones sin refrescar?
// Dos clientes supabase-js independientes = dos sesiones. Claves desde env.
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'

const SUPA_URL = process.env.SUPABASE_URL
const ANON = process.env.SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_KEY
if (!SUPA_URL || !ANON || !SERVICE) {
  console.error('Faltan SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_KEY en el entorno.')
  process.exit(1)
}

const N = 20
const thread = 'sp3-' + Date.now()

// Suscriptor: cliente ANON (como un cliente real del navegador)
const sub = createClient(SUPA_URL, ANON, { realtime: { params: { eventsPerSecond: 50 } } })
// Publicador: cliente SERVICE (inserta filas, sesión distinta)
const pub = createClient(SUPA_URL, SERVICE)

const recvAt = new Map()  // body -> t_recepcion (ms)
const sentAt = new Map()  // body -> t_envio (ms)

const channel = sub.channel('sp3-' + thread).on(
  'postgres_changes',
  { event: 'INSERT', schema: 'public', table: 'spike_messages', filter: `thread_id=eq.${thread}` },
  (payload) => { recvAt.set(payload.new.body, performance.now()) },
)

function waitSubscribed(ch, ms = 15000) {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('timeout suscripción')), ms)
    ch.subscribe((status) => {
      console.log('  [sub] estado:', status)
      if (status === 'SUBSCRIBED') { clearTimeout(to); resolve() }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(to); reject(new Error(status)) }
    })
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

console.log(`Thread: ${thread}`)
await waitSubscribed(channel)
console.log(`\nSuscrito. Insertando ${N} mensajes (100 ms entre cada uno)...`)

for (let i = 0; i < N; i++) {
  const body = `msg-${i}`
  sentAt.set(body, performance.now())
  const { error } = await pub.from('spike_messages').insert({ thread_id: thread, sender: 'A', body })
  if (error) console.log('  insert error:', error.message)
  await sleep(100)
}

await sleep(3000) // margen para los últimos

const latencies = []
for (const [body, ts] of sentAt) {
  if (body === 'msg-reconnect') continue
  if (recvAt.has(body)) latencies.push(recvAt.get(body) - ts)
}
latencies.sort((a, b) => a - b)
const recvCount = latencies.length
const avg = latencies.length ? latencies.reduce((s, x) => s + x, 0) / latencies.length : 0
const max = latencies[latencies.length - 1] ?? Infinity

console.log(`\n=== RESULTADOS ===`)
console.log(`  recibidos: ${recvCount}/${N}`)
console.log(`  latencia ms  min/avg/max: ${latencies[0]?.toFixed(0)} / ${avg.toFixed(0)} / ${max.toFixed(0)}`)

// Reconexión: cortar el socket, reconectar, insertar 1 más y ver si llega solo
console.log(`\nProbando reconexión (disconnect → connect del socket Realtime)...`)
sub.realtime.disconnect()
await sleep(1500)
sub.realtime.connect()
await sleep(4000) // deja que el canal se rejunte solo
const reBody = 'msg-reconnect'
sentAt.set(reBody, performance.now())
await pub.from('spike_messages').insert({ thread_id: thread, sender: 'A', body: reBody })
await sleep(3000)
const reconnectOk = recvAt.has(reBody)
console.log(`  mensaje tras reconexión recibido solo: ${reconnectOk ? 'SÍ' : 'NO'}`)

const pass = recvCount === N && max < 1000
console.log(`\n=== VEREDICTO SP-3 ===`)
console.log(`  20/20 sin perder: ${recvCount === N ? 'SÍ' : 'NO'}`)
console.log(`  latencia < 1s:    ${max < 1000 ? 'SÍ' : 'NO'} (max ${max.toFixed(0)} ms)`)
console.log(`  reconexión sola:  ${reconnectOk ? 'SÍ' : 'NO'}`)
console.log(`  => ${pass ? 'PASA' : 'REVISAR'}`)

writeFileSync('./sp3_result.json',
  JSON.stringify({ thread, N, recvCount, latencies, avg, max, reconnectOk, pass }, null, 2))

await sub.removeAllChannels()
process.exit(0)
