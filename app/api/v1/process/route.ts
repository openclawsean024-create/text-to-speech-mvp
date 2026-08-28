import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  createJob,
  storeAudio,
  loadAudio,
  updateJob,
  getJob,
  incrementApiKeyUsage,
  getApiKeyUsage,
} from '@/lib/jobs'
import { findApiKey, extractBearer, checkApiRateLimit, TIER_LIMITS } from '@/lib/api-keys'
import { transcribe } from '@/lib/whisper'
import { segmentChapters, summarize, toSrt, toVtt } from '@/lib/post-process'
import { dispatch } from '@/lib/webhook'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60s for synchronous short jobs; longer ones go async

const ALLOWED_MIME = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg', 'audio/webm', 'audio/flac', 'audio/m4a', 'audio/x-m4a', 'audio/mp4']
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB

interface ProcessBody {
  audioUrl?: string
  audioBase64?: string
  settings?: {
    chapters?: boolean
    summary?: boolean
    subtitles?: boolean
    epub?: boolean
    glossary?: string
    language?: string
  }
  options?: {
    webhookUrl?: string
  }
  async?: boolean
}

async function fetchAudioFromUrl(url: string): Promise<{ audio: Buffer; filename: string; mimeType: string }> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!resp.ok) throw new Error(`audio_url fetch failed: HTTP ${resp.status}`)
  const ct = resp.headers.get('content-type') || 'audio/mpeg'
  const filename = (() => {
    const disp = resp.headers.get('content-disposition') || ''
    const m = /filename="?([^"]+)"?/.exec(disp)
    if (m) return m[1]
    try {
      const u = new URL(url)
      return u.pathname.split('/').pop() || 'audio.mp3'
    } catch {
      return 'audio.mp3'
    }
  })()
  const arrayBuf = await resp.arrayBuffer()
  return { audio: Buffer.from(arrayBuf), filename, mimeType: ct.split(';')[0] }
}

async function runPipeline(jobId: string) {
  const job = await getJob(jobId)
  if (!job) return
  await updateJob(jobId, { status: 'running' })

  try {
    const audioRef = await loadAudio(job.audioKey)
    if (!audioRef) throw new Error('Audio bytes not found — they may have expired (30 day retention). Please re-upload.')

    const openaiKey = process.env.OPENAI_API_KEY
    const groqKey = process.env.GROQ_API_KEY

    // 1. Transcribe
    const transcript = await transcribe({
      audio: audioRef.audio,
      mimeType: job.mimeType,
      filename: job.filename,
      language: job.settings.language || 'zh',
      glossary: job.settings.glossary || '',
      openaiKey,
      groqKey,
    })

    // 2. Chapters
    let chapters = null
    if (job.settings.chapters !== false) {
      chapters = await segmentChapters({
        segments: transcript.segments,
        openaiKey,
        glossary: job.settings.glossary || '',
        targetChapters: 6,
      })
    }

    // 3. Summary
    let summary = null
    if (job.settings.summary !== false) {
      summary = await summarize({
        segments: transcript.segments,
        chapters: chapters || [],
        openaiKey,
      })
    }

    // 4. Subtitles
    let srt = null
    let vtt = null
    if (job.settings.subtitles !== false) {
      srt = toSrt(transcript.segments)
      vtt = toVtt(transcript.segments)
    }

    // 5. ePub (deferred to WS5 — placeholder)
    const epub = null

    // Update job with results
    const durationSec = transcript.duration || job.durationSec
    await updateJob(jobId, {
      status: 'done',
      transcript: { ...transcript, duration: durationSec },
      chapters,
      summary,
      srt,
      vtt,
      epub,
      finishedAt: Date.now(),
      durationSec,
    })

    // 6. Track API key usage (if applicable)
    if (job.apiKeyId) {
      await incrementApiKeyUsage(job.apiKeyId, durationSec)
    }

    // 7. Webhook delivery
    if (job.options.webhookUrl) {
      const updated = await getJob(jobId)
      if (updated) {
        const result = await dispatch(job.options.webhookUrl, {
          job_id: jobId,
          status: 'done',
          duration_sec: durationSec,
          filename: job.filename,
          chapters,
          summary,
          subtitles: {
            srt: srt ? `https://${process.env.VERCEL_URL || 'localhost'}/api/v1/jobs/${jobId}/download?format=srt` : null,
            vtt: vtt ? `https://${process.env.VERCEL_URL || 'localhost'}/api/v1/jobs/${jobId}/download?format=vtt` : null,
          },
        })
        await updateJob(jobId, { webhookDelivered: result.delivered })
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[process] pipeline failed for', jobId, message)
    await updateJob(jobId, {
      status: 'failed',
      errorMsg: message,
      finishedAt: Date.now(),
    })
    if (job.options.webhookUrl) {
      await dispatch(job.options.webhookUrl, {
        job_id: jobId,
        status: 'failed',
        error: message,
      })
    }
  }
}

export async function POST(req: NextRequest) {
  let body: ProcessBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const settings = body.settings || {}
  const options = body.options || {}

  // ── Auth ─────────────────────────────────────────────────────
  // Two paths:
  //   1. Enterprise: Bearer hms_xxx
  //   2. Web user: Clerk session
  let userId: string | null = null
  let apiKeyRecord: Awaited<ReturnType<typeof findApiKey>> = null
  const authHeader = req.headers.get('authorization')
  const bearer = extractBearer(authHeader)

  if (bearer) {
    apiKeyRecord = await findApiKey(bearer)
    if (!apiKeyRecord) {
      return NextResponse.json({ error: 'Invalid or expired API key', code: 'INVALID_API_KEY' }, { status: 401 })
    }
    // Rate limit (1 req/sec by default)
    const rps = TIER_LIMITS[apiKeyRecord.tier]?.rateLimitRps ?? 1
    const rl = await checkApiRateLimit(apiKeyRecord.hashedKey, rps)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retry_after_sec: rl.retryAfterSec },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      )
    }
  } else {
    try {
      const authResult = await auth()
      userId = authResult.userId
    } catch {
      // No auth
    }
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required (Bearer API key or Clerk session)', code: 'NO_AUTH' }, { status: 401 })
    }
  }

  // ── Get audio bytes ──────────────────────────────────────────
  let audio: Buffer
  let filename = 'audio.mp3'
  let mimeType = 'audio/mpeg'

  if (body.audioBase64) {
    try {
      audio = Buffer.from(body.audioBase64, 'base64')
      filename = `upload-${Date.now()}.mp3`
    } catch {
      return NextResponse.json({ error: 'audioBase64 decode failed' }, { status: 400 })
    }
  } else if (body.audioUrl) {
    try {
      const fetched = await fetchAudioFromUrl(body.audioUrl)
      audio = fetched.audio
      filename = fetched.filename
      mimeType = fetched.mimeType
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'fetch failed'
      return NextResponse.json({ error: `audioUrl fetch failed: ${msg}` }, { status: 400 })
    }
  } else {
    return NextResponse.json({ error: 'audioUrl or audioBase64 required' }, { status: 400 })
  }

  if (audio.length > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB`, fileSize: audio.length },
      { status: 413 },
    )
  }
  if (!ALLOWED_MIME.includes(mimeType) && !mimeType.startsWith('audio/')) {
    return NextResponse.json({ error: `Unsupported mime type: ${mimeType}` }, { status: 400 })
  }

  // ── Check tier limits (API key path) ─────────────────────────
  if (apiKeyRecord) {
    const tierCfg = TIER_LIMITS[apiKeyRecord.tier] || TIER_LIMITS.free
    const usage = await getApiKeyUsage(apiKeyRecord.id)
    const newDuration = audio.length / 16000 // rough estimate from MP3 size
    if (usage.usedSec + newDuration > tierCfg.monthlyProdMin * 60) {
      return NextResponse.json(
        {
          error: 'Monthly quota exceeded',
          tier: apiKeyRecord.tier,
          usedSec: usage.usedSec,
          limitSec: tierCfg.monthlyProdMin * 60,
        },
        { status: 402 },
      )
    }
  }

  // ── Create job ───────────────────────────────────────────────
  const audioKey = await storeAudio(`pending-${Date.now()}`, audio, mimeType)
  const job = await createJob({
    userId,
    apiKeyId: apiKeyRecord?.id || null,
    audioKey,
    filename,
    mimeType,
    fileSize: audio.length,
    durationSec: Math.round(audio.length / 16000),
    settings: {
      chapters: settings.chapters !== false,
      summary: settings.summary !== false,
      subtitles: settings.subtitles !== false,
      epub: settings.epub === true,
      glossary: settings.glossary || '',
      language: settings.language || 'zh',
    },
    options: {
      webhookUrl: options.webhookUrl,
    },
  })

  // ── Run pipeline (always async — 60s function timeout would cut long jobs) ─
  // Fire and return immediately
  runPipeline(job.id).catch((err) => console.error('[process] background pipeline error:', err))

  return NextResponse.json({
    ok: true,
    job_id: job.id,
    status: job.status,
    estimated_minutes: job.estimatedMinutes,
    poll_url: `/api/v1/jobs/${job.id}`,
    status_url: `/api/v1/jobs/${job.id}`,
    download_url: `/api/v1/jobs/${job.id}/download`,
  }, { status: 202 })
}

export async function OPTIONS() {
  return new NextResponse('', {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
