import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/linkedin-api': {
        target: 'https://api.linkedin.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/linkedin-api/, '')
      }
    }
  }
});

