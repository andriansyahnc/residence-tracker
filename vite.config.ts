import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import netlify from '@netlify/vite-plugin-tanstack-start'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    netlify(),
    viteReact(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Residence Tracker',
        short_name: 'Residence',
        lang: 'id',
        display: 'standalone',
        start_url: '/',
        background_color: '#ffffff',
        theme_color: '#0f172a',
      },
      workbox: {
        navigateFallback: '/',
      },
    }),
  ],
})

export default config
