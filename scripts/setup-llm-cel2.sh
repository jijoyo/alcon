#!/bin/bash
# setup-llm-cel2.sh — Instala llama.cpp + LFM2.5 ToMoE en cel2 (Redmi Note 12S)
# Ejecutar en Termux del cel2 después de SCP el modelo
#
# Uso:
#   1. SCP desde forja: scp models/lfm2.5/LFM2.5-1.2B-Thinking-ToMoE-Q4_K_M.gguf cel2:~/models/
#   2. En cel2: bash setup-llm-cel2.sh
#
# Requisitos: Termux actualizado, internet

set -e

MODEL_DIR="$HOME/models"
MODEL_FILE="LFM2.5-1.2B-Thinking-ToMoE-Q4_K_M.gguf"
MODEL_PATH="$MODEL_DIR/$MODEL_FILE"
LLAMA_DIR="$HOME/llama.cpp"
PORT=8082

echo "🔧 Instalando dependencias..."
pkg update -y && pkg install -y cmake git build-essential curl

echo "📦 Clonando llama.cpp..."
if [ ! -d "$LLAMA_DIR" ]; then
    git clone --depth 1 https://github.com/ggerganov/llama.cpp.git "$LLAMA_DIR"
fi

echo "🔨 Compilando llama.cpp (sin GPU, solo CPU)..."
cd "$LLAMA_DIR"
cmake -B build -DGGML_VULKAN=OFF -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j$(nproc)

echo "✅ Binarios compilados:"
ls -lh build/bin/llama-server build/bin/llama-cli 2>/dev/null || echo "⚠️  Verificar path de binarios"

echo ""
echo "📊 Verificando modelo..."
if [ -f "$MODEL_PATH" ]; then
    echo "  ✅ Modelo encontrado: $MODEL_PATH ($(du -h "$MODEL_PATH" | cut -f1))"
else
    echo "  ❌ Modelo NO encontrado en $MODEL_PATH"
    echo "  Copia desde forja: scp forja:models/lfm2.5/$MODEL_FILE $MODEL_DIR/"
    exit 1
fi

echo ""
echo "🚀 Test rápido (5 tokens)..."
"$LLAMA_DIR/build/bin/llama-cli" \
    -m "$MODEL_PATH" \
    -p "What is 2+2?" \
    -n 5 \
    --threads 2 \
    --no-display-prompt \
    2>&1 | tail -5

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ INSTALACIÓN COMPLETA"
echo "═══════════════════════════════════════════"
echo ""
echo "  Para iniciar servidor:"
echo "    $LLAMA_DIR/build/bin/llama-server \\"
echo "      -m $MODEL_PATH \\"
echo "      --host 0.0.0.0 --port $PORT \\"
echo "      --threads 2 --ctx-size 4096"
echo ""
echo "  Para test rápido:"
echo "    $LLAMA_DIR/build/bin/llama-cli -m $MODEL_PATH -p 'Hello' -n 20 --threads 2"
echo ""
echo "  Benchmark:"
echo "    time $LLAMA_DIR/build/bin/llama-cli -m $MODEL_PATH -p 'Count to 10' -n 50 --threads 2"
echo ""
echo "  Modelo: LFM2.5-1.2B-Thinking-ToMoE-Q4_K_M (Nichonauta)"
echo "  Chipset: MediaTek Helio G96 (2x A76 + 6x A55)"
echo "  Hilos: 2 (solo Cortex-A76 potentes)"
echo "═══════════════════════════════════════════"
