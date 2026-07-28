import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'dist/client',
      // Recharts and its d3 dependencies are ~60% of the bundle and change far
      // less often than app code, so they get their own long-cached chunk.
      // This keeps the first paint light on large profiles and means a copy
      // deploy only invalidates the small app chunk.
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
