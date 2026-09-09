# Graph Report - alcon  (2026-09-08)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 657 nodes · 1086 edges · 77 communities (36 shown, 26 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7b667fef`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 56
- Community 57
- Community 58
- Community 60
- Community 61
- Community 62
- Community 63
- Community 68

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 17 edges
2. `tasksRoutes()` - 16 edges
3. `getSocket()` - 15 edges
4. `connectSocket()` - 15 edges
5. `ChatView()` - 13 edges
6. `react` - 12 edges
7. `agentColor()` - 11 edges
8. `timeAgo()` - 11 edges
9. `jobsRoutes()` - 11 edges
10. `Task` - 10 edges

## Surprising Connections (you probably didn't know these)
- `connectSocket()` --calls--> `checkPermiso()`  [EXTRACTED]
  agents/agent.js → server/lib/permisos.js
- `TaskCardProps` --references--> `Task`  [EXTRACTED]
  pwa/src/components/TaskCard.tsx → pwa/src/lib/api.ts
- `TaskChatProps` --references--> `Task`  [EXTRACTED]
  pwa/src/components/TaskChat.tsx → pwa/src/lib/api.ts
- `TaskInputProps` --references--> `Task`  [EXTRACTED]
  pwa/src/components/TaskInput.tsx → pwa/src/lib/api.ts
- `TaskListProps` --references--> `Task`  [EXTRACTED]
  pwa/src/components/TaskInput.tsx → pwa/src/lib/api.ts

## Import Cycles
- None detected.

## Communities (77 total, 26 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (55): App(), View, ChatView(), AGENT_COLORS, AGENTS, InterruptorMaestro(), KanbanBoard(), STAGES (+47 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (42): AGENTS, STOP_WORDS, activeSessions, advanceStage(), agentRunning, broadcastPresence(), cleanupSessionByTaskId(), commsEnabled (+34 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (38): Detail, Device, Granja, OrchestrateRequest, OrchestrateResponse, Result, SquadConfig, net/http.Request (+30 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (33): AGENTS_DIR, buildOpencodeArgs(), claimTask(), completeTask(), connectSocket(), fastReply(), fetchTaskMessages(), findSessionIdByTitle() (+25 more)

### Community 4 - "Community 4"
Cohesion: 0.10
Nodes (27): better-sqlite3, db, dbPath, __dirname, result, db, DB_PATH, __dirname (+19 more)

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (20): boardStart(), callLlama(), callLlamaWithHistory(), callOpenCode(), closeSquadSession(), CONVERSATIONS_DIR, __dirname, handleSquadMessage() (+12 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (18): boardStart(), boardStop(), callLlama(), callLlamaWithHistory(), callOpenCode(), closeSquadSession(), CONVERSATIONS_DIR, __dirname (+10 more)

### Community 7 - "Community 7"
Cohesion: 0.20
Nodes (18): callLlama(), callOpenCode(), contains(), containsPrefix(), fanOut(), isDead(), main(), markDead() (+10 more)

### Community 8 - "Community 8"
Cohesion: 0.18
Nodes (18): get, ndarray, cache_paths(), chunk_text(), dir_hash(), embed_batch(), embed_one(), health() (+10 more)

### Community 9 - "Community 9"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleDetection (+10 more)

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (13): ARTIFACTS_DIR, __dirname, espanolRoutes(), TRAD, __dirname, granjaRoutes(), __dirname, radarStatusRoutes() (+5 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (16): name, private, type, version, autoprefixer, @capacitor/android, @capacitor/core, clsx (+8 more)

### Community 12 - "Community 12"
Cohesion: 0.21
Nodes (15): chunkDocument(), chunks, computeIDF(), computeTF(), cosineSimilarity(), __dirname, DOCS_DIR, idf (+7 more)

### Community 13 - "Community 13"
Cohesion: 0.23
Nodes (13): chunkDocument(), chunks, computeIDF(), computeTF(), cosineSimilarity(), __dirname, DOCS_DIR, idf (+5 more)

### Community 14 - "Community 14"
Cohesion: 0.17
Nodes (12): __dirname, edges, granja, GRANJA_PATH, granjaLines, graph, GRAPH_PATH, HTML_PATH (+4 more)

### Community 15 - "Community 15"
Cohesion: 0.42
Nodes (11): claimJob(), completeJob(), createJob(), failJob(), getActiveJobs(), getJobRuns(), getPendingJobs(), now() (+3 more)

### Community 16 - "Community 16"
Cohesion: 0.17
Nodes (11): fastify, @fastify/cors, @fastify/multipart, socket.io, name, scripts, dev, start (+3 more)

### Community 17 - "Community 17"
Cohesion: 0.23
Nodes (9): close(), DB_PATH, __dirname, open(), SCHEMA_PATH, CHAT_FILE, DATA_FILE, __dirname (+1 more)

### Community 18 - "Community 18"
Cohesion: 0.23
Nodes (10): close(), DB_PATH, __dirname, open(), SCHEMA_PATH, CHAT_FILE, DATA_FILE, __dirname (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.18
Nodes (11): dependencies, @capacitor/android, @capacitor/cli, @capacitor/core, clsx, lucide-react, react, react-dom (+3 more)

### Community 20 - "Community 20"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, orientation, short_name, start_url (+1 more)

### Community 21 - "Community 21"
Cohesion: 0.22
Nodes (8): dependencies, execa, socket.io-client, name, type, version, socket.io-client, execa

### Community 22 - "Community 22"
Cohesion: 0.33
Nodes (5): androidx.test.ext.junit.runners.AndroidJUnit4, org.junit.runner.RunWith, org.junit.Test, ExampleInstrumentedTest, ExampleUnitTest

### Community 23 - "Community 23"
Cohesion: 0.22
Nodes (9): devDependencies, autoprefixer, postcss, tailwindcss, @types/react, @types/react-dom, typescript, vite (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.28
Nodes (3): floorRelease(), floorRequest(), grantFloor()

### Community 25 - "Community 25"
Cohesion: 0.38
Nodes (6): ../lib/orchestrator.js, __dirname, GRANJA_SQUADS, granjaCache, log(), registerChat()

### Community 26 - "Community 26"
Cohesion: 0.29
Nodes (6): fs, { io }, LOG, path, SEND, socket

### Community 27 - "Community 27"
Cohesion: 0.33
Nodes (6): get(), __dirname, INBOX_DIR, PROCESSED_DIR, scanInbox(), startInboxWatcher()

### Community 28 - "Community 28"
Cohesion: 0.29
Nodes (7): dependencies, better-sqlite3, fastify, @fastify/cors, @fastify/multipart, socket.io, socket.io-client

### Community 29 - "Community 29"
Cohesion: 0.47
Nodes (5): EngramAutosave(), maybeSave(), loadState(), saveCheckpoint(), STATE_FILE

### Community 30 - "Community 30"
Cohesion: 0.60
Nodes (5): checkJson(), checkPage(), detectEnv(), healthMapRoutes(), hosts()

### Community 31 - "Community 31"
Cohesion: 0.80
Nodes (4): check_ssh(), copy_db(), log(), recolectar-granja.sh script

### Community 32 - "Community 32"
Cohesion: 0.50
Nodes (4): __dirname, discover(), run(), RUNTIME_PATH

### Community 33 - "Community 33"
Cohesion: 0.60
Nodes (4): getOpenRouterKey(), getSecret(), readFirst(), warned

### Community 34 - "Community 34"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

### Community 35 - "Community 35"
Cohesion: 0.50
Nodes (4): scripts, build, dev, preview

## Knowledge Gaps
- **216 isolated node(s):** `View`, `StatusPanelProps`, `AgentStatus`, `LOG`, `AGENT_COLORS` (+211 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 280 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `socket.io-client` connect `Community 21` to `Community 16`, `Community 11`?**
  _High betweenness centrality (0.156) - this node is a cross-community bridge._
- **Why does `better-sqlite3` connect `Community 4` to `Community 16`, `Community 17`, `Community 18`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `react` connect `Community 0` to `Community 11`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `tasksRoutes()` (e.g. with `formatTask()` and `server.js`) actually correct?**
  _`tasksRoutes()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `View`, `StatusPanelProps`, `AgentStatus` to the rest of the system?**
  _216 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.0777489818585709 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07686274509803921 - nodes in this community are weakly interconnected._