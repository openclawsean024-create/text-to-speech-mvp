/**
 * 有聲書轉換流程（FR-007；GOAL AC-004）。
 *
 * ParsedBook → 逐章切片段 → 每個片段【只合成一次】→ 組成逐章音檔
 * → 章節標記、ID3 標籤資料、依合成時序產生的 SRT／VTT、進度回報。
 *
 * 這是以搬入模組（parser、TTS provider、audio、subtitles）重寫的版本，取代
 * ebook-to-audiobook `/api/conversions` 的內嵌實作，修正原實作的缺陷：
 *   - 原實作每個片段合成兩次（第一輪結果丟棄，成本加倍）→ 這裡單一迴圈、每片段一次。
 *   - 原實作以 Buffer.concat 直接串接 MP3 → 這裡只組 PCM；編碼音訊的合併屬 M2。
 *   - 原實作把模型 ID 當 voice ID → 這裡 voice 由呼叫端明確傳入並原樣交給 provider。
 *
 * M1 只支援回傳 PCM 的 provider（Mock）。正式引擎的整本轉換屬 M2。
 */

import { countBillableChars } from '@/lib/billing/char-count'
import { PCM_CONTENT_TYPE, type AudioSegment, type TtsOrchestrator } from '@/lib/tts/provider'
import {
  assembleChapterAudio,
  buildId3v2Tags,
  formatChapterBaseName,
  type ChapterAudio,
  type ChapterMarker,
} from './audio'
import { slugify } from './parser'
import { buildCues, buildSrt, buildVtt } from './subtitles'
import { NARRATOR, type Chapter, type ParsedBook, type Speaker } from './types'

/** 單一合成片段的字數上限（依句末標點切分後再合併到不超過此長度）。 */
export const DEFAULT_MAX_SEGMENT_CHARS = 120

const SENTENCE_END = /(?<=[。！？!?；;…])/u

/**
 * 把章節內文切成合成片段：先依句末標點切句，再把相鄰句子合併到不超過 `maxChars`；
 * 沒有標點的超長句子以 `maxChars` 硬切。空白片段會被捨棄。
 */
export function splitIntoSegments(text: string, maxChars: number = DEFAULT_MAX_SEGMENT_CHARS): string[] {
  const limit = Math.max(1, Math.floor(maxChars))
  const sentences: string[] = []
  for (const line of text.split(/\n+/)) {
    for (const part of line.split(SENTENCE_END)) {
      const sentence = part.trim()
      if (!sentence) continue
      if (sentence.length <= limit) {
        sentences.push(sentence)
      } else {
        const chars = Array.from(sentence)
        for (let i = 0; i < chars.length; i += limit) sentences.push(chars.slice(i, i + limit).join(''))
      }
    }
  }

  const segments: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (!current) current = sentence
    else if (current.length + sentence.length <= limit) current += sentence
    else {
      segments.push(current)
      current = sentence
    }
  }
  if (current) segments.push(current)
  return segments
}

export interface PlannedSegment {
  /** 原文（字幕與計費用）。 */
  text: string
  /** 是否為章節標題。 */
  isTitle: boolean
}

export interface PlannedChapter {
  chapter: Chapter
  segments: PlannedSegment[]
  billableChars: number
}

export interface ConversionPlan {
  chapters: PlannedChapter[]
  totalSegments: number
  totalBillableChars: number
}

/**
 * 規劃整本書的合成片段（不呼叫 provider）。章節標題會被朗讀，因此也計入片段與計費字數；
 * 預設的「Chapter N」佔位標題（原書沒有標題時由 parser 產生）不朗讀。
 */
export function planConversion(book: ParsedBook, maxSegmentChars: number = DEFAULT_MAX_SEGMENT_CHARS): ConversionPlan {
  const chapters = book.chapters.map((chapter) => {
    const segments: PlannedSegment[] = []
    const isPlaceholderTitle = /^Chapter \d+$/.test(chapter.title)
    if (chapter.title.trim() && !isPlaceholderTitle) {
      for (const text of splitIntoSegments(chapter.title, maxSegmentChars)) segments.push({ text, isTitle: true })
    }
    for (const text of splitIntoSegments(chapter.text, maxSegmentChars)) segments.push({ text, isTitle: false })
    const billableChars = segments.reduce((sum, s) => sum + countBillableChars(s.text), 0)
    return { chapter, segments, billableChars }
  })
  return {
    chapters,
    totalSegments: chapters.reduce((sum, c) => sum + c.segments.length, 0),
    totalBillableChars: chapters.reduce((sum, c) => sum + c.billableChars, 0),
  }
}

export interface ConversionProgress {
  status: 'running' | 'done' | 'failed'
  totalChapters: number
  completedChapters: number
  totalSegments: number
  completedSegments: number
  /** 0–100 的整數。 */
  percent: number
  /** 目前處理中的章節（1-based）；完成時為 null。 */
  currentChapter: number | null
}

export interface ChapterOutput {
  chapterNumber: number
  title: string
  /** `{slug}-chapter-XX`（不含副檔名）。 */
  baseName: string
  /** 實際輸出檔名（M1 Mock 為 WAV）。 */
  fileName: string
  contentType: string
  audio: Uint8Array
  durationMs: number
  /** 此章在整本書時間軸上的起訖（毫秒）。 */
  startMs: number
  endMs: number
  segmentCount: number
  /** 章內片段標記（依合成時序）。 */
  markers: ChapterMarker[]
  id3: ChapterAudio['id3']
  id3Tag: string
  srt: string
  vtt: string
  billableChars: number
}

export interface BookChapterMarker {
  chapterNumber: number
  title: string
  startMs: number
  endMs: number
  fileName: string
}

export interface ConversionResult {
  bookTitle: string
  bookSlug: string
  provider: string
  chapters: ChapterOutput[]
  /** 整本書層級的章節標記。 */
  chapterMarkers: BookChapterMarker[]
  totalDurationMs: number
  totalSegments: number
  totalBillableChars: number
}

export class AudiobookConversionError extends Error {
  constructor(
    message: string,
    /** 失敗前已完成的章節（其音檔與字幕仍可使用）。 */
    readonly completed: ChapterOutput[],
    readonly failedChapter: number,
  ) {
    super(message)
    this.name = 'AudiobookConversionError'
  }
}

export interface ConvertOptions {
  book: ParsedBook
  orchestrator: TtsOrchestrator
  /** 交給 provider 的 voice id（前端代碼或引擎原生 id）。 */
  voice?: string
  speed?: number
  speaker?: Speaker
  maxSegmentChars?: number
  /**
   * 送進 provider 前的文字轉換（例：發音校正詞庫）。字幕與計費一律使用轉換前的原文。
   */
  transformText?: (text: string) => string
  onProgress?: (progress: ConversionProgress) => void | Promise<void>
  /** 已規劃好的片段（呼叫端先用 planConversion 估算額度時傳入，避免重算）。 */
  plan?: ConversionPlan
}

function percent(done: number, total: number): number {
  return total === 0 ? 100 : Math.min(100, Math.floor((done / total) * 100))
}

export async function convertBook(opts: ConvertOptions): Promise<ConversionResult> {
  const { book, orchestrator, voice = 'zh-TW', speed, transformText } = opts
  const speaker = opts.speaker ?? NARRATOR
  const plan = opts.plan ?? planConversion(book, opts.maxSegmentChars)
  const bookSlug = slugify(book.title)

  const outputs: ChapterOutput[] = []
  let completedSegments = 0
  let bookOffsetMs = 0
  let provider = ''

  const report = async (status: ConversionProgress['status'], currentChapter: number | null) => {
    await opts.onProgress?.({
      status,
      totalChapters: plan.chapters.length,
      completedChapters: outputs.length,
      totalSegments: plan.totalSegments,
      completedSegments,
      percent: percent(completedSegments, plan.totalSegments),
      currentChapter,
    })
  }

  for (const planned of plan.chapters) {
    const { chapter } = planned
    await report('running', chapter.number)

    const synthesized: Array<{ speaker: Speaker; segment: AudioSegment }> = []
    try {
      // 單一迴圈：每個片段恰好呼叫 provider 一次。
      for (const item of planned.segments) {
        const spoken = transformText ? transformText(item.text) : item.text
        const segment = await orchestrator.synthesize({ voice: { id: voice }, text: spoken, speed })
        if (segment.contentType !== PCM_CONTENT_TYPE) {
          throw new Error(`provider ${segment.provider} 回傳編碼音訊；整本轉換目前只支援 PCM（Mock），正式引擎屬 M2`)
        }
        provider = provider || segment.provider
        synthesized.push({ speaker, segment })
        completedSegments += 1
        await report('running', chapter.number)
      }
    } catch (err) {
      await report('failed', chapter.number)
      const message = err instanceof Error ? err.message : 'unknown error'
      throw new AudiobookConversionError(`第 ${chapter.number} 章合成失敗：${message}`, outputs, chapter.number)
    }

    const audio = assembleChapterAudio({
      bookTitle: book.title,
      bookSlug,
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
      author: book.author,
      segments: synthesized,
    })
    const cues = buildCues(audio.markers, planned.segments.map((s) => s.text))
    const baseName = formatChapterBaseName(bookSlug, chapter.number)

    outputs.push({
      chapterNumber: chapter.number,
      title: chapter.title,
      baseName,
      fileName: `${baseName}.wav`,
      contentType: 'audio/wav',
      audio: audio.wavBytes,
      durationMs: audio.durationMs,
      startMs: bookOffsetMs,
      endMs: bookOffsetMs + audio.durationMs,
      segmentCount: synthesized.length,
      markers: audio.markers,
      id3: audio.id3,
      id3Tag: buildId3v2Tags(audio),
      srt: buildSrt(cues),
      vtt: buildVtt(cues),
      billableChars: planned.billableChars,
    })
    bookOffsetMs += audio.durationMs
  }

  await report('done', null)

  return {
    bookTitle: book.title,
    bookSlug,
    provider,
    chapters: outputs,
    chapterMarkers: outputs.map((c) => ({
      chapterNumber: c.chapterNumber,
      title: c.title,
      startMs: c.startMs,
      endMs: c.endMs,
      fileName: c.fileName,
    })),
    totalDurationMs: bookOffsetMs,
    totalSegments: completedSegments,
    totalBillableChars: plan.totalBillableChars,
  }
}
