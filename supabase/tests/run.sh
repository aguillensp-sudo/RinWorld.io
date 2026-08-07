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

for _ in $(seq 1 60); do
  if docker exec "$NAME" pg_isready -U postgres -q; then break; fi
  sleep 1
done
docker exec "$NAME" pg_isready -U postgres -q

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

echo
echo "CATALOGO VERDE"
