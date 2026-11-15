import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { POST as audiobookPost, GET as audiobookInfo } from '@/app/api/audiobook/route'
import { GET as audiobookStatus } from '@/app/api/audiobook/[id]/route'
import { GET as audiobookDownload } from '@/app/api/audiobook/[id]/download/route'
import { parseBookFile } from '@/lib/audiobook/extract'
import {
  AudiobookConversionError,
  convertBook,
  planConversion,
  splitIntoSegments,
  type ConversionProgress,
} from '@/lib/audiobook/pipeline'
import { startAudiobookConversion } from '@/lib/audiobook/service'
import { getAudiobookJob } from '@/lib/audiobook/jobs'
import { MockTtsProvider, TtsOrchestrator, type AudioSegment, type SynthesizeOptions, type TtsProvider } from '@/lib/tts/provider'
import { getMockProvider } from '@/lib/tts/synthesis'
import { countBillableChars } from '@/lib/billing/char-count'
import { getMonthlyUsage, reserveChars } from '@/lib/billing/usage'
import { getPlanOrFree } from '@/lib/billing/plans'
import { signInAs, fetchCalls } from '../helpers/auth'
import { getRequest, uniqueUser, uploadRequest } from '../helpers/http'

const FIXTURE = readFileSync(path.resolve(__dirname, '../fixtures/sample-book.txt'))
const BOOK_FILE = { name: '巷口的一天.txt', content: FIXTURE }
const env = process.env as Record<string, string | undefined>

const loadBook = () => parseBookFile({ buffer: FIXTURE, filename: BOOK_FILE.name })

/** SRT／VTT 的 cue 數量（以時間軸行計算）。 */
const cueCount = (subtitle: string) => (subtitle.match(/-->/g) || []).length

describe('AC-004 有聲書轉換流程（Mock）', () => {
  beforeEach(() => {
    getMockProvider().reset()
  })

  describe('convertBook（parse → Mock TTS → 章節音檔 → 字幕）', () => {
    it('AC-004 3 章 fixture 產出 3 個章節、檔名 {slug}-chapter-XX、SRT／VTT、且 Mock 呼叫次數等於片段數', async () => {
      const book = await loadBook()
      const mock = new MockTtsProvider()
      const plan = planConversion(book)
      const result = await convertBook({ book, orchestrator: new TtsOrchestrator([mock]), voice: 'zh-TW' })

      // 3 個章節輸出
      expect(result.chapters).toHaveLength(3)
      expect(result.chapters.map((c) => c.chapterNumber)).toEqual([1, 2, 3])
      expect(result.bookSlug).toBe('巷口的一天')

      // 檔名符合 {slug}-chapter-XX
      expect(result.chapters.map((c) => c.baseName)).toEqual([
        '巷口的一天-chapter-01',
        '巷口的一天-chapter-02',
        '巷口的一天-chapter-03',
      ])
      for (const chapter of result.chapters) {
        expect(chapter.fileName).toMatch(/^巷口的一天-chapter-\d{2}\.wav$/)
        expect(chapter.fileName).toBe(`${chapter.baseName}.wav`)
      }

      // SRT 與 VTT 各至少 1 段，且每個片段一個 cue
      for (const chapter of result.chapters) {
        expect(cueCount(chapter.srt)).toBeGreaterThanOrEqual(1)
        expect(cueCount(chapter.vtt)).toBeGreaterThanOrEqual(1)
        expect(cueCount(chapter.srt)).toBe(chapter.segmentCount)
        expect(cueCount(chapter.vtt)).toBe(chapter.segmentCount)
        expect(chapter.srt.startsWith('1\n00:00:00,000 --> ')).toBe(true)
        expect(chapter.vtt.startsWith('WEBVTT\n\n')).toBe(true)
      }

      // Mock provider 的呼叫次數等於片段數（無重複合成）
      const totalSegments = result.chapters.reduce((sum, c) => sum + c.segmentCount, 0)
      expect(totalSegments).toBe(plan.totalSegments)
      expect(totalSegments).toBeGreaterThan(3)
      expect(mock.calls).toHaveLength(totalSegments)
      expect(mock.calls.map((c) => c.text)).toEqual(plan.chapters.flatMap((c) => c.segments.map((s) => s.text)))
      expect(mock.calls.every((c) => c.voiceId === 'zh-TW')).toBe(true)
      expect(result.provider).toBe('mock')
    })

    it('AC-004 章節音檔是有效的 WAV，長度等於各片段 PCM 的總和', async () => {
      const book = await loadBook()
      const result = await convertBook({ book, orchestrator: new TtsOrchestrator([new MockTtsProvider()]) })
      for (const chapter of result.chapters) {
        const wav = Buffer.from(chapter.audio)
        expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF')
        expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE')
        expect(chapter.contentType).toBe('audio/wav')
        // 16kHz、16-bit、mono：每毫秒 32 bytes
        expect(wav.length).toBe(44 + chapter.durationMs * 32)
        expect(chapter.durationMs).toBe(chapter.markers.at(-1)!.endMs)
      }
    })

    it('AC-004 章節標記與字幕時序來自實際合成片段的長度', async () => {
      const book = await loadBook()
      const result = await convertBook({ book, orchestrator: new TtsOrchestrator([new MockTtsProvider()]) })

      // 章內標記：首尾相接、從 0 開始、朗讀者為旁白
      const first = result.chapters[0]
      expect(first.markers[0]).toMatchObject({ index: 0, startMs: 0, label: '旁白' })
      for (let i = 1; i < first.markers.length; i++) {
        expect(first.markers[i].startMs).toBe(first.markers[i - 1].endMs)
        expect(first.markers[i].endMs).toBeGreaterThan(first.markers[i].startMs)
      }
      // 字幕第一段是章節標題，時間等於第一個片段的長度
      const titleDuration = (await new MockTtsProvider().synthesize({ voice: { id: 'zh-TW' }, text: '第一章 巷口的豆漿店' })).durationMs
      expect(first.markers[0].endMs).toBe(titleDuration)
      expect(first.srt).toContain('旁白: 第一章 巷口的豆漿店')
      expect(first.vtt).toContain('<v 旁白>第一章 巷口的豆漿店</v>')
      expect(first.srt).toContain('阿嬤把磨好的黃豆倒進大鍋')

      // 整本書層級的章節標記：連續、涵蓋全部長度
      expect(result.chapterMarkers).toHaveLength(3)
      expect(result.chapterMarkers[0].startMs).toBe(0)
      expect(result.chapterMarkers[1].startMs).toBe(result.chapterMarkers[0].endMs)
      expect(result.chapterMarkers[2].startMs).toBe(result.chapterMarkers[1].endMs)
      expect(result.chapterMarkers[2].endMs).toBe(result.totalDurationMs)
      expect(result.chapterMarkers.map((m) => m.title)).toEqual(book.chapters.map((c) => c.title))
      expect(result.totalDurationMs).toBe(result.chapters.reduce((sum, c) => sum + c.durationMs, 0))
    })

    it('AC-004 每章帶有 ID3 標籤資料（書名、章名、曲序）', async () => {
      const book = await loadBook()
      const result = await convertBook({ book, orchestrator: new TtsOrchestrator([new MockTtsProvider()]) })
      expect(result.chapters[1].id3).toEqual({
        title: '第二章 午後的雷陣雨',
        artist: 'Unknown',
        album: '巷口的一天',
        trackNumber: 2,
        comment: 'Generated by text-to-speech-mvp',
      })
      expect(result.chapters[1].id3Tag.startsWith('ID3')).toBe(true)
      expect(result.chapters[1].id3Tag).toContain('"track":2')
      expect(result.chapters[1].id3Tag).toContain(`"chapterCount":${result.chapters[1].segmentCount}`)
    })

    it('AC-004 進度狀態逐步回報，最後為 done／100%', async () => {
      const book = await loadBook()
      const events: ConversionProgress[] = []
      const result = await convertBook({
        book,
        orchestrator: new TtsOrchestrator([new MockTtsProvider()]),
        onProgress: (p) => {
          events.push({ ...p })
        },
      })
      expect(events.length).toBeGreaterThan(result.totalSegments)
      for (let i = 1; i < events.length; i++) {
        expect(events[i].completedSegments).toBeGreaterThanOrEqual(events[i - 1].completedSegments)
        expect(events[i].percent).toBeGreaterThanOrEqual(events[i - 1].percent)
      }
      expect(events[0]).toMatchObject({ status: 'running', completedChapters: 0, completedSegments: 0, percent: 0, currentChapter: 1 })
      expect(events.at(-1)).toEqual({
        status: 'done',
        totalChapters: 3,
        completedChapters: 3,
        totalSegments: result.totalSegments,
        completedSegments: result.totalSegments,
        percent: 100,
        currentChapter: null,
      })
      expect(new Set(events.map((e) => e.completedChapters))).toEqual(new Set([0, 1, 2, 3]))
    })

    it('AC-004 某章合成失敗時不重試、不重複合成，並回報已完成的章節', async () => {
      const book = await loadBook()
      const plan = planConversion(book)
      const failAt = plan.chapters[0].segments.length + 2 // 第二章的第 2 個片段
      let calls = 0
      const flaky: TtsProvider = {
        name: 'flaky-mock',
        isHealthy: async () => true,
        synthesize: async (opts: SynthesizeOptions): Promise<AudioSegment> => {
          calls += 1
          if (calls === failAt) throw new Error('simulated provider outage')
          return new MockTtsProvider().synthesize(opts)
        },
      }
      const events: ConversionProgress[] = []
      const error = await convertBook({
        book,
        orchestrator: new TtsOrchestrator([flaky]),
        onProgress: (p) => {
          events.push({ ...p })
        },
      }).catch((e) => e)

      expect(error).toBeInstanceOf(AudiobookConversionError)
      expect((error as AudiobookConversionError).failedChapter).toBe(2)
      expect((error as AudiobookConversionError).completed.map((c) => c.chapterNumber)).toEqual([1])
      // 失敗後立即停止：呼叫次數恰好到失敗的那一次
      expect(calls).toBe(failAt)
      expect(events.at(-1)?.status).toBe('failed')
    })

    it('AC-004 回傳編碼音訊（非 PCM）的 provider 會被拒絕：正式引擎的整本轉換屬 M2', async () => {
      const book = await loadBook()
      const encoded: TtsProvider = {
        name: 'fake-mp3',
        isHealthy: async () => true,
        synthesize: async (opts) => ({
          voiceId: opts.voice.id,
          bytes: new Uint8Array([1, 2, 3]),
          durationMs: 1000,
          sampleRateHz: 0,
          provider: 'fake-mp3',
          contentType: 'audio/mpeg',
        }),
      }
      await expect(convertBook({ book, orchestrator: new TtsOrchestrator([encoded]) })).rejects.toThrow(/M2/)
    })

    it('AC-004 transformText 只影響送進 provider 的文字；字幕維持原文', async () => {
      const book = await loadBook()
      const mock = new MockTtsProvider()
      const result = await convertBook({
        book,
        orchestrator: new TtsOrchestrator([mock]),
        transformText: (t) => t.replaceAll('阿嬤', '阿罵'),
      })
      expect(mock.calls.some((c) => c.text.includes('阿罵'))).toBe(true)
      expect(mock.calls.some((c) => c.text.includes('阿嬤'))).toBe(false)
      expect(result.chapters[0].srt).toContain('阿嬤')
      expect(result.chapters[0].srt).not.toContain('阿罵')
    })
  })

  describe('splitIntoSegments', () => {
    it('AC-004 依句末標點切分並合併到上限以內，內容不遺失、不重複', () => {
      const text = '第一句。第二句！第三句？「引號內的句子。」最後一句'
      const segments = splitIntoSegments(text, 8)
      for (const s of segments) expect(s.length).toBeLessThanOrEqual(8)
      expect(segments.join('')).toBe(text)
      expect(splitIntoSegments(text, 1000)).toEqual([text])
    })

    it('AC-004 沒有標點的超長句子以長度硬切；空白內容沒有片段', () => {
      const long = '字'.repeat(25)
      expect(splitIntoSegments(long, 10).map((s) => s.length)).toEqual([10, 10, 5])
      expect(splitIntoSegments('  \n \n', 10)).toEqual([])
    })

    it('AC-004 planConversion：章節標題會被朗讀並計入字數；佔位標題「Chapter N」不朗讀', async () => {
      const book = await loadBook()
      const plan = planConversion(book)
      expect(plan.chapters[0].segments[0]).toEqual({ text: '第一章 巷口的豆漿店', isTitle: true })
      const expected = book.chapters.reduce((sum, c) => sum + countBillableChars(c.title) + countBillableChars(c.text), 0)
      expect(plan.totalBillableChars).toBe(expected)

      const untitled = await parseBookFile({ buffer: Buffer.from('沒有章節標題的一段文字。'), filename: 'note.txt' })
      const untitledPlan = planConversion(untitled)
      expect(untitledPlan.chapters[0].segments.every((s) => !s.isTitle)).toBe(true)
      expect(untitledPlan.chapters[0].segments.map((s) => s.text)).toEqual(['沒有章節標題的一段文字。'])
    })
  })

  describe('/api/audiobook（上傳 → 轉換 → 進度 → 下載）', () => {
    it('AC-004 上傳 3 章 TXT：201、3 章、進度 done、可下載音檔／字幕／章節標記，且無重複合成', async () => {
      const userId = uniqueUser('reader')
      signInAs(userId)

      const res = await audiobookPost(uploadRequest('/api/audiobook', { rightsConfirmed: 'true', voice: 'zh-TW-male' }, BOOK_FILE))
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.status).toBe('done')
      expect(body.book).toMatchObject({ title: '巷口的一天', slug: '巷口的一天', fileType: 'txt', chapterCount: 3 })
      expect(body.settings).toMatchObject({ voice: 'zh-TW-male', mock: true, provider: 'mock' })
      expect(body.progress).toMatchObject({ status: 'done', totalChapters: 3, completedChapters: 3, percent: 100 })
      expect(body.chapters).toHaveLength(3)
      expect(body.chapters.map((c: { base_name: string }) => c.base_name)).toEqual([
        '巷口的一天-chapter-01',
        '巷口的一天-chapter-02',
        '巷口的一天-chapter-03',
      ])
      expect(body.chapter_markers).toHaveLength(3)

      // Mock 呼叫次數 = 片段數；沒有對外連線
      const totalSegments = body.chapters.reduce((sum: number, c: { segment_count: number }) => sum + c.segment_count, 0)
      expect(body.progress.totalSegments).toBe(totalSegments)
      expect(getMockProvider().calls).toHaveLength(totalSegments)
      expect(new Set(getMockProvider().calls.map((c) => c.voiceId))).toEqual(new Set(['zh-TW-male']))
      expect(fetchCalls()).toHaveLength(0)

      // 狀態端點
      const id = body.job_id as string
      const status = await audiobookStatus(getRequest(`/api/audiobook/${id}`), { params: { id } })
      expect(status.status).toBe(200)
      expect((await status.json()).progress.percent).toBe(100)

      // 下載：音檔、SRT、VTT、章內標記、整本章節標記
      const dl = (query: string) => audiobookDownload(getRequest(`/api/audiobook/${id}/download?${query}`), { params: { id } })
      const audio = await dl('chapter=2&format=audio')
      expect(audio.status).toBe(200)
      expect(audio.headers.get('Content-Type')).toBe('audio/wav')
      expect(decodeURIComponent(audio.headers.get('Content-Disposition') || '')).toContain('巷口的一天-chapter-02.wav')
      expect(audio.headers.get('Cache-Control')).toContain('no-store')
      const wav = Buffer.from(await audio.arrayBuffer())
      expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF')
      expect(wav.length).toBe(body.chapters[1].audio_bytes)

      const srt = await (await dl('chapter=1&format=srt')).text()
      expect(cueCount(srt)).toBe(body.chapters[0].segment_count)
      const vtt = await (await dl('chapter=3&format=vtt')).text()
      expect(vtt.startsWith('WEBVTT')).toBe(true)
      expect(cueCount(vtt)).toBe(body.chapters[2].segment_count)

      const markers = await (await dl('chapter=1&format=markers')).json()
      expect(markers.markers).toHaveLength(body.chapters[0].segment_count)
      const manifest = await (await dl('format=manifest')).json()
      expect(manifest.chapter_markers.map((m: { fileName: string }) => m.fileName)).toEqual([
        '巷口的一天-chapter-01.wav',
        '巷口的一天-chapter-02.wav',
        '巷口的一天-chapter-03.wav',
      ])
      expect((await dl('chapter=9&format=audio')).status).toBe(404)
      expect((await dl('chapter=1&format=exe')).status).toBe(400)

      // 按字數計量：成功後扣整本的計費字數
      expect(body.billing.billedChars).toBe(body.billing.billableChars)
      expect(await getMonthlyUsage(userId)).toBe(body.billing.billableChars)
    })

    it('AC-004 以自訂書名上傳時，檔名 slug 取自書名', async () => {
      signInAs(uniqueUser('reader'))
      const res = await audiobookPost(
        uploadRequest('/api/audiobook', { rightsConfirmed: 'true', title: 'My Demo Book' }, { name: 'whatever.txt', content: FIXTURE }),
      )
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.chapters.map((c: { file_name: string }) => c.file_name)).toEqual([
        'my-demo-book-chapter-01.wav',
        'my-demo-book-chapter-02.wav',
        'my-demo-book-chapter-03.wav',
      ])
    })

    it('AC-004 超過 M1 Mock 模式上限的書被拒（413），不截斷、不合成、不扣量', async () => {
      const userId = uniqueUser('reader')
      signInAs(userId)
      env.AUDIOBOOK_MOCK_MAX_CHARS = '50'
      try {
        const res = await audiobookPost(uploadRequest('/api/audiobook', { rightsConfirmed: 'true' }, BOOK_FILE))
        expect(res.status).toBe(413)
        const body = await res.json()
        expect(body.code).toBe('BOOK_TOO_LONG_FOR_M1')
        expect(body.chars).toBeGreaterThan(50)
        expect(getMockProvider().calls).toHaveLength(0)
        expect(await getMonthlyUsage(userId)).toBe(0)
      } finally {
        delete env.AUDIOBOOK_MOCK_MAX_CHARS
      }
    })

    it('AC-004 非測試模式時整本轉換不開放（503），不會呼叫任何引擎', async () => {
      signInAs(uniqueUser('reader'))
      env.NODE_ENV = 'development'
      delete env.TTS_PROVIDER
      env.OPENAI_API_KEY = 'placeholder-not-a-real-key'
      const res = await audiobookPost(uploadRequest('/api/audiobook', { rightsConfirmed: 'true', engine: 'openai' }, BOOK_FILE))
      expect(res.status).toBe(503)
      expect((await res.json()).code).toBe('AUDIOBOOK_MOCK_ONLY')
      expect(getMockProvider().calls).toHaveLength(0)
      expect(fetchCalls()).toHaveLength(0)
    })

    it('AC-004 額度不足時回 402，不建立工作也不合成', async () => {
      const userId = uniqueUser('reader')
      signInAs(userId)
      const free = getPlanOrFree('free')
      await reserveChars(userId, getPlanOrFree('custom'), (free.monthlyCharLimit as number) - 10)
      const res = await audiobookPost(uploadRequest('/api/audiobook', { rightsConfirmed: 'true' }, BOOK_FILE))
      expect(res.status).toBe(402)
      expect((await res.json()).code).toBe('CHAR_QUOTA_EXCEEDED')
      expect(getMockProvider().calls).toHaveLength(0)
      expect(await getMonthlyUsage(userId)).toBe((free.monthlyCharLimit as number) - 10)
    })

    it('AC-004 中途失敗：工作標為 failed、保留已完成章節，只對已完成章節計量', async () => {
      const userId = uniqueUser('reader')
      const book = await loadBook()
      const plan = planConversion(book)
      const failAt = plan.chapters[0].segments.length + 1
      let calls = 0
      const flaky: TtsProvider = {
        name: 'mock',
        isHealthy: async () => true,
        synthesize: async (opts) => {
          calls += 1
          if (calls === failAt) throw new Error('simulated provider outage')
          return new MockTtsProvider().synthesize(opts)
        },
      }
      const outcome = await startAudiobookConversion({
        identity: { kind: 'user', userId },
        book,
        filename: BOOK_FILE.name,
        orchestrator: new TtsOrchestrator([flaky]),
      })
      expect(outcome.ok).toBe(false)
      expect(outcome.job.status).toBe('failed')
      expect(outcome.job.errorMsg).toContain('第 2 章合成失敗')
      expect(outcome.job.chapters.map((c) => c.chapterNumber)).toEqual([1])
      expect(outcome.job.billing.billedChars).toBe(plan.chapters[0].billableChars)
      expect(await getMonthlyUsage(userId)).toBe(plan.chapters[0].billableChars)
      expect((await getAudiobookJob(outcome.job.id))?.status).toBe('failed')
      expect(calls).toBe(failAt)
    })

    it('AC-004 GET /api/audiobook 回傳權利聲明與限制', async () => {
      const info = await (await audiobookInfo()).json()
      expect(info.rights.statement).toContain('自有或已授權內容')
      expect(info.limits.max_file_bytes).toBe(50 * 1024 * 1024)
      expect(info.mode).toBe('mock')
    })
  })
})
