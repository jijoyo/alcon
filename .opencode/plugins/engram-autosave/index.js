// engram-autosave.js — gatillo automático de memoria (plan-engram-autosave.md)
// Dispara en session.idle con freno doble (dirty + intervalo 15min) y en
// session.compacted como red. v1: checkpoint FACTUAL sin LLM.
// Nunca lanza: un plugin roto no debe romper la sesión.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, basename, dirname } from "node:path";
import { execFileSync } from "node:child_process";

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

// Sin $ de Bun: en desktop puede no existir y cada save reventaría en
// silencio. Solo node:stdlib (child_process funciona en Bun y Node).
function sh(cmd, args, cwd) {
  try {
    return execFileSync(cmd, args, { cwd, timeout: 30000, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

async function saveCheckpoint(log, project, trigger, stateFile, cwd) {
  let branch = "?";
  let status = "(sin cambios)";
  branch = sh("git", ["branch", "--show-current"], cwd) || "?";
  const raw = sh("git", ["status", "--short"], cwd);
  if (raw) status = raw.split("\n").slice(0, MAX_STATUS_LINES).join("\n");
  const stamp = new Date().toISOString();
  const title = `Checkpoint auto ${project} ${stamp}`;
  const body = [
    `Trigger: ${trigger} ${stamp}`,
    `Rama: ${branch}`,
    `Cambios:`,
    status,
  ].join("\n");
  sh(ENGRAM_BIN, ["save", title, body, "--type", "evidence", "--project", project], cwd);
  await mkdir(dirname(stateFile), { recursive: true });
  await writeFile(stateFile, JSON.stringify({ lastSave: Date.now() }) + "\n");
  log(`engram-autosave: checkpoint guardado (${trigger})`);
}

export const EngramAutosave = async ({ client, directory }) => {
  const project = basename(directory || "alcon");
  const cwd = directory || ".";
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
      await saveCheckpoint(log, project, trigger, stateFile, cwd);
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
