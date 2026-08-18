# Alcon Go Orchestrator v4.2

Orchestrator en Go: 8.5MB binario vs 57MB node_modules.

## Compilar

```bash
# Local (Termux/android-arm64)
cd server/go
go build -o granjero orchestrator.go

# Cross-compile para VPS Oracle ARM
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="-s -w" -o granjero orchestrator.go

# Docker (distroless, ~14MB final)
docker build -t alcon-go .
```

## Correr

```bash
# Requiere OPENROUTER_API_KEY para cloud devices (vps, cel)
export OPENROUTER_API_KEY=sk-or-v1-...

# Squad default (code-audit)
./granjero

# Squad custom
./granjero --squad quick-review --prompt "revisa server.js"
```

## Reemplazar pm2 alcon-api

```bash
# Detener Node orchestrator
pm2 stop alcon-api
pm2 delete alcon-api

# Iniciar Go orchestrator
cd server/go
pm2 start ./granjero --name alcon-go -- --squad code-audit

# Verificar
pm2 status
pm2 logs alcon-go
```

## Docker

```bash
docker compose up --build -d
docker logs -f alcon-go-fase1
```

## Config

- `granja.json` — devices y squads (mismo formato que Node)
- `OPENROUTER_API_KEY` — required para cloud devices (vps, cel)
- `OPENROUTER_MODEL` — override model (default: xiaomi/mimo-v2.5)
- `ALCON_REPO` — inject repo context into prompts
