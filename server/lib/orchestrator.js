import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GRANJA = JSON.parse(fs.readFileSync(path.join(__dirname, 'granja.json'), 'utf8'));
const REGISTRY = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-registry.json'), 'utf8'));
const API_BOARD = process.env.BOARD_API_URL || 'http://localhost:9998';
const LLAMA = process.env.LLAMA_URL || 'http://localhost:8080';
const OPENCODE_BIN = process.env.OPENCODE_BIN || (() => {
  const candidates = [
    process.env.HOME + '/.opencode/bin/opencode',
    '/usr/local/bin/opencode',
    '/usr/bin/opencode',
  ];
  for (const c of candidates) { try { if (fs.existsSync(c)) return c; } catch {} }
  return candidates[0];
})();
const WORKDIR = process.env.ALCON_WORKDIR || (() => {
  const candidates = [
    path.join(process.env.HOME || '/home/user', 'Documentos/alcon'),
    '/home/ubuntu/alcon',
  ];
  for (const c of candidates) { try { if (fs.existsSync(c)) return c; } catch {} }
  return candidates[0];
})();

import { spawn } from 'child_process';

const CONVERSATIONS_DIR = path.join(__dirname, 'memory', 'conversations');
if (!fs.existsSync(CONVERSATIONS_DIR)) fs.mkdirSync(CONVERSATIONS_DIR, { recursive: true });

const squadSessions = new Map();
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

function loadConversations() {
  try{
    const files = fs.readdirSync(CONVERSATIONS_DIR);
    for(const f of files){
      if(!f.endsWith('.json')) continue;
      const squad = f.replace('.json','');
      const data = JSON.parse(fs.readFileSync(path.join(CONVERSATIONS_DIR, f), 'utf8'));
      squadSessions.set(squad, { history: data.history||[], taskId: data.taskId||null, lastActivity: data.lastActivity||Date.now(), timeout:null });
      console.log(`[orchestrator] loaded ${squad} ${data.history?.length||0}`);
    }
  }catch(e){ console.log(`[orchestrator] load ${e.message}`); }
}
function saveConversation(squad){
  try{
    const sess = squadSessions.get(squad);
    if(!sess) return;
    fs.writeFileSync(path.join(CONVERSATIONS_DIR, `${squad}.json`), JSON.stringify({ history: sess.history.slice(-30), taskId: sess.taskId, lastActivity: sess.lastActivity }, null, 2));
  }catch{}
}
loadConversations();

function closeSquadSession(squad){
  const sess = squadSessions.get(squad);
  if(!sess) return;
  if(sess.timeout) clearTimeout(sess.timeout);
  console.log(`[orchestrator] timeout ${squad} cerrado`);
  sess.timeout=null; sess.taskId=null; saveConversation(squad);
}

// board
async function boardStart(modelKey){
  const entry = REGISTRY.registry[modelKey] || REGISTRY.registry['code-review'];
  const boardKey = entry?.board_key || 'qwen';
  console.log(`[orchestrator] start ${modelKey} -> board:${boardKey}`);
  await fetch(`${API_BOARD}/start?model=${boardKey}`, {method:'POST'}).catch(async()=>{
    await fetch(`${API_BOARD}/start`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({model:boardKey})}).catch(()=>{});
  });
  for(let i=0;i<30;i++){ try{ const h=await fetch(`${LLAMA}/health`); if(h.ok) return; }catch{} await sleep(1000); }
}
async function boardStop(){ try{ await fetch(`${API_BOARD}/stop`,{method:'POST'});}catch{} }

function injectCode(prompt){
  const codeRoot = path.join(__dirname, '..', '..');
  const patterns = [/(?:revisa|analiza|audita|check|lee)\s+([\w\/\.\-]+(?:\.js|\.ts|\.json|\.md))/gi, /(server\/server\.js|server\.js|routes\/[\w\-]+\.js|lib\/[\w\-]+\.js)/gi];
  let code='';
  for(const re of patterns){
    for(const m of prompt.matchAll(re)){
      const filePath = m[1];
      const full = filePath.startsWith('/') ? filePath : `${codeRoot}/${filePath}`;
      try{ const content = fs.readFileSync(full,'utf8').slice(0,12000); code+=`\n=== ${filePath} ===\n${content}\n=== FIN ===\n`; }catch{}
    }
  }
  return code ? `${prompt}\n\n${code}` : prompt;
}

async function callLlamaWithHistory(history, systemPrompt, url=LLAMA){
  const messages = [{role:'system', content:systemPrompt}, ...history];
  const res = await fetch(`${url}/v1/chat/completions`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({model:'local', messages, stream:false, temperature:0.7, max_tokens:1024})});
  const j = await res.json(); return j.choices?.[0]?.message?.content || '';
}
async function callLlama(prompt){ return callLlamaWithHistory([{role:'user', content:prompt}], 'Eres asistente Alcon'); }

async function callOpenCode(prompt, systemPrompt, model='opencode/mimo-v2.5-free'){
  const fullPrompt = `${systemPrompt}\n\n${prompt}\nResponde en español, corto.`;
  return new Promise((resolve, reject)=>{
    const child = spawn(OPENCODE_BIN, ['run', '-m', model, '--dir', WORKDIR, fullPrompt], {cwd:WORKDIR, stdio:['ignore','pipe','inherit']});
    let stdout=''; child.stdout.on('data', d=>{ stdout+=d; });
    const timer=setTimeout(()=>{ child.kill(); reject(new Error('opencode timeout 120s')); }, 120000);
    child.on('close', code=>{ clearTimeout(timer); code===0 ? resolve(stdout||'(sin output)') : reject(new Error(`exit ${code}: ${stdout.slice(0,200)}`)); });
    child.on('error', err=>{ clearTimeout(timer); reject(err); });
  });
}

// === THROTTLED CALL con fallback ===
async function throttledCall(agent, prompt, history){
  // === HYBRID: debian/kali pueden caer a nube si local falla ===
  const tryLocalFirst = agent.hybrid || agent.backend === 'llama';

  const backend = agent.backend || 'llama';
  const systemPrompt = agent.system_prompt || `Sos ${agent.role||agent.device} del enjambre Alcon.`;
  
  if(tryLocalFirst){
    // Intenta local primero
    try{
      const url = agent.url || LLAMA;
      if(agent.model_ref && !agent.model_ref.startsWith('opencode/')) await boardStart(agent.model_ref);
      const hist = history ? [...history] : [{role:'user', content:prompt}];
      hist[hist.length-1].content = injectCode(hist[hist.length-1].content);
      const res = await callLlamaWithHistory(hist, agent.system_prompt || `Sos ${agent.role} del enjambre Alcon.`, url);
      return res;
    }catch(e){
      console.log(`[hybrid] ${agent.device}/${agent.model_ref} local fallo: ${e.message}, probando nube...`);
      // cae a nube
      await sleep(agent.cloud_throttle_ms || 4000);
      // busca primer modelo cloud en fallback
      const cloudModels = (agent.fallback_models||[]).filter(m=>m.startsWith('opencode/'));
      for(const cloudModel of cloudModels){
        try{
          const r = await callOpenCode(prompt, agent.system_prompt || `Sos ${agent.role}`, cloudModel);
          return r;
        }catch(ce){
          if(ce.message.includes('429')){ await sleep(5000); continue; }
          throw ce;
        }
      }
      throw e; // si no hay cloud fallback, lanza error local
    }
  }

  if(backend === 'llama' && !tryLocalFirst){

    // local: sin throttle, board switch ya serializa GPU
    const url = agent.url || LLAMA;
    if(agent.model_ref) await boardStart(agent.model_ref);
    const hist = history ? [...history] : [{role:'user', content:prompt}];
    // inject code en ultimo mensaje
    hist[hist.length-1].content = injectCode(hist[hist.length-1].content);
    const res = await callLlamaWithHistory(hist, systemPrompt, url);
    return res;
  }
  
  if(backend === 'opencode'){
    // nube: throttle 3-5s + fallback models + retry
    const throttle = agent.throttle_ms || 4000;
    const allFallback = agent.fallback_models || [agent.model_ref || 'opencode/mimo-v2.5-free'];
    const fallback = allFallback.filter(m => m.startsWith('opencode/'));
    if(fallback.length === 0) fallback.push('opencode/mimo-v2.5-free');
    await sleep(throttle + Math.random()*1000);
    
    for(let attempt=0; attempt<fallback.length; attempt++){
      const model = fallback[attempt];
      try{
        console.log(`[throttle] ${agent.device}/${model} intento ${attempt+1}`);
        const res = await callOpenCode(prompt, systemPrompt, model);
        return res;
      }catch(e){
        const msg = e.message||'';
        if(msg.includes('429') || msg.toLowerCase().includes('rate') || msg.includes('Too Many')){
          console.log(`[throttle] ${model} rate-limited, fallback...`);
          await sleep(5000 * (attempt+1)); // backoff exponencial
          continue;
        }
        throw e;
      }
    }
    throw new Error('Todos los modelos free rate-limited');
  }
}


function parseOverrides(prompt){
  let backendOverride = null; // null = usa config, 'llama', 'opencode', 'auto'
  let deviceFilter = null;
  let cleanPrompt = prompt;
  
  if(prompt.includes('--local')){
    backendOverride = 'llama';
    cleanPrompt = cleanPrompt.replace('--local','').trim();
  } else if(prompt.includes('--cloud')){
    backendOverride = 'opencode';
    cleanPrompt = cleanPrompt.replace('--cloud','').trim();
  } else if(prompt.includes('--auto')){
    backendOverride = 'auto';
    cleanPrompt = cleanPrompt.replace('--auto','').trim();
  }
  
  const deviceMatch = prompt.match(/--device=([\w,]+)/);
  if(deviceMatch){
    deviceFilter = deviceMatch[1].split(',').map(d=>d.trim());
    cleanPrompt = cleanPrompt.replace(deviceMatch[0],'').trim();
  }
  
  return { backendOverride, deviceFilter, cleanPrompt };
}


export async function handleSquadMessage(squad, prompt, from='user'){
  const squadConfig = GRANJA.squads[squad];
  const { backendOverride, deviceFilter, cleanPrompt } = parseOverrides(prompt);
  const effectivePrompt = cleanPrompt || prompt;

  if(!squadConfig) throw new Error(`squad ${squad} no existe`);

  if(!squadSessions.has(squad)){
    squadSessions.set(squad, { history:[], taskId:null, lastActivity:Date.now(), timeout:null });
  }
  const session = squadSessions.get(squad);
  session.lastActivity = Date.now();
  if(session.timeout) clearTimeout(session.timeout);
  const timeoutMs = (squadConfig.chat_timeout_minutes || 30) * 60 * 1000;
  session.timeout = setTimeout(()=> closeSquadSession(squad), timeoutMs);

  session.history.push({role:'user', content:effectivePrompt});
  if(session.history.length>30) session.history.splice(0, session.history.length-30);

  // === FAN-OUT con overrides configurables ===
  let agents = squadConfig.agents || [{model_ref:'code-review', device:'debian', backend:'llama', url:LLAMA, role:'reviewer'}];
  
  // Filtra por device si --device=
  if(deviceFilter){
    agents = agents.filter(a=> deviceFilter.includes(a.device));
  }
  // Override backend si --local/--cloud/--auto
  if(backendOverride){
    agents = agents.map(a=> ({...a, backend: backendOverride === 'auto' ? 'auto' : backendOverride }));
  }
  
  const effectivePromptForAgents = effectivePrompt;

  
  const promptForAgents = typeof effectivePromptForAgents !== 'undefined' ? effectivePromptForAgents : prompt;
  // Separa locales y nube
  const localAgents = agents.filter(a=> (a.backend||'llama')==='llama');
  const cloudAgents = agents.filter(a=> a.backend==='opencode');

  const results = [];

  // Locales en paralelo (hasta 3, GPU comparte, sin ban)
  if(localAgents.length>0){
    const localPromises = localAgents.map(async (agent)=>{
      try{
        const r = await throttledCall(agent, promptForAgents, session.history);
        return { model:agent.model_ref, device:agent.device, role:agent.role, response:r, ok:true };
      }catch(e){ return { model:agent.model_ref, device:agent.device, role:agent.role, response:e.message, ok:false }; }
    });
    const localResults = await Promise.allSettled(localPromises);
    for(const lr of localResults){
      if(lr.status==='fulfilled') results.push(lr.value);
      else results.push({ model:'unknown', device:'local', response:lr.reason, ok:false });
    }
  }

  // Nube secuencial con throttle (evita ban)
  for(const agent of cloudAgents){
    try{
      const r = await throttledCall(agent, promptForAgents, session.history);
      results.push({ model:agent.model_ref, device:agent.device, role:agent.role, response:r, ok:true });
    }catch(e){
      results.push({ model:agent.model_ref, device:agent.device, role:agent.role, response:e.message, ok:false });
    }
  }

  // === FAN-IN: sintetiza perspectivas ===
  const perspectivesText = results.map(r=> `[${r.device}/${r.model}/${r.role}]: ${r.response}`).join('\n---\n');
  const synthesisPrompt = `Sintetiza estas ${results.length} perspectivas sobre: "${prompt}"\n\n${perspectivesText}\n\nSintesis final en español, corta, accionable. Menciona quien dijo que.`;

  // usa llama local para sintesis (rapido, gratis)
  let synthesis;
  try{
    await boardStart('code-review');
    synthesis = await callLlamaWithHistory([...session.history, {role:'user', content:synthesisPrompt}], 'Sos el sintetizador del enjambre Alcon. Combinas multiples perspectivas en una respuesta coherente.');
    await boardStop();
  }catch{
    synthesis = perspectivesText.slice(0,2000);
  }

  session.history.push({role:'assistant', content:synthesis});
  saveConversation(squad);

  return synthesis;
}

export async function orchestrateTask(task){
  const squad = GRANJA.squads[task.squad||'code-audit'];
  if(!squad) throw new Error('squad no existe');
  const result = await handleSquadMessage(task.squad, task.text, 'task');
  const sess = squadSessions.get(task.squad);
  if(sess) sess.taskId = task.id || sess.taskId;
  const pendingPath=path.join(__dirname, 'memory', `pending-${new Date().toISOString().slice(0,10)}.md`);
  try{ fs.appendFileSync(pendingPath, `\n## ${new Date().toISOString()} ${task.squad} ${result.slice(0,2000)}\n`);}catch{}
  return { final: result, details:[], pendingPath };
}

export { squadSessions, saveConversation, closeSquadSession, sleep };
