/**
 * 合成入口：所有伺服器端合成路徑（/api/tts、/api/batch、/api/preview、有聲書流程）都經過這裡。
 *
 * - 測試模式（`TTS_PROVIDER=mock` 或 `NODE_ENV=test`）：Orchestrator 只包含 MockTtsProvider，
 *   不建立任何付費引擎 provider，因此不可能對外呼叫（GOAL AC-003）。
 * - 正式模式：主要 provider 為請求指定的引擎；設定 `TTS_FALLBACK_ORDER`（逗號分隔的引擎名）
 *   時，依序以「伺服器環境變數有金鑰」的其他引擎作為降級備援。未設定＝不跨引擎降級。
 *   BYOK（請求自帶金鑰）不降級，避免改用伺服器金鑰替使用者付費。
 *   正式模式【不會】降級到 Mock——不能把測試音訊當成正式產出交給使用者。
 * - 引擎金鑰只從環境變數（或請求自帶的 BYOK）取得，不寫入程式或設定檔。
 */

import { encodeWavMonoPcm16 } from '@/lib/audiobook/audio'
import { chunkText, CHUNK_SIZE } from './chunk'
import { mergeMp3Chunks, mp3ToWav } from './ffmpeg'
import { isMockTtsMode } from './mode'
import {
  EngineTtsProvider,
  MockTtsProvider,
  PCM_CONTENT_TYPE,
  TtsOrchestrator,
  type AudioSegment,
  type EngineName,
  type EngineSynthesizeFn,
  type TtsProvider,
} from './provider'
import { resolveEngineVoice } from './voice-map'

export const SUPPORTED_ENGINES: EngineName[] = ['openai', 'elevenlabs', 'kokoro', 'azure', 'google']

export function isSupportedEngine(engine: string): engine is EngineName {
  return (SUPPORTED_ENGINES as string[]).includes(engine)
}

/** 引擎金鑰一律來自環境變數。 */
export function getEngineEnvConfig(engine: string): { key: string | null; region?: string | null } {
  switch (engine) {
    case 'openai':
      return { key: process.env.OPENAI_API_KEY ?? null }
    case 'elevenlabs':
      return { key: process.env.ELEVENLABS_API_KEY ?? null }
    case 'kokoro':
      return { key: process.env.KOKORO_API_KEY ?? process.env.INFERENCE_SH_API_KEY ?? null }
    case 'azure':
      return {
        key: process.env.AZURE_SPEECH_KEY ?? process.env.AZURE_API_KEY ?? null,
        region: process.env.AZURE_SPEECH_REGION ?? null,
      }
    case 'google':
      return { key: process.env.GOOGLE_TTS_API_KEY ?? process.env.GOOGLE_API_KEY ?? null }
    default:
      return { key: null }
  }
}

/** 伺服器路徑的 Mock：每個片段最多 10 秒 PCM（約 320KB），避免長文字耗盡記憶體。 */
export const SERVER_MOCK_MAX_SEGMENT_MS = 10_000
const mockProvider = new MockTtsProvider({ maxDurationMs: SERVER_MOCK_MAX_SEGMENT_MS })

/** 測試模式共用的 Mock provider（測試可檢查 `.calls`）。 */
export function getMockProvider(): MockTtsProvider {
  return mockProvider
}

/** `TTS_FALLBACK_ORDER` 解析後的引擎清單（忽略未知名稱與重複）。 */
export function parseFallbackOrder(raw: string | undefined = process.env.TTS_FALLBACK_ORDER): EngineName[] {
  const out: EngineName[] = []
  for (const part of (raw || '').split(',')) {
    const name = part.trim().toLowerCase()
    if (isSupportedEngine(name) && !out.includes(name)) out.push(name)
  }
  return out
}

export interface OrchestratorRequest {
  engine: EngineName
  /** BYOK：請求自帶的金鑰（只用於主要引擎）。 */
  apiKey?: string | null
  region?: string | null
  /** 測試用：注入假的引擎函式。 */
  synthesizeFn?: EngineSynthesizeFn
}

export function buildProviders(req: OrchestratorRequest): TtsProvider[] {
  if (isMockTtsMode()) return [mockProvider]

  const env = getEngineEnvConfig(req.engine)
  const byok = Boolean(req.apiKey && req.apiKey.trim())
  const providers: TtsProvider[] = [
    new EngineTtsProvider({
      engine: req.engine,
      apiKey: byok ? req.apiKey!.trim() : env.key,
      region: req.region ?? env.region,
      resolveVoice: resolveEngineVoice,
      synthesizeFn: req.synthesizeFn,
    }),
  ]
  if (!byok) {
    for (const engine of parseFallbackOrder()) {
      if (engine === req.engine) continue
      const cfg = getEngineEnvConfig(engine)
      if (!cfg.key) continue
      providers.push(
        new EngineTtsProvider({
          engine,
          apiKey: cfg.key,
          region: cfg.region,
          resolveVoice: resolveEngineVoice,
          synthesizeFn: req.synthesizeFn,
        }),
      )
    }
  }
  return providers
}

export function buildOrchestrator(req: OrchestratorRequest): TtsOrchestrator {
  return new TtsOrchestrator(buildProviders(req))
}

/** 是否至少有一個可用的 provider（測試模式恆為 true）。 */
export async function hasUsableProvider(req: OrchestratorRequest): Promise<boolean> {
  for (const provider of buildProviders(req)) {
    if (await provider.isHealthy()) return true
  }
  return false
}

export interface SpeechRequest extends OrchestratorRequest {
  text: string
  /** 前端聲音代碼或引擎 voice id。 */
  voice?: string
  speed?: number
  emotion?: string
  style?: string
}

/** 合成單一片段（不分段）。同一段文字只會送出一次。 */
export async function synthesizeSpeech(req: SpeechRequest, orchestrator = buildOrchestrator(req)): Promise<AudioSegment> {
  return orchestrator.synthesize({
    voice: { id: req.voice || 'default' },
    text: req.text,
    speed: req.speed,
    emotion: req.emotion,
    style: req.style,
  })
}

export interface LongTextResult {
  audio: Buffer
  contentType: string
  /** 實際使用的 provider（測試模式為 mock）。 */
  provider: string
  isChunked: boolean
  totalChunks: number
  mock: boolean
  format: 'mp3' | 'wav'
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

/**
 * 長文字合成：超過 5,000 字時分段，每段只合成一次，再合併。
 * - PCM（Mock）：直接串接後包成 WAV，不需 ffmpeg；無論請求格式為何都回傳 WAV。
 * - 編碼音訊（正式引擎的 MP3）：多段以 ffmpeg 合併；請求 WAV 時再轉檔。
 */
export async function synthesizeLongText(req: SpeechRequest & { format?: 'mp3' | 'wav' }): Promise<LongTextResult> {
  const text = req.text.trim()
  const chunks = text.length <= CHUNK_SIZE ? [text] : chunkText(text, CHUNK_SIZE)
  const orchestrator = buildOrchestrator(req)

  const segments: AudioSegment[] = []
  for (const chunk of chunks) {
    segments.push(await synthesizeSpeech({ ...req, text: chunk }, orchestrator))
  }

  const provider = segments[0].provider
  const base = { provider, isChunked: chunks.length > 1, totalChunks: chunks.length }

  if (segments.every((s) => s.contentType === PCM_CONTENT_TYPE)) {
    const wav = encodeWavMonoPcm16(concat(segments.map((s) => s.bytes)), segments[0].sampleRateHz)
    return { ...base, audio: Buffer.from(wav), contentType: 'audio/wav', mock: provider === 'mock', format: 'wav' }
  }

  let audio = segments.length === 1 ? Buffer.from(segments[0].bytes) : mergeMp3Chunks(segments.map((s) => s.bytes))
  let contentType = segments.length === 1 ? segments[0].contentType : 'audio/mpeg'
  let format: 'mp3' | 'wav' = 'mp3'
  if (req.format === 'wav') {
    audio = mp3ToWav(audio)
    contentType = 'audio/wav'
    format = 'wav'
  }
  return { ...base, audio, contentType, mock: false, format }
}
