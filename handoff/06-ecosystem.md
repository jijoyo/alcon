# Ecosistema Kali — Referencia para Alcon

## Proyectos en ~/Documentos/

| Proyecto | Qué es | Relación con Alcon |
|----------|--------|-------------------|
| dose-dash-digital | App médica (Vite+React+shadcn+TS+Capacitor) | Alcon fue creado para coordinar esto |
| alcon | Multi-agent task system + live chat | El proyecto en sí |
| ai-automation-agency | Oracle cloud + n8n automation | Puede servir para workflows |
| opencode-lab | Lab de study/fixes de OpenCode | Referencia de debugging |
| azteca-unlocked | Chromecast + IPTV + smart home | Proyecto separado |
| kodi-mcp-server | MCP server para Kodi | Proyecto separado |

## Herramientas disponibles

### Modelos locales
| Modelo | Backend | Puerto | Notas |
|--------|---------|--------|-------|
| Ollama (3 modelos) | Ollama | 11434 | qwen25-coder-1.5b, gemma4-e2b, gemma4-e4b |
| llama.cpp (6 modelos) | CUDA/Vulkan/CPU | 8082 | qwen9b, deepseek-lite, ornith, etc. |

### Servicios en VPS Oracle (159.54.143.227)
| Puerto | Servicio | Estado |
|--------|----------|--------|
| :3003 | Alcon server (Fastify+Socket.io) | ✅ Online |
| :5176 | PWA estática Alcon | ✅ Online |
| :8443 | code-server (IDE remoto) | ✅ Online |
| :7438 | Engram server (memoria persistente) | ✅ Online |

### Herramientas MCP
| Herramienta | Para qué |
|-------------|----------|
| Engram | Memoria persistente entre sesiones |
| Supabase | DB + auth + realtime |
| Context7 | Docs actualizadas de librerías |
| Sequential-thinking | Razonamiento paso a paso |

## Infraestructura

### Nodos del enjambre
| Nodo | IP Tailscale | Capacidad |
|------|-------------|-----------|
| Kali (PC) | 100.103.82.104 | Builds, debugging, git |
| Cel (Mimo) | 100.76.111.99 | Testing físico, vite dev, opencode web |
| VPS Oracle | 100.102.63.30 | 24/7 uptime, server, engram |
| Reina Debian | Pendiente | Desarrollo pesado |

### Conectividad
```
Kali ──→ GitHub (repo) ──→ VPS (deploy)
  │                          │
  └── Tailscale ─────────────┘
         │
       Cel (Mimo)
```

### SSH al VPS
- **IP pública:** `ssh -i ~/.ssh/oracle_key ubuntu@159.54.143.227` (funciona cuando Oracle no bloquea)
- **Tailscale:** `ssh ubuntu@100.102.63.30` (requiere auth interactiva)

## Comandos útiles

```bash
# Alcon
cd ~/Documentos/alcon
./deploy.sh                    # Deploy a VPS

# VPS
ssh ubuntu@159.54.143.227
pm2 list                       # Ver procesos
pm2 logs alcon-server          # Logs
pm2 restart alcon-server       # Reiniciar

# Engram
curl http://127.0.0.1:7437/observations?project=alcon  # Ver memorias

# Ollama
ollama list                    # Modelos disponibles
ollama run gemma4-e2b          # Ejecutar modelo
```
