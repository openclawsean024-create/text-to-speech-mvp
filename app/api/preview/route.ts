import { NextRequest, NextResponse } from 'next/server'
import { VOICES } from '@/lib/voices'

// In-memory cache for generated preview audio (per voice, same text)
const previewCache = new Map<string, Blob>()

const PREVIEW_TEXT = '您好，歡迎使用文字轉語音服務。這是語音預覽。'
const MAX_CACHE_SIZE = 20

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

    // Check cache first
    if (previewCache.has(voiceId)) {
      const cached = previewCache.get(voiceId)!
      return new NextResponse(cached, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }

    // Need API key for TTS
    const effectiveKey = apiKey || process.env.OPENAI_API_KEY
    if (!effectiveKey || effectiveKey.startsWith('sk-...')) {
      return NextResponse.json(
        { error: 'API key required for preview generation', voiceId },
        { status: 401 }
      )
    }

    // Generate TTS preview via OpenAI
    const openaiRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${effectiveKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: voice.openaiVoice,
        input: PREVIEW_TEXT,
        speed: 1.0,
        response_format: 'mp3',
      }),
    })

    if (!openaiRes.ok) {
      const err = await openaiRes.text()
      return NextResponse.json({ error: `OpenAI error: ${err}` }, { status: 502 })
    }

    const arrayBuffer = await openaiRes.arrayBuffer()
    const audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' })

    // Cache it
    if (previewCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entry
      const firstKey = previewCache.keys().next().value
      if (firstKey) previewCache.delete(firstKey)
    }
    previewCache.set(voiceId, audioBlob)

    return new NextResponse(audioBlob, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err) {
    console.error('[preview API]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
