/**
 * Paridad de migraciones (F-277) · la lógica, sin red ni disco.
 *
 * Compara tres listas: los ficheros de `supabase/migrations/` y lo que tienen
 * registrado producción y `bearingworld-e2e` en `supabase_migrations.schema_migrations`.
 * La CLI (`paridad-migraciones.mjs`) trae las listas; aquí solo se comparan, para
 * poder probarlo con listas falsas (`paridad-migraciones.test.mjs`).
 *
 * CÓMO CASA UN FICHERO CON UNA FILA REGISTRADA, comprobado contra el catálogo de las
 * dos bases el 21-oct-2026 (F-146) y no supuesto. `apply_migration` del MCP registra
 * la versión como una marca de tiempo y el nombre como se le pase, así que hay tres
 * formas en uso, a veces en la misma base:
 *
 *   version `0003`            name `threads_and_items`        (producción, 0001–0012)
 *   version `20261020164853`  name `0069_suspension_tambien…` (lo habitual desde septiembre)
 *   version `20261012062333`  name `consulta_duplicada_solo…` (sin número: casa por el resto)
 *
 * Así que el número sale del nombre si lo lleva y, si no, de la versión cuando esta
 * tiene cuatro cifras; y si no hay número en ninguno de los dos, se casa por el resto
 * del nombre. Un número que casa con un fichero de otro nombre se avisa: es otra
 * migración con el mismo número.
 */

const NUMERO = /^(\d{4}[a-z]?)_(.+)$/;

/** `0061_importacion_por_correo.sql` → { numero: '0061', resto: 'importacion_por_correo', id }. */
export function leerFichero(nombre) {
  const sinSql = nombre.replace(/\.sql$/, '');
  const m = NUMERO.exec(sinSql);
  if (!m) return null;
  return { numero: m[1], resto: m[2], id: sinSql };
}

/** Una fila de `schema_migrations` ({ version, name }) → { numero | null, resto, id }. */
export function leerRegistrada({ version, name }) {
  const v = String(version ?? '');
  const n = String(name ?? '');
  const m = NUMERO.exec(n);
  if (m) return { numero: m[1], resto: m[2], id: n, version: v };
  if (/^\d{4}[a-z]?$/.test(v)) return { numero: v, resto: n, id: `${v}_${n}`, version: v };
  return { numero: null, resto: n, id: n, version: v };
}

function casa(fichero, fila) {
  return fila.numero ? fila.numero === fichero.numero : fila.resto === fichero.resto;
}

/**
 * Compara los ficheros con lo registrado en UNA base.
 * Devuelve las discrepancias sin filtrar:
 *   { tipo: 'falta',   base, migracion }  fichero del repo que la base no tiene
 *   { tipo: 'sobra',   base, migracion, version }  registrada sin fichero en el repo
 *   { tipo: 'nombre',  base, migracion, registrada } mismo número, otro nombre
 */
export function compararBase(base, ficheros, registradas) {
  const fs = ficheros.map(leerFichero).filter(Boolean);
  const rs = registradas.map(leerRegistrada);
  const usadas = new Set();
  const out = [];
  for (const f of fs) {
    const i = rs.findIndex((r, k) => !usadas.has(k) && casa(f, r));
    if (i < 0) {
      out.push({ tipo: 'falta', base, migracion: f.id });
      continue;
    }
    usadas.add(i);
    if (rs[i].resto !== f.resto) {
      out.push({ tipo: 'nombre', base, migracion: f.id, registrada: rs[i].id });
    }
  }
  rs.forEach((r, k) => {
    if (!usadas.has(k)) out.push({ tipo: 'sobra', base, migracion: r.id, version: r.version });
  });
  return out;
}

const mismaClave = (a, b) => a.tipo === b.tipo && a.base === b.base && a.migracion === b.migracion;

/**
 * Las excepciones (`supabase/paridad-migraciones.json`) son diferencias conocidas,
 * cada una con su motivo comprobado. Una excepción que ya no casa con ninguna
 * diferencia también es un fallo: si no, la lista crece y tapa lo que no debe.
 */
export function aplicarExcepciones(discrepancias, excepciones) {
  const pendientes = discrepancias.filter((d) => !excepciones.some((e) => mismaClave(d, e)));
  const caducadas = excepciones.filter((e) => !discrepancias.some((d) => mismaClave(d, e)));
  return { pendientes, caducadas };
}

/** Todo junto: { ok, pendientes, caducadas, aceptadas }. */
export function comprobarParidad({ ficheros, bases, excepciones = [] }) {
  const todas = bases.flatMap((b) => compararBase(b.nombre, ficheros, b.registradas));
  const { pendientes, caducadas } = aplicarExcepciones(todas, excepciones);
  return {
    ok: pendientes.length === 0 && caducadas.length === 0,
    pendientes,
    caducadas,
    aceptadas: todas.length - pendientes.length,
  };
}

/** Una línea por problema, en castellano, que diga qué migración y en qué base. */
export function mensajes({ pendientes, caducadas }, refs = {}) {
  const donde = (b) => (refs[b] ? `${b} (${refs[b]})` : b);
  const lineas = pendientes.map((d) => {
    if (d.tipo === 'falta') {
      return `FALTA en ${donde(d.base)}: ${d.migracion}.sql está en supabase/migrations/ y esa base no la tiene registrada. Aplícala por el MCP (apply_migration), revisada; la CI no aplica nada.`;
    }
    if (d.tipo === 'sobra') {
      return `SIN FICHERO en ${donde(d.base)}: «${d.migracion}» (versión ${d.version}) está registrada y no hay fichero que case en supabase/migrations/.`;
    }
    return `NOMBRE DISTINTO en ${donde(d.base)}: el fichero ${d.migracion}.sql casa por número con «${d.registrada}», que es otro nombre.`;
  });
  for (const e of caducadas) {
    lineas.push(`EXCEPCIÓN CADUCADA: {${e.tipo}, ${e.base}, ${e.migracion}} ya no se da. Quítala de supabase/paridad-migraciones.json.`);
  }
  return lineas;
}
