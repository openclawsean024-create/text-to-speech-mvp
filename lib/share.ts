/**
 * 分享連結（GOAL AC-007）：只分享「設定」，絕不把使用者輸入的原文放進 URL。
 *
 * URL 會進入瀏覽器歷史、伺服器存取紀錄與第三方 Referer，原文可能含個資或未公開內容。
 * 允許的參數為白名單：shared、engine、voice、speed。
 */

export interface ShareSettings {
  engine: string
  voice: string
  speed: number
}

const ALLOWED_ENGINES = ['openai', 'elevenlabs', 'kokoro', 'azure', 'google']
const SAFE_TOKEN = /^[A-Za-z0-9_.-]{1,64}$/

export function buildShareUrl(origin: string, settings: ShareSettings): string {
  const params = new URLSearchParams()
  params.set('shared', '1')
  if (ALLOWED_ENGINES.includes(settings.engine)) params.set('engine', settings.engine)
  if (SAFE_TOKEN.test(settings.voice)) params.set('voice', settings.voice)
  const speed = Number(settings.speed)
  if (Number.isFinite(speed) && speed >= 0.25 && speed <= 4) params.set('speed', String(speed))
  return `${origin.replace(/\/+$/, '')}/?${params.toString()}`
}

/** 解析分享連結；不是分享連結時回傳 null。未知或不合法的參數（含舊版的 text）一律忽略。 */
export function parseSharedSettings(search: string): Partial<ShareSettings> | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  if (params.get('shared') !== '1') return null
  const out: Partial<ShareSettings> = {}
  const engine = params.get('engine')
  if (engine && ALLOWED_ENGINES.includes(engine)) out.engine = engine
  const voice = params.get('voice')
  if (voice && SAFE_TOKEN.test(voice)) out.voice = voice
  const speed = Number(params.get('speed'))
  if (params.has('speed') && Number.isFinite(speed) && speed >= 0.25 && speed <= 4) out.speed = speed
  return out
}

/** 是否帶有不該出現在 URL 的內容參數（舊版分享連結的 text）。 */
export function hasLegacyContentParam(search: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  return params.has('text')
}
