#!/usr/bin/env bash
# =============================================================================
#  gstack · instalación endurecida para Nortex Systems / bearingworld.io
# =============================================================================
#
#  Aplica la postura dictaminada por la Dirección Técnica el 22-ago-2026:
#  modo solo, commit fijado, todos los interruptores de red apagados,
#  y el navegador fuera del árbol del repositorio E2EE.
#
#  QUÉ HACE ESTE SCRIPT
#    1. Comprueba requisitos (bun, node, git) sin instalar nada.
#    2. Copia de seguridad de ~/.claude/settings.json ANTES de tocar nada.
#    3. Fija el repo en el commit auditado (HEAD separado).
#    4. Ejecuta  ./setup --no-team --no-plan-tune-hooks
#    5. Apaga los cinco interruptores.
#    6. Verifica: hooks a cero, .gitignore de bearingworld intacto,
#       y diff del settings.json antes/después.
#
#  QUÉ NO HACE
#    No instala bun ni node. No ejecuta sudo. No activa el modo equipo.
#    No toca el repositorio de bearingworld.
#
#  DÓNDE SE EJECUTA
#    Git Bash o WSL, desde la raíz del clon de gstack:
#      cd /c/Users/admin/proyectos/Utilidades/Gstack
#      bash gstack-instalacion-endurecida.sh
#
#  Para revertirlo del todo:  bash gstack-instalacion-endurecida.sh --revertir
# =============================================================================

set -uo pipefail

SHA_AUDITADO="85fd9db554ae4aaaa6d356d2daf873121ee85bdd"   # v1.68.3.0, 21-ago-2026
REPO_BW="${REPO_BW:-$HOME/proyectos/Bearing.io/BearingWorld.io}"
SETTINGS="$HOME/.claude/settings.json"
STAMP="$(date +%Y%m%d-%H%M%S)"

rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
ambar() { printf '\033[33m%s\033[0m\n' "$*"; }
titulo(){ printf '\n\033[1m== %s ==\033[0m\n' "$*"; }

# ---------------------------------------------------------------- revertir --
if [[ "${1:-}" == "--revertir" ]]; then
  titulo "Revirtiendo la instalación"
  if [[ -x bin/gstack-settings-hook ]]; then
    for src in gstack-session-update gstack-timeline-stop plan-tune-cathedral \
               auq-error-fallback question-preference question-log; do
      bin/gstack-settings-hook remove-source --source "$src" 2>/dev/null \
        && echo "  quitado: $src"
    done
  fi
  echo
  ambar "Quedan por borrar a mano si quieres limpieza total:"
  echo "  rm -rf ~/.claude/skills/gstack   ~/.gstack"
  echo "  y revisa:  ls ~/.claude/settings.json.bak.*"
  exit 0
fi

# ------------------------------------------------------------- requisitos ---
titulo "1 · Requisitos"
FALTA=0
for cmd in git bun node; do
  if command -v "$cmd" >/dev/null 2>&1; then
    verde "  ✓ $cmd  $("$cmd" --version 2>/dev/null | head -1)"
  else
    rojo  "  ✗ $cmd  NO ENCONTRADO"; FALTA=1
  fi
done
if [[ $FALTA -eq 1 ]]; then
  echo
  rojo "Faltan requisitos. En Windows hacen falta bun Y node (bun tiene un fallo"
  rojo "conocido con el transporte de Playwright; browse cae a node)."
  echo "  bun:  https://bun.sh/     node: https://nodejs.org/"
  exit 1
fi
if [[ ! -f ./setup ]]; then
  rojo "No estás en la raíz del clon de gstack (no existe ./setup)."; exit 1
fi

# ------------------------------------------------------- copia de seguridad -
titulo "2 · Copia de seguridad de la configuración global"
mkdir -p "$HOME/.claude"
if [[ -f "$SETTINGS" ]]; then
  cp "$SETTINGS" "$SETTINGS.nortex-antes.$STAMP"
  verde "  ✓ $SETTINGS.nortex-antes.$STAMP"
else
  echo '{}' > "$SETTINGS.nortex-antes.$STAMP"
  ambar "  · No existía settings.json. Guardado un {} como referencia."
fi

GITIGNORE_BW_ANTES=""
if [[ -f "$REPO_BW/.gitignore" ]]; then
  GITIGNORE_BW_ANTES="$(sha256sum "$REPO_BW/.gitignore" | cut -d' ' -f1)"
  verde "  ✓ huella del .gitignore de bearingworld: ${GITIGNORE_BW_ANTES:0:16}…"
else
  ambar "  · No encuentro $REPO_BW/.gitignore — ajusta REPO_BW si la ruta no es esa."
fi

# ------------------------------------------------------------- fijar commit -
titulo "3 · Fijar el commit auditado"
ACTUAL="$(git rev-parse HEAD)"
if [[ "$ACTUAL" != "$SHA_AUDITADO" ]]; then
  rojo "  El clon está en $ACTUAL"
  rojo "  El commit auditado es $SHA_AUDITADO"
  ambar "  Detente y audita el diff antes de continuar:"
  echo  "     git log --oneline $SHA_AUDITADO..HEAD"
  exit 1
fi
git checkout --detach "$SHA_AUDITADO" >/dev/null 2>&1 \
  && verde "  ✓ HEAD separado en $SHA_AUDITADO (un git pull ahora falla en voz alta)" \
  || { rojo "  ✗ No pude separar HEAD"; exit 1; }

# ------------------------------------------------------------------- setup --
titulo "4 · Instalación en modo solo"
echo "  Ejecutando: ./setup --no-team --no-plan-tune-hooks"
echo "  (--no-team es lo único que quita el hook Stop que se registra sin preguntar)"
echo
export GSTACK_SKIP_FONTS=1     # evita el sudo -n apt-get del setup
if ! ./setup --no-team --no-plan-tune-hooks; then
  rojo "  ✗ setup devolvió error. Revisa la salida de arriba."
  exit 1
fi
verde "  ✓ setup completado"

# ------------------------------------------------------------ interruptores -
titulo "5 · Apagar los cinco interruptores"
GC=""
for c in "$HOME/.claude/skills/gstack/bin/gstack-config" "./bin/gstack-config"; do
  [[ -x "$c" ]] && { GC="$c"; break; }
done
if [[ -z "$GC" ]]; then
  rojo "  ✗ No encuentro gstack-config. Apágalos a mano (ver README de este script)."
else
  for kv in "auto_upgrade false" "update_check false" "pair_agent off" \
            "telemetry off" "artifacts_sync_mode off"; do
    # shellcheck disable=SC2086
    "$GC" set $kv >/dev/null 2>&1 && verde "  ✓ $kv" || rojo "  ✗ $kv"
  done
fi

# ------------------------------------------------------------ verificación --
titulo "6 · Verificación"

echo "6.1 · Hooks registrados en la configuración global (debe salir vacío)"
HOOKS=""
if [[ -x "$HOME/.claude/skills/gstack/bin/gstack-settings-hook" ]]; then
  HOOKS="$("$HOME/.claude/skills/gstack/bin/gstack-settings-hook" list-sources 2>/dev/null)"
elif [[ -x ./bin/gstack-settings-hook ]]; then
  HOOKS="$(./bin/gstack-settings-hook list-sources 2>/dev/null)"
fi
if [[ -z "${HOOKS// /}" ]]; then
  verde "  ✓ ningún hook de gstack registrado"
else
  rojo  "  ✗ QUEDAN HOOKS REGISTRADOS:"
  echo "$HOOKS" | sed 's/^/      /'
  ambar "    Quítalos uno a uno:  gstack-settings-hook remove-source --source <nombre>"
fi

echo
echo "6.2 · Qué cambió en la configuración global"
if command -v diff >/dev/null 2>&1 && [[ -f "$SETTINGS" ]]; then
  if diff -q "$SETTINGS.nortex-antes.$STAMP" "$SETTINGS" >/dev/null 2>&1; then
    verde "  ✓ settings.json sin cambios"
  else
    ambar "  · settings.json cambió. Diff:"
    diff -u "$SETTINGS.nortex-antes.$STAMP" "$SETTINGS" | sed 's/^/      /' | head -40
  fi
fi

echo
echo "6.3 · El repositorio de bearingworld sigue intacto"
if [[ -n "$GITIGNORE_BW_ANTES" ]]; then
  AHORA="$(sha256sum "$REPO_BW/.gitignore" | cut -d' ' -f1)"
  if [[ "$AHORA" == "$GITIGNORE_BW_ANTES" ]]; then
    verde "  ✓ .gitignore de bearingworld sin tocar"
  else
    rojo "  ✗ EL .GITIGNORE DE BEARINGWORLD HA CAMBIADO. Revísalo:"
    echo "      cd $REPO_BW && git diff .gitignore"
  fi
fi
if [[ -d "$REPO_BW/.gstack" ]]; then
  rojo "  ✗ HAY UN .gstack DENTRO DEL REPO E2EE. Puede contener cookies en claro."
  echo "      Bórralo:  rm -rf '$REPO_BW/.gstack'"
else
  verde "  ✓ no hay .gstack dentro del repo de bearingworld"
fi

echo
echo "6.4 · Configuración efectiva"
[[ -n "$GC" ]] && "$GC" list 2>/dev/null | sed 's/^/      /'

# --------------------------------------------------------------- resumen ----
titulo "Listo"
cat <<'FIN'
  Skills autorizadas para bearingworld.io:
      /review        sobre corriente A (esquema, cripto, capa de datos)
      /guard         para congelar el módulo criptográfico
      /spec          para los 182 escenarios
      /investigate   causa raíz antes del arreglo

  PROHIBIDAS en este proyecto:
      ./setup --team          gstack-team-init required
      /pair-agent             la extensión de Chrome
      browse dentro del repo  /setup-gbrain  /design-html  las de iOS

  DISCIPLINA DE COSTE
      /review sobre cambios de esquema, criptografía y capa de datos.
      NO sobre cada pantalla — una invocación puede rondar los 15 M de tokens.

  REVISIÓN PERIÓDICA
      bin/gstack-egress          registro de todas las salidas de red
      cd <repo bearingworld> && git status --ignored | grep -E '\.gstack|\.claude'
FIN
