import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    minify: 'esbuild',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Heavy chart library — only loaded on Analytics page
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'charts';
            }
            // Animation library — used everywhere but worth its own chunk
            if (id.includes('framer-motion')) {
              return 'motion';
            }
            // Icons
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            // React core
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/scheduler/')
            ) {
              return 'react-vendor';
            }
            // Router
            if (id.includes('react-router')) {
              return 'router';
            }
            // Document export utilities — used in admin only
            if (id.includes('docx')) {
              return 'docx';
            }
            // Everything else from node_modules
            return 'vendor';
          }
        },
      },
    },
  },
});
