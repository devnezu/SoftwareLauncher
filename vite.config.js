import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

// Gera uma porta aleatória entre 3000 e 9000
const randomPort = Math.floor(Math.random() * (9000 - 3000 + 1)) + 3000;

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.js',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      },
      {
        entry: 'electron/performanceMonitor.js',
        vite: {
          build: {
            outDir: 'dist-electron'
          }
        }
      },
       {
        entry: 'electron/healthCheckMonitor.js',
        vite: {
          build: {
            outDir: 'dist-electron'
          }
        }
      },
      {
        entry: 'electron/projectAnalyzer.js',
        vite: {
          build: {
            outDir: 'dist-electron'
          }
        }
      }
    ]),
    renderer()
  ],
  server: {
    port: randomPort,
    strictPort: false, // Se a porta aleatória estiver ocupada, encontra a próxima disponível
    host: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
}));
