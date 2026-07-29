# Registro de Decisión: Mejorar Alcón vs Reemplazar

> Creado: 2026-07-27
> Decisión: MEJORAR Alcón
> Alternativas consideradas: agent-tasks, wood-fired-tasks, agentboard, ai-agent-board, agent-kanban, agent_mq

## Contexto

Necesitábamos task management para nuestro Enjambre (Mimo, Kali, VPS, Cel). El Alcón server actual (puerto 3003) tiene chat + multi-dispositivo pero le faltan features de pipeline.

## Investigación

Investigamos 8 alternativas usando OODA:
1. **Observe**: Buscamos qué existía en el mercado
2. **Orient**: Comparamos features, tech stack, tradeoffs
3. **Decide**: Elegimos mejorar Alcón
4. **Act**: (Pendiente) Implementar mejoras

## Opciones evaluadas

### Opción A: Adoptar agent-tasks
- ✅ Pipeline stages, artifacts, dependencies
- ✅ MCP integration (8 tools)
- ✅ Kanban dashboard
- ❌ Sin chat en tiempo real
- ❌ Sin multi-dispositivo
- ❌ Sin Engram

### Opción B: Adoptar wood-fired-tasks
- ✅ Atomic claiming, WSJF prioritization
- ✅ 31 MCP tools
- ✅ CLI + REST + MCP
- ❌ Sin chat en tiempo real
- ❌ Sin multi-dispositivo
- ❌ Más complejo de instalar

### Opción C: Mejorar Alcón
- ✅ Conservar chat + multi-dispositivo + Engram
- ✅ Agregar features de otros proyectos
- ✅ Control total del código
- ❌ Requiere desarrollo
- ❌ Mantenimiento propio

## Decisión

**Mejorar Alcón** porque:
1. Ya tiene features ÚNICOS que ningún otro proyecto tiene (chat + multi-dispositivo)
2. Las features que le faltan (pipeline, dependencies, artifacts) se pueden agregar
3. No perdemos lo que ya funciona
4. Tenemos control total sobre el código

## Consecuencias

- Kali audita el server.js actual
- Implementamos pipeline stages (copiar patrón de agent-tasks)
- Implementamos dependencies (copiar patrón de wood-fired-tasks)
- Conservamos chat + Socket.io + Engram

## Revisión

Revisar después de implementar Fase 1 (SQLite + Pipeline stages).
Si no funciona → reconsiderar Opción A o B.
