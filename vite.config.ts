import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const isCodespaces = Boolean(process.env.CODESPACES);

  return {
    plugins: [react(), tailwindcss()],

    server: {
      host: '0.0.0.0',

      // Allow forwarded GitHub Codespaces URLs such as:
      // https://<codespace-name>-3000.app.github.dev
      allowedHosts: ['.app.github.dev'],

      // Codespaces exposes the development server through HTTPS/WSS.
      hmr: isCodespaces
        ? {
            protocol: 'wss',
            clientPort: 443,
          }
        : undefined,
    },

    build: {
      outDir: 'dist/client',

      // Keep chart dependencies separate from application code.
      rollupOptions: {
        output: {
          manualChunks: {
            charts: ['recharts'],
            vendor: ['react', 'react-dom'],
          },
        },
      },

      chunkSizeWarningLimit: 700,
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});