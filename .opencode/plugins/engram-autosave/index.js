// engram-autosave.js — gatillo automático de memoria (plan-engram-autosave.md)
// Dispara en session.idle con freno doble (dirty + intervalo 15min) y en
// session.compacted como red. v1: checkpoint FACTUAL sin LLM.
// Nunca lanza: un plugin roto no debe romper la sesión.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, basename, dirname } from "node:path";

const MIN_INTERVAL_MS = 900000; // 15 min, ajustable aquí
const MAX_STATUS_LINES = 10;

const ENGRAM_BIN = (process.env.HOME || "/home/israel") + "/.local/bin/engram";

async function loadState(stateFile) {
  try {
    return JSON.parse(await readFile(stateFile, "utf8"));
  } catch {
    return { lastSave: 0 };
  }
}

async function saveCheckpoint($, log, project, trigger, stateFile) {
  let branch = "?";
  let status = "(sin cambios)";
  try {
    branch = (await $`git branch --show-current`.text()).trim() || "?";
    const raw = (await $`git status --short`.text()).trim();
    if (raw) status = raw.split("\n").slice(0, MAX_STATUS_LINES).join("\n");
  } catch {
    // fuera de un repo git: se guarda igual con branch "?"
  }
  const stamp = new Date().toISOString();
  const title = `Checkpoint auto ${project} ${stamp}`;
  const body = [
    `Trigger: ${trigger} ${stamp}`,
    `Rama: ${branch}`,
    `Cambios:`,
    status,
  ].join("\n");
  await $`${ENGRAM_BIN} save ${title} ${body} --type evidence --project ${project}`;
  await mkdir(dirname(stateFile), { recursive: true });
  await writeFile(stateFile, JSON.stringify({ lastSave: Date.now() }) + "\n");
  log(`engram-autosave: checkpoint guardado (${trigger})`);
}

export const EngramAutosave = async ({ client, $, directory }) => {
  const project = basename(directory || "alcon");
  // Sin import.meta (Bun-only, revienta en Node y el loader lo descarta en
  // silencio — issue #34742): el state cuelga de directory del ctx.
  const stateFile = join(directory || ".", ".opencode/plugins/.engram-autosave.state.json");
  const state = await loadState(stateFile);
  let dirty = false;
  let saving = false;

  const log = (msg) => {
    try {
      client?.app?.log?.({
        body: { service: "engram-autosave", level: "info", message: msg },
      });
    } catch {
      console.log(`[${project}] ${msg}`);
    }
  };

  async function maybeSave(trigger) {
    if (!dirty || saving) return; // freno 1: sin cambios no hay disparo
    if (Date.now() - (state.lastSave || 0) < MIN_INTERVAL_MS) return; // freno 2: intervalo
    saving = true;
    try {
      await saveCheckpoint($, log, project, trigger, stateFile);
      state.lastSave = Date.now();
      dirty = false;
    } catch (err) {
      log(`engram-autosave: fallo al guardar (no fatal): ${err?.message || err}`);
    } finally {
      saving = false;
    }
  }

  log(`engram-autosave activo en ${project} (intervalo ${MIN_INTERVAL_MS / 60000}min)`);

  return {
    event: async ({ event }) => {
      if (!event || !event.type) return;
      switch (event.type) {
        case "file.edited":
        case "todo.updated":
          dirty = true;
          break;
        case "session.idle":
          await maybeSave("idle");
          break;
        case "session.compacted":
          await maybeSave("compaction");
          break;
      }
    },
  };
};
