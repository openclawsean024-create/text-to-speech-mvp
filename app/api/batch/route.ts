import { NextRequest, NextResponse } from 'next/server'
import { getUserApiKeys, incrementUsage } from '@/lib/db'
import { synthesize } from '@/lib/tts-engines'
import { resolveIdentity, identityUserId } from '@/lib/identity'
import { resolveServerPlan } from '@/lib/billing/plans'
import { countBillableChars } from '@/lib/billing/char-count'
import { reserveChars, commitChars, refundChars, quotaExceededBody } from '@/lib/billing/usage'

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

async function mergeWavChunks(chunks: Buffer[], tmpDir: string): Promise<Buffer> {
  const { execSync } = require('child_process')
  const path = require('path')
  const fs = require('fs')

  const files: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    const f = path.join(tmpDir, `chunk_${i}.wav`)
    fs.writeFileSync(f, chunks[i])
    files.push(f)
  }

  const listFile = path.join(tmpDir, 'wav_chunks.txt')
  fs.writeFileSync(listFile, files.map(f => `file '${f}'`).join('\n'))

  const outputFile = path.join(tmpDir, `merged_${Date.now()}.wav`)
  execSync(`ffmpeg -f concat -safe 0 -i "${listFile}" -c copy "${outputFile}" -y`)

  const result = fs.readFileSync(outputFile)

  for (const f of files) fs.unlinkSync(f)
  fs.unlinkSync(listFile)
  fs.unlinkSync(outputFile)

  return result
}

async function synthesizeTask(params: {
  engine: string
  text: string
  voice: string
  speed: number
  apiKey: string
  format: 'mp3' | 'wav'
}): Promise<{ audio: Buffer; contentType: string; isChunked: boolean; totalChunks: number }> {
  const { text, engine, voice, speed, apiKey, format } = params

  if (text.length <= CHUNK_SIZE) {
    const result = await synthesize({ engine, text: text.trim(), voice, speed, apiKey })
    return { ...result, isChunked: false, totalChunks: 1 }
  }

  const chunks = chunkText(text.trim(), CHUNK_SIZE)
  const audioChunks: Buffer[] = []

  for (let i = 0; i < chunks.length; i++) {
    const chunkResult = await synthesize({ engine, text: chunks[i], voice, speed, apiKey })
    audioChunks.push(chunkResult.audio)
  }

  const os = require('os')
  const tmpDir = os.tmpdir()

  let merged: Buffer
  if (format === 'wav') {
    merged = await mergeWavChunks(audioChunks, tmpDir)
  } else {
    merged = await mergeMp3Chunks(audioChunks, tmpDir)
  }

  return {
    audio: merged,
    contentType: format === 'wav' ? 'audio/wav' : 'audio/mpeg',
    isChunked: true,
    totalChunks: chunks.length,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // 注意：body.plan 不採信（AC-008）。方案一律由伺服器端依訂閱紀錄決定。
    const { tasks } = body

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ error: 'tasks must be a non-empty array' }, { status: 400 })
    }
    if (tasks.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 tasks per batch' }, { status: 400 })
    }

    // ── 身分與方案（伺服器端決定）────────────────────────────────
    const identity = await resolveIdentity(req)
    const userId = identityUserId(identity)
    if (!userId) {
      return NextResponse.json({ error: '請先登入後再使用批次轉換。', code: 'NO_AUTH' }, { status: 401 })
    }
    const plan = await resolveServerPlan(identity)

    // ── Resolve API Key from first task or user keys ───────────
    const firstTask = tasks[0]
    const engine = firstTask?.engine || 'openai'

    let apiKey = (firstTask.apiKey as string | undefined)?.trim()
      || (firstTask.api_key as string | undefined)?.trim()

    if (!apiKey) {
      const keys = await getUserApiKeys(userId)
      apiKey = (keys as Record<string, string>)[engine]
    }

    if (!apiKey) {
      apiKey = process.env[`${engine.toUpperCase()}_API_KEY`] || ''
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: `No API key for ${engine}. Pass apiKey in task or set ${engine.toUpperCase()}_API_KEY env var.` },
        { status: 400 }
      )
    }

    // ── Process each task ───────────────────────────────────────
    const results: Array<{
      id: string
      success: boolean
      audioUrl?: string
      contentType?: string
      error?: string
      code?: string
      status?: number
      billableChars?: number
      isChunked?: boolean
      totalChunks?: number
    }> = []

    for (const task of tasks) {
      const { id, text, voice: frontendVoice, speed = 1.0, format = 'mp3' } = task

      if (!text || typeof text !== 'string' || !text.trim()) {
        results.push({ id, success: false, error: 'text is required' })
        continue
      }

      if (!ALLOWED_ENGINES.includes(engine)) {
        results.push({ id, success: false, error: `Invalid engine: ${engine}` })
        continue
      }

      // 每個任務各自佔用額度；超額的任務回報 402，不影響已完成的任務
      const billableChars = countBillableChars(text)
      const reserved = await reserveChars(userId, plan, billableChars)
      if (reserved.ok === false) {
        const exceeded = quotaExceededBody(reserved.status, reserved.requested)
        results.push({ id, success: false, error: exceeded.error, code: exceeded.code, status: 402 })
        continue
      }

      try {
        const voice = resolveVoice(engine, frontendVoice) || frontendVoice
        const result = await synthesizeTask({
          engine,
          text: text.trim(),
          voice,
          speed: parseFloat(speed),
          apiKey,
          format: format === 'wav' ? 'wav' : 'mp3',
        })

        // In production this would upload to private object storage (M2); here we return a base64 data URL
        const base64 = result.audio.toString('base64')
        const audioUrl = `data:${result.contentType};base64,${base64}`

        await commitChars(reserved.reservation, engine)
        await incrementUsage(userId)

        results.push({
          id,
          success: true,
          audioUrl,
          contentType: result.contentType,
          billableChars,
          isChunked: result.isChunked,
          totalChunks: result.totalChunks,
        })
      } catch (err: unknown) {
        // 合成失敗不計字數
        await refundChars(reserved.reservation).catch(() => {})
        const message = err instanceof Error ? err.message : 'Unknown error'
        results.push({ id: task.id, success: false, error: message })
      }
    }

    // 全部任務都因額度不足而失敗時，整個請求回 402
    const allQuotaExceeded = results.length > 0 && results.every(r => r.status === 402)

    return NextResponse.json({
      results,
      processed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      plan: plan.id,
      ...(allQuotaExceeded
        ? { error: '本月字數額度不足，請升級方案或等待下個計費月份。', code: 'CHAR_QUOTA_EXCEEDED' }
        : {}),
    }, {
      status: allQuotaExceeded ? 402 : 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    console.error('[Batch] Error:', err instanceof Error ? err.message : 'unknown error')
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Batch processing failed: ${message}` }, { status: 500 })
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
