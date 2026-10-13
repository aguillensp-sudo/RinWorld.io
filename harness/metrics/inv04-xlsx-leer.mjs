import { unzipSync, strFromU8 } from 'fflate'; import { readFileSync } from 'node:fs';
const f = process.argv[2]; const mb = n => (n/1048576).toFixed(0);
const base = process.memoryUsage().rss; const c0 = process.cpuUsage();
const files = unzipSync(new Uint8Array(readFileSync(f)), { filter: e => e.name.startsWith('xl/') });
const x = strFromU8(files['xl/sharedStrings.xml']); const strings=[]; let p=0;
while ((p = x.indexOf('<t', p)) >= 0) { const s = x.indexOf('>', p)+1; const e = x.indexOf('</t>', s); strings.push(x.slice(s,e)); p = e; }
const y = strFromU8(files['xl/worksheets/sheet1.xml']); let n=0; p=0;
while ((p = y.indexOf('<row', p)) >= 0) { const e = y.indexOf('</row>', p); const row=y.slice(p,e); let q=0; const cells=[];
  while ((q = row.indexOf('<c ', q)) >= 0) { const ce=row.indexOf('</c>',q); const cell=row.slice(q,ce); const vs=cell.indexOf('<v>')+3; const v=cell.slice(vs,cell.indexOf('</v>')); cells.push(cell.includes(' t="s"')?strings[+v]:v); q=ce; } n++; p=e; }
const c = process.cpuUsage(c0);
console.log(`${f}: filas=${n} · cpu ${((c.user+c.system)/1000).toFixed(0)} ms · rss inicial ${mb(base)} MB → pico ${mb(process.memoryUsage().rss)} MB`);
