import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import netlify from '@netlify/vite-plugin-tanstack-start'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    netlify(),
    viteReact(),
  ],
  // The PWA files are plain static files in public/: manifest.webmanifest,
  // sw.js and the icons. vite-plugin-pwa emitted a manifest but never a
  // service worker under TanStack Start's two-pass build, so it is gone.
})

export default config
