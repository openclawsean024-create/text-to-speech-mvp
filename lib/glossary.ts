/**
 * Personal glossary — F-007
 *
 * Per-user vocabulary list (max 50 words for personal / 500 for creator/business).
 * Used to bias Whisper prompt + improve chapter naming + glossary term highlighting.
 */

// In-memory fallback
const inMemoryGlossaries = new Map<string, GlossaryRecord>()

// Vercel KV
let kv: { get: Function; set: Function; del: Function } | null = null
function getKV() {
  if (kv) return kv
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null
  try {
    const { createClient } = require('@vercel/kv')
    kv = createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    })
    return kv
  } catch {
    return null
  }
}

export interface GlossaryRecord {
  userId: string
  words: string[]
  updatedAt: number
  limit: number
}

function key(userId: string) {
  return `glossary:${userId}`
}

export function getTierLimit(tier: string = 'free'): number {
  switch (tier) {
    case 'business':
    case 'custom':
      return 500
    case 'creator':
      return 200
    case 'personal':
      return 50
    default:
      return 20
  }
}

export async function getGlossary(userId: string, tier: string = 'free'): Promise<GlossaryRecord> {
  const client = getKV()
  const limit = getTierLimit(tier)
  if (client) {
    const v = await client.get(key(userId))
    if (v) {
      const data = JSON.parse(String(v))
      return { ...data, limit }
    }
    return { userId, words: [], updatedAt: Date.now(), limit }
  }
  const local = inMemoryGlossaries.get(userId)
  if (local) return { ...local, limit }
  return { userId, words: [], updatedAt: Date.now(), limit }
}

export async function setGlossary(userId: string, words: string[], tier: string = 'free'): Promise<GlossaryRecord> {
  const limit = getTierLimit(tier)
  // Sanitize — trim, dedupe, filter non-string, enforce limit
  const cleaned = [...new Set(
    (words || [])
      .map((w) => String(w || '').trim())
      .filter((w) => w.length > 0 && w.length <= 50),
  )].slice(0, limit)

  const record: GlossaryRecord = {
    userId,
    words: cleaned,
    updatedAt: Date.now(),
    limit,
  }

  const client = getKV()
  if (client) {
    await client.set(key(userId), JSON.stringify(record), { ex: 365 * 86400 })
  } else {
    inMemoryGlossaries.set(userId, record)
  }
  return record
}

export async function addGlossaryWords(userId: string, additions: string[], tier: string = 'free'): Promise<GlossaryRecord> {
  const current = await getGlossary(userId, tier)
  const merged = [...current.words, ...(additions || [])]
  return setGlossary(userId, merged, tier)
}

export async function removeGlossaryWord(userId: string, word: string, tier: string = 'free'): Promise<GlossaryRecord> {
  const current = await getGlossary(userId, tier)
  const filtered = current.words.filter((w) => w !== word)
  return setGlossary(userId, filtered, tier)
}

export async function clearGlossary(userId: string, tier: string = 'free'): Promise<GlossaryRecord> {
  return setGlossary(userId, [], tier)
}

/**
 * Format glossary words for Whisper prompt injection.
 * Whisper prompt has 224 token limit; trim accordingly.
 */
export function toWhisperPrompt(glossary: GlossaryRecord, basePrompt: string = '以下是繁體中文的 podcast 內容。請保留原始繁體用字。'): string {
  if (!glossary || !glossary.words || glossary.words.length === 0) return basePrompt
  const terms = glossary.words.slice(0, 30).join('、') // First 30 to fit
  return `${basePrompt}\n專有名詞：${terms}。`
}
