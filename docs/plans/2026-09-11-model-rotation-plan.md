# PLAN: Implementación de Rotación de Modelos (Round-Robin) para Cloud
**Fecha:** 2026-09-11
**Estado:** Pendiente de aprobación
**Objetivo:** Saltar el Rate Limit de la nube mediante la rotación cíclica entre múltiples proveedores gratuitos.

## 1. Problema Identificado
El orquestador actual utiliza modelos fijos para las tareas de la nube. Cuando se realizan peticiones intensivas, los proveedores (Google, Meta, etc.) aplican Rate Limits rápidamente, lo que detiene el flujo de trabajo.

## 2. Solución Propuesta: El "Buffet" de Modelos
Implementar un sistema de rotación cíclica (Round-Robin) que distribuya la carga entre una lista diversa de modelos gratuitos de distintos fabricantes.

### Componentes Clave:
- **Model Pool:** Lista de IDs de OpenRouter de diversos proveedores (Google, Meta, Mistral, Microsoft, etc.).
- **Persistencia de Estado:** Un archivo `server/lib/rotation_state.json` que guarde el último índice usado para evitar saturar el mismo modelo al reiniciar el servidor.
- **Salto Reactivo:** Si se detecta un error HTTP 429 (Too Many Requests), el sistema incrementará el índice inmediatamente y reintentará con el siguiente modelo del pool sin esperas largas.

## 3. Fases de Implementación

### Fase 1: Infraestructura y Persistencia
- Crear `server/lib/rotation_state.json`.
- Implementar funciones en Go para cargar/guardar el índice de rotación.
- Definir la estructura del Pool de modelos (inicialmente con una lista base).

### Fase 2: El Motor de Rotación
- Desarrollar la lógica de `rotateModel()`.
- Implementar la detección de error `429` para activar el salto instantáneo al siguiente modelo.

### Fase 3: Integración con el Orquestrador
- Modificar `orchestrator.go` para que, cuando necesite usar la nube, utilice el motor de rotación en lugar de un modelo estático.

### Fase 4: Investigación y Validación
- **Investigación Web:** Obtener la lista real y actualizada de modelos `:free` en OpenRouter para alimentar el pool.
- **Pruebas:** Validar que el sistema rota correctamente ante ráfagas de peticiones.

## 4. Registro de Reputación (Trazabilidad)
- **Engram:** Registrar la decisión arquitectónica.
- **Obsidian:** Crear nota de aprendizaje en `04-aprendizajes/`.
- **Docs:** Este archivo `.md` actúa como el registro maestro del plan.
