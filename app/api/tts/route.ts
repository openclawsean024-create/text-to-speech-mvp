import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUserApiKeys, checkRateLimit, incrementUsage } from '@/lib/db'
import { synthesize } from '@/lib/tts-engines'

const ALLOWED_ENGINES = ['openai', 'elevenlabs', 'kokoro']

const VOICE_MAP: Record<string, Record<string, string>> = {
  'zh-CN':      { openai: 'alloy',    elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'zh-CN-female' },
  'zh-TW':      { openai: 'onyx',     elevenlabs: 'AZnzlk1XvdvUeBnXmlZG', kokoro: 'zh-CN-male'   },
  'en-US':      { openai: 'alloy',    elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'en-US-female' },
  'ja-JP':      { openai: 'nova',     elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'ja-JP-female'  },
  'ko-KR':      { openai: 'fable',    elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'ko-KR-female'  },
  'en-US-male': { openai: 'onyx',     elevenlabs: 'AZnzlk1XvdvUeBnXmlZG', kokoro: 'en-US-male'   },
}

function resolveVoice(engine: string, frontendVoice?: string) {
  if (!frontendVoice) return undefined
  const mapped = VOICE_MAP[frontendVoice]
  return mapped ? mapped[engine] : undefined
}

const CHUNK_SIZE = 5000

function chunkText(text: string, size: number = CHUNK_SIZE): string[] {
  const paragraphs = text.split(/\n+/)
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if ((current + para).length <= size) {
      current += (current ? '\n' : '') + para
    } else {
      if (current) chunks.push(current)
      if (para.length > size) {
        const sentences = para.split(/(?<=[。！？.!?])\s*/)
        current = ''
        for (const sent of sentences) {
          if (current && (current + sent).length > size) {
            chunks.push(current)
            current = sent
          } else {
            current += (current ? ' ' : '') + sent
          }
        }
      } else {
        current = para
      }
    }
  }
  if (current) chunks.push(current)
  return chunks
}

async function mergeMp3Chunks(chunks: Buffer[], tmpDir: string): Promise<Buffer> {
  const { execSync } = require('child_process')
  const path = require('path')
  const fs = require('fs')

  const files: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    const f = path.join(tmpDir, `chunk_${i}.mp3`)
    fs.writeFileSync(f, chunks[i])
    files.push(f)
  }

  const listFile = path.join(tmpDir, 'chunks.txt')
  fs.writeFileSync(listFile, files.map(f => `file '${f}'`).join('\n'))

  const outputFile = path.join(tmpDir, `merged_${Date.now()}.mp3`)
  execSync(`ffmpeg -f concat -safe 0 -i "${listFile}" -c copy "${outputFile}" -y`)

  const result = fs.readFileSync(outputFile)

  for (const f of files) fs.unlinkSync(f)
  fs.unlinkSync(listFile)
  fs.unlinkSync(outputFile)

  return result
}

async function mp3ToWav(mp3Buffer: Buffer, tmpDir: string): Promise<Buffer> {
  const { execSync } = require('child_process')
  const path = require('path')
  const fs = require('fs')

  const inputFile = path.join(tmpDir, `input_${Date.now()}.mp3`)
  const outputFile = path.join(tmpDir, `output_${Date.now()}.wav`)
  fs.writeFileSync(inputFile, mp3Buffer)

  try {
    execSync(`ffmpeg -i "${inputFile}" -acodec pcm_s16le -ar 44100 -ac 2 "${outputFile}" -y`)
    const result = fs.readFileSync(outputFile)
    return result
  } finally {
    try { fs.unlinkSync(inputFile) } catch { /* ignore */ }
    try { fs.unlinkSync(outputFile) } catch { /* ignore */ }
  }
}

async function synthesizeWithChunking(params: {
  engine: string
  text: string
  voice: string
  speed: number
  apiKey: string
  format: 'mp3' | 'wav'
}) {
  const { text, engine, voice, speed, apiKey, format } = params

  if (text.length <= CHUNK_SIZE) {
    const result = await synthesize({ engine, text: text.trim(), voice, speed, apiKey })

    let audio = result.audio
    let contentType = result.contentType

    if (format === 'wav') {
      const os = require('os')
      audio = await mp3ToWav(audio, os.tmpdir())
      contentType = 'audio/wav'
    }

    return { audio, contentType, engine, isChunked: false, totalChunks: 1, completedChunks: 1 }
  }

  const chunks = chunkText(text.trim(), CHUNK_SIZE)
  const audioChunks: Buffer[] = []

  for (let i = 0; i < chunks.length; i++) {
    const chunkResult = await synthesize({ engine, text: chunks[i], voice, speed, apiKey })
    audioChunks.push(chunkResult.audio)
  }

  const os = require('os')
  const tmpDir = os.tmpdir()

  // Merge chunks to MP3 first
  const mergedMp3 = await mergeMp3Chunks(audioChunks, tmpDir)

  // Then convert to WAV if requested
  let audio: Buffer
  let contentType: string
  if (format === 'wav') {
    audio = await mp3ToWav(mergedMp3, tmpDir)
    contentType = 'audio/wav'
  } else {
    audio = mergedMp3
    contentType = 'audio/mpeg'
  }

  return {
    audio,
    contentType,
    engine,
    isChunked: true,
    totalChunks: chunks.length,
    completedChunks: chunks.length,
  }
}

export async function POST(req: NextRequest) {
  let engine = 'openai'
  try {
    const body = await req.json()
    const { text, engine: bodyEngine, voice: frontendVoice, speed = 1.0, plan = 'free', apiKey: bodyApiKey, format = 'mp3' } = body
    engine = bodyEngine || 'openai'

    const outputFormat = format === 'wav' ? 'wav' : 'mp3'

    // ── Validation ────────────────────────────────────────────────
    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }
    if (!ALLOWED_ENGINES.includes(engine)) {
      return NextResponse.json(
        { error: `Invalid engine. Allowed: ${ALLOWED_ENGINES.join(', ')}` },
        { status: 400 }
      )
    }
    if (outputFormat !== 'mp3' && outputFormat !== 'wav') {
      return NextResponse.json({ error: 'Invalid format. Must be mp3 or wav.' }, { status: 400 })
    }

    // ── Resolve API Key ───────────────────────────────────────────
    // Priority: body.apiKey (explicit key, no login required) > env var
    const apiKey = (bodyApiKey as string | undefined)?.trim() || process.env[`${engine.toUpperCase()}_API_KEY`] || null

    if (!apiKey) {
      return NextResponse.json(
        { error: `No API key for ${engine}. Pass apiKey in request body or set ${engine.toUpperCase()}_API_KEY env var.`, code: 'NO_API_KEY' },
        { status: 400 }
      )
    }

    // ── Auth + Rate Limit (only if user is logged in) ───────────
    let userId: string | null = null
    let rateLimitInfo = { allowed: true, limit: 999, used: 0, remaining: 999, resetsAt: '' }
    try {
      const authResult = await auth()
      userId = authResult.userId
    } catch {
      // Not logged in — skip rate limiting and usage tracking
    }

    if (userId) {
      rateLimitInfo = await checkRateLimit(userId, plan)
      if (!rateLimitInfo.allowed) {
        return NextResponse.json(
          { error: 'Rate limit exceeded', limit: rateLimitInfo.limit, used: rateLimitInfo.used, resetsAt: rateLimitInfo.resetsAt },
          { status: 429 }
        )
      }
    }

    // ── Synthesize ────────────────────────────────────────────────
    const voice = resolveVoice(engine, frontendVoice) || frontendVoice
    const result = await synthesizeWithChunking({
      engine,
      text: text.trim(),
      voice,
      speed: parseFloat(speed),
      apiKey,
      format: outputFormat,
    })

    // ── Track Usage (logged-in users only) ───────────────────────
    if (userId) {
      await incrementUsage(userId)
    }

    const ext = outputFormat
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = new Blob([result.audio as any], { type: result.contentType })
    const filename = `tts-output-${Date.now()}.${ext}`
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'X-TTS-Engine': result.engine,
        'X-TTS-Chunked': String(!!result.isChunked),
        'X-TTS-Total-Chunks': String(result.totalChunks),
        'X-TTS-Format': ext,
        'X-RateLimit-Remaining': String(Math.max(0, rateLimitInfo.remaining - 1)),
        'X-RateLimit-Limit': String(rateLimitInfo.limit),
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err: unknown) {
    console.error('[TTS] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'

    if (message.includes('API key') || message.includes('401') || message.includes('403') || message.includes('Incorrect') || message.includes('incorrect')) {
      return NextResponse.json({ error: 'Invalid API key. Please check your key.', code: 'INVALID_API_KEY' }, { status: 401 })
    }
    if (message.includes('429')) {
      return NextResponse.json({ error: 'Upstream API rate limit exceeded. Please try again later.', code: 'UPSTREAM_RATE_LIMIT' }, { status: 429 })
    }
    if (message.includes('insufficient_quota') || message.includes('quota') || message.includes('exceeded')) {
      return NextResponse.json({ error: 'API quota exceeded on your provider account.', code: 'QUOTA_EXCEEDED' }, { status: 402 })
    }
    if (message.includes('NO_API_KEY')) {
      return NextResponse.json({ error: `No API key configured for ${engine}. Add your key in the dashboard or pass it in the request body.`, code: 'NO_API_KEY' }, { status: 400 })
    }

    return NextResponse.json({ error: `TTS failed: ${message}`, code: 'TTS_ERROR' }, { status: 500 })
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
