#!/usr/bin/env bash
# kit-proyecto.sh — envoltura fina: indexador primero, repartidor después.
# Uso: kit-proyecto.sh <repo> [opts de disseminate-kit.sh...]
# Fail-fast: si el índice falla, no se reparte.
set -euo pipefail
REPO="${1:?Uso: $0 <repo> [opts...]}"
INDEXER="$HOME/Documentos/indexer/bin/generar-indice.sh"
KITDIR="$(realpath "$(dirname "$0")")"
[ -x "$INDEXER" ] || { echo "Falta indexador: $INDEXER"; exit 1; }
"$INDEXER" "$REPO"
"$KITDIR/disseminate-kit.sh" "$@"
"$KITDIR/kit-doctor.sh" "$REPO" && echo "✓ Kit verde en $(basename "$REPO")."
