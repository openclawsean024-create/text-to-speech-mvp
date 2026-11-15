import { NextRequest, NextResponse } from 'next/server'
import { getJob } from '@/lib/jobs'
import { resolveIdentity } from '@/lib/identity'
import { authorizeOwner } from '@/lib/access-control'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: { id: string }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = params

  // 只允許擁有者（Clerk userId 或建立該工作的 API key）讀取（AC-007）。
  // 先驗證身分再查工作：匿名一律 401，不洩漏工作是否存在。
  const identity = await resolveIdentity(req, { allowApiKey: true, allowDemo: false })
  if (identity.kind === 'anonymous') {
    const denied = authorizeOwner(identity, {})
    if (denied.allowed === false) {
      return NextResponse.json({ error: denied.error, code: denied.code }, { status: denied.status })
    }
  }

  const job = await getJob(id)
  if (!job) {
    return NextResponse.json({ error: 'Job not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const decision = authorizeOwner(identity, { userId: job.userId, apiKeyId: job.apiKeyId })
  if (decision.allowed === false) {
    return NextResponse.json({ error: decision.error, code: decision.code }, { status: decision.status })
  }

  // Strip heavy fields for poll, include download URLs
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : (process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get('host') || 'localhost:3000'}`)
  return NextResponse.json({
    ok: true,
    job_id: job.id,
    status: job.status,
    filename: job.filename,
    mime_type: job.mimeType,
    file_size: job.fileSize,
    duration_sec: job.durationSec,
    estimated_minutes: job.estimatedMinutes,
    created_at: job.createdAt,
    finished_at: job.finishedAt,
    error_msg: job.errorMsg,
    settings: job.settings,
    chapters: job.chapters,
    summary: job.summary,
    transcript: job.transcript ? {
      language: job.transcript.language,
      duration: job.transcript.duration,
      segment_count: job.transcript.segments.length,
      engine: job.transcript.engine,
    } : null,
    downloads: {
      srt: job.srt ? `${base}/api/v1/jobs/${job.id}/download?format=srt` : null,
      vtt: job.vtt ? `${base}/api/v1/jobs/${job.id}/download?format=vtt` : null,
      epub: job.epub ? `${base}/api/v1/jobs/${job.id}/download?format=epub` : null,
      chapters_json: `${base}/api/v1/jobs/${job.id}/download?format=chapters.json`,
      summary_json: `${base}/api/v1/jobs/${job.id}/download?format=summary.json`,
      transcript_json: `${base}/api/v1/jobs/${job.id}/download?format=transcript.json`,
    },
    webhook_delivered: job.webhookDelivered,
  })
}
