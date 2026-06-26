import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  // HMR is disabled in AI Studio via DISABLE_HMR env var (prevents flicker during agent edits).
  const disableHmr = process.env.DISABLE_HMR === 'true';
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: true,
      hmr: !disableHmr,
      watch: disableHmr ? null : {},
      // Dev: proxy API calls to the backend so the frontend can call /api/*
      // (in production, nginx performs the same proxying).
      proxy: {
        '/api': { target: 'http://localhost:5000', changeOrigin: true },
        '/health': { target: 'http://localhost:5000', changeOrigin: true },
      },
    },
  };
});
