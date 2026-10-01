import basicSsl from '@vitejs/plugin-basic-ssl';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const API_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:8787';
// The sync service (SRS 11.2). Proxied so the page (https) can reach it as wss on its own origin.
const SYNC_TARGET = process.env.SYNC_PROXY_TARGET ?? 'ws://localhost:8790';
// E2E runs on its own port so it never reuses (or fights with) a running `pnpm dev`.
const WEB_PORT = Number(process.env.WEB_PORT ?? 5173);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Local HTTPS so the camera works in dev (SRS 14.1). Self-signed; no mkcert needed.
    // PLAIN_HTTP=1 turns it off for the offline E2E: Chrome won't register a service worker on a
    // self-signed certificate, but http://localhost counts as a secure context.
    ...(process.env.PLAIN_HTTP ? [] : [basicSsl()]),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Shelf Life',
        short_name: 'Shelf Life',
        description: 'Use it before you lose it.',
        start_url: '/',
        display: 'standalone',
        // Manifest colors must be literal values; these match --cream and --navy in tokens.css.
        background_color: '#FFFBF3',
        theme_color: '#4D5C9F',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell so every page opens offline (SRS 12.4).
        globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
        // The OCR engine (~7 MB) isn't precached: it downloads the first time Scan is opened and is
        // then cached for offline use (approved Milestone 3 decision).
        globIgnores: ['ocr/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/ocr/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'shelf-life-ocr',
              expiration: { maxEntries: 10 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/sync\//],
      },
    }),
  ],
  server: {
    port: WEB_PORT,
    strictPort: true,
    // Same-origin API in dev keeps the SameSite=Lax session cookie working.
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
      '/sync': { target: SYNC_TARGET, ws: true, rewrite: (path) => path.replace(/^\/sync/, '') },
    },
  },
  preview: {
    port: WEB_PORT,
    strictPort: true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
      '/sync': { target: SYNC_TARGET, ws: true, rewrite: (path) => path.replace(/^\/sync/, '') },
    },
  },
});
