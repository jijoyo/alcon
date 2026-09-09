#!/usr/bin/env bash
# disseminate-kit.sh — reparte el kit (plugin autosave + gitignore + link + bisturí)
# Uso: disseminate-kit.sh <repo> [--graph-dir DIR] [--brain FILE] [--no-graphify]
# Idempotente: re-ejecutable sin duplicar. JAMÁS contra alcon (ahí se canoniza).
set -euo pipefail

KIT_VERSION="v1.2"
CANON_DIR="$(realpath "$(dirname "$0")/..")"
CANON_PLUGIN="$CANON_DIR/.opencode/plugins/engram-autosave/index.js"
REPO="${1:?Uso: $0 <repo> [--graph-dir DIR] [--brain FILE] [--no-graphify]}"
shift || true
GRAPH_DIR="docs"
BRAIN=""
NO_GRAPHIFY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --graph-dir) GRAPH_DIR="$2"; shift 2;;
    --brain) BRAIN="$2"; shift 2;;
    --no-graphify) NO_GRAPHIFY=1; shift;;
    *) echo "Flag desconocida: $1"; exit 1;;
  esac
done
REPO="$(realpath "$REPO")"
[ -z "$BRAIN" ] && BRAIN="$GRAPH_DIR/ARCHITECTURE.html"
[ "$REPO" = "$CANON_DIR" ] && { echo "REHUSADO: alcon es canon, no destino (REGLA 13)."; exit 1; }
[ -d "$REPO/.opencode" ] || { echo "Sin .opencode en $REPO, no es proyecto opencode."; exit 1; }
[ -f "$CANON_PLUGIN" ] || { echo "Falta canon: $CANON_PLUGIN"; exit 1; }

NAME="$(basename "$REPO")"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/disseminate-backup/$NAME-$TS"
mkdir -p "$BACKUP"
echo "== Kit $KIT_VERSION → $NAME =="

# Pre-estado
PRE="ausente"
[ -f "$REPO/.opencode/plugins/engram-autosave.js" ] && PRE="$(grep -o 'source-template: [^ ]* [^ ]* ([^)]*)' "$REPO/.opencode/plugins/engram-autosave.js" | head -1 || echo 'sin-version')"
echo "Pre: plugin $PRE"

# Respaldo
tar -czf "$BACKUP/pre.tgz" -C "$REPO" .opencode 2>/dev/null || true
[ -f "$REPO/$BRAIN" ] && cp "$REPO/$BRAIN" "$BACKUP/" || true
[ -f "$REPO/.gitignore" ] && cp "$REPO/.gitignore" "$BACKUP/gitignore" || true
echo "Respaldo: $BACKUP"

# Plugin como package-dir (igual que lazy-load: solo los dirs cargan siempre).
# Skip si misma versión.
PKGDIR="$REPO/.opencode/plugins/engram-autosave"
DEST="$PKGDIR/index.js"
mkdir -p "$PKGDIR"
if grep -q "source-template: $KIT_VERSION desde alcon" "$DEST" 2>/dev/null; then
  echo "Plugin: ya en $KIT_VERSION, skip."
else
  { echo "// source-template: $KIT_VERSION desde alcon ($(date +%Y-%m-%d)) — canon: alcon/.opencode/plugins/engram-autosave/index.js"; cat "$CANON_PLUGIN"; } > "$DEST.tmp" && mv "$DEST.tmp" "$DEST"
  # Descriptor completo: sin name+main el resolvedor traga el plugin en silencio (#34742).
  [ -f "$PKGDIR/package.json" ] && grep -q '"main"' "$PKGDIR/package.json" || cat > "$PKGDIR/package.json" <<'EOF'
{
  "name": "opencode-engram-autosave",
  "version": "1.2.0",
  "description": "Checkpoint factual automatico en Engram (session.idle con freno doble)",
  "main": "index.js",
  "type": "module",
  "keywords": ["opencode-plugin", "memory", "engram"],
  "author": "jijoyo",
  "license": "MIT"
}
EOF
  echo "Plugin: instalado $KIT_VERSION (package-dir)."
fi

# Gitignore (guardas idempotentes)
GI="$REPO/.gitignore"
touch "$GI"
grep -q "engram-autosave.state.json" "$GI" || echo ".opencode/plugins/.engram-autosave.state.json" >> "$GI"
if ! grep -q "graphify-out/\*" "$GI"; then
  { echo ""; echo "# Kit $KIT_VERSION: bisturí regenerable, solo reporte como evidencia"; echo "graphify-out/*"; echo "!graphify-out/GRAPH_REPORT.md"; } >> "$GI"
fi
echo "Gitignore: ok."

# Link tablero→mapa (solo si existe el anchor y no está ya)
ANCHOR='<div class="meta" id="meta">'
if [ -f "$REPO/$BRAIN" ]; then
  if grep -q "graphify-out" "$REPO/$BRAIN"; then
    echo "Link: ya existe, skip."
  elif grep -qF "$ANCHOR" "$REPO/$BRAIN"; then
    LINK="<div class=\"meta\">Mapa de código (bisturí): <a href=\"../graphify-out/graph.html\">graph.html</a> · <a href=\"../graphify-out/GRAPH_REPORT.md\">reporte</a></div>"
    awk -v a="$ANCHOR" -v l="$LINK" '{print} index($0,a){print l}' "$REPO/$BRAIN" > "$REPO/$BRAIN.tmp" && mv "$REPO/$BRAIN.tmp" "$REPO/$BRAIN"
    grep -q "graphify-out" "$REPO/$BRAIN" && echo "Link: insertado y verificado." || { echo "Link: AVISO inserción falló (manual)."; }
  else
    echo "Link: AVISO sin anchor, skip (manual)."
  fi
else
  echo "Link: sin $BRAIN, skip."
fi

# Bisturí
if [ "$NO_GRAPHIFY" = 1 ]; then
  echo "Bisturí: omitido (--no-graphify)."
elif command -v graphify >/dev/null 2>&1; then
  (cd "$REPO" && graphify extract . --code-only --no-label 2>&1 | tail -1)
  (cd "$REPO" && graphify cluster-only . --no-label 2>&1 | tail -1)
else
  echo "Bisturí: AVISO sin graphify en PATH, skip."
fi

# Verificación
node --check "$DEST" && echo "Verify: syntax OK."
grep -q "source-template: $KIT_VERSION" "$DEST" && echo "Verify: versión $KIT_VERSION presente."
echo "Post: respaldo en $BACKUP. Sin commit (commitea el agente del repo)."
