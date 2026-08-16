# Fase 1: 8.58MB version from your video
FROM golang:1.22-alpine AS builder
WORKDIR /src
COPY go.mod* ./
RUN go mod init alcon-go 2>/dev/null || true
COPY orchestrator.go .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /app/orchestrator orchestrator.go && ls -lh /app/orchestrator

# distroless vs scratch: distroless trae CA certs para HTTPS (opencode calls)
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=builder /app/orchestrator .
COPY granja.json ./granja.json
# CA certs ya vienen en distroless, no copiar manual
USER nonroot:nonroot
ENTRYPOINT ["./orchestrator"]
# Size: 8.58MB binary + 5MB distroless = ~14MB
