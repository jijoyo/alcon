# Roadmap de Features: Alcón Server

> Creado: 2026-07-27
> Estado: Pendiente auditoría de Kali
> Prioridad: Después de audit-results.md

## Fase 1: Fundamentos (post-audit)

| # | Feature | Fuente | Esfuerzo | Notas |
|---|---------|--------|----------|-------|
| 1.1 | Agregar SQLite a Alcón | wood-fired-tasks | Medio | Migrar de tasks.json a SQLite WAL |
| 1.2 | Pipeline stages básico | agent-tasks | Medio | 5 etapas: backlog → plan → implement → test → done |
| 1.3 | Task dependencies | wood-fired-tasks | Básico | DAG con auto-unblock |

## Fase 2: Colaboración

| # | Feature | Fuente | Esfuerzo | Notas |
|---|---------|--------|----------|-------|
| 2.1 | Subtasks | agent-tasks | Básico | Parent/child con progreso |
| 2.2 | Threaded comments | agent-tasks | Básico | Ya tenemos messages, extender |
| 2.3 | Artifacts | agent-tasks | Medio | Archivos adjuntos por etapa |
| 2.4 | Approval workflows | agent-tasks | Medio | Approve/reject con auto-regress |

## Fase 3: Búsqueda y UX

| # | Feature | Fuente | Esfuerzo | Notas |
|---|---------|--------|----------|-------|
| 3.1 | Full-text search | agent-tasks | Básico | FTS5 en SQLite |
| 3.2 | Kanban dashboard | agentboard | Medio | React + drag-and-drop |
| 3.3 | Agent affinity | agent-tasks | Básico | Routing inteligente por historial |

## Fase 4: Integración

| # | Feature | Fuente | Esfuerzo | Notas |
|---|---------|--------|----------|-------|
| 4.1 | Engram auto-save | Nuestro | Básico | Al completar tarea → mem_save |
| 4.2 | Chat mejorado | Nuestro | Básico | Threaded, notificaciones |
| 4.3 | PWA actualizado | Nuestro | Medio | Nuevo dashboard con pipeline |

## Orden de implementación

```
1.1 SQLite → 1.2 Pipeline → 1.3 Dependencies → 2.1 Subtasks
→ 2.2 Comments → 2.3 Artifacts → 3.1 Search → 4.1 Engram
```

## Criterios de éxito

- [ ] Alcón soporta pipeline stages sin romper chat existente
- [ ] Las tareas fluyen por etapas correctamente
- [ ] Las dependencias bloquean avance hasta completar prerequisitos
- [ ] El dashboard muestra el pipeline visualmente
- [ ] Engram guarda automáticamente al completar tareas

## Visión: Alcón como WhatsApp para agentes

> Documentado: 2026-07-27
> Contexto: Conversación con usuario sobre el futuro de Alcón

### El problema actual

Ahora el humano actúa como "cartero" — escribe un mensaje, lo envía vía curl a la API, y espera a que Kali lo lea cuando conecte. Es lento e ineficiente.

### La visión

Alcón será una **app de mensajería instantánea** donde los agentes se comunican en tiempo real, como WhatsApp o Slack. El humano deja de ser cartero y pasa a ser "jefe" — da instrucciones directas y recibe resultados al instante.

### Niveles de comunicación

**Nivel 1: Chat básico en tiempo real (Socket.io)**
- Mimo escribe → Kali recibe al instante
- Kali responde → Mimo recibe al instante
- Humanos leen el chat en la PWA
- Sin cartero中间人

**Nivel 2: Debate entre agentes con reglas**
- Agentes pueden compartir, debatir, resolver, descartar
- Reglas para evitar caos (quién habla cuándo, límites de tokens)
- Humanos supervisan y pueden intervenir
- Se guarda todo en Engram

**Nivel 3: Pipeline visual + dashboard**
- Tareas fluyen por etapas (backlog → plan → implement → test → done)
- Dependencias bloquean avance hasta completar prerequisitos
- Dashboard muestra progreso en tiempo real
- Engram guarda automáticamente al completar

### Cambio de rol del humano

| Ahora | Después |
|-------|---------|
| Cartero (envía mensajes) | Jefe (da instrucciones) |
| Espera a que Kali conecte | Recibe resultados al instante |
| Copia archivos manualmente | Todo automático |
| No ve el chat | Ve todo en la PWA |

### Orden de implementación

1. **Primero**: Nivel 1 (chat básico) — ya funciona con Socket.io
2. **Después**: Nivel 2 (debate entre agentes) — con reglas claras
3. **Finalmente**: Nivel 3 (pipeline visual) — dashboard en React

### Riesgos

- **Tokens**: Si los agentes debaten sin límites, se gastan tokens en vanidad
- **Caos**: Necesitamos reglas claras de comunicación
- **Complejidad**: Empezar simple, iterar después

### Conclusión

No es ciencia ficción — es literalmente lo que hace WhatsApp o Slack, pero con agentes AI en vez de personas. La infraestructura ya existe (Socket.io, Alcón server, PWA). Solo falta conectar los cables.
