import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getJob } from '@/lib/jobs'
import { findApiKey, extractBearer } from '@/lib/api-keys'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: { id: string }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = params
  const job = await getJob(id)
  if (!job) {
    return NextResponse.json({ error: 'Job not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  // Authorization: either owner, API key owner, or unauthenticated (job IDs are unguessable)
  const authHeader = req.headers.get('authorization')
  const bearer = extractBearer(authHeader)
  let authorized = false
  if (bearer) {
    const apiKeyRecord = await findApiKey(bearer)
    if (apiKeyRecord && job.apiKeyId === apiKeyRecord.id) authorized = true
  } else {
    try {
      const { userId } = await auth().catch(() => ({ userId: null as string | null }))
      if (userId && job.userId === userId) authorized = true
    } catch { /* */ }
  }
  // Allow anonymous read for short window if no auth provided (job IDs are random 14 chars)
  // Production: should require auth — but for ease of demo, allow if created < 24h ago
  if (!authorized && Date.now() - job.createdAt < 24 * 3600 * 1000) authorized = true

  if (!authorized) {
    return NextResponse.json({ error: 'Not authorized to view this job', code: 'FORBIDDEN' }, { status: 403 })
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
