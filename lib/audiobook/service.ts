/**
 * 有聲書轉換服務：額度 → 建立工作 → 轉換 → 保存產出 → 計量。
 * API route 只負責解析請求與回應；商業邏輯集中在這裡以便整合測試。
 */

import { identityUserId, type Identity } from '@/lib/identity'
import { resolveServerPlan } from '@/lib/billing/plans'
import { commitChars, quotaExceededBody, refundChars, reserveChars } from '@/lib/billing/usage'
import { makeRightsRecord } from '@/lib/rights'
import { isMockTtsMode } from '@/lib/tts/mode'
import { buildOrchestrator, isSupportedEngine } from '@/lib/tts/synthesis'
import type { EngineName, TtsOrchestrator } from '@/lib/tts/provider'
import { slugify } from './parser'
import {
  AudiobookConversionError,
  convertBook,
  planConversion,
  type ChapterOutput,
  type ConversionProgress,
} from './pipeline'
import {
  createAudiobookJob,
  saveAudiobookJob,
  storeChapterAudio,
  sweepExpiredAudio,
  toChapterRecord,
  type AudiobookJob,
} from './jobs'
import type { ParsedBook } from './types'

/** M1 Mock 模式下單本書的計費字數上限（Mock 產生未壓縮 PCM，全部暫存在記憶體）。 */
export const DEFAULT_MOCK_MAX_CHARS = 50_000

export function mockMaxChars(): number {
  const raw = Number(process.env.AUDIOBOOK_MOCK_MAX_CHARS)
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_MOCK_MAX_CHARS
}

export class AudiobookRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'AudiobookRequestError'
  }
}

export interface StartConversionInput {
  identity: Identity
  book: ParsedBook
  filename: string
  engine?: string
  voice?: string
  speed?: number
  /** 送進 provider 前的文字轉換（發音校正詞庫，AC-006）。 */
  transformText?: (text: string) => string
  /** 測試用：注入 orchestrator。 */
  orchestrator?: TtsOrchestrator
  now?: Date
}

export interface ConversionOutcome {
  job: AudiobookJob
  ok: boolean
}

export async function startAudiobookConversion(input: StartConversionInput): Promise<ConversionOutcome> {
  const { identity, book, filename } = input
  const userId = identityUserId(identity)
  if (!userId || identity.kind === 'anonymous') {
    throw new AudiobookRequestError('Authentication required', 401, 'NO_AUTH')
  }

  // M1：整本轉換只在測試模式（Mock）開放；正式引擎屬 M2（需私有儲存與背景佇列）。
  const mock = isMockTtsMode()
  if (!mock && !input.orchestrator) {
    throw new AudiobookRequestError(
      '有聲書轉換在 M1 僅支援測試模式（TTS_PROVIDER=mock）；正式引擎的整本轉換將於 M2 開放。',
      503,
      'AUDIOBOOK_MOCK_ONLY',
    )
  }

  const engine: EngineName = input.engine && isSupportedEngine(input.engine) ? input.engine : 'openai'
  const voice = input.voice?.trim() || 'zh-TW'
  const speed = Number.isFinite(input.speed) && (input.speed as number) > 0 ? (input.speed as number) : 1

  const conversionPlan = planConversion(book)
  if (conversionPlan.totalSegments === 0) {
    throw new AudiobookRequestError('檔案沒有可朗讀的文字內容。', 422, 'EMPTY_CONTENT')
  }
  const maxChars = mockMaxChars()
  if (conversionPlan.totalBillableChars > maxChars) {
    throw new AudiobookRequestError(
      `M1 測試模式單本上限為 ${maxChars.toLocaleString('en-US')} 字（此檔為 ${conversionPlan.totalBillableChars.toLocaleString('en-US')} 字）。內容未被截斷；更長的書需等 M2 的背景轉換。`,
      413,
      'BOOK_TOO_LONG_FOR_M1',
      { limit: maxChars, chars: conversionPlan.totalBillableChars },
    )
  }

  // ── 每月字數額度：整本先佔用 ───────────────────────────────────
  const plan = await resolveServerPlan(identity)
  const reserved = await reserveChars(userId, plan, conversionPlan.totalBillableChars, input.now)
  if (reserved.ok === false) {
    const body = quotaExceededBody(reserved.status, reserved.requested)
    throw new AudiobookRequestError(body.error, 402, body.code, body)
  }
  const reservation = reserved.reservation

  sweepExpiredAudio()
  const initialProgress: ConversionProgress = {
    status: 'running',
    totalChapters: conversionPlan.chapters.length,
    completedChapters: 0,
    totalSegments: conversionPlan.totalSegments,
    completedSegments: 0,
    percent: 0,
    currentChapter: conversionPlan.chapters[0]?.chapter.number ?? null,
  }
  const job = await createAudiobookJob({
    owner: {
      userId: identity.kind === 'apiKey' ? null : userId,
      apiKeyId: identity.kind === 'apiKey' ? identity.apiKeyId : null,
    },
    status: 'running',
    rights: makeRightsRecord(input.now),
    book: {
      title: book.title,
      slug: slugify(book.title),
      author: book.author,
      fileType: book.fileType,
      filename,
      totalChars: book.totalChars,
      chapterCount: book.chapters.length,
    },
    settings: { engine, voice, speed, mock, provider: null },
    progress: initialProgress,
    billing: { plan: plan.id, billableChars: conversionPlan.totalBillableChars, billedChars: 0 },
  })

  const orchestrator = input.orchestrator ?? buildOrchestrator({ engine })
  const persistOutputs = (outputs: ChapterOutput[]) => {
    for (const output of outputs) storeChapterAudio(job, output)
    job.chapters = outputs.map(toChapterRecord)
    job.chapterMarkers = outputs.map((c) => ({
      chapterNumber: c.chapterNumber,
      title: c.title,
      startMs: c.startMs,
      endMs: c.endMs,
      fileName: c.fileName,
    }))
  }

  let savedChapters = -1
  try {
    const result = await convertBook({
      book,
      orchestrator,
      voice,
      speed,
      plan: conversionPlan,
      transformText: input.transformText,
      onProgress: async (progress) => {
        job.progress = progress
        // 每完成一章才寫回一次，避免逐片段寫入 KV
        if (progress.completedChapters !== savedChapters) {
          savedChapters = progress.completedChapters
          await saveAudiobookJob(job)
        }
      },
    })

    persistOutputs(result.chapters)
    job.status = 'done'
    job.settings.provider = result.provider
    job.billing.billedChars = result.totalBillableChars
    job.finishedAt = Date.now()
    await commitChars(reservation, result.provider || 'mock')
    await saveAudiobookJob(job)
    return { job, ok: true }
  } catch (err) {
    // 只對已完成的章節計量；未完成的部分退回額度（失敗的合成不計字數）
    const completed = err instanceof AudiobookConversionError ? err.completed : []
    const billed = completed.reduce((sum, c) => sum + c.billableChars, 0)
    persistOutputs(completed)
    await refundChars(reservation, conversionPlan.totalBillableChars - billed).catch(() => {})
    if (billed > 0) await commitChars(reservation, job.settings.provider || (mock ? 'mock' : engine)).catch(() => {})

    job.status = 'failed'
    job.progress = { ...job.progress, status: 'failed' }
    job.billing.billedChars = billed
    job.errorMsg = err instanceof Error ? err.message : 'unknown error'
    job.finishedAt = Date.now()
    await saveAudiobookJob(job)
    return { job, ok: false }
  }
}
