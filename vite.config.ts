import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import { createSaveStripHandler } from './server/saveStrip.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'GOOGLE_DRIVE_')
  return {
    plugins: [vue(), {
      name: 'local-drive-upload',
      configureServer(server) {
        const handler = createSaveStripHandler(() => ({
          url: process.env.GOOGLE_DRIVE_UPLOAD_URL ?? env.GOOGLE_DRIVE_UPLOAD_URL,
          secret: process.env.GOOGLE_DRIVE_UPLOAD_SECRET ?? env.GOOGLE_DRIVE_UPLOAD_SECRET,
        }))
        server.middlewares.use((request, response, next) => {
          if (request.url?.split('?')[0] !== '/api/save-strip') return next()
          void handler(request, response).catch(() => {
            if (!response.headersSent) {
              response.statusCode = 500
              response.setHeader('Content-Type', 'application/json')
              response.end(JSON.stringify({ error: 'Your strip could not be saved. Please download it instead.' }))
            }
          })
        })
      },
    }],
  }
})
