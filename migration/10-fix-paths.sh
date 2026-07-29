#!/bin/bash
# 10-fix-paths.sh — Ajustar paths de Kali → Debian en configs
set -e

echo "╔══════════════════════════════════════╗"
echo "║  FASE 10: Fix paths Kali → Debian    ║"
echo "╚══════════════════════════════════════╝"

# --- Fix opencode.jsonc ---
OPENCODE_CONFIG="$HOME/.config/opencode/opencode.jsonc"
if [ -f "$OPENCODE_CONFIG" ]; then
    echo ""
    echo "=== opencode.jsonc ==="
    
    # Backup
    cp "$OPENCODE_CONFIG" "$OPENCODE_CONFIG.bak.$(date +%Y%m%d)"
    
    # Fix paths: Kali /home/jijoyo → Debian /home/$USER
    sed -i "s|/home/jijoyo|/home/$USER|g" "$OPENCODE_CONFIG"
    
    # Fix ollama service path
    OLLAMA_SERVICE="$HOME/.config/systemd/user/ollama.service"
    if [ -f "$OLLAMA_SERVICE" ]; then
        sed -i "s|/home/jijoyo/.local/bin/ollama|/usr/bin/ollama|g" "$OLLAMA_SERVICE"
        echo "   ollama.service: path ajustado a /usr/bin/ollama"
    fi
    
    echo "   opencode.jsonc: paths ajustados a /home/$USER"
else
    echo "⚠️  opencode.jsonc no encontrado — configurar manualmente"
fi

# --- Fix AGENTS.md global ---
AGENTS_MD="$HOME/.config/opencode/AGENTS.md"
if [ -f "$AGENTS_MD" ]; then
    echo ""
    echo "=== AGENTS.md ==="
    
    # Backup
    cp "$AGENTS_MD" "$AGENTS_MD.bak.$(date +%Y%m%d)"
    
    # Actualizar sección Entorno
    sed -i 's|Kali Linux (dual-boot con Windows, NTFS solo-lectura)|Debian 13 (trixie)|g' "$AGENTS_MD"
    sed -i 's|Con sudo.*|Con sudo: disponible|g' "$AGENTS_MD"
    sed -i 's|udisksctl mount.*|N/A|g' "$AGENTS_MD"
    
    echo "   AGENTS.md: Entorno actualizado a Debian 13"
else
    echo "⚠️  AGENTS.md no encontrado"
fi

# --- Fix .bashrc ---
BASHRC="$HOME/.bashrc"
if [ -f "$BASHRC" ]; then
    echo ""
    echo "=== .bashrc ==="
    
    # Backup
    cp "$BASHRC" "$BASHRC.bak.$(date +%Y%m%d)"
    
    # Ajustar PATH para Go en Debian (installed via /usr/local)
    if ! grep -q '/usr/local/go/bin' "$BASHRC"; then
        echo 'export PATH="/usr/local/go/bin:$HOME/go/bin:$PATH"' >> "$BASHRC"
        echo "   .bashrc: PATH Go agregado"
    fi
    
    echo "   .bashrc: listo"
fi

echo ""
echo "✅ Paths ajustados"
echo "Siguiente: 99-verify.sh"
