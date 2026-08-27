#!/bin/bash
set -e
echo "=== FERRARI HEALTH CHECK ==="
echo "--- Router :8080 /v1/models ---"
curl -sf http://100.121.64.26:8080/v1/models | jq '.data[].id' 2>/dev/null || curl -sf http://127.0.0.1:8080/v1/models | jq '.data[].id' 2>/dev/null || echo "FALLO router"
echo "--- Router :8080 /health ---"
curl -sf http://100.121.64.26:8080/health 2>/dev/null || curl -sf http://127.0.0.1:8080/health || echo "health no disponible"
echo "--- Control API :9998 /status ---"
curl -sf http://127.0.0.1:9998/status | jq . 2>/dev/null || echo "Control API no responde"
echo "--- Control API :9998 /api/router/status ---"
curl -sf http://127.0.0.1:9998/api/router/status | jq . 2>/dev/null || echo "Control API router no responde"
pm2 ls
echo "Ferrari: router :8080 único, throttle 0, ctx 131K max, 10 modelos on-demand"
