import { NextRequest, NextResponse } from 'next/server'
import { resolveIdentity } from '@/lib/identity'
import { authorizeOwner } from '@/lib/access-control'
import { getAudiobookJob, loadChapterAudio } from '@/lib/audiobook/jobs'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: { id: string }
}

function attachment(filename: string): string {
  // ASCII 後備檔名 + RFC 5987 的 UTF-8 檔名（書名可能是中文）
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

/**
 * 下載有聲書產出。只允許擁有者（AC-007）。
 *
 *   ?format=manifest                     整本的章節標記（JSON）
 *   ?chapter=N&format=audio|srt|vtt|markers|id3
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const identity = await resolveIdentity(req, { allowApiKey: true })
  if (identity.kind === 'anonymous') {
    const denied = authorizeOwner(identity, {})
    if (denied.allowed === false) {
      return NextResponse.json({ error: denied.error, code: denied.code }, { status: denied.status })
    }
  }

  const job = await getAudiobookJob(params.id)
  if (!job) {
    return NextResponse.json({ error: 'Job not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const decision = authorizeOwner(identity, job.owner)
  if (decision.allowed === false) {
    return NextResponse.json({ error: decision.error, code: decision.code }, { status: decision.status })
  }

  const format = (req.nextUrl.searchParams.get('format') || 'audio').toLowerCase()
  const privateHeaders = { 'Cache-Control': 'private, no-store' }

  if (format === 'manifest') {
    const manifest = {
      book: job.book,
      status: job.status,
      chapter_markers: job.chapterMarkers,
      chapters: job.chapters.map((c) => ({
        chapter: c.chapterNumber,
        title: c.title,
        file_name: c.fileName,
        duration_ms: c.durationMs,
        id3: c.id3,
      })),
    }
    return new NextResponse(JSON.stringify(manifest, null, 2), {
      headers: {
        ...privateHeaders,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': attachment(`${job.book.slug}-chapters.json`),
      },
    })
  }

  const chapterNumber = Number(req.nextUrl.searchParams.get('chapter'))
  const chapter = job.chapters.find((c) => c.chapterNumber === chapterNumber)
  if (!chapter) {
    return NextResponse.json({ error: 'Chapter not found or not finished yet', code: 'CHAPTER_NOT_FOUND' }, { status: 404 })
  }

  switch (format) {
    case 'audio': {
      const bytes = loadChapterAudio(job.id, chapter.chapterNumber)
      if (!bytes) {
        return NextResponse.json(
          { error: '音檔已不在伺服器記憶體（M1 僅暫存），請重新轉換。', code: 'AUDIO_EXPIRED' },
          { status: 410 },
        )
      }
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          ...privateHeaders,
          'Content-Type': chapter.contentType,
          'Content-Length': String(bytes.length),
          'Content-Disposition': attachment(chapter.fileName),
        },
      })
    }
    case 'srt':
      return new NextResponse(chapter.srt, {
        headers: {
          ...privateHeaders,
          'Content-Type': 'application/x-subrip; charset=utf-8',
          'Content-Disposition': attachment(`${chapter.baseName}.srt`),
        },
      })
    case 'vtt':
      return new NextResponse(chapter.vtt, {
        headers: {
          ...privateHeaders,
          'Content-Type': 'text/vtt; charset=utf-8',
          'Content-Disposition': attachment(`${chapter.baseName}.vtt`),
        },
      })
    case 'markers':
      return new NextResponse(JSON.stringify({ chapter: chapter.chapterNumber, title: chapter.title, markers: chapter.markers }, null, 2), {
        headers: {
          ...privateHeaders,
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': attachment(`${chapter.baseName}.markers.json`),
        },
      })
    case 'id3':
      return new NextResponse(JSON.stringify({ id3: chapter.id3, tag: chapter.id3Tag }, null, 2), {
        headers: { ...privateHeaders, 'Content-Type': 'application/json; charset=utf-8' },
      })
    default:
      return NextResponse.json(
        { error: 'Unknown format. Supported: audio, srt, vtt, markers, id3, manifest', code: 'BAD_FORMAT' },
        { status: 400 },
      )
  }
}
