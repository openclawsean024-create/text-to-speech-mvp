import { NextRequest, NextResponse } from 'next/server'
import { VOICES } from '@/lib/voices'
import { isMockTtsMode } from '@/lib/tts/mode'
import { synthesizeLongText } from '@/lib/tts/synthesis'

// In-memory cache for generated preview audio (per voice, same text)
const previewCache = new Map<string, { audio: Blob; contentType: string }>()

const PREVIEW_TEXT = '您好，歡迎使用文字轉語音服務。這是語音預覽。'
const MAX_CACHE_SIZE = 20

/**
 * 聲音試聽（FR-014）。固定短句、每個聲音快取一次，不計入字數額度。
 * 與其他合成路徑相同，測試模式只用 Mock（AC-003）。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { voiceId, apiKey } = body as { voiceId: string; apiKey?: string }

    if (!voiceId) {
      return NextResponse.json({ error: 'voiceId is required' }, { status: 400 })
    }

    const voice = VOICES.find(v => v.id === voiceId)
    if (!voice) {
      return NextResponse.json({ error: 'Unknown voice ID' }, { status: 404 })
    }

    const mock = isMockTtsMode()
    const cacheKey = `${mock ? 'mock' : 'openai'}:${voiceId}`

    // Check cache first
    const cached = previewCache.get(cacheKey)
    if (cached) {
      return new NextResponse(cached.audio, {
        status: 200,
        headers: {
          'Content-Type': cached.contentType,
          'Cache-Control': mock ? 'no-store' : 'public, max-age=86400',
        },
      })
    }

    // Need API key for TTS（測試模式不需要）
    const effectiveKey = apiKey || process.env.OPENAI_API_KEY
    if (!mock && (!effectiveKey || effectiveKey.startsWith('sk-...'))) {
      return NextResponse.json(
        { error: 'API key required for preview generation', voiceId },
        { status: 401 }
      )
    }

    let result
    try {
      result = await synthesizeLongText({
        engine: 'openai',
        text: PREVIEW_TEXT,
        voice: voice.openaiVoice,
        speed: 1.0,
        apiKey: apiKey || null,
        format: 'mp3',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error'
      return NextResponse.json({ error: `Preview generation failed: ${message}` }, { status: 502 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audioBlob = new Blob([result.audio as any], { type: result.contentType })

    // Cache it
    if (previewCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entry
      const firstKey = previewCache.keys().next().value
      if (firstKey) previewCache.delete(firstKey)
    }
    previewCache.set(cacheKey, { audio: audioBlob, contentType: result.contentType })

    return new NextResponse(audioBlob, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'X-TTS-Mock': String(result.mock),
        'Cache-Control': mock ? 'no-store' : 'public, max-age=86400',
      },
    })
  } catch (err) {
    console.error('[preview API]', err instanceof Error ? err.message : 'unknown error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
