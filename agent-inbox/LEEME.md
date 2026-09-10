# LEEME — agent-inbox/ (cola de tareas, NO bodega)
1. Aquí SOLO entran `msg-*.md` y `task-*.md`. Todo lo demás se ignora.
2. El server (`lib/inbox-processor.js`, watcher cada 30s) convierte cada
   msg/task en un job backlog y mueve el archivo a `.processed/`.
3. NO pongas estado, misiones ni notas aquí: se vuelven jobs en silencio.
   Estado de misión vive en `misiones/`.
4. Quien deja un msg/task, avisa por socket (`send.txt`) para que alguien lo lea.
