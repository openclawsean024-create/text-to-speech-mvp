import { NextRequest, NextResponse } from 'next/server'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

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
      const epub = require('epub-parser')
      const bufferArray = Array.from(buffer)
      const epubText: string = await new Promise<string>((resolve, reject) => {
        epub.open(Buffer.from(bufferArray), function (err: Error | null, meta: any) {
          if (err) { reject(err); return }
          const chapters: string[] = []
          if (meta && meta.flow) {
            for (const id of Object.keys(meta.flow)) {
              const chapter = meta.flow[id]
              if (chapter && chapter.html) {
                chapters.push(chapter.html.replace(/<[^>]+>/g, '').trim())
              }
            }
          }
          resolve(chapters.join('\n\n').trim())
        })
      })
      text = epubText
      if (!text || text.trim().length === 0) {
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
