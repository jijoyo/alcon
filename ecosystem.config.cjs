module.exports = {
  apps: [
    {
      name: 'alcon-api',
      script: './server/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: { PORT: 3002, NODE_ENV: 'production' },
      max_memory_restart: '200M',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: 10000,
      kill_timeout: 5000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true
    },
    {
      name: 'vps-agent',
      script: './agents/agent.js',
      args: 'vps http://100.102.63.30:3002'
    }
  ]
};
