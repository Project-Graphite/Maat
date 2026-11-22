import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const siteUrl = (env) => (env.VITE_SITE_URL || 'http://localhost:8080').replace(/\/$/, '')

const siteUrlInHtml = (site) => ({
  name: 'maat-site-url',
  transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', site),
})

const siteUrlInPublicFiles = (site) => {
  let outDir
  return {
    name: 'maat-site-url-public',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      for (const name of ['robots.txt', 'sitemap.xml']) {
        const file = path.join(outDir, name)
        writeFileSync(file, readFileSync(file, 'utf8').replaceAll('%SITE_URL%', site))
      }
    },
  }
}

// Not Vite's loadEnv: the NODE_ENV=development in that file would turn `vite build` into a development build
const rootEnv = () => {
  const file = fileURLToPath(new URL('../.env', import.meta.url))
  return { ...(existsSync(file) && parseEnv(readFileSync(file, 'utf8'))), ...process.env }
}

export default defineConfig(() => {
  const env = rootEnv()
  const site = siteUrl(env)
  const origin = (env.FRONTEND_URL || 'http://localhost:8080').split(',')[0].trim()
  const backend = { target: env.BACKEND_URL || 'http://localhost:5000', changeOrigin: true, headers: { origin } }

  return {
    plugins: [react(), siteUrlInHtml(site), siteUrlInPublicFiles(site)],
    define: {
      __SITE_URL__: JSON.stringify(site),
      __CONTACT_EMAIL__: JSON.stringify(env.VITE_CONTACT_EMAIL || ''),
    },
    server: {
      proxy: {
        '/api': backend,
        '/health': backend,
        '/sitemap-problems.xml': backend,
        '/socket.io': { ...backend, ws: true },
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{js,jsx}'],
    },
    build: {
      chunkSizeWarningLimit: 4000,
    },
  }
})
