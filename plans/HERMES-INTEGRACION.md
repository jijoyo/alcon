# Plan: Integrar hermes como agente autónomo en Alcon

> Estado: **PENDIENTE** — Esperando decisión de modelo LLM
> Creado: 2026-08-15
> Investigador: debian (opencode)

## Contexto

Hermes es un agente de codificación Python-based (v0.20.0) instalado en debian (`~/.local/bin/hermes`). Actualmente no puede funcionar porque el model server en puerto 8080 está apagado. El usuario quiere integrarlo como agente autónomo en el enjambre Alcon.

## Estado actual

| Componente | Estado | Detalle |
|------------|--------|---------|
| `~/.local/bin/hermes` | ✅ Instalado | Hermes Agent v0.20.0, Python 3.11 |
| Model server (:8080) | ❌ Apagado | Necesita Qwen3-35B GGUF o alternativa |
| Config (`~/.hermes/config.yaml`) | ⚠️ Parcial | Custom provider en `localhost:8080` |
| `hermes-agent.js` | ❌ No existe | Necesita ser creado |
| Integración Alcon | ❌ No existe | Sin conexión Socket.io |

## Pasos pendientes

### Paso 1: Elegir modelo LLM
Opciones:
- **A. Ollama** (ya instalado en forja, `qwen2.5-coder:7b` o `gemma4-e2b`) — Rápido, bajo consumo
- **B. llama-server** con Qwen3-35B GGUF — Potente, ~20GB RAM
- **C. OpenRouter/cloud** — Sin local, requiere API key

### Paso 2: Configurar hermes
- Editar `~/.hermes/config.yaml` para apuntar al modelo elegido
- Si Ollama: `base_url: http://localhost:11434/v1`, `provider: custom`
- Si cloud: configurar API key en `~/.hermes/.env`

### Paso 3: Crear `agents/hermes-agent.js`
Clone de `agent.js` pero usando `hermes chat -q` en vez de `opencode run`:
```js
const HERMES_BIN = '/home/israel/.local/bin/hermes';
const WORKDIR = '/home/israel/Documentos/alcon';

// En el handler de agent:direct:
const child = spawn(HERMES_BIN, ['chat', '-q', prompt, '--cli', '--no-restore-cwd'], {
  cwd: WORKDIR,
  stdio: ['ignore', 'pipe', 'inherit']
});
```

### Paso 4: Agregar SYSTEM_PROMPTS.hermes
```js
'hermes': `Eres hermes, agente de codificación del enjambre Alcon. REGLAS:
1. Enfócate en código, debugging, refactoring
2. Consulta con otros agentes antes de cambios grandes
3. Usa permisos asignados (bash, write, git)`
```

### Paso 5: Test local
```bash
node agents/hermes-agent.js hermes http://100.102.63.30:3003
```

### Paso 6: PM2 (opcional)
Agregar a `ecosystem.config.cjs`:
```js
{
  name: 'hermes-agent',
  script: './agents/hermes-agent.js',
  args: 'hermes http://100.102.63.30:3003'
}
```

## Notas
- hermes usa `-q QUERY` para modo no-interactivo (equivalente a `opencode run`)
- hermes tiene `--cli` para output limpio
- hermes necesita model server corriendo — sin modelo, no funciona
- Permisos de hermes ya están en `permisos.js` (activado en shared.js)
