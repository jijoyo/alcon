# Plan de Migración: Kali Linux → Debian 13 (Trixie)

**Fecha:** 2026-07-26
**Objetivo:** Migrar entorno de desarrollo completo (toolchain, proyectos, configs, MCP, agentes, memoria) de Kali a Debian 13
**Estrategia:** VPS como intermediario + LAN directa para datos pesados
**Estado:** En revisión (Meta)

---

## 1. Estado Actual

### Kali Linux (Origen)
- **OS:** Kali Linux (dual-boot con Windows NTFS)
- **Hardware:** GTX 1050 Ti 4.2GB VRAM, 15GB RAM
- **Toolchain:** opencode v1.17.10, node v22.23.1 (nvm), bun 1.3.14, ollama (servicio fallando), engram MCP, adb, gh CLI
- **GPU:** NVIDIA GTX 1050 Ti, CUDA 12.4, Driver 550.163.01
- **Proyectos:** dose-dash-digital (872MB), alcon (209MB), opencode-lab (5.2GB), otros menores. Total ~11.5GB
- **Memoria:** engram MCP + memory.jsonl (27 entidades) + memos/MEMORY.md
- **Problema conocido:** Servicio ollama en crash loop (exit 203/EXEC)

### Debian 13 (Destino)
- **OS:** Debian 13 (trixie) — YA INSTALADO Y CORRIENDO
- **Opencode:** YA INSTALADO Y FUNCIONANDO con agente
- **Estado:** Listo para recibir migración
- **Pendiente:** Proyectos, configs, modelos ollama, MCP servers

### VPS Oracle (Intermediario)
- **IP:** 159.54.143.227 (Tailscale: 100.102.63.30)
- **Specs:** 4 ARM cores, 23GB RAM, 48GB disco (13GB libres)
- **Ya tiene:** ollama (system service, 3 modelos: mistral:7b, qwen2.5:3b, qwen2.5:1.5b) + opencode configurado
- **Rol:** Almacenamiento temporal de backups + fallback de ollama remoto

---

## 2. Inventario de Migración

### 2.1 Copiar via VPS (config, ~175MB)

| Ruta | Contenido | Tamaño |
|------|-----------|--------|
| `~/.config/opencode/` | opencode.jsonc, AGENTS.md, plugins/lazy-load, engram.ts, memory.jsonl | ~2MB |
| `~/.opencode/bin/opencode` | Binario estático | ~170MB |
| `~/.opencode/plugins/` | Plugins lazy-load + engram | ~var |
| `~/.config/systemd/user/ollama.service` | Servicio ollama (ajustar path en Debian) | ~1KB |
| `~/.ssh/oracle_key*` | SSH key para VPS | ~1KB |
| `~/.gitconfig` | Git global config | ~1KB |
| `~/.bashrc` | PATHs, aliases, env vars | ~6KB |
| `~/.local/bin/engram` | Binario engram MCP | ~19MB |
| `~/.local/bin/stv-mcp` | MCP server TV | ~var |
| `~/.local/lib/octocode-mcp/` | MCP GitHub search | ~var |
| `~/.engram/` | Data de engram | ~var |
| `~/.config/nvm/` | nvm + versiones Node | ~2MB |
| `~/opencode-migration/mcp-servers/dose-dash-mcp/` | project-mcp server | ~var |

### 2.2 Copiar via LAN directa (proyectos, ~11.5GB)

| Directorio | Tamaño | Notas |
|------------|--------|-------|
| `dose-dash-digital/` | 872MB | Proyecto principal (sin node_modules) |
| `alcon/` | 209MB | Multi-agent + chat |
| `opencode-lab/` | 5.2GB | Solo .opencode/ y mcp-servers/ |
| `ai-automation-agency/` | ~var | Oracle cloud + n8n |
| `azteca-unlocked/` | 8.3MB | Chromecast + IPTV |
| `kodi-mcp-server/` | 528KB | Kodi MCP |
| `youtube-knowledge/` | 104KB | YT knowledge |
| `yt-dlp-power/` | 919MB | YouTube downloads |
| `remote-control-tv/` | 440KB | Remote control |

**Excluir de proyectos:** `node_modules/`, `__pycache__/`, `dist/`, `.angular/`, `.git/` (de opencode-lab)

### 2.3 Re-descargar en Debian (NO transferir)

| Componente | Tamaño | Cómo |
|------------|--------|------|
| Modelos Ollama (4) | ~12GB | `ollama pull` en Debian |
| node_modules (todos) | ~var | `npm install` / `bun install` en cada proyecto |
| Playwright browsers | ~var | `npx playwright install` |
| Python venvs | 699MB | `pip install` fresh |

### 2.4 Instalar via apt en Debian

| Paquete | Notas |
|---------|-------|
| build-essential | gcc, g++, make |
| openjdk-21-jdk | Java para Android builds |
| openjdk-25-jdk | Latest EA |
| android-tools-adb | ADB para deploy |
| gh | GitHub CLI |
| cmake | Para compilar llama.cpp |
| tmux | Terminal multiplexer |
| zstd | Compresión para backups |
| chromium | Navegador |

---

## 3. Estrategia de Red

```
Kali (100.103.82.104)          VPS (100.102.63.30)         Debian (Nueva IP)
┌────────────────────┐         ┌──────────────────┐         ┌────────────────┐
│ 1. Empaquetar      │         │ Almacenamiento   │         │ 6. Descargar   │
│    config (~175MB) │──scp────│ temporal         │──scp────│    config      │
│                    │         │                  │         │                │
│ 2. rsync proyectos │─────────│                  │─────────│ 7. rsync       │
│    (~11.5GB)       │  LAN    │                  │  LAN    │    proyectos   │
│    directo al      │ directa │                  │ directa │                │
│    Debian          │         │                  │         │                │
└────────────────────┘         └──────────────────┘         └────────────────┘
                                         │
                                         ▼
                              ┌──────────────────┐
                              │ 5. Fallback:      │
                              │    ollama remoto  │
                              │    si GPU local   │
                              │    no está lista  │
                              └──────────────────┘
```

**Flujo de datos:**
1. **Config (Kali→VPS→Debian):** SCP bidireccional, ~175MB, rápido
2. **Proyectos (Kali→Debian):** rsync directo por LAN, ~11.5GB, requiere IPs Tailscale
3. **Modelos Ollama:** Re-descargar en Debian (12GB via internet, más lento pero más seguro)

---

## 4. Fallback: Ollama Remoto via VPS

Mientras la GPU de Debian no esté lista, opencode puede usar el ollama del VPS:

```jsonc
// opencode.jsonc — agregar provider remoto
{
  "provider": {
    "ollama": {
      "name": "Ollama Local",
      "apiKey": "ollama",
      "models": {
        "qwen2.5-coder-1.5b": { "name": "Qwen 2.5 Coder 1.5B", "maxTokens": 8192, "contextWindow": 32768 },
        "gemma4-e2b": { "name": "Gemma4 2B", "maxTokens": 8192, "contextWindow": 32768 }
      }
    },
    "ollama-remote": {
      "name": "Ollama VPS",
      "apiKey": "ollama",
      "baseURL": "http://100.102.63.30:11434/v1",
      "models": {
        "qwen2.5-coder-1.5b": { "name": "Qwen 2.5 Coder 1.5B", "maxTokens": 8192, "contextWindow": 32768 },
        "mistral-7b": { "name": "Mistral 7B", "maxTokens": 8192, "contextWindow": 32768 }
      }
    }
  },
  "model": {
    "big": "ollama/gemma4-e2b",
    "small": "ollama/qwen2.5-coder-1.5b",
    "medium": "ollama-remote/mistral-7b"
  }
}
```

---

## 5. Fases de Ejecución

### Fase 1: Preparación en Kali (yo ejecuto)
**Objetivo:** Empaquetar y subir al VPS
**Duración:** ~10 min

1. Ejecutar audit para verificar espacio en VPS
2. Crear tarball de config (~175MB)
3. SCP config al VPS
4. Verificar integridad en VPS

### Fase 2: Preparación en VPS (yo ejecuto)
**Objetivo:** Verificar que todo está listo en VPS
**Duración:** ~5 min

1. Verificar tarball en VPS (`tar -tzf`)
2. Verificar espacio disponible
3. Preparar scripts de restauración

### Fase 3: Setup base en Debian (tú ejecutas)
**Objetivo:** Instalar dependencias del sistema
**Duración:** ~30 min

1. `apt update && apt upgrade`
2. Instalar paquetes base (build-essential, java, adb, gh, cmake, etc.)
3. Instalar NVIDIA driver + CUDA (si aplica)
4. Instalar nvm + Node 22
5. Instalar Bun
6. Instalar Go
7. Instalar Ollama (system service, NO user service)
8. Instalar OpenCode
9. Verificar: `which node bun go ollama opencode gh adb java`

### Fase 4: Restaurar config en Debian (yo ejecuto vía SSH o tú manual)
**Objetivo:** Restaurar configuraciones del VPS
**Duración:** ~10 min

1. SCP config-backup.tar.gz del VPS
2. Restaurar ~/.config/opencode/ (AGENTS.md, plugins, memory.jsonl)
3. Restaurar ~/.opencode/bin/opencode
4. Restaurar ~/.ssh/oracle_key
5. Restaurar ~/.gitconfig
6. Restaurar ~/.bashrc (ajustar paths para Debian)
7. Restaurar ~/.local/bin/engram
8. Restaurar engram data
9. Verificar: `opencode --version`, `ssh oracle@159.54.143.227 "echo ok"`

### Fase 5: Restaurar proyectos en Debian (tú ejecutas)
**Objetivo:** Copiar proyectos via LAN
**Duración:** ~15-30 min

1. Verificar conectividad LAN: `ping <IP-Kali>`
2. `rsync -avz --progress <Kali>:~/Documentos/ ~/Documentos/`
3. `npm install` en dose-dash-digital
4. `npm install` en alcon
5. Rebuild MCP servers (`npm install` en cada uno)
6. Verificar: `cd ~/Documentos/dose-dash-digital && npm run build`

### Fase 6: Configurar servicios en Debian (yo ejecuto vía SSH o tú manual)
**Objetivo:** Arrancar servicios
**Duración:** ~10 min

1. Habilitar ollama: `sudo systemctl enable --now ollama`
2. Pull modelos: `ollama pull qwen2.5-coder-1.5b && ollama pull gemma4-e2b`
3. Habilitar engram: `systemctl --user enable --now engram`
4. Ajustar opencode.jsonc paths (Kali → Debian)
5. Actualizar AGENTS.md global (sección Entorno: Kali → Debian)
6. Verificar: `ollama list`, `systemctl --user status engram`

### Fase 7: Verificación final (tú + yo)
**Objetivo:** Todo funciona
**Duración:** ~10 min

Ejecutar checklist de verificación (script 99-verify.sh):
- [ ] `opencode` arranca
- [ ] `ollama list` muestra modelos
- [ ] `gh auth status` autenticado
- [ ] `ssh oracle@159.54.143.227 "echo ok"` conecta
- [ ] `cd ~/Documentos/dose-dash-digital && npm run build` compila
- [ ] `nvidia-smi` muestra GPU (si aplica)
- [ ] `systemctl --user status engram` = active
- [ ] MCP servers conectan (engram, context7, supabase, etc.)
- [ ] `adb devices` detecta celular (si conectado)

---

## 6. Scripts de Automatización

### En Kali (Fase 1)
- `00-audit.sh` — Verificar espacio en VPS
- `01-create-backups.sh` — Empaquetar config + proyectos
- `02-upload-to-vps.sh` — SCP al VPS

### En Debian (Fases 3-6)
- `03-install-base-debian.sh` — apt install paquetes base
- `04-install-nvidia.sh` — Driver + CUDA
- `05-install-toolchain.sh` — nvm, bun, go, ollama, opencode
- `06-restore-config.sh` — Descargar y restaurar config del VPS
- `07-restore-projects.sh` — rsync proyectos de Kali + npm install
- `08-rebuild-mcp.sh` — npm install en MCP servers
- `09-setup-services.sh` — Ollama + engram services
- `10-fix-paths.sh` — Ajustar opencode.jsonc + AGENTS.md
- `99-verify.sh` — Checklist completo

---

## 7. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| VPS sin espacio (13GB libre, necesita ~12GB) | Media | Alto | Usar LAN directa para proyectos, VPS solo para config |
| SSH key perdida = sin acceso a VPS | Baja | Crítico | Verificar SSH ANTES de borrar Kali |
| opencode.jsonc tiene paths hardcoded que fallan | Alta | Alto | Script 10 con sed/reemplazo de paths |
| Modelos Ollama se corrompen al transferir | Baja | Medio | NO transferir, re-descargar con ollama pull |
| Servicios systemd no arrancan (paths rotos) | Alta | Medio | Script 09 con verificación explícita |
| .bashrc tiene prompts Kali que rompen shell | Alta | Baja | Script 10 limpia variables Kali |
| GPU NVIDIA no detectada en Debian | Media | Baja | Driver via apt, puede necesitar reboot |
| node_modules incompatibles con Node 22 | Baja | Medio | npm install fresh en cada proyecto |

---

## 8. Criterio de Éxito

La migración es exitosa cuando:
1. ✅ `opencode` arranca y puede usar todos los providers
2. ✅ Todos los MCP servers conectan (engram, context7, supabase, project-mcp, shadcn, thinking, tv, octocode, agent-browser)
3. ✅ Los proyectos abren y compilan (`npm run build` en dose-dash-digital)
4. ✅ Ollama sirve modelos localmente (o remoto vía VPS como fallback)
5. ✅ SSH al VPS funciona
6. ✅ Git + GitHub CLI autenticado
7. ✅ ADB detecta dispositivos Android
8. ✅ `systemctl --user status engram` = active
9. ✅ `nvidia-smi` muestra la GTX 1050 Ti (si aplica)
10. ✅ El usuario puede continuar su flujo de trabajo normal

---

## 9. Preguntas Pendientes (para Meta)

1. **¿La nueva PC Debian tiene GPU NVIDIA?** Si es así, ¿misma GTX 1050 Ti o diferente?
2. **¿Tailscale ya está instalado en Debian?** Necesario para rsync LAN y conexión al VPS
3. **¿Qué IPs Tailscale tienen Kali y Debian?** Para rsync directo
4. **¿Hay algo en Debian que ya esté configurado y NO debe sobrescribirse?** (git config, SSH keys, etc.)
5. **¿El ollama de Kali con el servicio fallando debe limpiarse?** O solo ignorar

---

## 10. Notas Técnicas

### Servicio Ollama (diferencia Kali vs Debian)
- **Kali:** User service (`~/.config/systemd/user/ollama.service`) — FALLA con exit 203/EXEC porque el binario no está en el path esperado
- **Debian:** System service (`/etc/systemd/system/ollama.service`) — funciona out-of-the-box con `curl -fsSL https://ollama.com/install.sh | sh`
- **Acción:** NO restaurar el servicio ollama de Kali. Dejar que la instalación oficial de Debian cree el servicio correcto.

### Mixed Content (Capacitor)
- **Problema:** El WebView de Capacitor carga desde `https://localhost` y bloquea HTTP requests
- **Solución:** `server.url: 'http://100.102.63.30:5176'` en capacitor.config.ts
- **Aplicación:** Aplica tanto en Kali como en Debian

### MCP Servers que dependen de opencode-lab
- agent-browser, shadcn, thinking, llama-mcp — están en `~/Documentos/opencode-lab/.opencode/mcp-servers/`
- **Acción:** Migrar TODO el directorio .opencode/ de opencode-lab, no solo mcp-servers

---

**Autor:** israe (jijoyo) + opencode
**Fecha creación:** 2026-07-26
**Última actualización:** 2026-07-26
**Próximo paso:** Revisión de Meta → Aprobación → Ejecución
