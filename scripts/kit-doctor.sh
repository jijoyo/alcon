#!/usr/bin/env bash
# kit-doctor.sh — chequeo profundo del kit bajo demanda (no programado).
# Uso: kit-doctor.sh <repo>  → PASS/FAIL por chequeo, exit 1 si algo falla.
set -uo pipefail
REPO="${1:?Uso: $0 <repo>}"
REPO="$(realpath "$REPO")"
FAIL=0
ok()  { echo "PASS: $1"; }
na()  { echo "N/A: $1"; }
bad() { echo "FAIL: $1"; FAIL=1; }

# Perfiles: lab (sin git, memoria vía MCP) no debe dar FAILs falsos.
IS_GIT=0; git -C "$REPO" rev-parse --git-dir >/dev/null 2>&1 && IS_GIT=1
HAS_MCP=0; grep -q '"engram"' "$REPO/.opencode/opencode.json" ~/.config/opencode/opencode.json ~/.config/opencode/opencode.jsonc 2>/dev/null && HAS_MCP=1

P="$REPO/.opencode/plugins/engram-autosave/index.js"
if [ -f "$P" ]; then
  ok "plugin existe ($(grep -o 'source-template: [^ ]*' "$P" | head -1 || echo sin-version))"
elif [ "$HAS_MCP" = 1 ]; then
  na "sin plugin (memoria vía MCP, decisión del repo)"
else
  bad "plugin ausente"
fi
# Fuera de git (scratch) se verifica textual en .gitignore, no con git check-ignore.
ignorado() { (cd "$REPO" && git check-ignore -q "$1" 2>/dev/null) || grep -q "$1" "$REPO/.gitignore" 2>/dev/null; }
if [ "$IS_GIT" = 0 ] && [ ! -f "$REPO/.gitignore" ]; then
  na "sin git ni .gitignore (ignores no aplican)"
else
  ignorado ".engram-autosave.state.json" && ok "state gitignorado" || bad "state NO ignorado"
  ignorado "graphify-out" && ok "blobs ignorados" || bad "blobs NO ignorados"
fi
BRAIN="$(ls "$REPO"/docs/ARCHITECTURE.html "$REPO"/ops-brain/ARCHITECTURE.html 2>/dev/null | head -1)"
if [ -n "$BRAIN" ]; then
  grep -q "graphify-out" "$BRAIN" && ok "link tablero→mapa" || bad "link ausente en $(basename "$(dirname "$BRAIN")")/ARCHITECTURE.html"
else
  bad "sin ARCHITECTURE.html (docs/ ni ops-brain/)"
fi
REP="$(ls "$REPO"/graphify-out/GRAPH_REPORT.md 2>/dev/null | head -1)"
if [ -n "$REP" ]; then
  ok "reporte existe"
  if [ "$IS_GIT" = 1 ]; then
    RC="$(grep -o 'Built from commit: `[^`]*`' "$REP" | head -1 || true)"
    HEAD="$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo ?)"
    case "$RC" in *"$HEAD"*) ok "reporte fresco ($HEAD)";; *) bad "reporte obsoleto ($RC vs HEAD $HEAD)";; esac
  else
    na "frescura sin git (manual)"
  fi
else
  bad "sin GRAPH_REPORT.md"
fi
[ -f "$REPO/INDEX.md" ] && ok "INDEX.md (indexador)" || bad "INDEX.md ausente (correr indexador)"
exit $FAIL
