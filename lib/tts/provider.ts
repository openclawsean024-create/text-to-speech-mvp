/**
 * TTS provider 介面、Orchestrator（依序降級）與離線 Mock。
 *
 * 移植自 ebook-to-audiobook `src/lib/engine/tts.ts`（commit 75c3a31），SPEC §12.1 #2 / GOAL AC-003：
 *   - 搬入：`TtsProvider`、`AudioSegment`、`SynthesizeOptions`、`TtsOrchestrator`、`MockTtsProvider`。
 *   - 不搬：EB 的 Google／Azure stub（它們實際回傳 Mock 音訊）。改以 `EngineTtsProvider`
 *     包裝主 repo 既有的 `lib/tts-engines.js` 五個引擎。
 */

import { isMockTtsMode } from './mode'

/** 聲音識別。`id` 可以是前端聲音代碼（例：zh-TW）或引擎原生 voice id。 */
export interface Voice {
  id: string
  name?: string
  gender?: 'male' | 'female' | 'neutral'
  locale?: string
  type?: 'builtin' | 'cloned'
  provider?: string
}

export interface AudioSegment {
  voiceId: string
  /** Mock：16-bit PCM mono；正式引擎：引擎回傳的編碼音訊（通常為 MP3）。 */
  bytes: Uint8Array
  durationMs: number
  /** PCM 取樣率；編碼音訊（MP3）為 0。 */
  sampleRateHz: number
  /** 產生此片段的 provider 名稱。 */
  provider: string
  /** `audio/L16`（raw PCM）或引擎回傳的 MIME type。 */
  contentType: string
  /** true＝durationMs 為依字數估算（正式引擎不回傳長度）。 */
  durationEstimated?: boolean
}

export const PCM_CONTENT_TYPE = 'audio/L16'

export interface SynthesizeOptions {
  voice: Voice
  text: string
  speed?: number
  emotion?: string
  style?: string
  /** If true, throws on failure rather than falling back (used in tests). */
  noFallback?: boolean
}

export interface TtsProvider {
  readonly name: string
  isHealthy(): Promise<boolean>
  synthesize(opts: SynthesizeOptions): Promise<AudioSegment>
}

/** 朗讀時間估算（毫秒）：中日文約 2.5 字／秒，其餘約 14 字元／秒。 */
export function estimateSpeechMs(text: string, speed = 1): number {
  const cjkChars = (text.match(/[一-鿿぀-ヿ]/g) || []).length
  const asciiChars = text.length - cjkChars
  const rate = Number.isFinite(speed) && speed > 0 ? speed : 1
  return Math.round(((cjkChars / 2.5 + asciiChars / 14) * 1000) / rate)
}

// ────────────────────────────────────────────────────────────────────────────
// Mock provider — deterministic, offline-safe, used for tests + dev.
// Synthesizes placeholder PCM (a 440Hz tone) sized to the input length.
// ────────────────────────────────────────────────────────────────────────────

export interface MockSynthesizeCall {
  text: string
  voiceId: string
  speed?: number
}

export interface MockProviderOptions {
  /**
   * 單次合成的音訊長度上限（毫秒）。Mock 產生未壓縮 PCM（約 32KB／秒），
   * 伺服器路徑設上限以免長文字佔用大量記憶體；未設定＝不設上限。
   */
  maxDurationMs?: number
}

export class MockTtsProvider implements TtsProvider {
  readonly name = 'mock'
  /** 每次 synthesize 的輸入紀錄（測試用：驗證呼叫次數與實際送出的文字）。 */
  readonly calls: MockSynthesizeCall[] = []

  constructor(private readonly options: MockProviderOptions = {}) {}

  async isHealthy(): Promise<boolean> {
    return true
  }

  async synthesize(opts: SynthesizeOptions): Promise<AudioSegment> {
    this.calls.push({ text: opts.text, voiceId: opts.voice.id, speed: opts.speed })
    const uncapped = Math.max(500, estimateSpeechMs(opts.text))
    const durationMs = this.options.maxDurationMs ? Math.min(uncapped, this.options.maxDurationMs) : uncapped
    const sampleRate = 16000
    const numSamples = Math.round((durationMs / 1000) * sampleRate)
    // 16-bit signed PCM mono, simple sine-ish placeholder
    const bytes = new Uint8Array(numSamples * 2)
    for (let i = 0; i < numSamples; i++) {
      const sample = Math.sin((i / sampleRate) * 440 * 2 * Math.PI) * 0x1fff
      const v = Math.max(-0x7fff, Math.min(0x7fff, Math.round(sample)))
      bytes[i * 2] = v & 0xff
      bytes[i * 2 + 1] = (v >> 8) & 0xff
    }
    return {
      voiceId: opts.voice.id,
      bytes,
      durationMs,
      sampleRateHz: sampleRate,
      provider: this.name,
      contentType: PCM_CONTENT_TYPE,
    }
  }

  reset(): void {
    this.calls.length = 0
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Engine provider — 包裝 lib/tts-engines.js 的單一引擎（付費 API）。
// 未設定金鑰時回報 unhealthy，讓 Orchestrator 依序降級到下一個 provider。
// ────────────────────────────────────────────────────────────────────────────

export type EngineName = 'openai' | 'elevenlabs' | 'kokoro' | 'azure' | 'google'

export interface EngineSynthesizeParams {
  engine: string
  text: string
  voice?: string
  speed?: number
  apiKey?: string
  emotion?: string
  style?: string
  region?: string
}

export interface EngineSynthesizeResult {
  audio: Uint8Array
  contentType: string
  engine?: string
  voice?: string
}

export type EngineSynthesizeFn = (params: EngineSynthesizeParams) => Promise<EngineSynthesizeResult>

export interface EngineProviderConfig {
  engine: EngineName
  apiKey?: string | null
  region?: string | null
  /** 把 Voice.id 轉成該引擎的 voice id（未提供時原樣傳入）。 */
  resolveVoice?: (engine: EngineName, voiceId: string) => string | undefined
  /** 測試用：注入假的引擎函式。未注入時使用 lib/tts-engines.js（真實付費 API）。 */
  synthesizeFn?: EngineSynthesizeFn
}

export class EngineTtsProvider implements TtsProvider {
  readonly name: string

  constructor(private readonly config: EngineProviderConfig) {
    this.name = config.engine
  }

  async isHealthy(): Promise<boolean> {
    return Boolean(this.config.apiKey)
  }

  async synthesize(opts: SynthesizeOptions): Promise<AudioSegment> {
    const { engine, apiKey, region, resolveVoice } = this.config
    if (!apiKey) throw new Error(`${engine} TTS API key not configured`)

    let synthesizeFn = this.config.synthesizeFn
    if (!synthesizeFn) {
      // 最後一道防線：測試模式下絕不載入、也不呼叫真實引擎。
      if (isMockTtsMode()) {
        throw new Error(`TTS 測試模式不得呼叫付費引擎（${engine}）`)
      }
      // 延後載入：測試模式下連引擎模組（與 OpenAI SDK）都不會被載入。
      const mod = (await import('@/lib/tts-engines')) as unknown as {
        synthesize?: EngineSynthesizeFn
        default?: { synthesize?: EngineSynthesizeFn }
      }
      synthesizeFn = mod.synthesize ?? mod.default?.synthesize
      if (!synthesizeFn) throw new Error('lib/tts-engines 未匯出 synthesize')
    }

    const voice = resolveVoice?.(engine, opts.voice.id) ?? opts.voice.id
    const result = await synthesizeFn({
      engine,
      text: opts.text,
      voice,
      speed: opts.speed,
      apiKey,
      emotion: opts.emotion,
      style: opts.style,
      region: region ?? undefined,
    })
    return {
      voiceId: result.voice ?? voice,
      bytes: result.audio,
      durationMs: Math.max(500, estimateSpeechMs(opts.text, opts.speed)),
      durationEstimated: true,
      sampleRateHz: 0,
      provider: this.name,
      contentType: result.contentType || 'audio/mpeg',
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Orchestrator — 依序使用第一個 healthy 的 provider，失敗則降級到下一個。
// ────────────────────────────────────────────────────────────────────────────

export class TtsOrchestrator {
  constructor(private readonly providers: TtsProvider[]) {}

  /** provider 名稱（依降級順序）。 */
  get order(): string[] {
    return this.providers.map((p) => p.name)
  }

  async synthesize(opts: SynthesizeOptions): Promise<AudioSegment> {
    const order = this.providers
    const tried: string[] = []
    let lastError: unknown = null
    if (opts.noFallback) {
      const primary = order[0]
      if (!primary) throw new Error('No TTS provider configured')
      if (!(await primary.isHealthy())) {
        throw new Error(`Primary provider ${primary.name} is unhealthy (noFallback=true)`)
      }
      return primary.synthesize(opts)
    }
    for (const p of order) {
      if (tried.includes(p.name)) continue
      if (!(await p.isHealthy())) continue
      try {
        return await p.synthesize(opts)
      } catch (err) {
        tried.push(p.name)
        lastError = err
        // Continue to next provider (graceful degradation).
      }
    }
    const detail = lastError instanceof Error ? `; last error: ${lastError.message}` : ''
    throw new Error(`All TTS providers failed (tried: ${tried.join(', ') || 'none healthy'})${detail}`)
  }
}
