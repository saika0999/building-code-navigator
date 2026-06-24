import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'
import { sources } from './src/data/sources'

function sanitizePathPart(value: string) {
  return value.replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
}

function sourceLibraryPath(source: (typeof sources)[number]) {
  const region = sanitizePathPart(source.jurisdiction)
  const fileName = sanitizePathPart(source.code ?? source.id)
  return `local-library/documents/${region}/${fileName}.pdf`
}

function readRequestBody(request: import('node:http').IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
    })
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

function localSourceLibraryPlugin() {
  return {
    name: 'local-source-library',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/api/source-library/download', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        try {
          const body = JSON.parse(await readRequestBody(request)) as { sourceId?: string }
          const source = sources.find((item) => item.id === body.sourceId)

          if (!source) {
            response.statusCode = 404
            response.end(JSON.stringify({ error: 'Source not found' }))
            return
          }

          if (!source.downloadUrl) {
            response.statusCode = 422
            response.end(JSON.stringify({ error: 'This source has no direct official download URL' }))
            return
          }

          const relativePath = sourceLibraryPath(source)
          const absolutePath = path.resolve(server.config.root, relativePath)
          const libraryRoot = path.resolve(server.config.root, 'local-library')

          if (!absolutePath.startsWith(libraryRoot + path.sep)) {
            response.statusCode = 400
            response.end(JSON.stringify({ error: 'Invalid local library path' }))
            return
          }

          const downloadResponse = await fetch(source.downloadUrl, {
            headers: {
              'User-Agent': 'building-code-navigator-local-library/0.1',
            },
          })

          if (!downloadResponse.ok) {
            response.statusCode = 502
            response.end(JSON.stringify({ error: `Official download failed: ${downloadResponse.status}` }))
            return
          }

          const buffer = Buffer.from(await downloadResponse.arrayBuffer())
          await fs.mkdir(path.dirname(absolutePath), { recursive: true })
          await fs.writeFile(absolutePath, buffer)

          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({
            sourceId: source.id,
            relativePath,
            absolutePath,
            bytes: buffer.byteLength,
            savedAt: new Date().toISOString(),
          }))
        } catch (error) {
          response.statusCode = 500
          response.end(JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown local download error',
          }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/building-code-navigator/',
  plugins: [react(), localSourceLibraryPlugin()],
})
