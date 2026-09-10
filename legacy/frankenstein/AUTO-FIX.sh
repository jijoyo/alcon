#!/bin/bash
cd ~/Documentos/alcon/server/go
cp orchestrator.go orchestrator.go.bak.$(date +%s)

# parchea: busca donde se define system prompt o prompt y agrega mapa
cat > /tmp/patch.py <<'PY'
import pathlib, re
p = pathlib.Path("orchestrator.go")
s = p.read_text()

# Si ya tiene systemPrompts no duplicar
if "systemPrompts" not in s:
    # Inserta mapa antes de throttledCall o donde se usa prompt
    inject = '''
var squadPrompts = map[string]string{
    "code-audit": "Eres auditor seguridad Go senior. Analiza SOLO el REPO CONTEXT dado. PROHIBIDO pedir ejecutar bash/find/cat. Devuelve: 1) 3 vulnerabilidades con severidad 2) diff unificado listo para aplicar. Formato conciso, sin explicaciones largas.",
    "performance": "Eres optimizador Go. Analiza REPO CONTEXT. No pidas bash. Devuelve diff que reduzca latencia 20% y RAM.",
    "arquitectura": "Eres arquitecto Go. Analiza REPO CONTEXT. No pidas bash. Devuelve mejoras en 5 bullets + diagrama ASCII.",
    "refactor": "Eres refactor Go. Analiza REPO CONTEXT. Devuelve diff limpio, idiomatico Go, sin pedir bash.",
}
func getSquadPrompt(squad string) string {
    if pr, ok := squadPrompts[squad]; ok { return pr }
    return "Analiza REPO CONTEXT, no pidas bash, devuelve hallazgos concisos y diff."
}
'''
    # inyecta después de getRepoContext
    s = s.replace("func getRepoContext()", inject + "
func getRepoContext()")
    p.write_text(s)
    print("inyectado squadPrompts")

# Segundo paso: reemplazar donde se usa prompt base por getSquadPrompt(squad) + repoContext + userPrompt
s = pathlib.Path("orchestrator.go").read_text()
# busca throttledCall y asegura que use getSquadPrompt
if "getSquadPrompt" in s and "throttledCall" in s:
    # intento de reemplazo simple: donde se concatena prompt, anteponer squad prompt
    s = re.sub(r'prompt := .*?getRepoContext\(\)', 'prompt := getSquadPrompt(squad) + "\n" + getRepoContext()', s)
    # si no matchea, al menos asegure que getRepoContext se use
    if "getRepoContext()" not in s:
        print("WARN no encontré uso de getRepoContext")
    pathlib.Path("orchestrator.go").write_text(s)
    print("parcheado throttledCall")

PY
python3 /tmp/patch.py

echo "[1/3] parcheado, compilando..."
go build -o alcon-go orchestrator.go
if [ $? -ne 0 ]; then
  echo "build fallo, restaurando"
  ls -t orchestrator.go.bak.* | head -1 | xargs -I{} cp {} orchestrator.go
  exit 1
fi
cp alcon-go ~/.local/bin/alcon
chmod +x ~/.local/bin/alcon
echo "[2/3] binario $(du -h alcon-go | cut -f1) en ~/.local/bin/alcon"
echo "[3/3] test rapido:"
~/.local/bin/alcon --squad code-audit --prompt "audita inyeccion OS.Getenv ALCON_REPO en getRepoContext" 2>&1 | head -80
