# Plan: plugin engram-autosave (gatillo automático de memoria)

> Estado: pendiente → (ejecutar → validar → documentar → diseminar)
> Origen: video Kauã Miguel (ai-memory) evaluado 2026-09-07 — se descartó
> ai-memory (Docker + config global + doble memoria) y se optó por hook
> nativo de opencode + store Engram existente.
> Dolor que resuelve: nadie debe acordarse de guardar; el guardado dispara solo.

## 1. Contexto que el ejecutor necesita (leer antes de tocar)

- Doc oficial verificada 2026-09-07: https://opencode.ai/docs/plugins/
- NO existe `session.end`. Eventos útiles: `session.idle` (tras cada
  respuesta), `session.compacted`/`experimental.session.compacting`,
  `file.edited`, `todo.updated`.
- Plugins locales van en `.opencode/plugins/` (este repo aún no tiene esa
  carpeta; crearla). Cero dependencias para no tocar `.opencode/package.json`.
- CLI Engram: `/home/israel/.local/bin/engram save "TITULO" "CONTENIDO"
  --type evidence --project alcon` (ya usado en esta sesión, funciona).
- Convención repo: cambio de infra = docs en `docs/INFRA-VIVA.md` + Engram
  en el mismo commit. Commits `chore:`/`docs:`/`feat:`. ESM. Español.

## 2. Diseño exacto (no improvisar)

Archivo: `.opencode/plugins/engram-autosave/index.js` (ESM, `export const EngramAutosave`,
package-dir con `package.json` type:module — igual que lazy-load).

```js
// Pseudocódigo vinculante:
state = leer(".opencode/plugins/.engram-autosave.state.json") ?? {lastSave: 0}
dirty = false
hooks:
  "file.edited"   → dirty = true
  "todo.updated"  → dirty = true
  "session.idle"  → si dirty Y (ahora - lastSave >= 15min):
                       checkpoint = armar()
                       $`engram save ...`   // via Bun shell API del ctx
                       lastSave = ahora; dirty = false; persistir state
  "session.compacted" → si dirty: mismo guardado (red de seguridad)
```

Checkpoint factual v1 (SIN LLM, sin resumen inventado):

```
TITULO: "Checkpoint auto <repo> <fecha-hora>"
CONTENIDO:
  Rama: <git branch --show-current>
  Cambios: <git status --short, máx 10 líneas>
  Todos: <si hay tool todos — si no se puede leer, omitir sección>
```

State schema: `{"lastSave": 1725..., "dirty": false}`.
Intervalo: 15 min = 900000 ms (constante `MIN_INTERVAL_MS` arriba del
archivo, comentada, para ajustarla sin cazarla).

## 3. Orden de ejecución (paso a paso)

1. Crear `.opencode/plugins/engram-autosave/index.js` (+package.json) según §2.
2. Agregar a `.gitignore`: `.opencode/plugins/.engram-autosave.state.json`
   (runtime local, con comentario `# state plugin autosave`).
3. Pruebas (ver §4) — no seguir sin las 5 verdes.
4. Documentar en `docs/INFRA-VIVA.md` (sección breve: qué dispara, cada
   cuánto, dónde está el state).
5. `git add` SOLO: plugin + `.gitignore` + INFRA-VIVA + este plan.
   Verificar `git show --stat HEAD` post-commit (lección 2026-09-07: el
   index arrastra staged ajeno — revisar siempre).
6. Engram save tipo decision con el resultado.
7. Commit `feat:` (es funcionalidad nueva, no chore).

## 4. Criterios de aceptación (los 5, todos verificables)

1. `opencode` levanta sin errores de plugin (ver log de init).
2. Editar un archivo → idle → aparece checkpoint en
   `engram search "Checkpoint auto"` (espera hasta 1 min tras idle).
3. Idle sin cambios previos → NO aparece guardado nuevo (freno dirty).
4. Dos idles <15 min con cambios → UN solo guardado (freno intervalo).
5. `git status --short` no muestra el `.state.json` (gitignore efectivo).

## 5. Archivos que toca / que NO toca

TOCA: `.opencode/plugins/engram-autosave.js` (nuevo), `.gitignore`
(1 línea), `docs/INFRA-VIVA.md` (1 sección), este plan, Engram.
NO TOCA: plantilla brain-map v4.6, manuales (plugin invisible al humano),
`~/.config/opencode/` global, otros repos, VPS, `memory.jsonl`,
formato del store Engram.

## 6. Fuera de alcance v1 (no hacerlo aunque tiente)

- Resumen con LLM del checkpoint (v2, solo si v1 demuestra valor).
- Plugin global `~/.config/opencode/plugins/` (solo si v1 verde aquí).
- Diseminación a otros repos (canoniza aquí primero; conejillo
  opencode-lab después, REGLA 13).
- Graphify (track separado, spike pendiente en opencode-lab).
