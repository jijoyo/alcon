#!/bin/bash
cd ~/Documentos/alcon/server/go
cp orchestrator.go orchestrator.go.bak.$(date +%s)
cat > /tmp/patch.py <<'PY'
import pathlib, re
p = pathlib.Path("orchestrator.go")
s = p.read_text()
if "squadPrompts" not in s:
    inject = '''
var squadPrompts = map[string]string{
    "code-audit": "Eres auditor seguridad Go senior. Analiza SOLO el REPO CONTEXT dado. PROHIBIDO pedir ejecutar bash/find/cat. Devuelve: 1) 3 vulnerabilidades con severidad 2) diff unificado listo para aplicar. Formato conciso.",
    "performance": "Eres optimizador Go. Analiza REPO CONTEXT. No pidas bash. Devuelve diff que reduzca latencia 20% y RAM.",
    "arquitectura": "Eres arquitecto Go. Analiza REPO CONTEXT. No pidas bash. Devuelve 5 bullets + diagrama ASCII.",
    "refactor": "Eres refactor Go. Analiza REPO CONTEXT. Devuelve diff limpio idiomatico.",
}
func getSquadPrompt(squad string) string {
    if pr, ok := squadPrompts[squad]; ok { return pr }
    return "Analiza REPO CONTEXT, no pidas bash, devuelve hallazgos concisos y diff."
}
'''
    s = s.replace("func getRepoContext()", inject + "\nfunc getRepoContext()")
    p.write_text(s)
    print("inyectado squadPrompts")
PY
python3 /tmp/patch.py
go build -o alcon-go orchestrator.go
cp alcon-go ~/.local/bin/alcon
chmod +x ~/.local/bin/alcon
echo "OK $(du -h alcon-go | cut -f1) listo"
