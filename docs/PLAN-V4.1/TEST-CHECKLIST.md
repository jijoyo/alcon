# Test Checklist: Alcon v4.1-conversacional

## Tests pre-commit

### 1. Verificar archivos
```bash
# granja.json tiene 4 devices, 3 squads configurables
wc -l server/lib/granja.json  # debe ser ~194

# orchestrator.js tiene circuit breaker + hybrid
wc -l server/lib/orchestrator.js  # debe ser ~291

# chat.js tiene squad detection
grep -c "GRANJA_SQUADS" server/routes/chat.js  # debe ser >0

# tasks.js tiene granja guard pero sigue teniendo ~400L
wc -l server/routes/tasks.js  # debe ser ~400
```

### 2. Verificar imports
```bash
# orchestrator.js exporta handleSquadMessage
grep "export.*handleSquadMessage" server/lib/orchestrator.js

# chat.js importa handleSquadMessage
grep "import.*handleSquadMessage" server/routes/chat.js

# chat.js usa Fastify/Socket.IO (no Express)
grep "io.of('/enjambre')" server/routes/chat.js
```

### 3. Verificar memory conversations
```bash
ls -la server/lib/memory/conversations/  # debe existir
```

## Tests post-commit

### 1. Test local (debian)
```bash
curl http://localhost:8080/health  # debe retornar OK
```

### 2. Test squad --local
```bash
@quick-review --local revisa server.js
# Esperado: solo debian 3060 local, 0ms, sin gastar tokens
```

### 3. Test squad auto (4 perspectivas)
```bash
@code-audit revisa server.js
# Esperado: 4 perspectivas (debian+kali+vps+cel), fan-in síntesis, ~12-15s
```

### 4. Test squad --cloud
```bash
@code-audit --cloud --device=vps,cel revisa server.js
# Esperado: solo nube vps+cel, 4s throttle
```

### 5. Test debate
```bash
@research-deep investiga si usar SQLite en Alcon
# Esperado: 3 rondas de debate, síntesis final
```

### 6. Test persistencia
```bash
# Después de un test, verificar:
ls -la server/lib/memory/conversations/
# Debe existir code-audit.json o quick-review.json
cat server/lib/memory/conversations/code-audit.json | head -5
```

### 7. Test Kanban
```bash
# Verificar que la tarea aparece en Done
curl -s http://localhost:3003/api/tasks?status=hecho | jq '.tasks[0]'
# Debe tener stage='done'
```

## Deploy VPS
```bash
ssh root@100.102.63.30
cd ~/alcon
git reset --hard origin/feat/v4.1-conversacional
pm2 restart alcon-api --update-env

# Test remoto
curl -s http://100.102.63.30:3003/health
curl -X POST http://100.102.63.30:3003/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"text":"@quick-review test rapido","squad":"quick-review"}'
```

## Troubleshooting

| Problema | Causa | Solución |
|----------|-------|----------|
| `granja.json not found` | Path incorrecto | Verificar `server/lib/granja.json` |
| `handleSquadMessage not a function` | Import falló | Verificar orchestrator.js exports |
| `429 Too Many Requests` | Rate limit nube | Circuit breaker debería rotar automáticamente |
| `opencode: command not found` | OpenCode no instalado | `curl -fsSL https://opencode.ai/install \| bash` |
| `timeout 120s` | Modelo local lento | Verificar llama-server en :8080 |
