import { writeFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Stamps the hashed build outputs into the service worker's precache list so the
// app shell (HTML + JS + CSS) is fully available offline, not just index.html.
function precacheAssets(): Plugin {
  return {
    name: 'precache-assets',
    apply: 'build',
    writeBundle(options, bundle) {
      const outDir = options.dir ?? resolve('dist')
      const swPath = resolve(outDir, 'sw.js')

      const assets = Object.keys(bundle)
        .filter((f) => f.endsWith('.js') || f.endsWith('.css'))
        .map((f) => `/${f}`)

      const shell = ['/', '/manifest.webmanifest', '/logo-192.png', '/logo-512.png', ...assets]

      const source = readFileSync(swPath, 'utf8')
      const stamped = source.replace(
        /const SHELL = \[[\s\S]*?\];/,
        `const SHELL = ${JSON.stringify(shell)};`
      )
      writeFileSync(swPath, stamped)

      // SPA fallback for `serve`, so refreshing a deep route doesn't 404.
      // Production hosts need their own equivalent rewrite rule.
      writeFileSync(
        resolve(outDir, 'serve.json'),
        JSON.stringify({ rewrites: [{ source: '**', destination: '/index.html' }] }, null, 2)
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), precacheAssets()],
  server: {
    // Lets the Cloudflare quick-tunnel (or any *.trycloudflare.com dev URL)
    // reach the dev server; Vite otherwise rejects unrecognized Host headers.
    allowedHosts: ['.trycloudflare.com'],
  },
})
