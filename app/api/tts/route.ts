import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getUserApiKeys, checkRateLimit, incrementUsage } from '@/lib/db'
import { synthesize } from '@/lib/tts-engines'

const ALLOWED_ENGINES = ['openai', 'elevenlabs', 'kokoro']

// Voice mapping: frontend voice code → engine-specific voice ID
// ElevenLabs: verified gender-aware voice IDs
// - 21m00Tcm4TlvDq8ikWAM = Rachel (female)
// - AZnzlk1XvdvUeBnXmlZG = Antoni (male)
const VOICE_MAP: Record<string, Record<string, string>> = {
  'zh-CN':      { openai: 'alloy',    elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'zh-CN-female' },  // Female
  'zh-TW':      { openai: 'onyx',     elevenlabs: 'AZnzlk1XvdvUeBnXmlZG', kokoro: 'zh-CN-male'   },  // Male
  'en-US':      { openai: 'alloy',    elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'en-US-female' },  // Female
  'ja-JP':      { openai: 'nova',     elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'ja-JP-female'  },  // Female
  'ko-KR':      { openai: 'fable',    elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'ko-KR-female'  },  // Female
  'en-US-male': { openai: 'onyx',     elevenlabs: 'AZnzlk1XvdvUeBnXmlZG', kokoro: 'en-US-male'   },  // Male
}

function resolveVoice(engine: string, frontendVoice?: string) {
  if (!frontendVoice) return undefined
  const mapped = VOICE_MAP[frontendVoice]
  return mapped ? mapped[engine] : undefined
}

const CHUNK_SIZE = 5000 // chars per chunk

function chunkText(text: string, size: number = CHUNK_SIZE): string[] {
  // Split by line to avoid cutting mid-sentence when possible
  const paragraphs = text.split(/\n+/)
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if ((current + para).length <= size) {
      current += (current ? '\n' : '') + para
    } else {
      if (current) chunks.push(current)
      // If single paragraph exceeds chunk size, split by sentence
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

  // Write each chunk to a temp file
  const files: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    const f = path.join(tmpDir, `chunk_${i}.mp3`)
    fs.writeFileSync(f, chunks[i])
    files.push(f)
  }

  // Use FFmpeg to concatenate all MP3 files
  const listFile = path.join(tmpDir, 'chunks.txt')
  const fileListContent = files.map(f => `file '${f}'`).join('\n')
  fs.writeFileSync(listFile, fileListContent)

  const outputFile = path.join(tmpDir, `merged_${Date.now()}.mp3`)
  execSync(`ffmpeg -f concat -safe 0 -i "${listFile}" -c copy "${outputFile}" -y`)

  const result = fs.readFileSync(outputFile)

  // Cleanup
  for (const f of files) fs.unlinkSync(f)
  fs.unlinkSync(listFile)
  fs.unlinkSync(outputFile)

  return result
}

/**
 * Synthesize with auto-chunking for large texts.
 * Returns { audio: Buffer, contentType, isChunked, totalChunks, completedChunks }
 */
async function synthesizeWithChunking(params: {
  engine: string
  text: string
  voice: string
  speed: number
  apiKey: string
}) {
  const { text, engine, voice, speed, apiKey } = params

  if (text.length <= CHUNK_SIZE) {
    const result = await synthesize({ engine, text: text.trim(), voice, speed, apiKey })
    return { ...result, isChunked: false, totalChunks: 1, completedChunks: 1 }
  }

  const chunks = chunkText(text.trim(), CHUNK_SIZE)
  const audioChunks: Buffer[] = []

  for (let i = 0; i < chunks.length; i++) {
    const chunkResult = await synthesize({ engine, text: chunks[i], voice, speed, apiKey })
    audioChunks.push(chunkResult.audio)
  }

  // Merge using FFmpeg
  const os = require('os')
  const tmpDir = os.tmpdir()
  const merged = await mergeMp3Chunks(audioChunks, tmpDir)

  return {
    audio: merged,
    contentType: 'audio/mpeg',
    engine,
    isChunked: true,
    totalChunks: chunks.length,
    completedChunks: chunks.length,
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
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

    // ── Synthesize (with auto-chunking for large texts) ────────────
    const voice = resolveVoice(engine, frontendVoice) || frontendVoice
    const result = await synthesizeWithChunking({
      engine,
      text: text.trim(),
      voice,
      speed: parseFloat(speed),
      apiKey,
    })

    // ── Track Usage ────────────────────────────────────────────────
    await incrementUsage(userId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = new Blob([result.audio as any], { type: result.contentType })
    const filename = `tts-${engine}-${Date.now()}.mp3`
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'X-TTS-Engine': result.engine,
        'X-TTS-Chunked': String(!!result.isChunked),
        'X-TTS-Total-Chunks': String(result.totalChunks),
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