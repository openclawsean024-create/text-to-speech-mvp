import { describe, it, expect, vi } from 'vitest'
import {
  MockTtsProvider,
  EngineTtsProvider,
  TtsOrchestrator,
  PCM_CONTENT_TYPE,
  type EngineSynthesizeFn,
  type SynthesizeOptions,
  type Voice,
} from '@/lib/tts/provider'
import { buildOrchestrator, buildProviders, getMockProvider, parseFallbackOrder, synthesizeSpeech } from '@/lib/tts/synthesis'
import { isMockTtsMode } from '@/lib/tts/mode'
import { chunkText } from '@/lib/tts/chunk'
import { fetchCalls } from '../helpers/auth'

/**
 * 移植自 ebook-to-audiobook `src/lib/engine/__tests__/tts.test.ts`。
 * EB 的 GoogleTtsProvider／AzureTtsProvider 是回傳 Mock 音訊的 stub（SPEC §12.1 #2 明定不搬），
 * 對應案例改以 EngineTtsProvider（包裝主 repo 的 lib/tts-engines.js）驗證相同的行為：
 * 未設定金鑰＝unhealthy、依序降級、noFallback、全部失敗時拋錯。
 */

const baseVoice: Voice = { id: 'zh-TW-female-1', name: '示範女聲', gender: 'female', locale: 'zh-TW', type: 'builtin', provider: 'mock' }
const baseOpts: SynthesizeOptions = {
  voice: baseVoice,
  text: '小瑜決定出門走走。',
}

/** 假引擎：不連網，回傳固定位元組並記錄呼叫。 */
function fakeEngine() {
  const fn = vi.fn<EngineSynthesizeFn>(async ({ engine, voice }) => ({
    audio: new Uint8Array([1, 2, 3]),
    contentType: 'audio/mpeg',
    engine,
    voice,
  }))
  return fn
}
const failingEngine: EngineSynthesizeFn = async ({ engine }) => {
  throw new Error(`${engine} upstream 503`)
}

const env = process.env as Record<string, string | undefined>
function leaveMockMode() {
  env.NODE_ENV = 'development'
  delete env.TTS_PROVIDER
}

describe('AC-003 tts module — provider 介面、降級順序與 Mock', () => {
  describe('MockTtsProvider', () => {
    it('AC-003 reports healthy in offline environments', async () => {
      const mock = new MockTtsProvider()
      expect(await mock.isHealthy()).toBe(true)
    })

    it('AC-003 produces PCM audio bytes scaled to text length', async () => {
      const mock = new MockTtsProvider()
      const seg = await mock.synthesize(baseOpts)
      expect(seg.bytes.length).toBeGreaterThan(0)
      expect(seg.sampleRateHz).toBe(16000)
      expect(seg.provider).toBe('mock')
      expect(seg.voiceId).toBe(baseVoice.id)
      expect(seg.contentType).toBe(PCM_CONTENT_TYPE)
    })

    it('AC-003 produces audio whose duration scales with input length', async () => {
      const mock = new MockTtsProvider()
      const short = await mock.synthesize({ ...baseOpts, text: '你好' })
      const long = await mock.synthesize({
        ...baseOpts,
        text: '從前從前有一個故事很長很長很長很長很長很長。'.repeat(20),
      })
      expect(long.durationMs).toBeGreaterThan(short.durationMs)
    })

    it('AC-003 produces at least 500ms of audio even for empty text', async () => {
      const mock = new MockTtsProvider()
      const seg = await mock.synthesize({ ...baseOpts, text: '' })
      expect(seg.durationMs).toBeGreaterThanOrEqual(500)
    })

    it('AC-003 是決定性的，並記錄每次呼叫的輸入', async () => {
      const mock = new MockTtsProvider()
      const a = await mock.synthesize(baseOpts)
      const b = await mock.synthesize(baseOpts)
      expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(true)
      expect(mock.calls).toEqual([
        { text: baseOpts.text, voiceId: baseVoice.id, speed: undefined },
        { text: baseOpts.text, voiceId: baseVoice.id, speed: undefined },
      ])
      mock.reset()
      expect(mock.calls).toHaveLength(0)
    })

    it('AC-003 可設定單次合成長度上限（伺服器路徑用，避免長文字佔用大量記憶體）', async () => {
      const capped = new MockTtsProvider({ maxDurationMs: 2000 })
      const seg = await capped.synthesize({ ...baseOpts, text: '很長的句子。'.repeat(200) })
      expect(seg.durationMs).toBe(2000)
      expect(seg.bytes.length).toBe(2 * 16000 * 2)
      const short = await capped.synthesize({ ...baseOpts, text: '短句' })
      expect(short.durationMs).toBeLessThan(2000)
    })
  })

  describe('EngineTtsProvider（包裝 lib/tts-engines.js；取代 EB 的 Google／Azure stub）', () => {
    it('AC-003 reports unhealthy when no API key is configured', async () => {
      const g = new EngineTtsProvider({ engine: 'google', apiKey: undefined, synthesizeFn: fakeEngine() })
      expect(await g.isHealthy()).toBe(false)
      expect(await new EngineTtsProvider({ engine: 'azure', apiKey: null, region: 'eastasia' }).isHealthy()).toBe(false)
      expect(await new EngineTtsProvider({ engine: 'azure', apiKey: '' }).isHealthy()).toBe(false)
    })

    it('AC-003 reports healthy when API key is provided', async () => {
      const g = new EngineTtsProvider({ engine: 'google', apiKey: 'fake-key-for-test', synthesizeFn: fakeEngine() })
      expect(await g.isHealthy()).toBe(true)
      expect(await new EngineTtsProvider({ engine: 'azure', apiKey: 'k', region: 'eastasia' }).isHealthy()).toBe(true)
    })

    it('AC-003 throws a clear error when synthesizing without a key', async () => {
      const engine = fakeEngine()
      const g = new EngineTtsProvider({ engine: 'google', apiKey: undefined, synthesizeFn: engine })
      await expect(g.synthesize(baseOpts)).rejects.toThrow(/api key/i)
      expect(engine).not.toHaveBeenCalled()
    })

    it('AC-003 把引擎、金鑰、區域與對應後的 voice 傳給引擎函式，回傳編碼音訊', async () => {
      const engine = fakeEngine()
      const p = new EngineTtsProvider({
        engine: 'azure',
        apiKey: 'fake-key',
        region: 'eastasia',
        resolveVoice: (e, v) => (v === 'zh-TW' ? `${e}-mapped-voice` : undefined),
        synthesizeFn: engine,
      })
      const seg = await p.synthesize({ voice: { id: 'zh-TW' }, text: '哈囉', speed: 1.25, style: 'calm' })
      expect(engine).toHaveBeenCalledTimes(1)
      expect(engine).toHaveBeenCalledWith({
        engine: 'azure',
        text: '哈囉',
        voice: 'azure-mapped-voice',
        speed: 1.25,
        apiKey: 'fake-key',
        emotion: undefined,
        style: 'calm',
        region: 'eastasia',
      })
      expect(seg.provider).toBe('azure')
      expect(seg.contentType).toBe('audio/mpeg')
      expect(seg.durationEstimated).toBe(true)
    })

    it('AC-003 測試模式下，未注入假引擎的 provider 拒絕合成（不會載入或呼叫付費引擎）', async () => {
      expect(isMockTtsMode()).toBe(true)
      const real = new EngineTtsProvider({ engine: 'openai', apiKey: 'placeholder-not-a-real-key' })
      await expect(real.synthesize(baseOpts)).rejects.toThrow(/測試模式不得呼叫付費引擎/)
      expect(fetchCalls()).toHaveLength(0)
    })
  })

  describe('TtsOrchestrator（依序降級）', () => {
    const google = (key?: string, fn: EngineSynthesizeFn = fakeEngine()) =>
      new EngineTtsProvider({ engine: 'google', apiKey: key, synthesizeFn: fn })
    const azure = (key?: string, fn: EngineSynthesizeFn = fakeEngine()) =>
      new EngineTtsProvider({ engine: 'azure', apiKey: key, region: 'eastasia', synthesizeFn: fn })

    it('AC-003 uses the first provider when configured and skips fallback', async () => {
      const mock = new MockTtsProvider()
      const orch = new TtsOrchestrator([google('fake-key'), mock])
      const seg = await orch.synthesize(baseOpts)
      expect(seg.provider).toBe('google')
      expect(mock.calls).toHaveLength(0)
    })

    it('AC-003 falls back to Mock when Google has no API key', async () => {
      const orch = new TtsOrchestrator([google(undefined), new MockTtsProvider()])
      const seg = await orch.synthesize(baseOpts)
      expect(seg.provider).toBe('mock')
    })

    it('AC-003 falls back to Azure when Google is unhealthy', async () => {
      const orch = new TtsOrchestrator([google(undefined), azure('fake-key'), new MockTtsProvider()])
      const seg = await orch.synthesize(baseOpts)
      expect(seg.provider).toBe('azure')
    })

    it('AC-003 falls back to Mock when both Google and Azure are unhealthy', async () => {
      const orch = new TtsOrchestrator([google(undefined), azure(undefined), new MockTtsProvider()])
      const seg = await orch.synthesize(baseOpts)
      expect(seg.provider).toBe('mock')
    })

    it('AC-003 healthy 但合成失敗時，降級到下一個 provider，且每個 provider 只嘗試一次', async () => {
      const failing = vi.fn(failingEngine)
      const backup = fakeEngine()
      const orch = new TtsOrchestrator([google('fake-key', failing), azure('fake-key', backup)])
      const seg = await orch.synthesize(baseOpts)
      expect(seg.provider).toBe('azure')
      expect(failing).toHaveBeenCalledTimes(1)
      expect(backup).toHaveBeenCalledTimes(1)
      expect(orch.order).toEqual(['google', 'azure'])
    })

    it('AC-003 throws when noFallback=true and the first provider fails', async () => {
      const orch = new TtsOrchestrator([google(undefined), new MockTtsProvider()])
      await expect(orch.synthesize({ ...baseOpts, noFallback: true })).rejects.toThrow()
    })

    it('AC-003 throws when every provider is exhausted', async () => {
      const orch = new TtsOrchestrator([google(undefined), azure(undefined)])
      await expect(orch.synthesize(baseOpts)).rejects.toThrow(/all tts providers/i)

      const allFail = new TtsOrchestrator([google('k', failingEngine), azure('k', failingEngine)])
      await expect(allFail.synthesize(baseOpts)).rejects.toThrow(/tried: google, azure/)
    })
  })

  describe('buildOrchestrator（環境決定 provider 組合）', () => {
    it('AC-003 測試模式只包含 Mock，即使環境中有引擎金鑰', async () => {
      env.OPENAI_API_KEY = 'placeholder-not-a-real-key'
      env.AZURE_SPEECH_KEY = 'placeholder-not-a-real-key'
      env.TTS_FALLBACK_ORDER = 'azure,google'
      try {
        for (const engine of ['openai', 'elevenlabs', 'kokoro', 'azure', 'google'] as const) {
          expect(buildOrchestrator({ engine, apiKey: 'byok-placeholder' }).order).toEqual(['mock'])
        }
        const seg = await synthesizeSpeech({ engine: 'openai', text: baseOpts.text, voice: 'zh-TW' })
        expect(seg.provider).toBe('mock')
        expect(getMockProvider().calls.at(-1)).toMatchObject({ text: baseOpts.text, voiceId: 'zh-TW' })
        expect(fetchCalls()).toHaveLength(0)
      } finally {
        delete env.TTS_FALLBACK_ORDER
      }
    })

    it('AC-003 TTS_PROVIDER=mock 在 NODE_ENV=production 也生效；NODE_ENV=test 時無法以 TTS_PROVIDER 關閉', () => {
      env.NODE_ENV = 'production'
      env.TTS_PROVIDER = 'mock'
      expect(isMockTtsMode()).toBe(true)
      expect(buildOrchestrator({ engine: 'openai' }).order).toEqual(['mock'])

      env.NODE_ENV = 'test'
      env.TTS_PROVIDER = 'openai'
      expect(isMockTtsMode()).toBe(true)
      expect(buildOrchestrator({ engine: 'openai' }).order).toEqual(['mock'])
    })

    it('AC-003 正式模式：未設定 TTS_FALLBACK_ORDER 時只用指定引擎，且不會降級到 Mock', async () => {
      leaveMockMode()
      expect(isMockTtsMode()).toBe(false)
      const orch = buildOrchestrator({ engine: 'openai', synthesizeFn: fakeEngine() })
      expect(orch.order).toEqual(['openai'])
      // 沒有任何金鑰 → 全部 unhealthy → 拋錯，而不是回傳 Mock 音訊
      await expect(orch.synthesize(baseOpts)).rejects.toThrow(/all tts providers/i)
      expect(buildProviders({ engine: 'openai' }).some((p) => p.name === 'mock')).toBe(false)
    })

    it('AC-003 正式模式：依 TTS_FALLBACK_ORDER 的順序降級，只納入有伺服器金鑰的引擎', async () => {
      leaveMockMode()
      env.TTS_FALLBACK_ORDER = 'google, azure ,openai,unknown,azure'
      env.OPENAI_API_KEY = 'placeholder-not-a-real-key'
      env.AZURE_SPEECH_KEY = 'placeholder-not-a-real-key'
      try {
        expect(parseFallbackOrder()).toEqual(['google', 'azure', 'openai'])
        const calls: string[] = []
        const engine: EngineSynthesizeFn = async ({ engine: name }) => {
          calls.push(name)
          if (name === 'openai') throw new Error('openai upstream 503')
          return { audio: new Uint8Array([9]), contentType: 'audio/mpeg', engine: name }
        }
        // google 沒有金鑰 → 不在清單內；主要引擎 openai 失敗 → 降級到 azure
        const orch = buildOrchestrator({ engine: 'openai', synthesizeFn: engine })
        expect(orch.order).toEqual(['openai', 'azure'])
        const seg = await orch.synthesize(baseOpts)
        expect(seg.provider).toBe('azure')
        expect(calls).toEqual(['openai', 'azure'])
      } finally {
        delete env.TTS_FALLBACK_ORDER
      }
    })

    it('AC-003 正式模式：BYOK 請求不跨引擎降級（不會改用伺服器金鑰）', () => {
      leaveMockMode()
      env.TTS_FALLBACK_ORDER = 'azure,google'
      env.AZURE_SPEECH_KEY = 'placeholder-not-a-real-key'
      try {
        const orch = buildOrchestrator({ engine: 'elevenlabs', apiKey: 'byok-placeholder', synthesizeFn: fakeEngine() })
        expect(orch.order).toEqual(['elevenlabs'])
      } finally {
        delete env.TTS_FALLBACK_ORDER
      }
    })
  })

  describe('chunkText（長文字分段，FR-003）', () => {
    it('AC-003 不超過上限的文字維持一段', () => {
      expect(chunkText('第一段\n第二段', 100)).toEqual(['第一段\n第二段'])
    })

    it('AC-003 依段落累積，超過上限時換段；內容不遺失', () => {
      const paras = Array.from({ length: 10 }, (_, i) => `第${i}段`.padEnd(30, '字'))
      const chunks = chunkText(paras.join('\n'), 100)
      expect(chunks.length).toBeGreaterThan(1)
      for (const c of chunks) expect(c.length).toBeLessThanOrEqual(100)
      expect(chunks.join('\n')).toBe(paras.join('\n'))
    })

    it('AC-003 單一超長段落依句末標點切分', () => {
      const para = '這是一個句子。'.repeat(40)
      const chunks = chunkText(para, 50)
      expect(chunks.length).toBeGreaterThan(1)
      for (const c of chunks) {
        expect(c.length).toBeLessThanOrEqual(50)
        expect(c.endsWith('。')).toBe(true)
      }
      expect(chunks.join('').replace(/\s/g, '')).toBe(para)
    })
  })
})
