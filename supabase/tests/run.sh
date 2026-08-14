#!/usr/bin/env bash
# Levanta un Postgres desechable, aplica las migraciones y corre las dos fases de
# prueba. No toca el proyecto de Supabase remoto. Requiere Docker.
#
#   Fase 1 · esquema      (base `postgres`)   — el esquema dice "no" donde debe
#   Fase 2 · catálogo     (base `bwcatalog`)  — la siembra del día 3 y la demo
#
# Las dos fases van en bases SEPARADAS a propósito: el smoke test deja sus propias
# organizaciones y líneas de inventario, y los recuentos del catálogo no pueden
# contar con datos ajenos. Mismo contenedor, así que no cuesta nada.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
NAME="bw-schema-test"
PORT="${PGPORT_TEST:-55432}"
IMAGE="postgres:16-alpine"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

echo "· arrancando $IMAGE en :$PORT"
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres \
  -p "$PORT:5432" "$IMAGE" >/dev/null

# ⚠ NO SE ESPERA CON `pg_isready`, Y NO ES CAPRICHO.
#
# La imagen oficial de Postgres arranca DOS veces: durante `initdb` el entrypoint
# levanta un servidor temporal —solo socket local, para crear la base y correr los
# scripts de init—, lo para y lo relanza de verdad. `pg_isready` dice que sí
# durante esa primera ventana, y el `psql` siguiente se encuentra el socket ya
# cerrado:
#
#   psql: error: connection to server on socket ".s.PGSQL.5432" failed:
#         No such file or directory
#
# Que es exactamente como se cayó la CI el 11-ago (F-053). El primer diagnóstico
# fue "runner lento" y era incompleto: no se esperaba poco, se esperaba **la señal
# equivocada**.
#
# Se espera por tanto con una consulta de verdad, y se exige que aguante CINCO
# comprobaciones seguidas: la ventana del reinicio dura menos que eso, así que un
# sí prematuro no sobrevive al bucle.
listo=0
estables=0
for _ in $(seq 1 90); do
  if docker exec -e PGPASSWORD=postgres "$NAME" \
       psql -U postgres -d postgres -qtAc 'select 1' >/dev/null 2>&1; then
    estables=$((estables + 1))
    if [ "$estables" -ge 5 ]; then listo=1; break; fi
  else
    estables=0
  fi
  sleep 1
done

if [ "$listo" -ne 1 ]; then
  {
    echo
    echo "!! Postgres no aceptó conexiones estables en 90s. Esto es lo que se sabe:"
    docker ps -a --filter "name=$NAME" --format '   contenedor: {{.Status}} · {{.Ports}}' || true
    echo "   pg_isready dice:"
    docker exec "$NAME" pg_isready -U postgres || true
    echo "   y una conexión de verdad dice:"
    docker exec -e PGPASSWORD=postgres "$NAME" \
      psql -U postgres -d postgres -qtAc 'select 1' 2>&1 | sed 's/^/   /' || true
    echo "   últimas 40 líneas del log del contenedor:"
    docker logs --tail 40 "$NAME" 2>&1 | sed 's/^/   /' || true
  } >&2
  exit 1
fi

# $1 = fichero · $2 = base de datos (por defecto `postgres`)
run() {
  docker exec -i -e PGPASSWORD=postgres "$NAME" \
    psql -U postgres -d "${2:-postgres}" -v ON_ERROR_STOP=1 -q -f - < "$1"
}

migrate() {
  run "$ROOT/supabase/tests/00_auth_stub.sql" "$1"
  for m in "$ROOT"/supabase/migrations/*.sql; do
    run "$m" "$1"
  done
}

# -----------------------------------------------------------------------------
# Fase 1 · esquema
# -----------------------------------------------------------------------------
echo "· fase 1 · stub de auth y migraciones"
migrate postgres

echo "· fase 1 · smoke test del esquema"
run "$ROOT/supabase/tests/01_schema_smoke.sql"

echo
echo "ESQUEMA VERDE"

# -----------------------------------------------------------------------------
# Fase 2 · catálogo de demo
# -----------------------------------------------------------------------------
echo
echo "· fase 2 · base limpia para el catálogo"
docker exec -e PGPASSWORD=postgres "$NAME" \
  psql -U postgres -d postgres -q -c 'drop database if exists bwcatalog' -c 'create database bwcatalog'
migrate bwcatalog

echo "· fase 2 · fixture y siembra"
run "$ROOT/supabase/tests/02_catalog_fixture.sql" bwcatalog
# Los dos ficheros de siembra se ejecutan TAL CUAL, sin copia intermedia: si el
# test probara una copia, probaría otra cosa que lo que se despliega.
run "$ROOT/supabase/seed/demo_orgs.sql"    bwcatalog
run "$ROOT/supabase/seed/catalog_demo.sql" bwcatalog

echo "· fase 2 · asertos del catálogo"
run "$ROOT/supabase/tests/03_catalog_asserts.sql" bwcatalog

echo "· fase 2 · segunda pasada de la siembra (idempotencia)"
run "$ROOT/supabase/seed/catalog_demo.sql"          bwcatalog
run "$ROOT/supabase/tests/04_catalog_idempotent.sql" bwcatalog

# -----------------------------------------------------------------------------
# Fase 3 · deriva de frescura y re-anclaje (día 12 · F-094)
# -----------------------------------------------------------------------------
# LA SIEMBRA RECIÉN CORRIDA SIEMPRE PASA LOS ASERTOS DE FRESCURA, Y POR ESO NO
# BASTA CON CORRERLOS.
#
# `catalog_demo.sql` usa fechas relativas a `now()`, así que dos líneas más
# arriba el catálogo es perfecto por construcción. El defecto que se llevó por
# delante la columna Antigüedad no está en la siembra: está en el CALENDARIO —
# siete días después de sembrar, 220 de 221 líneas pasaban de 7 días y ningún
# aserto se enteró.
#
# Aquí se envejece el catálogo a propósito para que el defecto exista dentro de
# la prueba, y se comprueban las dos mitades:
#
#   · envejecido y sin re-anclar, `05` tiene que FALLAR — si pasara, el aserto
#     no estaría mirando lo que dice mirar (F-047 · F-058 · F-074);
#   · re-anclado, tiene que pasar.
#
# El negativo y el positivo, en la misma corrida y sobre los mismos datos.
echo
echo "· fase 3 · se envejece el catálogo 9 días (la deriva real del 14-ago)"
docker exec -e PGPASSWORD=postgres "$NAME" psql -U postgres -d bwcatalog -q   -c "update public.inventory_lines set last_upload_at = last_upload_at - interval '9 days'" >/dev/null

echo "· fase 3 · ANCLA NEGATIVA: los asertos de frescura tienen que fallar ahora"
if run "$ROOT/supabase/tests/05_freshness_asserts.sql" bwcatalog >/dev/null 2>&1; then
  echo "!! 05_freshness_asserts.sql PASÓ con el catálogo envejecido 9 días." >&2
  echo "   Ese es justo el estado que se lleva por delante la columna Antigüedad," >&2
  echo "   así que el fichero no está comprobando lo que dice comprobar." >&2
  exit 1
fi
echo "   OK · falla como debe"

echo "· fase 3 · re-anclaje"
run "$ROOT/supabase/seed/reanchor_freshness.sql" bwcatalog

echo "· fase 3 · asertos de frescura"
run "$ROOT/supabase/tests/05_freshness_asserts.sql" bwcatalog

echo
echo "CATALOGO VERDE"
