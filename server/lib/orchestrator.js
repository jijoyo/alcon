
import fs from 'fs';
const GRANJA = JSON.parse(fs.readFileSync('./lib/granja.json','utf8'));
const REGISTRY = JSON.parse(fs.readFileSync('./lib/model-registry.json','utf8'));
const API_BOARD = 'http://localhost:9998';
const LLAMA = 'http://localhost:8080';

async function boardStart(modelKey){
  const entry = REGISTRY.registry[modelKey];
  const boardKey = entry?.board_key || modelKey;
  console.log(`[orchestrator] start ${modelKey} -> board:${boardKey}`);
  await fetch(`${API_BOARD}/start?model=${boardKey}`, {method:'POST'}).catch(async()=>{
    await fetch(`${API_BOARD}/start`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({model:boardKey})}).catch(()=>{});
  });
  for(let i=0;i<30;i++){
    try{ const h=await fetch(`${LLAMA}/health`); if(h.ok) return; }catch{}
    await new Promise(r=>setTimeout(r,1000));
  }
}
async function boardStop(){ try{ await fetch(`${API_BOARD}/stop`,{method:'POST'});}catch{} }
function injectCode(prompt){
  const codeRoot = import.meta.dirname + '/../..';
  const patterns = [
    /(?:revisa|analiza|audita|check|lee)\s+([\w\/\.\-]+(?:\.js|\.ts|\.json|\.md))/gi,
    /(server\/server\.js|server\.js|routes\/[\w\-]+\.js|lib\/[\w\-]+\.js)/gi
  ];
  let code = '';
  for(const re of patterns){
    for(const m of prompt.matchAll(re)){
      const filePath = m[1];
      const full = filePath.startsWith('/') ? filePath : `${codeRoot}/${filePath}`;
      try{
        const content = fs.readFileSync(full,'utf8').slice(0,12000);
        code += `\n=== CODIGO REAL ${filePath} ===\n${content}\n=== FIN CODIGO ===\n`;
      }catch{}
    }
  }
  return code ? `${prompt}\n\n${code}` : prompt;
}
async function callLlama(prompt){
  const res = await fetch(`${LLAMA}/v1/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'local',messages:[{role:'user',content:prompt}],stream:false})});
  const j=await res.json(); return j.choices?.[0]?.message?.content||'';
}
export async function orchestrateTask(task){
  const squad = GRANJA.squads[task.squad||'code-audit'];
  const atomics = squad.pattern==='proxy-atomico'? task.text.split(/\s+y\s+|,|;/).map(t=>t.trim()).filter(Boolean).slice(0,8) : [task.text];
  const all=[];
  for(const atomic of atomics){
    const round=[];
    for(const agent of squad.agents){
      try{ await boardStart(agent.model_ref); const r=await callLlama(`[${agent.role}] ${injectCode(atomic)}`); round.push({role:agent.role,result:r}); await boardStop(); }
      catch(e){ round.push({role:agent.role,error:e.message}); await boardStop(); }
    }
    all.push({atomic, results:round});
  }
  await boardStart('code-review');
  const final = await callLlama(`Sintetiza squad ${squad.pattern}: ${JSON.stringify(all).slice(0,8000)}`);
  await boardStop();
  const pendingPath=`./lib/memory/pending-${new Date().toISOString().slice(0,10)}.md`;
  fs.appendFileSync(pendingPath, `\n## ${new Date().toISOString()} ${task.squad} ${final.slice(0,2000)}\n`);
  return {final, details:all, pendingPath};
}
