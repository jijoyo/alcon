# Auditoría pendiente: Alcón Server

> Para: Kali
> Creado: 2026-07-27
> Estado: PENDIENTE

## Contexto

Decidimos mejorar el Alcón server (puerto 3003) en vez de reemplazarlo. Antes de implementar, necesitamos una auditoría completa del código actual.

## Qué revisar

### 1. Estructura del server.js
- [ ] Leer `/home/ubuntu/alcon/server/server.js` completo
- [ ] Identificar todas las rutas (endpoints)
- [ ] Identificar el modelo de datos (tasks.json schema)
- [ ] Identificar la lógica de agent routing (@kali, @vps, @cel)
- [ ] Identificar el distributed locking (TTL + heartbeat)
- [ ] Identificar el Socket.io (eventos, namespaces)

### 2. Datos actuales
- [ ] Cuántas tareas hay en tasks.json
- [ ] Cuántos mensajes hay
- [ ] Cuántos agentes están registrados
- [ ] Si hay datos corruptos o inconsistentes

### 3. Dependencias
- [ ] Revisar package.json (versiones, dependencias)
- [ ] Identificar si hay dependencias obsoletas o con vulnerabilidades
- [ ] Verificar si se puede agregar SQLite (para pipeline stages)

### 4. Riesgos
- [ ] ¿Hay code paths que puedan romperse al agregar features?
- [ ] ¿Hay hardcodes que limiten la escalabilidad?
- [ ] ¿El modelo de datos actual soporta pipeline stages?

## Output esperado

Un documento con:
1. Resumen de la arquitectura actual
2. Lista de endpoints y su función
3. Modelo de datos actual
4. Recomendaciones para agregar pipeline stages
5. Riesgos identificados

## Guardar resultado en

`~/.opencode/plans/alcon-improvement/05-audit-results.md`
