module.exports = {
  apps: [
    {
      name: 'alcon-api',
      script: './server/server.js',
      env: { PORT: 3003, NODE_ENV: 'production', LLAMA_URL: process.env.LLAMA_URL || 'http://localhost:8080' }
    },
    {
      name: 'alcon-pwa',
      cwd: './pwa',
      script: './node_modules/.bin/vite',
      args: 'preview --host 0.0.0.0 --port 3004',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'vps-agent',
      script: './agents/agent.js',
      args: 'vps http://100.102.63.30:3003'
    }
  ]
};
