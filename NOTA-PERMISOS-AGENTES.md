# Nota: Sistema de Permisos de Agentes en Alcon

## Estado actual
El `agent.js` de Alcon es un **stub** — simula ejecución con setTimeout. No hay sistema de permisos real.

## Lo que CUALQUIER agente puede hacer ahora
- Poll de tareas pendientes
- Claim (tomar posesión)
- Marcar como completada
- Enviar mensajes al chat

## Lo que NINGÚN agente puede hacer ahora
- Ejecutar código real en otros nodos
- Modificar archivos del repo
- Hacer deploy
- Acceder al filesystem de otros nodos

## Capacidades reales por agente

| Agente | Ubicación | Puede modificar | Cómo |
|--------|-----------|-----------------|------|
| **Kali** | /home/jijoyo/ | Código DoseDash | Git push |
| **VPS** | Oracle ARM | Server Alcon | SSH + pm2 |
| **Cel** | Termux | Nada | Solo testing físico |

## Pendientes para aterrizar

### Fase 1: Ejecución básica (urgente)
- [ ] Que agent.js ejecute comandos reales (no simulados)
- [ ] Sistema de whitelist: qué comandos puede ejecutar cada agente
- [ ] Log de acciones por agente

### Fase 2: Permisos (medio plazo)
- [ ] Definir roles: quién puede qué
- [ ] Control de acceso por archivo/directorio
- [ ] Rate limiting por agente

### Fase 3: Seguridad (largo plazo)
- [ ] Sandbox para ejecución de código
- [ ] Auditoría de cambios
- [ ] Aprobación humana para cambios críticos

## Preguntas abiertas
1. ¿Quién aprueba los cambios de código?
2. ¿Los agentes pueden hacer push directo o necesitan PR?
3. ¿Cómo se evita que un agente corrupto destruya el repo?

## Referencia
- agents/agent.js (stub actual)
- server/server.js (API con locking pero sin permisos)
- .github/agents/ (agentes de revisión en DoseDash — modelo a seguir)
