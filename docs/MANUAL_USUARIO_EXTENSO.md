# Manual de Usuario — Alcon v4.0-granja-real

> Para Juan. En lenguaje natural. Sin humo.

---

## Sección 1: Qué es Alcon

Alcon es **tu sistema de agentes de IA** que corre en tu computadora. No es CrewAI, no es LangChain, no es la nube. Es un sistema de 8 equipos especializados de inteligencia artificial que compiten, debaten y colaboran para hacer trabajo real.

Imagina que tienes 8 empleados especializados:
- Uno que revisa código rápido
- Uno que audita seguridad
- Uno que investiga con debate
- Uno que diseña arquitectura
- Uno que crea contenido de YouTube
- Uno que hace deploy
- Uno que consolida memoria
- Uno que genera títulos y miniaturas

Todos corren en tu GPU (RTX 3060), todos trabajan para ti, y nada sale de tu PC.

---

## Sección 2: Para qué sirve

### Auditoría de código
Le dices "revisa server.js" y te da un reporte con líneas específicas, vulnerabilidades clasificadas por severidad, y código corregido. No es un chat genérico — es un análisis real con tu código inyectado en el modelo.

### Fábrica de CAPs de YouTube
Le das un transcript de YouTube y te lo parte en 38 tareas atómicas: portada, guion, quiz, SEO, miniatura.

### Research con debate
Tres modelos debaten entre sí 3 rondas sobre un tema (ej: "¿migrar de JSON a SQLite?"). Cada uno da su argumento, y al final hay una síntesis.

### Arquitecto de software
Tres arquitectos votan sobre cómo diseñar un sistema. Si hay consenso, se aprueba. Si no, se debate.

### Debugger rápido
Le dices "por qué se duplica el contador" y te da 3 hipótesis con líneas de código.

---

## Sección 3: Cómo se usa desde el cel

1. Abrir el navegador en tu cel
2. Ir a: **http://100.102.63.30:3004**
3. Escribir en el chat con el prefijo del squad
4. Esperar (1-5 minutos dependiendo del squad)
5. Ver el resultado en el chat

**Ejemplo:**
```
@quick-review revisa por qué el contador se duplica
```

El sistema automáticamente:
1. Detecta que es un squad
2. Cambia el modelo en tu GPU
3. Inyecta el código real
4. Ejecuta la auditoría
5. Te da el resultado

---

## Sección 4: Los 8 squads explicados

### quick-review (rápido, 1 modelo)
Revisión rápida. Un solo modelo analiza y da resultado. Útil para dudas simples.
- **Tiempo:** 30-60 segundos
- **Ejemplo:** `@quick-review revisa App.tsx`

### code-audit (profundo, 3 modelos)
Auditoría completa. Tres modelos diferentes analizan desde perspectivas distintas:
- **reviewer** — auditoría técnica general
- **security** — enfocado en vulnerabilidades
- **health** — enfocado en calidad y maintainability
- **Tiempo:** 3-5 minutos
- **Ejemplo:** `@code-audit audita server.js por CORS`

### research-deep (debate, 3 rondas)
Investigación con debate. Tres modelos discuten un tema durante 3 rondas:
- **researcher** — da la posición inicial
- **analyst** — contra-argumenta
- **critic** — evalúa ambos lados
- **Tiempo:** 5-8 minutos
- **Ejemplo:** `@research-deep debate SQLite vs JSON`

### architecture (consenso, 3 votos)
Diseño de arquitectura. Tres arquitectos proponen soluciones y votan:
- Si hay consenso → se aprueba
- Si no → se debate más
- **Tiempo:** 4-6 minutos
- **Ejemplo:** `@architecture propone microservicios`

### mithos-cap (fábrica de CAPs)
Crea contenido para YouTube. Divide un transcript en tareas atómicas:
- Guion
- Portada
- Quiz
- SEO
- Miniatura
- **Tiempo:** 3-5 minutos
- **Ejemplo:** `@mithos-cap toma este transcript y créame un CAP`

### deploy (simple, 1 modelo)
Hace deploy al VPS. Cambia código en el servidor y reinicia servicios.
- **Tiempo:** 1-2 minutos
- **Ejemplo:** `@deploy haz deploy de alcon-api`

### memory-consolidation (simple, 1 modelo)
Consolida auditorías y pendientes. Organiza el historial.
- **Tiempo:** 1-2 minutos
- **Ejemplo:** `@memory-consolidation consolida las auditorías de hoy`

### youtube-auto (3 modelos paralelos)
Genera metadata completa para YouTube:
- Título optimizado
- Miniatura descriptiva
- Descripción con SEO
- **Tiempo:** 1-2 minutos
- **Ejemplo:** `@youtube-auto genera metadata para este video`

---

## Sección 5: Ejemplos simples

### 1. Bug en contador
```
@quick-review por qué se duplica el contador cuando hago doble tap
```

### 2. XSS en rutas
```
@code-audit revisa server/routes/tasks.js en busca de XSS
```

### 3. Memory leak en PWA
```
@quick-review revisa pwa/src/App.tsx en busca de memory leaks
```

### 4. Deploy rápido
```
@deploy haz deploy de alcon-api al VPS
```

---

## Sección 6: Ejemplos complejos

### 5. Migración de base de datos
```
@research-deep debate si debo migrar tasks.json a SQLite WAL para 10k tareas, considera mi 3060 y mis 13 modelos
```

### 6. Integración entre proyectos
```
@architecture propone cómo hacer que DoseDash use Alcon como backend sin salir de local
```

### 7. Fábrica de CAPs completa
```
@mithos-cap toma este transcript de YouTube [pega aquí] y pártelo en 38 tareas atómicas para crear un CAP con portada y quiz
```

### 8. Metadata de YouTube
```
@youtube-auto genera título, miniatura y descripción para este video sobre inteligencia artificial local
```

### 9. Consolidación de memoria
```
@memory-consolidation consolida las auditorías de hoy en pendientes organizados
```

### 10. Race conditions
```
@code-audit analiza server/lib/orchestrator.js por race conditions y problemas de concurrencia
```

### 11. Inyección de comandos
```
@code-audit audita agents/agent.js por inyección de comandos y vulnerabilidades de seguridad
```

### 12. Hermes como agente
```
@research-deep investiga si vale la pena agregar Hermes al enjambre como agente autónomo de codificación
```

---

## Sección 7: Configurable

Puedes cambiar:

### Modelos
En `server/lib/model-registry.json`:
```json
{
  "code-review": {
    "board_key": "qwen",
    "model": "qwen3.6-35b-A3B-MXFP4",
    "service": "qwen3-35b.service",
    "vram": "10.6GB",
    "toks": 45
  }
}
```

Cambia `board_key` para usar otro modelo. El sistema automáticamente switch el modelo en tu GPU.

### Squads
En `server/lib/granja.json` puedes:
- Agregar nuevos squads
- Cambiar el patrón (single, fan-out-fan-in, debate, consensus, proxy-atomico)
- Cambiar qué modelos usa cada squad
- Agregar o quitar agentes

---

## Sección 8: Auto-reparable

### pending-*.md
Cada auditoría guarda resultado en `server/lib/memory/pending-YYYY-MM-DD.md`. Esto es un historial que puedes revisar para ver qué se ha auditado y qué se ha encontrado.

### Engram
El sistema guarda lecciones entre sesiones. Cuando algo falla, se recuerda para no volver a fallar.

### Historial de auditorías
Cada vez que ejecutas una auditoría, el resultado se guarda. Puedes ver patrones: "este archivo siempre tiene problemas de CORS", "este otro siempre tiene race conditions".

---

## Sección 9: Auto-mejorable

### El orchestrator aprende
Cada auditoría mejora la siguiente. Si un modelo no detectó algo, la próxima vez se le da más contexto.

### injectCode() mejora
Cada vez que se usa, se puede mejorar qué archivos detecta y cómo los inyecta.

### Los squads se optimizan
Con uso, puedes ver qué squads son más efectivos y cuáles necesitan ajustes.

---

## Sección 10: Qué no es y cómo no olvidarlo

### Qué no es
- **No es humo** — hay logs de 4m47s de ejecución real
- **No es la nube** — todo corre en tu PC, nada sale
- **No es permanente** — si no haces `pm2 save`, se pierde al reiniciar
- **No es CrewAI** — es un sistema custom, no una librería

### Cómo no olvidarlo

**Antes de apagar la PC:**
```bash
pm2 save
```

**Cuando hagas un cambio importante:**
```bash
git add -A && git commit -m "feat: descripción"
git tag v4.0-granja-real
git push origin main --tags
```

**Cuando olvides qué es Alcon:**
Lee `BOOTSTRAP.md` — está en la raíz del proyecto y tiene todo el contexto en 1 página.

### El prompt de inicio
Si Meta AI o cualquier agente olvida qué es Alcon, dile:
```
Lee BOOTSTRAP.md en la raíz del proyecto
```

O directamente:
```
Curl: curl -X POST http://100.102.63.30:3003/api/orchestrate -H "Content-Type: application/json" -d '{"text":"@quick-review test","squad":"quick-review"}'
```
