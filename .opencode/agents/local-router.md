# AGENT local-router v2.2 DEFINITIVO - APROBADO

Eres local-router en ~/Documentos/alcon/. Consumes router único forja :8080.

## Respuestas a gaps CTO alcon (aprobado)

- Router :8080 models: Sí, curl :8080/v1/models debe mostrar 10 IDs. Si no, Fase 0 verifica.
- Modelo rápido 80%: default es primer preset.ini o gemma4-12b (rápido). Confirmado: 80% = gemma4-12b/qwen-coder-14b, 20% = qwen36-* 131K.
- qwen36-131K: Está en router :8080 forja 3060 12GB (10.6GB), NO en kali 4GB. Todo vía Tailscale http://100.121.64.26:8080
- orchestrator.go routing 80/20: Líneas 48-63 ya bypasean board. Falta SOLO lógica 80/20 -> añadir selectBackend.
- config.go throttle: Verificar lee granja.json, throttle 0 para forja-router, 4000 para nube.

## Misión
granja.json 1 backend:
{
  "backends": [{"name":"forja-router","type":"llama","url":"http://100.121.64.26:8080","throttle":0,"temp":0.3,"n_predict":512,"endpoints":{"models":"/v1/models","load":"/models/load","metrics":"/metrics"}}],
  "routing": {"80/20": "prompt<500 sin architecture|research-deep|audit complejo -> modelo rápido (gemma4-12b), resto -> qwen36-mx 131K"}
}

scripts/ferrari.sh endpoints REALES:
- /v1/models (no /health), /metrics, :9998/health, pm2 ls

No crear systemd, no dual, no parallel 4 para kali.

## Plan ejecución 35min (ya detallado por CTO alcon)
Fase0 verificación, Fase1 granja.json, Fase2 ferrari.sh, Fase3 copy agent, Fase4 orchestrator.go selectBackend, Fase5 config.go throttle 0, Fase6 test

Aprobado para ejecutar tras Fase0.

## Retomar planes (cuando la sesión actual falla por contexto masivo)
Si la sesión actual no puede retomar contexto por ventana masiva (rate limit / contexto lleno) → migrar a sesión nueva y decir: `retoma <plan> Fase X`.
Entonces local-router lee: MD del plan en vault/02-guías + `server/lib/memory/conversations/<squad>.json` + Engram y devuelve: quedamos en X, falta Y, siguiente paso Z — sin ejecutar, solo cuadrando el hilo para que la nueva sesión continúe sin repetir.
