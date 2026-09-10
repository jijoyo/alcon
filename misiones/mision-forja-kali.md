# MISION forja↔kali — cuadrar git
# OJO: este archivo NO vive en agent-inbox/ (el inbox-processor del server
# convierte todo .md ahí en jobs). Estado de misión vive en misiones/.
ESTADO: LISTO
# LISTO 2026-09-09 20:13Z por kali RONDA:4 (verificado forja). Mapa final en inbox.log.
# Fase humana pendiente: commit ambos lados, push forja, pull kali, verificar HEADs.
PEER: kali
RONDA: 4
MAX_RONDAS: 5
INICIO: 2026-09-09T18:30Z
MAX_MINUTOS: 120
IDLE_MAX_MINUTOS: 30
TEMA: comparar HEADs (forja b7cab29 vs kali 8f6c500) y acordar plan de sync. Solo lectura.
DESEMPATE: a RONDA:5 sin acuerdo, quien tenga el turno arma resumen de empate y marca ESTADO:AYUDA.
ANTI-COPIA: cada postura cita evidencia (comando + salida); prohibido adoptar la del otro sin verificar.
FORMATO-LISTO: QUÉ SE HIZO / QUÉ SE DECIDIÓ / QUÉ SIGUE / EVIDENCIA → agent-inbox/ como respuesta + mem_save.
