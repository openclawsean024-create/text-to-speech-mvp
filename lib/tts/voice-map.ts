/**
 * 前端聲音代碼 → 各引擎 voice id。原本在 /api/tts 與 /api/batch 各有一份，移到這裡共用。
 */
import type { EngineName } from './provider'

export const VOICE_MAP: Record<string, Record<EngineName, string>> = {
  'zh-CN':      { openai: 'alloy',   elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'zh-CN-female', azure: 'zh-CN-XiaoxiaoNeural',  google: 'cmn-CN-Wavenet-A' },
  'zh-TW':      { openai: 'onyx',    elevenlabs: 'AZnzlk1XvdvUeBnXmlZG', kokoro: 'zh-CN-male',   azure: 'zh-TW-HsiaoChenNeural', google: 'cmn-TW-Wavenet-A' },
  'en-US':      { openai: 'alloy',   elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'en-US-female', azure: 'en-US-JennyNeural',     google: 'en-US-Wavenet-F' },
  'ja-JP':      { openai: 'nova',    elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'ja-JP-female', azure: 'ja-JP-NanamiNeural',    google: 'ja-JP-Wavenet-A' },
  'ko-KR':      { openai: 'fable',   elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'ko-KR-female', azure: 'ko-KR-SunHiNeural',     google: 'ko-KR-Wavenet-A' },
  'en-US-male': { openai: 'onyx',    elevenlabs: 'AZnzlk1XvdvUeBnXmlZG', kokoro: 'en-US-male',   azure: 'en-US-GuyNeural',       google: 'en-US-Wavenet-D' },
  'zh-TW-male': { openai: 'onyx',    elevenlabs: 'AZnzlk1XvdvUeBnXmlZG', kokoro: 'zh-CN-male',   azure: 'zh-TW-YunJheNeural',    google: 'cmn-TW-Wavenet-C' },
  'zh-TW-soft': { openai: 'shimmer', elevenlabs: '21m00Tcm4TlvDq8ikWAM', kokoro: 'zh-CN-female', azure: 'zh-TW-HsiaoChenNeural', google: 'cmn-TW-Wavenet-A' },
}

/** 找不到對應時回傳 undefined（呼叫端原樣使用傳入的 voice id）。 */
export function resolveEngineVoice(engine: EngineName, voiceId?: string): string | undefined {
  if (!voiceId) return undefined
  return VOICE_MAP[voiceId]?.[engine]
}
