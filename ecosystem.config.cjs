module.exports = {
  apps: [
    {
      name: 'alcon-api',
      script: './server/server.js',
      env: { PORT: 3003, NODE_ENV: 'production', LLAMA_URL: process.env.LLAMA_URL || 'http://localhost:8080', QDRANT_URL: process.env.QDRANT_URL || 'http://localhost:6333' }
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
      args: 'vps',
      env: {
        ALCON_WORKDIR: process.env.ALCON_WORKDIR || '/home/ubuntu/alcon',
        LLAMA_URL: process.env.LLAMA_URL || 'http://100.121.64.26:8080',
        BOARD_API_URL: process.env.BOARD_API_URL || 'http://100.121.64.26:9998'
      }
    }
  ]
};
