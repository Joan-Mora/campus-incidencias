import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '');
  const apiTarget = `http://localhost:${env.PORT || 4000}`;
  const https = mode === 'https';

  return {
    envDir: repoRoot,
    plugins: [
      react(),
      tailwindcss(),
      ...(https ? [basicSsl()] : []),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'theme-init.js'],
        manifest: {
          name: 'El Campus También Se Daña',
          short_name: 'Campus',
          description: 'Reporta y atiende daños del campus en tiempo real',
          lang: 'es',
          theme_color: '#070b16',
          background_color: '#070b16',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,woff2}'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          navigateFallbackDenylist: [/^\/api/, /^\/ws/, /^\/uploads/],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/models/'),
              handler: 'CacheFirst',
              options: { cacheName: 'models', expiration: { maxEntries: 40 } },
            },
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/locations'),
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'locations' },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    resolve: {
      dedupe: ['three', 'react', 'react-dom'],
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/uploads': { target: apiTarget, changeOrigin: true },
        '/ws': { target: apiTarget.replace('http', 'ws'), ws: true },
      },
    },
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: {
            three: ['three', '@react-three/fiber', '@react-three/drei', 'maath'],
            charts: ['recharts'],
          },
        },
      },
    },
  };
});
