---
name: project-loop
description: Project Loop — Marco metodológico para iniciar cualquier proyecto o tarea compleja. Basado en OODA (Observe-Orient-Decide-Act) con investigación antes de acción.
created: 2026-08-29
last_updated: 2026-08-30
version: 1.2
status: activa
score: 9.5/10
---

## Reputación de ejecuciones (huella)

| # | Fecha | Plan | Modo | Resultado | Lección |
|---|-------|------|------|-----------|---------|
| 1 | 2026-08-29 | plan-infra-deploy (Ferrari 35min) | completo | 6/6 fases ✅ | Ferrari verde: router 0.0.0.0, 80/20, granja 127.0.0.1 |
| 2 | 2026-08-29 | mejora-rag (v4.4-embed) | completo | 15/15 eval ✅, 4 bugs muertos | eval harness > intuición; YesNo era perfil interno, no repo |
| 3 | 2026-08-30 | atomic-ai (pendiente) | light | — | primero experimento A/B, integrar solo si gana |

## Qué hago
- Aplico el marco OODA para tareas complejas: Observar → Orientar → Decidir → Actuar
- Aseguro investigación antes de acción (anti-hallucination)
- Pido aprobación humana en puntos clave
- Documento aprendizajes para futuras sesiones

> ⚠️ **¡¡¡¡¡REGLA #0!!!!!!!! ANTES DE CUALQUIER COSA:**
> - **¿Guardaste el plan como MD?**
> - **¿Leíste el plan completo?**
> - **¿Seguiste el orden?**
> - **SI NO → VOLVÉ ATRÁS. NO IMPROVISES.**
> - **SIGUE CONSTANTE SIN PRISAS PARA EVITAR RETRABAJOS**

## Cuándo usarme
- Al iniciar un proyecto nuevo
- Cuando la tarea es compleja o ambigua
- Cuando necesito investigar antes de actuar
- Cuando el usuario dice "investiga primero" o "no adivines"

## El Loop OODA

```
┌─────────────────────────────────────────────────────────────┐
│                    PROJECT LOOP OODA                        │
├─────────────────────────────────────────────────────────────┤
│  1. OBSERVAR    → Entender el contexto, recopilar datos     │
│  2. ORIENTAR    → Investigar opciones, comparar fuentes     │
│  3. DECIDIR     → Elegir la mejor opción, crear plan        │
│  4. ACTUAR      → Ejecutar con checkpoints de aprobación    │
│                                                              │
│  → Documentar aprendizajes al finalizar                      │
└─────────────────────────────────────────────────────────────┘
```

## Fases Detalladas

### Fase 1: OBSERVAR (Entender)
> ⚠️ **¡¡¡¡¡PARA!!!!!!!! ANTES DE EMPEZAR:**
> - **¿Definiste el problema correctamente?**
> - **SIGUE CONSTANTE SIN PRISAS PARA EVITAR RETRABAJOS**

**Objetivo**: Definir exactamente qué se necesita resolver.

Pasos:
1. Clarificar el problema con el usuario
2. Identificar restricciones y dependencias
3. Verificar si existe trabajo previo
4. Definir criterios de éxito

**Checkpoint**: "¿Entendí correctamente el problema?"

### Fase 2: ORIENTAR (Investigar)
> ⚠️ **¡¡¡¡¡PARA!!!!!!!! ANTES DE EMPEZAR:**
> - **¿Investiguaste con herramientas reales?**
> - **¿No estás adivinando?**
> - **SIGUE CONSTANTE SIN PRISAS PARA EVITAR RETRABAJOS**

**Objetivo**: Encontrar opciones reales basadas en evidencia.

Pasos:
1. Usar herramientas reales (websearch, webfetch, grep, docs)
2. Comparar múltiples opciones
3. Verificar con fuentes oficiales
4. Identificar patrones de alucinación a evitar

**Reglas Anti-Hallucination**:
- Nunca adivinar → siempre investigar
- Nunca asumir que es la mejor opción → comparar
- Usar herramientas reales → no confiar solo en memoria
- La web tiene información más reciente → siempre verificar

**Checkpoint**: "¿Las opciones están basadas en evidencia?"

### Fase 3: DECIDIR (Planificar)
> ⚠️ **¡¡¡¡¡PARA!!!!!!!! ANTES DE EMPEZAR:**
> - **¿Guardaste el plan como MD?**
> - **¿El plan está en ~/.opencode/plans/?**
> - **SIGUE CONSTANTE SIN PRISAS PARA EVITAR RETRABAJOS**

**Objetivo**: Elegir la mejor opción y crear un plan ejecutable guardado.

Pasos:
1. Evaluar pros/contras de cada opción
2. Seleccionar la mejor según criterios objetivos
3. Crear plan con pasos concretos
4. **Guardar plan como MD** en `~/.opencode/plans/<nombre-del-proyecto>.md`
5. Identificar riesgos y mitigaciones
6. **Solo proceder a ACTUAR después de que el plan esté guardado**
7. **Presentar plan orquestado al usuario** (OBLIGATORIO antes de ACTUAR)

**Checkpoint**: "¿El plan está guardado y es ejecutable?"

### Plan Orquestado (Paso 7 - OBLIGATORIO)

**ANTES de pasar a ACTUAR, presentar al usuario:**

| # | Paso | Descripción | Checkpoint |
|---|------|-------------|------------|
| 1 | [nombre] | [qué implica, qué se necesita] | [cómo verificar] |
| 2 | ... | ... | ... |

**Si algo NO se detalla:** Explicar por qué no es necesario orquestarlo.

**Solo proceder a ACTUAR después de aprobación explícita del usuario.**

> ⚠️ **FILOSOFÍA: Plan twice, execute once**

### Fase 4: ACTUAR (Ejecutar)
> ⚠️ **¡¡¡¡¡PARA!!!!!!!! ANTES DE EMPEZAR:**
> - **¿Estás siguiendo el plan paso a paso?**
> - **¿No te estás desviando?**
> - **SIGUE CONSTANTE SIN PRISAS PARA EVITAR RETRABAJOS**

**Objetivo**: Implementar la solución con control de calidad.

Pasos:
1. Ejecutar plan paso a paso
2. Verificar en cada paso
3. Ajustar si hay cambios inesperados
4. Confirmar resultado con el usuario

**Checkpoints**:
- Después de cada paso importante
- Antes de cambios irreversibles
- Al completar la tarea

**Checkpoint final**: "¿Se cumplió el criterio de éxito?"

### Fase 5: DOCUMENTAR (Aprender)
> ⚠️ **¡¡¡¡¡PARA!!!!!!!! ANTES DE EMPEZAR:**
> - **¿Guardaste los aprendizajes?**
> - **¿Actualizaste research-protocol.md?**
> - **SIGUE CONSTANTE SIN PRISAS PARA EVITAR RETRABAJOS**

**Objetivo**: Guardar aprendizajes para futuras sesiones.

Pasos:
1. Qué funcionó y qué no
2. Lecciones aprendidas
3. Errores a evitar
4. Guardar en `~/.opencode/notes/research-protocol.md`

## Herramientas Disponibles

| Fase | Herramientas |
|------|--------------|
| Observar | `read`, `glob`, `grep` |
| Orientar | `websearch`, `webfetch`, `task` (subagentes) |
| Decidir | Análisis propio, `sequential-thinking` |
| Actuar | `edit`, `write`, `bash` |
| Documentar | `write` (notas), `mem_save` (MCP/Engram), `mem_session_summary` (MCP/Engram) |

## Memoria Persistente (Engram)

> Estas tools son MCP (Model Context Protocol). Disponibles en OpenCode via opencode.jsonc.

**Conexión:** Engram via SSH al VPS (puerto 7438)

**Cuándo usar:**

| Tool | Cuándo | Ejemplo |
|------|--------|---------|
| `mem_context` | Al INICIAR sesión | Recuperar contexto previo |
| `mem_search` | Al INICIAR ORIENTAR | Buscar experiencias pasadas |
| `mem_save` | Al FINALIZAR cada fase | Guardar aprendizajes |
| `mem_session_summary` | Al FINALIZAR sesión | Resumen obligatorio |

**Formato de mem_save:**
```json
{
  "title": "Acción realizada",
  "type": "decision|bugfix|discovery|pattern|config|preference",
  "content": "Qué / Por Qué / Dónde / Aprendido"
}
```

**Regla:** SIEMPRE guardar después de:
- Completar una fase del loop
- Tomar una decisión importante
- Encontrar un error o learnig
- Cambiar configuración

## El Enjambre: Nodos de Desarrollo

**Sistema de 4 nodos para DoseDash:**

| Nodo | Capacidad | Cuándo usar |
|------|-----------|-------------|
| **Cel (Termux)** | Testing físico, opencode web, vite dev, screencaps | Siempre (yo soy este nodo) |
| **VPS (Oracle)** | 24/7 uptime, code-server :8443, Ollama, Alcón | Servicios backend, memoria |
| **Kali (PC)** | Builds pesados, debugging profundo, git | Cuando hay acceso al escritorio |
| **PC (Vercel)** | Deploy :3000, CI/CD, env vars | Deploy a producción |

**Flujo de Comunicación:**
```
Cel ←SSH/Tailscale→ VPS ←Git→ GitHub ←Git→ Kali/PC
                         ↕
                    Vercel (deploy)
```

**Reglas del Enjambre:**
- SIEMPRE `git pull` antes de cada tarea
- SIEMPRE `git push` después de cada cambio
- NUNCA commitear `.env` o `.vercel/`
- Cel NO hace builds pesados (>70s)
- Documentar en CHANGELOG.md cada cambio

## Integración con Otros Skills

- **Research Protocol**: Usar `~/.opencode/notes/research-protocol.md` como referencia
- **Phase Lock**: Si el proyecto tiene fases, verificar dependencias
- **Result Contract**: Al finalizar cada fase, generar envelope JSON

## Ejemplo Rápido

```
Usuario: "Necesito configurar OpenCode en mi VPS"

1. OBSERVAR: Entender → VPS Oracle, Ubuntu, sin OpenCode instalado
2. ORIENTAR: Investigar → docs oficiales, mejores prácticas, opciones
3. DECIDIR: Plan → instalar binario, configurar Ollama hybrid
4. ACTUAR: Ejecutar → paso a paso con verificación
5. DOCUMENTAR: Guardar → vps-oracle.md actualizado
```

## Errores Comunes a Evitar

| Error | Solución |
|-------|----------|
| Saltar investigación | Siempre usar herramientas reales |
| Asumir que funciona | Verificar con docs oficiales |
| No documentar | Siempre guardar aprendizajes |
| Ejecutar sin plan guardado | Guardar MD en plans/ antes de actuar |
| Ejecutar sin plan | Completar Fase 3 antes de actuar |

## Sistema de Pendientes

Al trabajar en un proyecto, SIEMPRE:
1. Ejecutar `~/.local/bin/pending-update` antes de leer pendientes
2. Mostrar clasificación visual al usuario
3. Si hay [ROJO], preguntar si es importante

**Guía completa:** `~/.opencode/notes/pending-update-system.md`

**Clasificación:**
- [VERDE] = Normal (0-3 días, 1-2 mostrado)
- [AMARILLO] = Considerar (4-7 días, 3-4 mostrado)
- [NARANJA] = Actuar o eliminar (8-14 días, 5-7 mostrado)
- [ROJO] = ¿Es importante? (15+ días, 8+ mostrado)

> ⚠️ Sistema nuevo (24 jul 2026). Monitorear durante 2 semanas.

## Shell Escaping — Regla Obligatoria

> ⚠️ **CONOCIMIENTO OBLIGATORIO PARA TODO NODO DEL ENJAMBRE**

**Problema:** Los caracteres especiales en bash causan fallos silenciosos. Cada fallo desperdicia tokens y tiempo.

**Caracteres peligrosos:** `()` `|` `>` `<` `` ` `` `$` `;` `!`

**Soluciones:**
1. **Comillas simples** (la más fácil): `'texto con (paréntesis)'`
2. **Printf %q** (la más robusta): `printf '%q' 'texto'`
3. **Simplificar texto**: Evitar caracteres especiales
4. **Tools directos**: `write`, `edit`, `mem_save`

**Regla de oro:** "Cuando en dudas, comillas simples."

**Checklist:** ¿El texto tiene `()` `|` `>` `<` `` ` `` `$` `;` `!`? → Usar comillas simples

**Referencia completa:** `vault/04-aprendizajes/patrones/escaping-bash-patrones-error.md`

**Engram:** Memoria #14 — Shell Escaping Conocimiento Obligatorio Enjambre

---

## Archivos Relacionados
- `~/.opencode/notes/research-protocol.md` — Protocolo anti-hallucination
- `~/.opencode/notes/MIUI-limitations.md` — Restricciones del dispositivo
- `~/.config/opencode/AGENTS.md` — Reglas globales

## Regla: Señalar Pendientes

**En cada iteración del loop, SIEMPRE señalar:**
- Errores o advertencias que vea
- Pendientes que identifique
- Cosas que se pueden mejorar

**NO hace falta arreglarlas ahora. Solo señalar.**

**La noción no se pierde — queda registrada para cuando haya tiempo.**

> Ejemplo: "Sonarr está unhealthy en el VPS. No lo arreglé, pero quedó registrado. Cuando Kali esté conectado o haya tiempo, se revisa."

---

## Lección: Cada iteración es oportunidad de mejora

> "Preguntar = 1 minuto de ignorancia. No preguntar = ignorancia permanente."

**Ciclo de mejora continua:**
```
Cuestionar → Evaluar → Implementar → Documentar
     ↓           ↓           ↓            ↓
  "¿por qué?"  "¿cuál es   "hacerlo"    "aprender
                el mejor?"              para no repetir"
```

| Fase | Pregunta | Resultado |
|------|----------|-----------|
| Cuestionar | "¿Por qué?" | Entender el problema |
| Evaluar | "¿Cuál es el mejor camino?" | Comparar opciones reales |
| Implementar | "Hacerlo" | Ejecutar con control |
| Documentar | "Aprender para no repetir" | Hoy corrijo, mañana no me preocupo |

**Casos de estudio:**
- [Eficiencia: Evaluar antes de actuar](../../obsidian-vault/04-aprendizajes/descubrimientos/eficiencia-evaluar-antes-de-actuar.md)
- [AGENTS.md Optimization](examples/AGENTS.md-optimization.md)

---

## Lección: OODA es para TODO, no solo implementar

> "Nunca crear sin antes investigar si ya existe."

**El error común:** Saltar directo a "Act" (diseñar/crear) sin pasar por "Observe" (investigar qué existe).

**La realidad:** OODA es para CUALQUIER cosa:
- Crear un feature nuevo → **Observe** primero (¿ya existe?)
- Fixear un bug → **Observe** primero (¿alguien ya lo fixeó?)
- Elegir una herramienta → **Observe** primero (¿qué hay en el mercado?)
- Responder una pregunta → **Observe** primero (¿qué dicen las fuentes?)

**Regla de oro:**
```
ANTES de crear algo → preguntar:
1. "¿Ya existe algo que haga esto?"
2. "¿Qué han hecho otros?"
3. "¿Puedo reusar en vez de construir?"
```

**Caso de estudio:** Diseñé un sistema de payloads/templates para Alcón. Después investigué y descubrí que "agent-tasks" ya tenía TODO lo que estaba construyendo. Tiempo desperdiciado.

**Motivación:** Cada error documentado es una generación futura que no lo repite.