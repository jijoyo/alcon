#!/usr/bin/env node
<<<<<<< HEAD
import http from 'http';
import { io } from 'socket.io-client';

const AGENT_NAME = process.argv[2] || 'kali';
const SERVER_URL = process.argv[3] || 'http://localhost:3002';
const POLL_INTERVAL = 30_000;
const HEARTBEAT_INTERVAL = 120_000;
=======

// Alcon Agent - Polls task server and executes tasks
// Usage: node agent.js <agent-name> <server-url> <execute-fn>

import http from 'http';

const AGENT_NAME = process.argv[2] || 'kali';
const SERVER_URL = process.argv[3] || 'http://localhost:3002';
const POLL_INTERVAL = 30_000; // 30 seconds
const HEARTBEAT_INTERVAL = 120_000; // 2 minutes
>>>>>>> 501e4787b8af408c102b01432baee0443d3a1985

let activeTask = null;
let heartbeatTimer = null;

function request(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, SERVER_URL);
<<<<<<< HEAD
    const options = { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: { 'Content-Type': 'application/json' } };
    const req = http.request(options, (res) => {
      let data=''; res.on('data',c=>data+=c); res.on('end',()=>{ try{resolve(JSON.parse(data))}catch{resolve({raw:data})} });
    });
    req.on('error', reject);
    req.setTimeout(10000, ()=>{ req.destroy(); reject(new Error('timeout')); });
=======
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10_000, () => { req.destroy(); reject(new Error('timeout')); });

>>>>>>> 501e4787b8af408c102b01432baee0443d3a1985
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
<<<<<<< HEAD
function log(m){ console.log(`[${new Date().toISOString()}] [${AGENT_NAME}] ${m}`); }

// === PRESENCIA REAL ===
const socketUrl = SERVER_URL + '/enjambre';
const socket = io(socketUrl, { transports:['websocket','polling'] });
socket.on('connect', ()=>{ log(`WS conectado ${socket.id}`); socket.emit('chat:join',{name:AGENT_NAME}); });
socket.on('disconnect', ()=>log('WS desconectado'));
setInterval(()=>{ if(socket.connected) socket.emit('chat:heartbeat'); },5000);
const typing = (v)=>{ if(socket.connected) socket.emit(v?'typing:start':'typing:stop'); };

async function heartbeat(){ if(!activeTask) return; try{ await request('POST',`/api/task/${activeTask.id}/heartbeat`,{owner:AGENT_NAME}); }catch{} }

async function processTask(task){
  log(`Procesando ${task.id}: ${task.text}`);
  activeTask=task; heartbeatTimer=setInterval(heartbeat,HEARTBEAT_INTERVAL); typing(true);
  try{
    await request('POST',`/api/task/${task.id}/message`,{from:AGENT_NAME,text:`Procesando: ${task.text}`});
    await new Promise(r=>setTimeout(r,3000));
    const result=`Tarea "${task.text}" completada por ${AGENT_NAME}`;
    await request('POST',`/api/task/${task.id}/complete`,{owner:AGENT_NAME,result});
    log(`Completada ${task.id}`);
  }catch(e){ log(`Error ${e.message}`); await request('POST',`/api/task/${task.id}/error`,{owner:AGENT_NAME,error:e.message}).catch(()=>{}); }
  finally{ clearInterval(heartbeatTimer); typing(false); activeTask=null; }
}

async function poll(){
  if(activeTask) return;
  try{
    const data=await request('GET',`/api/tasks?agent=${AGENT_NAME}&status=pendiente`);
    if(!data.tasks?.length) return;
    const task=data.tasks.sort((a,b)=>new Date(a.created)-new Date(b.created))[0];
    const claimed=await request('POST',`/api/task/${task.id}/claim`,{owner:AGENT_NAME}).catch(()=>null);
    if(claimed?.status==='en_proceso') await processTask(claimed);
  }catch(e){ log(`Poll: ${e.message}`); }
}

log(`Iniciando con presencia -> ${socketUrl}`);
poll(); setInterval(poll,POLL_INTERVAL);
=======

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${AGENT_NAME}] ${msg}`);
}

async function heartbeat() {
  if (!activeTask) return;
  try {
    await request('POST', `/api/task/${activeTask.id}/heartbeat`, { owner: AGENT_NAME });
    log(`Heartbeat sent for task ${activeTask.id}`);
  } catch (e) {
    log(`Heartbeat failed: ${e.message}`);
  }
}

async function processTask(task) {
  log(`Processing task ${task.id}: ${task.text}`);
  activeTask = task;

  // Start heartbeat
  heartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL);

  try {
    // Send status message
    await request('POST', `/api/task/${task.id}/message`, {
      from: AGENT_NAME,
      text: `Procesando tarea: ${task.text}`
    });

    // Simulate work (replace with actual task execution)
    log(`Executing: ${task.text}`);
    await new Promise(r => setTimeout(r, 5000)); // Simulated work

    // Complete task
    const result = `Tarea "${task.text}" completada por ${AGENT_NAME}`;
    await request('POST', `/api/task/${task.id}/complete`, {
      owner: AGENT_NAME,
      result
    });

    await request('POST', `/api/task/${task.id}/message`, {
      from: AGENT_NAME,
      text: result
    });

    log(`Task ${task.id} completed`);
  } catch (e) {
    log(`Task ${task.id} failed: ${e.message}`);
    await request('POST', `/api/task/${task.id}/error`, {
      owner: AGENT_NAME,
      error: e.message
    }).catch(() => {});
  } finally {
    clearInterval(heartbeatTimer);
    activeTask = null;
  }
}

async function poll() {
  try {
    if (activeTask) return; // Already processing

    const data = await request('GET', `/api/tasks?agent=${AGENT_NAME}&status=pendiente`);
    if (!data.tasks || data.tasks.length === 0) return;

    // Sort by created (oldest first)
    const sorted = data.tasks.sort((a, b) => new Date(a.created) - new Date(b.created));
    const task = sorted[0];

    // Try to claim
    try {
      const claimed = await request('POST', `/api/task/${task.id}/claim`, { owner: AGENT_NAME });
      if (claimed.status === 'en_proceso') {
        await processTask(claimed);
      }
    } catch (e) {
      if (e.message?.includes('409')) {
        log(`Task ${task.id} already claimed by another agent`);
      } else {
        log(`Claim failed: ${e.message}`);
      }
    }
  } catch (e) {
    log(`Poll error: ${e.message}`);
  }
}

// Register agent
async function register() {
  try {
    await request('POST', '/api/ping', { agent: AGENT_NAME });
    log(`Registered with server`);
  } catch (e) {
    log(`Registration failed: ${e.message}`);
  }
}

log(`Starting agent (server: ${SERVER_URL})`);

process.on('unhandledRejection', (err) => {
  log(`Unhandled rejection: ${err.message || err}`);
});

await register();
setInterval(poll, POLL_INTERVAL);
poll().catch(e => log(`Initial poll error: ${e.message}`));
>>>>>>> 501e4787b8af408c102b01432baee0443d3a1985
