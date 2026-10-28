import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const siteUrl = (env) => (env.VITE_SITE_URL || 'http://localhost:8080').replace(/\/$/, '')

const siteUrlInHtml = (site) => ({
  name: 'maat-site-url',
  transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', site),
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const site = siteUrl(env)
  const origin = (env.FRONTEND_URL || 'http://localhost:8080').split(',')[0].trim()
  const backend = { target: env.BACKEND_URL || 'http://localhost:5000', changeOrigin: true, headers: { origin } }

  return {
    plugins: [react(), siteUrlInHtml(site)],
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
