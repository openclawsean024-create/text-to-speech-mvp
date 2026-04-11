import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 30
export const preferredRegion = 'hnd1'

const MAX_SIZE = 4 * 1024 * 1024 // 10MB

function stripHtml(input: string) {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

async function extractEpubText(buffer: Buffer) {
  const epubPath = path.join(os.tmpdir(), `ebook-${randomUUID()}.epub`)
  await fs.writeFile(epubPath, buffer)

  try {
    const Epub = (await import('epubjs')).default as unknown as new (input: string) => {
      load: () => Promise<void>
      ready: Promise<void>
      spine: { items: Array<{ href?: string }> }
      archive: { read: (target: string) => Promise<string> }
    }

    const book = new Epub(epubPath)
    await book.load()
    await book.ready

    const chapterTexts: string[] = []
    for (const item of book.spine?.items ?? []) {
      if (!item?.href) continue
      try {
        const html = await book.archive.read(item.href)
        const text = stripHtml(String(html || ''))
        if (text) chapterTexts.push(text)
      } catch {
        // Ignore individual chapter failures and continue extracting the rest.
      }
    }

    return chapterTexts.join('\n\n').trim()
  } finally {
    await fs.unlink(epubPath).catch(() => {})
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 413 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const buffer = Buffer.from(await file.arrayBuffer())
    let text = ''

    if (ext === 'txt' || ext === 'srt' || ext === 'vtt' || ext === 'lrc') {
      text = buffer.toString('utf-8')
      // Strip common subtitle/timecode markers
      text = text.replace(/^\d+\s*$/gm, '') // line numbers
      text = text.replace(/^\d{2}:\d{2}:\d{2}[,.]?\d*\s*-->\s*\d{2}:\d{2}:\d{2}[,.]?\d*$/gm, '') // timestamps
      text = text.replace(/^WEBVTT.*$/gm, '') // vtt header
      text = text.trim()
    } else if (ext === 'pdf') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse')
      const data = await pdfParse(buffer)
      text = data.text
    } else if (ext === 'epub') {
      text = await extractEpubText(buffer)
      if (!text) {
        return NextResponse.json({ error: 'Could not extract text from EPUB' }, { status: 422 })
      }
    } else if (ext === 'docx') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else {
      return NextResponse.json({ error: `Unsupported file type: .${ext}` }, { status: 415 })
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Could not extract text from file' }, { status: 422 })
    }

    // Truncate to 5000 chars (matching the TTS limit)
    if (text.length > 5000) {
      text = text.slice(0, 5000)
    }

    return NextResponse.json({ text, filename: file.name, charCount: text.length })
  } catch (err) {
    console.error('[extract-text] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Extraction failed: ${message}` }, { status: 500 })
  }
}
