/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // GitHub Pages serves project sites from /<repo>/; CI sets VITE_BASE, local dev stays at /
  base: process.env.VITE_BASE ?? '/',
  // phone testing over an HTTPS tunnel (`cloudflared tunnel --url http://localhost:5173`); the mic needs HTTPS
  server: { allowedHosts: ['.trycloudflare.com'] },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Clear',
        short_name: 'Clear',
        description: 'A calm, offline-first to-do list.',
        theme_color: '#f6f5f2',
        background_color: '#f6f5f2',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts'],
  },
});
