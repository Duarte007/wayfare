import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // MapLibre's worker is an ES module (it imports the code it shares with the main thread).
  worker: { format: 'es' },
  build: {
    rolldownOptions: {
      output: {
        // Shared chunks are named after every screen using them; a hash is enough.
        chunkFileNames: (chunk) =>
          chunk.name.startsWith('shared') ? 'assets/shared-[hash].js' : 'assets/[name]-[hash].js',
        // Lazy routes alone split the app into dozens of tiny shared chunks (one per icon or
        // Radix part), and every extra request costs a round trip, even from the service worker.
        codeSplitting: {
          groups: [
            // Everything the first screen needs, in the entry chunk instead of a dozen preloads.
            { name: 'index', tags: ['$initial'] },
            // Code shared by several screens, in a few chunks keyed by which screens use it.
            // Heavy, rarely used libraries keep their own chunk.
            {
              name: 'shared',
              test: (id) =>
                !/[\\/](maplibre-gl|pmtiles|@protomaps|zod|react-day-picker|date-fns)/.test(id),
              minShareCount: 2,
              entriesAware: true,
              entriesAwareMergeThreshold: 30_000,
            },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Wayfare',
        short_name: 'Wayfare',
        description: 'Your trip, maps and documents, even offline.',
        theme_color: '#f6f4ef',
        background_color: '#f6f4ef',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // Every chunk is precached (app shell, lazy routes, the date picker, all five locales), so
        // each screen and language opens in airplane mode after the first visit.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
