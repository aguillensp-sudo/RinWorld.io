#!/usr/bin/env bash
# Levanta un Postgres desechable, aplica las migraciones y corre el smoke test.
# No toca el proyecto de Supabase remoto. Requiere Docker.
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

run() {
  docker exec -i -e PGPASSWORD=postgres "$NAME" \
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f - < "$1"
}

echo "· stub de auth"
run "$ROOT/supabase/tests/00_auth_stub.sql"

for m in "$ROOT"/supabase/migrations/*.sql; do
  echo "· migración $(basename "$m")"
  run "$m"
done

echo "· smoke test"
run "$ROOT/supabase/tests/01_schema_smoke.sql"

echo
echo "ESQUEMA VERDE"
