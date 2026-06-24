import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'
import { sources } from './src/data/sources'

function sanitizePathPart(value: string) {
  return value.replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
}

function sourceLibraryPath(source: (typeof sources)[number], extension: string) {
  const region = sanitizePathPart(source.jurisdiction)
  const fileName = sanitizePathPart(source.code ?? source.id)
  return `local-library/documents/${region}/${fileName}.${extension}`
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

function officialFetch(url: string, referer?: string) {
  return fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 building-code-navigator-local-library/0.1',
      ...(referer ? { Referer: referer } : {}),
    },
  })
}

function extensionFromContent(contentType: string | null, url: string) {
  if (contentType?.includes('pdf')) return 'pdf'
  if (contentType?.includes('wordprocessingml') || contentType?.includes('msword')) return 'doc'
  if (contentType?.includes('spreadsheetml') || contentType?.includes('excel')) return 'xlsx'
  if (contentType?.includes('zip')) return 'zip'
  const pathname = new URL(url).pathname.toLowerCase()
  const match = pathname.match(/\.([a-z0-9]{2,5})$/)
  return match?.[1] ?? 'bin'
}

function isLikelyAttachmentUrl(url: string) {
  return /download|attachment|fileUrl|fileName|\.pdf|\.docx?|\.xlsx?|\.zip/i.test(url)
}

function isSpecificOfficialPage(url: string) {
  const parsed = new URL(url)
  return parsed.pathname !== '/' && !parsed.pathname.endsWith('/index.html')
}

function extractAttachmentUrls(html: string, pageUrl: string) {
  return Array.from(html.matchAll(/href=["']([^"']+)["']/g))
    .map((match) => new URL(match[1], pageUrl).toString())
    .filter((url) => isLikelyAttachmentUrl(url))
}

function htmlToReadableText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

async function writeLocalFile(root: string, source: (typeof sources)[number], extension: string, content: Buffer | string) {
  const relativePath = sourceLibraryPath(source, extension)
  const absolutePath = path.resolve(root, relativePath)
  const libraryRoot = path.resolve(root, 'local-library')

  if (!absolutePath.startsWith(libraryRoot + path.sep)) {
    throw new Error('Invalid local library path')
  }

  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, content)

  return {
    relativePath,
    absolutePath,
    bytes: Buffer.byteLength(content),
  }
}

async function downloadBinarySource(source: (typeof sources)[number], url: string, root: string, referer?: string) {
  const officialResponse = await officialFetch(url, referer)

  if (!officialResponse.ok) {
    throw new Error(`Official download failed: ${officialResponse.status}`)
  }

  const contentType = officialResponse.headers.get('content-type')
  const extension = extensionFromContent(contentType, url)
  const buffer = Buffer.from(await officialResponse.arrayBuffer())
  const file = await writeLocalFile(root, source, extension, buffer)

  return {
    ...file,
    kind: extension === 'txt' ? 'page_snapshot' : 'official_attachment',
    sourceUrl: url,
  }
}

async function discoverAndSaveSource(source: (typeof sources)[number], root: string) {
  if (source.downloadUrl) {
    return downloadBinarySource(source, source.downloadUrl, root, source.sourceUrl)
  }

  if (!isSpecificOfficialPage(source.sourceUrl)) {
    throw new Error('这个资料源还只是主管部门首页，尚未配置到具体公告页，无法可靠抓取规范正文。')
  }

  const pageResponse = await officialFetch(source.sourceUrl)

  if (!pageResponse.ok) {
    throw new Error(`Official page fetch failed: ${pageResponse.status}`)
  }

  const html = await pageResponse.text()
  const attachmentUrls = extractAttachmentUrls(html, source.sourceUrl)

  for (const attachmentUrl of attachmentUrls) {
    try {
      return await downloadBinarySource(source, attachmentUrl, root, source.sourceUrl)
    } catch {
      // Try the next attachment before falling back to a page snapshot.
    }
  }

  const text = htmlToReadableText(html)

  if (!text) {
    throw new Error('官方页面没有可保存的正文内容。')
  }

  const snapshot = [
    `资料源：${source.title}`,
    `官方页面：${source.sourceUrl}`,
    `抓取时间：${new Date().toISOString()}`,
    '',
    text,
    '',
  ].join('\n')
  const file = await writeLocalFile(root, source, 'txt', snapshot)

  return {
    ...file,
    kind: 'page_snapshot',
    sourceUrl: source.sourceUrl,
  }
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

          const savedSource = await discoverAndSaveSource(source, server.config.root)

          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({
            sourceId: source.id,
            ...savedSource,
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
