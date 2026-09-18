#!/bin/bash
# decir.sh "texto" — voz oficial Alcon (piper es_MX-claude-high, CPU/RAM, $0)
echo "$1" | python3 -m piper -m ~/piper/voz2.onnx -f /tmp/decir.wav 2>/dev/null && aplay /tmp/decir.wav 2>/dev/null
