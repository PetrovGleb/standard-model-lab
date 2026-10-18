/* Vite configuration: React plugin and a proxy from /api to the NestJS API in dev and preview. */
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiUrl = process.env.API_URL ?? 'http://localhost:3000';
const proxy = { '/api': { target: apiUrl, changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
});
