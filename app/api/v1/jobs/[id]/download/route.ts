import { NextRequest, NextResponse } from 'next/server'
import { getJob } from '@/lib/jobs'
import { findApiKey, extractBearer } from '@/lib/api-keys'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: { id: string }
}

const FORMAT_INFO: Record<string, { contentType: string; ext: string }> = {
  srt: { contentType: 'application/x-subrip', ext: 'srt' },
  vtt: { contentType: 'text/vtt', ext: 'vtt' },
  epub: { contentType: 'application/epub+zip', ext: 'epub' },
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = params
  const job = await getJob(id)
  if (!job) {
    return NextResponse.json({ error: 'Job not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  // Authorization (same pattern as /jobs/[id])
  const authHeader = req.headers.get('authorization')
  const bearer = extractBearer(authHeader)
  let authorized = false
  if (bearer) {
    const apiKeyRecord = await findApiKey(bearer)
    if (apiKeyRecord && job.apiKeyId === apiKeyRecord.id) authorized = true
  }
  if (!authorized && Date.now() - job.createdAt < 30 * 24 * 3600 * 1000) authorized = true
  if (!authorized) {
    return NextResponse.json({ error: 'Not authorized', code: 'FORBIDDEN' }, { status: 403 })
  }

  if (job.status !== 'done') {
    return NextResponse.json(
      { error: 'Job not finished yet', status: job.status, code: 'NOT_READY' },
      { status: 409 },
    )
  }

  const format = (req.nextUrl.searchParams.get('format') || 'srt').toLowerCase()
  let content: string | null = null
  let contentType = 'text/plain; charset=utf-8'
  let ext = 'txt'
  let filename = job.filename.replace(/\.[^.]+$/, '') + '-output'

  switch (format) {
    case 'srt':
      content = job.srt
      contentType = FORMAT_INFO.srt.contentType
      ext = 'srt'
      break
    case 'vtt':
      content = job.vtt
      contentType = FORMAT_INFO.vtt.contentType
      ext = 'vtt'
      break
    case 'epub':
      content = job.epub
      contentType = FORMAT_INFO.epub.contentType
      ext = 'epub'
      break
    case 'chapters.json':
      content = JSON.stringify({ chapters: job.chapters || [] }, null, 2)
      contentType = 'application/json; charset=utf-8'
      ext = 'json'
      filename += '.chapters'
      break
    case 'summary.json':
      content = JSON.stringify({ summary: job.summary || null }, null, 2)
      contentType = 'application/json; charset=utf-8'
      ext = 'json'
      filename += '.summary'
      break
    case 'transcript.json':
      content = JSON.stringify(job.transcript || { segments: [] }, null, 2)
      contentType = 'application/json; charset=utf-8'
      ext = 'json'
      filename += '.transcript'
      break
    case 'transcript.txt':
      content = (job.transcript?.segments || []).map((s: any) => (s.text || '').trim()).join('\n\n')
      contentType = 'text/plain; charset=utf-8'
      ext = 'txt'
      filename += '.transcript'
      break
    default:
      return NextResponse.json(
        { error: 'Unknown format. Supported: srt, vtt, epub, chapters.json, summary.json, transcript.json, transcript.txt' },
        { status: 400 },
      )
  }

  if (content === null || content === undefined) {
    return NextResponse.json({ error: `Output not available for format ${format}`, code: 'EMPTY' }, { status: 404 })
  }

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}.${ext}"`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}
