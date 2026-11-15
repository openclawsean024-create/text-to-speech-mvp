import { NextRequest, NextResponse } from 'next/server'
import { incrementUsage } from '@/lib/db'
import { resolveIdentity, identityUserId } from '@/lib/identity'
import { resolveServerPlan } from '@/lib/billing/plans'
import { countBillableChars } from '@/lib/billing/char-count'
import { reserveChars, commitChars, refundChars, quotaExceededBody, type Reservation } from '@/lib/billing/usage'
import { isMockTtsMode } from '@/lib/tts/mode'
import { lexiconTransformer } from '@/lib/lexicon'
import {
  SUPPORTED_ENGINES,
  getEngineEnvConfig,
  isSupportedEngine,
  synthesizeLongText,
} from '@/lib/tts/synthesis'

/**
 * 單段／長文字轉語音（FR-001、FR-003）。
 *
 * - 方案與額度由伺服器端決定（AC-008）；按字數計量，超額回 402，失敗不扣量（AC-005）。
 * - 測試模式（TTS_PROVIDER=mock 或 NODE_ENV=test）只用 Mock，不需要也不使用任何引擎金鑰（AC-003）。
 */
export async function POST(req: NextRequest) {
  let engine = 'openai'
  let reservation: Reservation | null = null
  try {
    const body = await req.json()
    // 注意：body.plan 不採信（AC-008）。方案一律由伺服器端依訂閱紀錄決定。
    const {
      text,
      engine: bodyEngine,
      voice: frontendVoice,
      speed = 1.0,
      apiKey: bodyApiKey,
      format = 'mp3',
      emotion,
      style,
      region,
    } = body
    engine = bodyEngine || 'openai'

    const outputFormat = format === 'wav' ? 'wav' : 'mp3'

    // ── Validation ────────────────────────────────────────────────
    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }
    if (!isSupportedEngine(engine)) {
      return NextResponse.json(
        { error: `Invalid engine. Allowed: ${SUPPORTED_ENGINES.join(', ')}` },
        { status: 400 }
      )
    }

    // ── 身分與方案（伺服器端決定）────────────────────────────────
    const identity = await resolveIdentity(req)
    const userId = identityUserId(identity)
    if (!userId) {
      return NextResponse.json({ error: '請先登入後再使用雲端語音合成。', code: 'NO_AUTH' }, { status: 401 })
    }
    const plan = await resolveServerPlan(identity)

    // ── Resolve API Key ───────────────────────────────────────────
    // Priority: body.apiKey (BYOK) > per-engine env var。測試模式不需要金鑰。
    const mock = isMockTtsMode()
    const envCfg = getEngineEnvConfig(engine)
    const byokKey = typeof bodyApiKey === 'string' ? bodyApiKey.trim() : ''
    const resolvedRegion = (typeof region === 'string' && region.trim()) || envCfg.region || undefined

    if (!mock && !byokKey && !envCfg.key) {
      return NextResponse.json(
        { error: `No API key for ${engine}. Pass apiKey in request body or set the corresponding env var.`, code: 'NO_API_KEY' },
        { status: 400 }
      )
    }

    // ── 每月字數額度：先佔用，合成失敗再退回 ─────────────────────
    const billableChars = countBillableChars(text)
    const reserved = await reserveChars(userId, plan, billableChars)
    if (reserved.ok === false) {
      return NextResponse.json(quotaExceededBody(reserved.status, reserved.requested), { status: 402 })
    }
    reservation = reserved.reservation
    const quota = reserved.status

    // ── 發音校正詞庫：計費已用原文計算，送進引擎的是校正後文字（AC-006）──
    const applyLexicon = await lexiconTransformer(userId)
    const spokenText = applyLexicon(text.trim())

    // ── Synthesize（每個片段只合成一次）──────────────────────────
    const parsedSpeed = parseFloat(speed)
    const result = await synthesizeLongText({
      engine,
      text: spokenText,
      voice: typeof frontendVoice === 'string' ? frontendVoice : undefined,
      speed: Number.isFinite(parsedSpeed) ? parsedSpeed : 1.0,
      apiKey: byokKey || null,
      region: resolvedRegion,
      emotion: emotion as string | undefined,
      style: style as string | undefined,
      format: outputFormat,
    })

    // ── 合成成功才計量 ───────────────────────────────────────────
    await commitChars(reservation, result.provider)
    await incrementUsage(userId)

    const ext = result.format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = new Blob([result.audio as any], { type: result.contentType })
    const filename = `tts-output-${result.provider}-${Date.now()}.${ext}`
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'X-TTS-Engine': result.provider,
        'X-TTS-Mock': String(result.mock),
        'X-TTS-Chunked': String(result.isChunked),
        'X-TTS-Total-Chunks': String(result.totalChunks),
        'X-TTS-Format': ext,
        'X-Plan': quota.plan,
        'X-Billable-Chars': String(billableChars),
        'X-Quota-Limit': quota.limit === null ? 'unlimited' : String(quota.limit),
        'X-Quota-Remaining': quota.remaining === null ? 'unlimited' : String(quota.remaining),
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers':
          'X-TTS-Engine, X-TTS-Mock, X-TTS-Chunked, X-TTS-Total-Chunks, X-TTS-Format, X-Plan, X-Billable-Chars, X-Quota-Limit, X-Quota-Remaining',
      },
    })
  } catch (err: unknown) {
    // 合成失敗不計字數
    if (reservation) await refundChars(reservation).catch(() => {})
    console.error('[TTS] Error:', err instanceof Error ? err.message : 'unknown error')
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
