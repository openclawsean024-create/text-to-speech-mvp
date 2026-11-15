import { NextRequest, NextResponse } from 'next/server'
import { getUserApiKeys, incrementUsage } from '@/lib/db'
import { resolveIdentity, identityUserId } from '@/lib/identity'
import { resolveServerPlan } from '@/lib/billing/plans'
import { countBillableChars } from '@/lib/billing/char-count'
import { reserveChars, commitChars, refundChars, quotaExceededBody } from '@/lib/billing/usage'
import { isMockTtsMode } from '@/lib/tts/mode'
import { lexiconTransformer } from '@/lib/lexicon'
import { getEngineEnvConfig, isSupportedEngine, synthesizeLongText } from '@/lib/tts/synthesis'

// 批次目前只開放這三個引擎（FR-015）
const ALLOWED_ENGINES = ['openai', 'elevenlabs', 'kokoro']

/**
 * 批次轉換（FR-015）。
 *
 * - 方案與額度由伺服器端決定（AC-008）；每個任務各自按字數計量（AC-005）。
 * - 測試模式只用 Mock，不需要也不使用任何引擎金鑰（AC-003）。
 */
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

    // ── Resolve API Key from first task, user keys, or env ───────
    const firstTask = tasks[0]
    const engine: string = firstTask?.engine || 'openai'
    const mock = isMockTtsMode()

    let byokKey = (firstTask.apiKey as string | undefined)?.trim()
      || (firstTask.api_key as string | undefined)?.trim()
      || ''

    if (!byokKey && !mock) {
      const keys = await getUserApiKeys(userId)
      byokKey = (keys as Record<string, string | null>)[engine] || ''
    }

    const envCfg = getEngineEnvConfig(engine)
    if (!mock && !byokKey && !envCfg.key) {
      return NextResponse.json(
        { error: `No API key for ${engine}. Pass apiKey in task or set the corresponding env var.`, code: 'NO_API_KEY' },
        { status: 400 }
      )
    }

    // 發音校正詞庫（AC-006）：計費用原文，送進引擎的是校正後文字
    const applyLexicon = await lexiconTransformer(userId)

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

      if (!ALLOWED_ENGINES.includes(engine) || !isSupportedEngine(engine)) {
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
        const parsedSpeed = parseFloat(speed)
        const result = await synthesizeLongText({
          engine,
          text: applyLexicon(text.trim()),
          voice: typeof frontendVoice === 'string' ? frontendVoice : undefined,
          speed: Number.isFinite(parsedSpeed) ? parsedSpeed : 1.0,
          apiKey: byokKey || null,
          format: format === 'wav' ? 'wav' : 'mp3',
        })

        // In production this would upload to private object storage (M2); here we return a base64 data URL
        const audioUrl = `data:${result.contentType};base64,${result.audio.toString('base64')}`

        await commitChars(reserved.reservation, result.provider)
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
      mock,
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
