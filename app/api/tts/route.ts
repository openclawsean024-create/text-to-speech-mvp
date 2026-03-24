import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getUserApiKeys, checkRateLimit, incrementUsage } from '@/lib/db'
import { synthesize } from '@/lib/tts-engines'

const ALLOWED_ENGINES = ['openai', 'elevenlabs', 'kokoro']

const VOICE_MAP: Record<string, Record<string, string>> = {
  'zh-CN':      { openai: 'alloy',    elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'zh-CN' },
  'zh-TW':      { openai: 'alloy',    elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'zh-TW' },
  'en-US':      { openai: 'alloy',    elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'en-US' },
  'ja-JP':      { openai: 'nova',     elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'ja-JP' },
  'ko-KR':      { openai: 'fable',    elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'ko-KR' },
  'en-US-male': { openai: 'onyx',     elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'en-US' },
}

function resolveVoice(engine: string, frontendVoice?: string) {
  if (!frontendVoice) return undefined
  const mapped = VOICE_MAP[frontendVoice]
  return mapped ? mapped[engine] : undefined
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      // Anonymous usage — use plan-based rate limiting by IP
      return NextResponse.json(
        { error: '請先登入後再使用 API 模式' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { text, engine = 'openai', voice: frontendVoice, speed = 1.0, plan = 'free' } = body

    // ── Validation ────────────────────────────────────────────────
    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }
    if (text.length > 5000) {
      return NextResponse.json({ error: 'text exceeds 5000 character limit' }, { status: 400 })
    }
    if (!ALLOWED_ENGINES.includes(engine)) {
      return NextResponse.json(
        { error: `Invalid engine. Allowed: ${ALLOWED_ENGINES.join(', ')}` },
        { status: 400 }
      )
    }

    // ── Rate Limit Check ──────────────────────────────────────────
    const limit = await checkRateLimit(userId, plan)
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          limit: limit.limit,
          used: limit.used,
          resetsAt: limit.resetsAt,
        },
        { status: 429 }
      )
    }

    // ── Resolve API Key ───────────────────────────────────────────
    // Priority: body.apiKey (explicit) > stored user key > env var
    const storedKeys = await getUserApiKeys(userId)
    const apiKey =
      (body.apiKey as string | undefined)?.trim() ||
      storedKeys[engine] ||
      process.env[`${engine.toUpperCase()}_API_KEY`] ||
      null

    if (!apiKey) {
      return NextResponse.json(
        {
          error: `No API key for ${engine}. Please add your API key in the dashboard.`,
          code: 'NO_API_KEY',
        },
        { status: 400 }
      )
    }

    // ── Synthesize ────────────────────────────────────────────────
    const voice = resolveVoice(engine, frontendVoice) || frontendVoice
    const result = await synthesize({
      engine,
      text: text.trim(),
      voice,
      speed: parseFloat(speed),
      apiKey,
    })

    // ── Track Usage ────────────────────────────────────────────────
    await incrementUsage(userId)

    const filename = `tts-${engine}-${Date.now()}.mp3`
    return new NextResponse(result.audio, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'X-TTS-Engine': result.engine,
        'X-RateLimit-Remaining': String(Math.max(0, limit.remaining - 1)),
        'X-RateLimit-Limit': String(limit.limit),
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err: unknown) {
    console.error('[TTS] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'

    if (
      message.includes('API key') ||
      message.includes('401') ||
      message.includes('403') ||
      message.includes('Incorrect')
    ) {
      return NextResponse.json({ error: 'Invalid API key. Please check your key.' }, { status: 401 })
    }
    if (message.includes('429')) {
      return NextResponse.json({ error: 'Upstream API rate limit exceeded.' }, { status: 429 })
    }
    if (message.includes('insufficient_quota') || message.includes('quota')) {
      return NextResponse.json({ error: 'API quota exceeded.' }, { status: 402 })
    }

    return NextResponse.json({ error: `TTS failed: ${message}` }, { status: 500 })
  }
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
