// server/lib/permisos.js — Whitelist de permisos por agente

const PERMISOS = {
  vps: {
    label: 'VPS (full access)',
    bash: true,
    write: true,
    deploy: true,
    git: true,
    net: true,
    chat: true,
    list: true,
    comms: true,
  },
  kali: {
    label: 'Kali (readonly + net)',
    bash: true,
    write: false,
    deploy: false,
    git: false,       // no git push a main
    gitRead: true,    // git pull, git status, git log
    net: true,        // curl, wget, ssh, scp, rsync
    chat: true,
    list: true,
    comms: true,
  },
  cel: {
    label: 'Cel (solo chat/list)',
    bash: false,
    write: false,
    deploy: false,
    git: false,
    net: false,
    chat: true,
    list: true,
    comms: true,
  },
  reina: {
    label: 'Reina (desarrollo pesado)',
    bash: true,
    write: true,
    deploy: false,
    git: true,
    net: true,
    chat: true,
    list: true,
    comms: true,
  },
  debian: {
    label: 'Debian (desarrollo)',
    bash: true,
    write: true,
    deploy: false,
    git: true,
    net: true,
    chat: true,
    list: true,
    comms: true,
  },
};

const WRITE_PATTERNS = [
  /^(git (add|commit|push|rm|checkout|merge|rebase|reset|cherry-pick))/,
  /^(npm (build|install|run|publish|uninstall))/,
  /^(yarn (add|remove|install|build))/,
  /^(pnpm (add|remove|install|build))/,
  /^(deploy\.sh)/,
  /^(rm -)/,
  /^(rmdir)/,
  /^(chmod)/,
  /^(chown)/,
  /^(systemctl)/,
  /^(reboot|shutdown|halt|poweroff)/,
  /^(mv|cp)\s/,
  /^(mkdir)\s/,
  /^(touch)\s/,
  /^(echo\s*>)/,
  /^(sed -i)/,
  /^(tee)/,
];

const DEPLOY_PATTERNS = [
  /^(deploy\.sh)/,
  /^(pm2 (restart|stop|delete|start))/,
  /^(systemctl)/,
  /^(reboot|shutdown)/,
];

const GIT_DANGEROUS_PATTERNS = [
  /^(git push)/,
  /^(git (checkout|switch)\s+(main|master))/,
  /^(git (merge|rebase)\s+(main|master))/,
  /^(git (reset|revert)\s+--hard)/,
];

const NET_ALLOWED = [
  /^(curl)/,
  /^(wget)/,
  /^(ssh)/,
  /^(scp)/,
  /^(rsync)/,
  /^(ping)/,
  /^(dig|nslookup)/,
  /^(netstat|ss)/,
  /^(ip |ifconfig|route)/,
];

function getPermisos(agentName) {
  return PERMISOS[agentName] || PERMISOS.kali;
}

function isWriteCommand(cmd) {
  return WRITE_PATTERNS.some(p => p.test(cmd));
}

function isDeployCommand(cmd) {
  return DEPLOY_PATTERNS.some(p => p.test(cmd));
}

function isGitDangerous(cmd) {
  return GIT_DANGEROUS_PATTERNS.some(p => p.test(cmd));
}

function isNetCommand(cmd) {
  return NET_ALLOWED.some(p => p.test(cmd));
}

function isGitReadCommand(cmd) {
  return /^git (status|log|diff|show|branch|remote|fetch|pull|stash list)/.test(cmd);
}

/**
 * Verifica si un agente puede ejecutar un comando.
 * @param {string} agentName
 * @param {string} cmd
 * @returns {{ allowed: boolean, reason: string }}
 */
function checkPermiso(agentName, cmd) {
  const perm = getPermisos(agentName);

  // Si bash no está habilitado, solo permitir chat/list
  if (!perm.bash && !perm.list) {
    return { allowed: false, reason: `${agentName}: sin permiso bash` };
  }

  // Deploy commands
  if (isDeployCommand(cmd)) {
    if (!perm.deploy) {
      return { allowed: false, reason: `${agentName}: sin permiso deploy` };
    }
    if (!perm.write) {
      return { allowed: false, reason: `${agentName}: sin permiso escritura` };
    }
  }

  // Git dangerous (push, merge a main, etc.)
  if (isGitDangerous(cmd)) {
    if (!perm.git) {
      return { allowed: false, reason: `${agentName}: sin permiso git write` };
    }
  }

  // Git read
  if (isGitReadCommand(cmd)) {
    if (perm.gitRead || perm.git || perm.bash) {
      return { allowed: true, reason: 'git read OK' };
    }
    return { allowed: false, reason: `${agentName}: sin permiso git read` };
  }

  // Write commands
  if (isWriteCommand(cmd)) {
    if (!perm.write) {
      return { allowed: false, reason: `${agentName}: sin permiso escritura` };
    }
  }

  // Net commands
  if (isNetCommand(cmd)) {
    if (!perm.net && !perm.bash) {
      return { allowed: false, reason: `${agentName}: sin permiso red` };
    }
  }

  // Default: si tiene bash, permitir
  if (perm.bash) {
    return { allowed: true, reason: 'bash OK' };
  }

  return { allowed: false, reason: `${agentName}: sin permiso bash` };
}

export { PERMISOS, getPermisos, checkPermiso, isWriteCommand, isDeployCommand, isGitDangerous };
