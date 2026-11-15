import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as ttsPost } from '@/app/api/tts/route'
import { POST as batchPost } from '@/app/api/batch/route'
import { POST as previewPost } from '@/app/api/preview/route'
import { getMockProvider } from '@/lib/tts/synthesis'
import { VOICES } from '@/lib/voices'
import * as engines from '@/lib/tts-engines'
import { signInAs, unconfigureClerk, fetchCalls } from '../helpers/auth'
import { jsonRequest, uniqueUser } from '../helpers/http'

// 付費引擎模組整個換成「呼叫即拋錯」的間諜：只要任何合成路徑碰到它，測試就會失敗。
vi.mock('@/lib/tts-engines', () => {
  const paid = (name: string) =>
    vi.fn(() => {
      throw new Error(`付費引擎 ${name} 不得在測試模式被呼叫`)
    })
  const mod = {
    synthesize: paid('synthesize'),
    openaiTTS: paid('openai'),
    elevenlabsTTS: paid('elevenlabs'),
    kokoroTTS: paid('kokoro'),
    azureTTS: paid('azure'),
    googleTTS: paid('google'),
    SUPPORTED_ENGINES: ['openai', 'elevenlabs', 'kokoro', 'azure', 'google'],
  }
  return { ...mod, default: mod }
})

const env = process.env as Record<string, string | undefined>
const ENGINES = ['openai', 'elevenlabs', 'kokoro', 'azure', 'google'] as const

function expectNoPaidCalls() {
  // global.fetch 是「呼叫即拋錯」的 stub（tests/setup.ts）；外呼次數必須為 0
  expect(fetchCalls()).toHaveLength(0)
  for (const fn of [engines.synthesize, engines.openaiTTS, engines.elevenlabsTTS, engines.kokoroTTS, engines.azureTTS, engines.googleTTS]) {
    expect(fn).not.toHaveBeenCalled()
  }
}

async function wavOf(res: Response): Promise<Buffer> {
  const buf = Buffer.from(await res.arrayBuffer())
  expect(buf.subarray(0, 4).toString('ascii')).toBe('RIFF')
  expect(buf.subarray(8, 12).toString('ascii')).toBe('WAVE')
  return buf
}

describe('AC-003 TTS 測試模式：所有合成路徑只用 Mock，對付費 TTS 外呼 0 次', () => {
  beforeEach(() => {
    getMockProvider().reset()
    // 模擬「環境裡其實有金鑰」的情況：測試模式仍不得使用
    env.OPENAI_API_KEY = 'placeholder-not-a-real-key'
    env.ELEVENLABS_API_KEY = 'placeholder-not-a-real-key'
    env.KOKORO_API_KEY = 'placeholder-not-a-real-key'
    env.AZURE_SPEECH_KEY = 'placeholder-not-a-real-key'
    env.GOOGLE_TTS_API_KEY = 'placeholder-not-a-real-key'
  })

  it('AC-003 global.fetch 已換成呼叫即拋錯的 stub', () => {
    expect(() => (globalThis.fetch as unknown as (u: string) => unknown)('https://api.openai.com/v1/audio/speech')).toThrow(/不得連網/)
    expect(fetchCalls()).toEqual(['https://api.openai.com/v1/audio/speech'])
  })

  it('AC-003 /api/tts：五個引擎在測試模式都由 Mock 合成', async () => {
    signInAs(uniqueUser('tts'))
    for (const engine of ENGINES) {
      const res = await ttsPost(jsonRequest('/api/tts', { text: `這是 ${engine} 的測試句子。`, engine, voice: 'zh-TW' }))
      expect(res.status, engine).toBe(200)
      expect(res.headers.get('X-TTS-Engine')).toBe('mock')
      expect(res.headers.get('X-TTS-Mock')).toBe('true')
      expect(res.headers.get('Content-Type')).toBe('audio/wav')
      expect((await wavOf(res)).length).toBeGreaterThan(44)
    }
    expect(getMockProvider().calls).toHaveLength(ENGINES.length)
    expectNoPaidCalls()
  })

  it('AC-003 /api/tts：請求自帶 apiKey（BYOK）在測試模式也不會被用來呼叫引擎', async () => {
    signInAs(uniqueUser('byok'))
    const res = await ttsPost(
      jsonRequest('/api/tts', { text: '自帶金鑰的請求。', engine: 'elevenlabs', apiKey: 'byok-placeholder-not-real', format: 'wav' }),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('X-TTS-Mock')).toBe('true')
    expectNoPaidCalls()
  })

  it('AC-003 /api/tts：不需要任何引擎金鑰（demo mode、無金鑰）', async () => {
    for (const name of ['OPENAI_API_KEY', 'ELEVENLABS_API_KEY', 'KOKORO_API_KEY', 'AZURE_SPEECH_KEY', 'GOOGLE_TTS_API_KEY']) delete env[name]
    unconfigureClerk()
    const res = await ttsPost(jsonRequest('/api/tts', { text: '沒有金鑰也能在測試模式合成。', engine: 'azure' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('X-TTS-Mock')).toBe('true')
    expectNoPaidCalls()
  })

  it('AC-003 /api/tts：超過 5,000 字時分段，每段只送 Mock 一次，合併為單一 WAV', async () => {
    signInAs(uniqueUser('long'))
    const paragraph = '這是一段自編的長文字，用來測試分段合成。'
    const text = Array.from({ length: 400 }, () => paragraph).join('\n')
    expect(text.length).toBeGreaterThan(5000)

    const res = await ttsPost(jsonRequest('/api/tts', { text, engine: 'openai' }))
    expect(res.status).toBe(200)
    const totalChunks = Number(res.headers.get('X-TTS-Total-Chunks'))
    expect(res.headers.get('X-TTS-Chunked')).toBe('true')
    expect(totalChunks).toBeGreaterThan(1)

    const calls = getMockProvider().calls
    expect(calls).toHaveLength(totalChunks)
    // 片段依序串起來恰好等於原文：沒有遺漏，也沒有任何片段被重複合成
    expect(calls.map((c) => c.text).join('\n')).toBe(text)
    for (const c of calls) expect(c.text.length).toBeLessThanOrEqual(5000)

    await wavOf(res)
    expectNoPaidCalls()
  })

  it('AC-003 /api/batch：測試模式由 Mock 合成，回傳 WAV data URL', async () => {
    signInAs(uniqueUser('batch'))
    const res = await batchPost(
      jsonRequest('/api/batch', {
        tasks: [
          { id: 'a', text: '第一個批次任務。', engine: 'openai', voice: 'zh-TW' },
          { id: 'b', text: '第二個批次任務。', voice: 'zh-TW-male', format: 'wav' },
          { id: 'c', text: '', voice: 'zh-TW' },
        ],
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.mock).toBe(true)
    expect(body.processed).toBe(2)
    expect(body.failed).toBe(1)
    for (const r of body.results.slice(0, 2)) {
      expect(r.success).toBe(true)
      expect(r.audioUrl.startsWith('data:audio/wav;base64,')).toBe(true)
    }
    expect(getMockProvider().calls.map((c) => c.text)).toEqual(['第一個批次任務。', '第二個批次任務。'])
    expectNoPaidCalls()
  })

  it('AC-003 /api/preview：測試模式由 Mock 合成，不呼叫 OpenAI', async () => {
    const voice = VOICES[0]
    const res = await previewPost(jsonRequest('/api/preview', { voiceId: voice.id, apiKey: 'byok-placeholder-not-real' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('audio/wav')
    await wavOf(res)
    expect(getMockProvider().calls).toHaveLength(1)

    // 第二次命中快取，不再合成
    const again = await previewPost(jsonRequest('/api/preview', { voiceId: voice.id }))
    expect(again.status).toBe(200)
    expect(getMockProvider().calls).toHaveLength(1)
    expectNoPaidCalls()
  })

  it('AC-003 TTS_PROVIDER=mock 單獨也能啟用測試模式（NODE_ENV=production）', async () => {
    signInAs(uniqueUser('prod-mock'))
    env.NODE_ENV = 'production'
    env.TTS_PROVIDER = 'mock'
    const res = await ttsPost(jsonRequest('/api/tts', { text: '正式環境變數下的測試模式。', engine: 'google' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('X-TTS-Mock')).toBe('true')
    expectNoPaidCalls()
  })

  it('AC-003 非測試模式且沒有金鑰時回 400 NO_API_KEY（不會悄悄改用 Mock）', async () => {
    for (const name of ['OPENAI_API_KEY', 'ELEVENLABS_API_KEY', 'KOKORO_API_KEY', 'AZURE_SPEECH_KEY', 'GOOGLE_TTS_API_KEY']) delete env[name]
    signInAs(uniqueUser('nokey'))
    env.NODE_ENV = 'development'
    delete env.TTS_PROVIDER
    const res = await ttsPost(jsonRequest('/api/tts', { text: '沒有金鑰。', engine: 'openai' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('NO_API_KEY')
    expect(getMockProvider().calls).toHaveLength(0)
    expectNoPaidCalls()
  })
})
