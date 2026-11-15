/**
 * 繁中發音校正詞庫（FR-011；GOAL AC-006）。
 *
 * - 系統預設詞條（lib/lexicon/system-lexicon.json）＋使用者自訂詞條。
 * - 合成前以「最長匹配、由左至右、不重疊」套用於所有引擎（含 Mock）。
 * - 使用者詞條與系統詞條原詞相同時，使用者詞條優先。
 * - 計費字數一律以套用【前】的原文計算（lib/billing/char-count.ts）。
 *
 * ⚠️ 與 Whisper 逐字稿用的「個人詞彙表」（lib/glossary.ts、/api/glossary、KV `glossary:`）
 * 是完全不同的資料：本模組使用 KV 前綴 `lexicon:`，不讀也不寫詞彙表；詞彙表也不會影響 TTS。
 *
 * `pinyin`／`zhuyin` 為可選欄位，保存供 Azure SSML `<phoneme>` 使用（M2）；M1 所有引擎
 * 一律以 `replacement` 文字替換。
 */

import systemLexicon from './system-lexicon.json'
import { getStore } from '@/lib/kv-store'

export interface LexiconEntry {
  /** 原詞（要被校正的文字）。 */
  term: string
  /** 送進 TTS 的替代讀法文字。 */
  replacement: string
  /** 可選：漢語拼音（數字聲調），供 Azure SSML 使用。 */
  pinyin?: string
  /** 可選：注音符號，供 Azure SSML 使用。 */
  zhuyin?: string
}

export interface ResolvedEntry extends LexiconEntry {
  source: 'system' | 'user'
}

export const LEXICON_KEY_PREFIX = 'lexicon:'
export const MAX_TERM_LENGTH = 50
export const MAX_REPLACEMENT_LENGTH = 100
const LEXICON_TTL_SEC = 365 * 86400

const lexiconKey = (userId: string) => `${LEXICON_KEY_PREFIX}${userId}`

export class LexiconValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LexiconValidationError'
  }
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.normalize('NFC').trim() : ''
}

/** 驗證並正規化一筆詞條；無效時拋出 LexiconValidationError。 */
export function normalizeEntry(raw: unknown): LexiconEntry {
  const r = (raw ?? {}) as Record<string, unknown>
  const term = clean(r.term)
  const replacement = clean(r.replacement)
  if (!term) throw new LexiconValidationError('term（原詞）為必填')
  if (!replacement) throw new LexiconValidationError(`「${term}」缺少 replacement（替代讀法）`)
  if (term.length > MAX_TERM_LENGTH) throw new LexiconValidationError(`原詞最多 ${MAX_TERM_LENGTH} 字`)
  if (replacement.length > MAX_REPLACEMENT_LENGTH) throw new LexiconValidationError(`替代讀法最多 ${MAX_REPLACEMENT_LENGTH} 字`)
  if (/[<>&]/.test(term + replacement)) throw new LexiconValidationError('詞條不可包含 < > & 字元')
  const entry: LexiconEntry = { term, replacement }
  const pinyin = clean(r.pinyin)
  const zhuyin = clean(r.zhuyin)
  if (pinyin) {
    if (!/^[a-zA-ZüÜ:1-5 ]{1,200}$/.test(pinyin)) throw new LexiconValidationError(`「${term}」的拼音格式不正確（例：hang2 zhang3）`)
    entry.pinyin = pinyin
  }
  if (zhuyin) {
    if (!/^[ㄅ-ㄯㆠ-ㆿˊˇˋ˙ ]{1,200}$/.test(zhuyin)) throw new LexiconValidationError(`「${term}」的注音格式不正確`)
    entry.zhuyin = zhuyin
  }
  return entry
}

export function getSystemEntries(): LexiconEntry[] {
  return (systemLexicon.entries as unknown[]).map(normalizeEntry)
}

export async function getUserEntries(userId: string): Promise<LexiconEntry[]> {
  const stored = await getStore().get<LexiconEntry[]>(lexiconKey(userId))
  return Array.isArray(stored) ? stored : []
}

/**
 * 新增或更新使用者詞條（同原詞覆蓋）。超過方案上限時拋錯，不做部分寫入。
 */
export async function upsertUserEntries(userId: string, rawEntries: unknown[], limit: number): Promise<LexiconEntry[]> {
  const incoming = rawEntries.map(normalizeEntry)
  const map = new Map((await getUserEntries(userId)).map((e) => [e.term, e]))
  for (const entry of incoming) map.set(entry.term, entry)
  if (map.size > limit) {
    throw new LexiconValidationError(`自訂詞條上限為 ${limit} 條（目前方案）`)
  }
  const next = [...map.values()]
  await getStore().set(lexiconKey(userId), next, { ex: LEXICON_TTL_SEC })
  return next
}

export async function removeUserEntry(userId: string, term: string): Promise<boolean> {
  const target = clean(term)
  const current = await getUserEntries(userId)
  const next = current.filter((e) => e.term !== target)
  if (next.length === current.length) return false
  await getStore().set(lexiconKey(userId), next, { ex: LEXICON_TTL_SEC })
  return true
}

export async function clearUserEntries(userId: string): Promise<void> {
  await getStore().del(lexiconKey(userId))
}

/** 合併系統與使用者詞條：同原詞時使用者優先。 */
export function mergeEntries(system: LexiconEntry[], user: LexiconEntry[]): ResolvedEntry[] {
  const map = new Map<string, ResolvedEntry>()
  for (const e of system) map.set(e.term, { ...e, source: 'system' })
  for (const e of user) map.set(e.term, { ...e, source: 'user' })
  return [...map.values()]
}

export async function getEffectiveEntries(userId: string | null): Promise<ResolvedEntry[]> {
  return mergeEntries(getSystemEntries(), userId ? await getUserEntries(userId) : [])
}

export interface Replacement {
  index: number
  term: string
  replacement: string
}

/**
 * 以最長匹配、由左至右、不重疊的方式套用詞庫。
 * 替換後的文字不會再被掃描（避免連鎖替換）。
 */
export function applyLexicon(text: string, entries: LexiconEntry[]): { text: string; replacements: Replacement[] } {
  if (!text || entries.length === 0) return { text, replacements: [] }
  const byFirstChar = new Map<string, LexiconEntry[]>()
  for (const e of entries) {
    const list = byFirstChar.get(e.term[0]) ?? []
    list.push(e)
    byFirstChar.set(e.term[0], list)
  }
  for (const list of byFirstChar.values()) list.sort((a, b) => b.term.length - a.term.length)

  let out = ''
  const replacements: Replacement[] = []
  let i = 0
  while (i < text.length) {
    const candidates = byFirstChar.get(text[i])
    const hit = candidates?.find((e) => text.startsWith(e.term, i))
    if (hit) {
      out += hit.replacement
      replacements.push({ index: i, term: hit.term, replacement: hit.replacement })
      i += hit.term.length
    } else {
      out += text[i]
      i += 1
    }
  }
  return { text: out, replacements }
}

/** 取得某使用者的文字轉換函式（供合成路徑使用）。 */
export async function lexiconTransformer(userId: string | null): Promise<(text: string) => string> {
  const entries = await getEffectiveEntries(userId)
  return (text: string) => applyLexicon(text, entries).text
}
