#!/usr/bin/env bash
# Prueba la propuesta de F-192 en el banco, sin tocar `supabase/` ni ninguna base
# remota. Requiere Docker. Dos corridas:
#
#   1 · ANCLA NEGATIVA: stub con las DEFAULT PRIVILEGES de tablas de la plataforma
#       y SIN 0065 → 06_privilegios_asserts.sql tiene que FALLAR (es F-192
#       reproducido en local). Si pasa, el aserto no mide nada.
#   2 · La propuesta entera: stub + 0065 + run.sh completo (smoke, catálogo,
#       frescura) + 06 → todo verde. El smoke ejerce como `authenticated` las
#       escrituras de la app, así que también prueba que 0065 no quita nada usado.
#
# Trabaja sobre una COPIA de supabase/ en un directorio temporal, con contenedor
# y puerto propios para no pisar un `run.sh` que esté corriendo otra sesión.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPA="$(cd "$HERE/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"; docker rm -f bw-f192-neg >/dev/null 2>&1 || true' EXIT

copia() {
  local dst="$1"
  mkdir -p "$dst/supabase"
  cp -r "$SUPA/tests" "$SUPA/migrations" "$SUPA/seed" "$dst/supabase/"
  cat "$HERE/stub_privilegios_de_tablas.sql" >> "$dst/supabase/tests/00_auth_stub.sql"
  cp "$HERE/06_privilegios_asserts.sql" "$dst/supabase/tests/"
}

echo "== 1 · ancla negativa: plataforma sin 0065"
copia "$TMP/neg"
NAME=bw-f192-neg PORT=55434
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres -p "$PORT:5432" postgres:16-alpine >/dev/null
estables=0
for _ in $(seq 1 90); do
  if docker exec -e PGPASSWORD=postgres "$NAME" psql -U postgres -qtAc 'select 1' >/dev/null 2>&1; then
    estables=$((estables + 1)); [ "$estables" -ge 5 ] && break
  else estables=0; fi
  sleep 1
done
run() { docker exec -i -e PGPASSWORD=postgres "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q -f - < "$1"; }
run "$TMP/neg/supabase/tests/00_auth_stub.sql"
for m in "$TMP"/neg/supabase/migrations/*.sql; do run "$m"; done
if salida="$(run "$TMP/neg/supabase/tests/06_privilegios_asserts.sql" 2>&1)"; then
  echo "!! 06 PASÓ sin 0065 y con los privilegios de la plataforma: no mide nada" >&2
  exit 1
fi
echo "   OK · falla como debe:"
echo "$salida" | grep -E "fallo\(s\)" | sed 's/^/   /'
echo "$salida" | grep -E "^\s+[A-F]:" | sed -E 's/^\s+([A-F]):.*/\1/' | sort | uniq -c | sed 's/^/   reglas rotas: /'
docker rm -f "$NAME" >/dev/null

echo "== 2 · la propuesta: stub + 0065 + run.sh entero + 06"
copia "$TMP/pos"
cp "$HERE/0065_privilegios_minimos_en_public.sql" "$TMP/pos/supabase/migrations/"
# Contenedor y puerto propios; 06 justo después del smoke.
sed -i \
  -e 's/^NAME="bw-schema-test"/NAME="bw-f192-pos"/' \
  -e 's/PGPORT_TEST:-55432/PGPORT_TEST:-55435/' \
  -e 's|^run "\$ROOT/supabase/tests/01_schema_smoke.sql"$|&\nrun "$ROOT/supabase/tests/06_privilegios_asserts.sql"|' \
  "$TMP/pos/supabase/tests/run.sh"
grep -q '06_privilegios_asserts' "$TMP/pos/supabase/tests/run.sh" || { echo "!! no se pudo enganchar 06 en run.sh" >&2; exit 1; }
bash "$TMP/pos/supabase/tests/run.sh"
echo
echo "F-192 · PROPUESTA VERDE"
