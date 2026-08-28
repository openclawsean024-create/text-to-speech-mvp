import { NextRequest, NextResponse } from 'next/server'
import { synthesize } from '@/lib/tts-engines'
import { buildShort } from '@/lib/shorts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/shorts
 *
 * One-call 9:16 short video generation:
 *   1. TTS synthesize the input text with given engine/voice
 *   2. Mix TTS audio + title/subtitle text into a 1080x1920 vertical MP4
 *   3. Return MP4 ready for upload to YouTube Shorts / IG Reels / TikTok
 *
 * Body:
 *   {
 *     text: string,                 // Required
 *     title?: string,              // Default = first 30 chars of text
 *     subtitle?: string,            // Optional
 *     engine?: string,             // openai|elevenlabs|kokoro|azure|google (default: openai)
 *     voice?: string,              // voice ID
 *     speed?: number,
 *     emotion?: string,            // For Azure express-as style
 *     aspect?: '9:16' | '4:5' | '1:1',
 *     bgColor?: string,
 *     fgColor?: string,
 *     apiKey?: string,             // pass-through for the engine
 *     format?: 'mp4' | 'mov',      // Default mp4
 *   }
 */
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { text, title, subtitle, engine = 'openai', voice, speed = 1.0, emotion, aspect = '9:16', bgColor, fgColor, apiKey, format = 'mp4' } = body
  if (!text || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }
  if (text.length > 5000) {
    return NextResponse.json({ error: 'text too long (max 5000 chars for short videos)' }, { status: 400 })
  }

  // Resolve API key from env if not passed in body
  const envKey = process.env[`${engine.toUpperCase()}_API_KEY`] || null
  const finalKey = apiKey || envKey
  if (!finalKey) {
    return NextResponse.json(
      { error: `No API key for ${engine}. Pass apiKey or set ${engine.toUpperCase()}_API_KEY.` },
      { status: 400 },
    )
  }

  try {
    // Step 1: TTS
    const ttsResult = await synthesize({
      engine,
      text: text.trim(),
      voice,
      speed: parseFloat(speed),
      apiKey: finalKey,
      emotion,
    })

    // Step 2: Build vertical video
    const video = await buildShort({
      audio: ttsResult.audio,
      mimeType: ttsResult.contentType || 'audio/mpeg',
      title: title || text.trim().slice(0, 30),
      subtitle,
      bgColor,
      fgColor,
      aspect,
    })

    const filename = `shorts-${Date.now()}.${format}`
    return new NextResponse(new Uint8Array(video), {
      status: 200,
      headers: {
        'Content-Type': format === 'mov' ? 'video/quicktime' : 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Short-Engine': engine,
        'X-Short-Voice': voice || 'default',
        'X-Short-Aspect': aspect,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg, code: 'SHORT_FAIL' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/shorts',
    description: 'POST {text, title?, engine?, voice?, aspect?, ...} to generate a 9:16 vertical MP4 (YouTube Shorts / IG Reels / TikTok) from TTS + text overlay.',
    aspects: ['9:16', '4:5', '1:1'],
    engines: ['openai', 'elevenlabs', 'kokoro', 'azure', 'google'],
    requirements: 'ffmpeg + ffprobe in PATH + a CJK font (PingFang/Noto CJK)',
  })
}

export async function OPTIONS() {
  return new NextResponse('', {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
