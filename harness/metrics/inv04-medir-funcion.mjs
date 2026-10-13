// Mide CPU y memoria de lo que hace ingest-email con un adjunto CSV de N filas. Necesita 'npm i postal-mime@2.4.3' junto al guion.
// Uso: node --expose-gc medir.mjs <filas>
import PostalMime from 'postal-mime';
import { pathToFileURL } from 'node:url';

const root = process.argv[3];
const core = await import(pathToFileURL(`${root}/supabase/functions/ingest-email/import-core.ts`).href);
const rows = Number(process.argv[2]);

const brands = ['SKF', 'FAG', 'NSK', 'NTN', 'INA'];
const parts = ['6205-2RS', '6306-2Z', 'NU2210E', '32010X', '22211E', '51108', '7208B', '1204'];
let csv = 'Referencia,Marca,Cantidad,Pais,Plazo,Notas\n';
for (let i = 0; i < rows; i++) {
  csv += `${parts[i % parts.length]}-${i},${brands[i % 5]},${(i % 900) + 1},ES,${i % 30},Prueba de carga numero ${i}\n`;
}
const csvBytes = Buffer.from(csv, 'utf8');
const b64 = csvBytes.toString('base64').replace(/(.{76})/g, '$1\r\n');
const mime =
  'From: a@b.c\r\nTo: x@y.z\r\nSubject: carga\r\nMIME-Version: 1.0\r\n' +
  'Content-Type: multipart/mixed; boundary="B"\r\n\r\n--B\r\nContent-Type: text/plain\r\n\r\nhola\r\n' +
  '--B\r\nContent-Type: text/csv; name="carga.csv"\r\nContent-Disposition: attachment; filename="carga.csv"\r\n' +
  `Content-Transfer-Encoding: base64\r\n\r\n${b64}\r\n--B--\r\n`;
const raw = new Uint8Array(Buffer.from(mime));

const mb = (n) => (n / 1048576).toFixed(0);
function step(name, fn) {
  global.gc();
  const c0 = process.cpuUsage();
  const t0 = performance.now();
  const out = fn();
  return Promise.resolve(out).then((v) => {
    const c = process.cpuUsage(c0);
    console.log(`${name.padEnd(22)} cpu ${((c.user + c.system) / 1000).toFixed(0).padStart(6)} ms · reloj ${(performance.now() - t0).toFixed(0).padStart(6)} ms · rss ${mb(process.memoryUsage().rss)} MB`);
    return v;
  });
}

console.log(`filas=${rows} · csv=${(csvBytes.length / 1048576).toFixed(1)} MB · mime=${(raw.length / 1048576).toFixed(1)} MB`);
const email = await step('PostalMime.parse', () => new PostalMime().parse(raw));
const att = email.attachments[0];
const bytes = new Uint8Array(att.content);
const text = await step('decodeText', () => core.decodeText(bytes.buffer.slice(0)));
const file = await step('parseImportText', () => core.parseImportText('carga.csv', text));
const sig = core.headerSignature(file.headers);
const mapping = ['part_number', 'brand', 'quantity', 'location_country', 'lead_time_days', 'notes'];
const built = await step('buildLines', () => core.buildLines(file, mapping, 'ES'));
await step('JSON.stringify(rpc)', () => JSON.stringify(built.lines));
console.log(`líneas válidas=${built.lines.length} errores=${built.errors.length} · pico rss=${mb(process.memoryUsage().rss)} MB`);
