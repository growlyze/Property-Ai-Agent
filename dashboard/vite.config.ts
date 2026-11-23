import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // root: 'src', // This can cause routing issues, so we remove it.
  publicDir: './public',
  build: {
    outDir: '../build',
    emptyOutDir: true,
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3002,
    host: '127.0.0.1',
    // Allow Vite to manage HMR (default true). Optionally specify port explicitly:
    // hmr: { host: '127.0.0.1', port: 3002 },
    cors: true,
    // Mirror nginx.conf in dev: relative `/api` and `/uploads` calls (services/api.ts
    // uses baseURL '/api') go to the backend instead of falling back to index.html.
    proxy: {
      '/api': { target: process.env.VITE_DEV_API_TARGET || 'http://localhost:3001', changeOrigin: true },
      '/uploads': { target: process.env.VITE_DEV_API_TARGET || 'http://localhost:3001', changeOrigin: true },
    },
    watch: {
      usePolling: false,
    },
  },
  define: {
    'process.env.NODE_ENV': '"development"',
  },
});