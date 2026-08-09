import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:3003',
      '/health': 'http://localhost:3003',
      '/enjambre': { target: 'http://localhost:3003', ws: true }
    }
  },
  preview: {
    port: 3004,
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:3003',
      '/health': 'http://localhost:3003',
      '/enjambre': { target: 'http://localhost:3003', ws: true }
    }
  }
});
