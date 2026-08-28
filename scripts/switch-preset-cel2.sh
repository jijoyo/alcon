#!/bin/bash
# switch-preset-cel2.sh — Cambia modelo en cel2 según preset
# Uso: ./switch-preset-cel2.sh <lfm-thinking|qwen-1.7b|gemma-1b|gemma-4b>
# Desde forja: ssh -p 8022 u0_a339@100.96.34.100 "bash ~/alcon/scripts/switch-preset-cel2.sh gemma-1b"

PRESET=${1:-lfm-thinking}
INI="$HOME/alcon/server/lib/cel2-presets.ini"

if [ ! -f "$INI" ]; then
  INI="$HOME/models/presets.ini"
fi

MODEL=$(grep -A5 "^\[$PRESET\]" "$INI" | grep "^model=" | cut -d= -f2-)
THREADS=$(grep -A5 "^\[$PRESET\]" "$INI" | grep "^threads=" | cut -d= -f2)
CTX=$(grep -A5 "^\[$PRESET\]" "$INI" | grep "^ctx=" | cut -d= -f2)
PORT=$(grep -A5 "^\[$PRESET\]" "$INI" | grep "^port=" | cut -d= -f2)

if [ -z "$MODEL" ]; then
  echo "Preset no encontrado: $PRESET"
  echo "Disponibles: lfm-thinking, qwen-1.7b, gemma-1b, gemma-4b"
  exit 1
fi

eval MODEL_EXPANDED="$MODEL"

echo "🔄 Cambiando a [$PRESET]"
echo "   Modelo: $MODEL_EXPANDED"
echo "   Threads: $THREADS, Ctx: $CTX, Port: $PORT"

pkill -f "llama-server.*$PORT" 2>/dev/null
sleep 1

nohup ~/llama.cpp/build/bin/llama-server \
  -m "$MODEL_EXPANDED" \
  --host 0.0.0.0 --port "$PORT" \
  --threads "$THREADS" --ctx-size "$CTX" \
  --cache-type-k q4_0 --cache-type-v q4_0 \
  > ~/llama-server.log 2>&1 &

sleep 3
curl -s "http://127.0.0.1:$PORT/health" | head -1 && echo "✅ Servidor en :$PORT con $PRESET"
