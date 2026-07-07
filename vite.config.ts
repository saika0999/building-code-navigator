import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { sources } from './src/data/sources'

const localLibraryDirectory = 'local-library'
const require = createRequire(import.meta.url)
const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'))
const pdfjsCMapUrl = `${pdfjsRoot.replaceAll(path.sep, '/')}/cmaps/`
const pdfWatermarkPatterns = [
  '住房城乡建设部信息公开 浏览专用',
]

function sanitizePathPart(value: string) {
  return value.replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
}

function sourceFileBase(source: (typeof sources)[number]) {
  return sanitizePathPart(source.code ?? source.id)
}

function sourceLibraryPath(source: (typeof sources)[number], extension: string) {
  const region = sanitizePathPart(source.jurisdiction)
  return `${localLibraryDirectory}/documents/${region}/${sourceFileBase(source)}.${extension}`
}

function sourceIndexPath(source: (typeof sources)[number]) {
  return `${localLibraryDirectory}/index/${source.id}.txt`
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

function localLibraryRoot(root: string) {
  return path.resolve(root, localLibraryDirectory)
}

function assertLocalLibraryPath(root: string, relativePath: string) {
  const absolutePath = path.resolve(root, relativePath)
  const libraryRoot = localLibraryRoot(root)

  if (!absolutePath.startsWith(libraryRoot + path.sep)) {
    throw new Error('Invalid local library path')
  }

  return absolutePath
}

async function findLocalSourceFile(root: string, source: (typeof sources)[number]) {
  const region = sanitizePathPart(source.jurisdiction)
  const sourceDirectory = path.resolve(root, localLibraryDirectory, 'documents', region)
  const fileBase = sourceFileBase(source)

  try {
    const entries = await fs.readdir(sourceDirectory, { withFileTypes: true })
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.startsWith(`${fileBase}.`))
      .map((entry) => entry.name)
      .sort((a, b) => {
        const priority = ['.pdf', '.txt', '.doc', '.docx', '.xlsx', '.zip']
        return priority.findIndex((extension) => a.endsWith(extension)) - priority.findIndex((extension) => b.endsWith(extension))
      })

    const fileName = files[0]
    if (!fileName) {
      return null
    }

    const absolutePath = path.join(sourceDirectory, fileName)
    const stats = await fs.stat(absolutePath)
    const relativePath = path.relative(root, absolutePath).replaceAll(path.sep, '/')
    const extension = path.extname(fileName).replace('.', '')

    return {
      sourceId: source.id,
      exists: true,
      relativePath,
      absolutePath,
      bytes: stats.size,
      updatedAt: stats.mtime.toISOString(),
      extension,
      kind: extension === 'txt' ? 'page_snapshot' : 'official_attachment',
    }
  } catch {
    return null
  }
}

async function sourceStatus(root: string, source: (typeof sources)[number]) {
  const localFile = await findLocalSourceFile(root, source)
  const index = await sourceTextIndexStatus(root, source)

  return {
    ...(localFile ?? {
    sourceId: source.id,
    exists: false,
    relativePath: sourceLibraryPath(source, 'pdf'),
    bytes: 0,
    updatedAt: null,
    extension: null,
    kind: null,
    }),
    ...index,
  }
}

function sendJson(response: import('node:http').ServerResponse, payload: unknown, statusCode = 200) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

async function writeLocalFile(root: string, source: (typeof sources)[number], extension: string, content: Buffer | string) {
  const relativePath = sourceLibraryPath(source, extension)
  const absolutePath = assertLocalLibraryPath(root, relativePath)

  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, content)

  return {
    relativePath,
    absolutePath,
    bytes: Buffer.byteLength(content),
  }
}

async function sourceTextIndexStatus(root: string, source: (typeof sources)[number]) {
  const relativePath = sourceIndexPath(source)
  const absolutePath = assertLocalLibraryPath(root, relativePath)

  try {
    const [stats, content] = await Promise.all([
      fs.stat(absolutePath),
      fs.readFile(absolutePath, 'utf8'),
    ])

    const effectiveText = content
      .split('\n')
      .filter((line) => {
        const value = line.trim()
        return value &&
          !value.startsWith('资料源：') &&
          !value.startsWith('资料源 ID：') &&
          !value.startsWith('本地文件：') &&
          !value.startsWith('索引时间：') &&
          !value.startsWith('PDF 页数：') &&
          !value.startsWith('有效文本字数：')
      })
      .join('\n')

    return {
      indexExists: true,
      indexPath: relativePath,
      indexUpdatedAt: stats.mtime.toISOString(),
      indexChars: effectiveText.length,
      searchable: effectiveText.length >= 100,
    }
  } catch {
    return {
      indexExists: false,
      indexPath: relativePath,
      indexUpdatedAt: null,
      indexChars: 0,
      searchable: false,
    }
  }
}

function normalizeExtractedText(text: string) {
  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line && !pdfWatermarkPatterns.includes(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function extractPdfText(absolutePath: string) {
  const data = new Uint8Array(await fs.readFile(absolutePath))
  const pdf = await getDocument({
    data,
    cMapUrl: pdfjsCMapUrl,
    cMapPacked: true,
  }).promise
  const pages: string[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    const normalized = normalizeExtractedText(pageText)

    if (normalized) {
      pages.push(`--- PDF Page ${pageNumber} ---\n${normalized}`)
    }
  }

  return {
    pageCount: pdf.numPages,
    text: pages.join('\n\n').trim(),
  }
}

async function buildSourceTextIndex(root: string, source: (typeof sources)[number]) {
  const localFile = await findLocalSourceFile(root, source)

  if (!localFile?.exists) {
    throw new Error('本地资料库还没有这份规范文件，请先获取到资料库。')
  }

  const extension = localFile.extension?.toLowerCase()
  let text: string
  let pageCount: number | null = null

  if (extension === 'txt') {
    text = await fs.readFile(localFile.absolutePath, 'utf8')
  } else if (extension === 'pdf') {
    const extracted = await extractPdfText(localFile.absolutePath)
    text = extracted.text
    pageCount = extracted.pageCount
  } else {
    throw new Error(`暂不支持 ${extension?.toUpperCase() ?? '该'} 文件的文本索引。`)
  }

  const indexText = [
    `资料源：${source.title}`,
    `资料源 ID：${source.id}`,
    `本地文件：${localFile.relativePath}`,
    `索引时间：${new Date().toISOString()}`,
    pageCount ? `PDF 页数：${pageCount}` : '',
    `有效文本字数：${text.length}`,
    '',
    text,
    '',
  ].filter(Boolean).join('\n')
  const relativePath = sourceIndexPath(source)
  const absolutePath = assertLocalLibraryPath(root, relativePath)

  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, indexText)

  return {
    sourceId: source.id,
    indexPath: relativePath,
    indexChars: text.length,
    pageCount,
    searchable: text.length >= 100,
    message: text.length >= 100
      ? '文本索引已建立。'
      : '已尝试建立索引，但有效文本很少；该 PDF 可能需要 OCR 或人工打开查阅。',
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
      server.middlewares.use('/api/source-library/status', async (request, response) => {
        if (request.method !== 'GET') {
          sendJson(response, { error: 'Method not allowed' }, 405)
          return
        }

        const statuses = await Promise.all(sources.map((source) => sourceStatus(server.config.root, source)))
        sendJson(response, { sources: statuses })
      })

      server.middlewares.use('/api/source-library/file', async (request, response) => {
        if (request.method !== 'GET') {
          sendJson(response, { error: 'Method not allowed' }, 405)
          return
        }

        try {
          const url = new URL(request.url ?? '', 'http://localhost')
          const relativePath = url.searchParams.get('path')

          if (!relativePath) {
            sendJson(response, { error: 'Missing local file path' }, 400)
            return
          }

          const absolutePath = assertLocalLibraryPath(server.config.root, relativePath)
          const extension = path.extname(absolutePath).toLowerCase()
          const content = await fs.readFile(absolutePath)
          const contentType = extension === '.pdf'
            ? 'application/pdf'
            : extension === '.txt'
              ? 'text/plain; charset=utf-8'
              : 'application/octet-stream'

          response.setHeader('Content-Type', contentType)
          response.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(path.basename(absolutePath))}"`)
          response.end(content)
        } catch (error) {
          sendJson(response, { error: error instanceof Error ? error.message : 'Unable to open local file' }, 500)
        }
      })

      server.middlewares.use('/api/source-library/search', async (request, response) => {
        if (request.method !== 'GET') {
          sendJson(response, { error: 'Method not allowed' }, 405)
          return
        }

        try {
          const url = new URL(request.url ?? '', 'http://localhost')
          const query = (url.searchParams.get('q') ?? '').trim()
          const sourceIdFilter = new Set((url.searchParams.get('sourceIds') ?? '').split(',').filter(Boolean))

          if (query.length < 2) {
            sendJson(response, { results: [], searchableFiles: 0, message: '请输入至少两个字符。' })
            return
          }

          const statuses = await Promise.all(sources.map((source) => sourceStatus(server.config.root, source)))
          const searchableDocs = statuses
            .filter((status) => !sourceIdFilter.size || sourceIdFilter.has(status.sourceId))
            .flatMap((status) => {
              const docs = []

              if (status.indexExists && status.searchable && status.indexPath) {
                docs.push({ sourceId: status.sourceId, relativePath: status.indexPath, kind: 'text_index' })
              }

              if (status.exists && status.extension === 'txt') {
                docs.push({ sourceId: status.sourceId, relativePath: status.relativePath, kind: 'page_snapshot' })
              }

              return docs
            })
          const results = []

          for (const doc of searchableDocs) {
            const source = sources.find((item) => item.id === doc.sourceId)
            const absolutePath = assertLocalLibraryPath(server.config.root, doc.relativePath)
            const text = await fs.readFile(absolutePath, 'utf8')
            const index = text.toLowerCase().indexOf(query.toLowerCase())

            if (index >= 0) {
              const start = Math.max(0, index - 90)
              const end = Math.min(text.length, index + query.length + 150)
              results.push({
                sourceId: doc.sourceId,
                title: source?.title ?? doc.sourceId,
                relativePath: doc.relativePath,
                kind: doc.kind,
                snippet: text.slice(start, end).replace(/\s+/g, ' ').trim(),
              })
            }
          }

          sendJson(response, {
            results,
            searchableFiles: searchableDocs.length,
            message: searchableDocs.length === 0 ? '当前尚无可搜索文本索引。请先对已下载 PDF 点击“建立文本索引”。' : undefined,
          })
        } catch (error) {
          sendJson(response, { error: error instanceof Error ? error.message : 'Local search failed' }, 500)
        }
      })

      server.middlewares.use('/api/source-library/index-source', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, { error: 'Method not allowed' }, 405)
          return
        }

        try {
          const body = JSON.parse(await readRequestBody(request)) as { sourceId?: string }
          const source = sources.find((item) => item.id === body.sourceId)

          if (!source) {
            sendJson(response, { error: 'Source not found' }, 404)
            return
          }

          sendJson(response, await buildSourceTextIndex(server.config.root, source))
        } catch (error) {
          sendJson(response, { error: error instanceof Error ? error.message : 'Text indexing failed' }, 500)
        }
      })

      server.middlewares.use('/api/source-library/download', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, { error: 'Method not allowed' }, 405)
          return
        }

        try {
          const body = JSON.parse(await readRequestBody(request)) as { sourceId?: string }
          const source = sources.find((item) => item.id === body.sourceId)

          if (!source) {
            sendJson(response, { error: 'Source not found' }, 404)
            return
          }

          const savedSource = await discoverAndSaveSource(source, server.config.root)

          sendJson(response, {
            sourceId: source.id,
            ...savedSource,
            savedAt: new Date().toISOString(),
          })
        } catch (error) {
          sendJson(response, {
            error: error instanceof Error ? error.message : 'Unknown local download error',
          }, 500)
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
