import { zipSync, unzipSync, strToU8, strFromU8, Unzip, UnzipInflate } from 'fflate';
const rows = Number(process.argv[2]);
const brands = ['SKF','FAG','NSK','NTN','INA'];
const parts = ['6205-2RS','6306-2Z','NU2210E','32010X','22211E','51108','7208B','1204'];
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
// xlsx como lo escribe Excel: textos en sharedStrings, números en <v>
const sst = new Map(); const sstList = [];
const si = s => { let i = sst.get(s); if (i === undefined) { i = sstList.length; sst.set(s, i); sstList.push(s); } return i; };
const hdr = ['Referencia','Marca','Cantidad','Pais','Plazo','Notas'];
let sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
sheet += '<row r="1">' + hdr.map((h,c)=>`<c r="${'ABCDEF'[c]}1" t="s"><v>${si(h)}</v></c>`).join('') + '</row>';
for (let i=0;i<rows;i++){ const r=i+2;
  sheet += `<row r="${r}" spans="1:6"><c r="A${r}" t="s"><v>${si(parts[i%8]+'-'+i)}</v></c><c r="B${r}" t="s"><v>${si(brands[i%5])}</v></c><c r="C${r}"><v>${(i%900)+1}</v></c><c r="D${r}" t="s"><v>${si('ES')}</v></c><c r="E${r}"><v>${i%30}</v></c><c r="F${r}" t="s"><v>${si('Prueba de carga numero '+i)}</v></c></row>`; }
sheet += '</sheetData></worksheet>';
const sstXml = '<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + sstList.map(s=>`<si><t>${esc(s)}</t></si>`).join('') + '</sst>';
const zip = zipSync({
 '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
 'xl/worksheets/sheet1.xml': strToU8(sheet), 'xl/sharedStrings.xml': strToU8(sstXml) }, { level: 6 });
import {writeFileSync} from 'node:fs'; writeFileSync('x'+rows+'.xlsx', zip); if (process.argv[3]==='gen') process.exit(0);
const mb = n => (n/1048576).toFixed(1);
console.log(`filas=${rows} · xlsx=${mb(zip.length)} MB · hoja sin comprimir=${mb(sheet.length)} MB · sst=${mb(sstXml.length)} MB`);
function step(name, fn){ global.gc(); const c0=process.cpuUsage(); const out=fn(); const c=process.cpuUsage(c0);
  console.log(`${name.padEnd(26)} cpu ${((c.user+c.system)/1000).toFixed(0).padStart(6)} ms · rss ${mb(process.memoryUsage().rss)} MB`); return out; }
// Lector: descomprime, lee sharedStrings con indexOf, recorre filas con indexOf (sin DOM)
const files = step('unzip (en memoria)', () => unzipSync(zip));
const strings = step('sharedStrings', () => { const x = strFromU8(files['xl/sharedStrings.xml']); const out=[]; let p=0;
  while ((p = x.indexOf('<t', p)) >= 0) { const s = x.indexOf('>', p)+1; const e = x.indexOf('</t>', s); out.push(x.slice(s,e)); p = e; } return out; });
const matrix = step('filas (indexOf)', () => { const x = strFromU8(files['xl/worksheets/sheet1.xml']); const out=[]; let p=0;
  while ((p = x.indexOf('<row', p)) >= 0) { const e = x.indexOf('</row>', p); const row = x.slice(p,e); const cells=[]; let q=0;
    while ((q = row.indexOf('<c ', q)) >= 0) { const ce = row.indexOf('</c>', q); const cell = row.slice(q,ce); const isS = cell.includes(' t="s"');
      const vs = cell.indexOf('<v>')+3; const v = cell.slice(vs, cell.indexOf('</v>')); cells.push(isS ? strings[+v] : v); q = ce; }
    out.push(cells); p = e; } return out; });
console.log(`filas leídas=${matrix.length} · muestra=${JSON.stringify(matrix[matrix.length-1])} · pico rss=${mb(process.memoryUsage().rss)} MB`);
