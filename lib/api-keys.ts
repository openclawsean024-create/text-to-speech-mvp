/**
 * Tier-based API key management — F-104
 *
 * SHA-256 hashed API keys with tier + monthly limits + expiration.
 *
 * Tier 與 lib/billing 的方案 id 相同（free／personal／creator／business／custom）。
 * 價格不寫死在程式：顯示用價格取自方案設定（config/plans.json 或 BILLING_PLANS_JSON），
 * 尚未決定時顯示「待定」。以下 TTS／後製分鐘數為企業 API（/api/v1/process）既有的後製額度。
 */

import crypto from 'node:crypto'
import planConfig from '@/lib/billing/plan-config'

function tierPrice(tier: string): string {
  return planConfig.formatPlanPrice(planConfig.getPlanOrFree(tier))
}

const KEY_PREFIX = 'hms_'

// In-memory fallback
const inMemoryKeys = new Map<string, ApiKeyRecord>()
const inMemoryOwnerIndex = new Map<string, Set<string>>()

// Vercel KV (optional)
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

export type Tier = 'free' | 'personal' | 'creator' | 'business' | 'custom'

export interface TierConfig {
  monthlyTtsMin: number    // TTS minutes per month
  monthlyProdMin: number   // Post-production minutes per month
  monthlyApiCalls: number  // API calls per month
  rateLimitRps: number     // Requests per second
  description: string
  price: string
}

export const TIER_LIMITS: Record<Tier, TierConfig> = {
  free: {
    monthlyTtsMin: Number(process.env.TIER_FREE_TTS_MIN ?? 5),
    monthlyProdMin: Number(process.env.TIER_FREE_PROD_MIN ?? 30),
    monthlyApiCalls: 100,
    rateLimitRps: 1,
    description: '免費試用',
    get price() { return tierPrice('free') },
  },
  personal: {
    monthlyTtsMin: Number(process.env.TIER_PERSONAL_TTS_MIN ?? 30),
    monthlyProdMin: Number(process.env.TIER_PERSONAL_PROD_MIN ?? 60),
    monthlyApiCalls: 1000,
    rateLimitRps: 1,
    description: '個人版',
    get price() { return tierPrice('personal') },
  },
  creator: {
    monthlyTtsMin: Number(process.env.TIER_CREATOR_TTS_MIN ?? 180),
    monthlyProdMin: Number(process.env.TIER_CREATOR_PROD_MIN ?? 600),
    monthlyApiCalls: 5000,
    rateLimitRps: 1,
    description: '創作者版',
    get price() { return tierPrice('creator') },
  },
  business: {
    monthlyTtsMin: Number(process.env.TIER_BUSINESS_TTS_MIN ?? 3000),
    monthlyProdMin: Number(process.env.TIER_BUSINESS_PROD_MIN ?? 12000),
    monthlyApiCalls: 100000,
    rateLimitRps: 1,
    description: '企業 API',
    get price() { return tierPrice('business') },
  },
  custom: {
    monthlyTtsMin: 999999,
    monthlyProdMin: 999999,
    monthlyApiCalls: 999999,
    rateLimitRps: 5,
    description: '客製方案',
    get price() { return tierPrice('custom') },
  },
}

export interface ApiKeyRecord {
  id: string
  ownerId: string
  tier: Tier
  hashedKey: string
  prefix: string         // First 12 chars of plaintext key for display (hms_xxxxxxxx)
  monthlyLimitSec: number
  expiresAt: number
  createdAt: number
  revokedAt: number | null
}

function hashKey(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex')
}

function makePlainKey(): string {
  // hms_<32 chars base64url> = ~43 chars total
  return `${KEY_PREFIX}${crypto.randomBytes(24).toString('base64url')}`
}

export async function createApiKey(ownerId: string, tier: Tier = 'free', expiresInDays = 365): Promise<{ record: ApiKeyRecord; plaintext: string }> {
  const plain = makePlainKey()
  const id = crypto.randomUUID()
  const tierCfg = TIER_LIMITS[tier] || TIER_LIMITS.free
  const record: ApiKeyRecord = {
    id,
    ownerId,
    tier,
    hashedKey: hashKey(plain),
    prefix: plain.slice(0, 12) + '...',
    monthlyLimitSec: tierCfg.monthlyProdMin * 60,
    expiresAt: Date.now() + expiresInDays * 86400 * 1000,
    createdAt: Date.now(),
    revokedAt: null,
  }

  const client = getKV()
  if (client) {
    await client.set(`apikey:${record.hashedKey}`, JSON.stringify(record), { ex: expiresInDays * 86400 })
    const idx = (await client.get(`owner-keys:${ownerId}`)) || []
    idx.unshift(id)
    await client.set(`owner-keys:${ownerId}`, idx.slice(0, 50), { ex: 365 * 86400 })
    await client.set(`apikey-id:${id}`, record.hashedKey, { ex: expiresInDays * 86400 })
  } else {
    inMemoryKeys.set(record.hashedKey, record)
    const idx = inMemoryOwnerIndex.get(ownerId) || new Set()
    idx.add(id)
    inMemoryOwnerIndex.set(ownerId, idx)
  }

  return { record, plaintext: plain }
}

/**
 * Look up an API key by its plaintext value.
 * Returns null if not found / revoked / expired.
 */
export async function findApiKey(plain: string): Promise<ApiKeyRecord | null> {
  if (!plain || !plain.startsWith(KEY_PREFIX)) return null
  const hashed = hashKey(plain)
  const client = getKV()
  let record: ApiKeyRecord | null = null
  if (client) {
    const v = await client.get(`apikey:${hashed}`)
    record = v ? JSON.parse(String(v)) : null
  } else {
    record = inMemoryKeys.get(hashed) || null
  }
  if (!record) return null
  if (record.revokedAt) return null
  if (record.expiresAt < Date.now()) return null
  return record
}

export async function revokeApiKey(id: string, ownerId: string): Promise<boolean> {
  const client = getKV()
  if (client) {
    const hashedKey = await client.get(`apikey-id:${id}`)
    if (!hashedKey) return false
    const v = await client.get(`apikey:${hashedKey}`)
    if (!v) return false
    const record: ApiKeyRecord = JSON.parse(String(v))
    if (record.ownerId !== ownerId) return false
    record.revokedAt = Date.now()
    await client.set(`apikey:${hashedKey}`, JSON.stringify(record), { ex: 7 * 86400 })
    return true
  }
  for (const rec of inMemoryKeys.values()) {
    if (rec.id === id && rec.ownerId === ownerId) {
      rec.revokedAt = Date.now()
      return true
    }
  }
  return false
}

export async function listApiKeys(ownerId: string): Promise<ApiKeyRecord[]> {
  const client = getKV()
  if (client) {
    const ids = (await client.get(`owner-keys:${ownerId}`)) || []
    const records: ApiKeyRecord[] = []
    for (const id of ids) {
      const hashedKey = await client.get(`apikey-id:${id}`)
      if (!hashedKey) continue
      const v = await client.get(`apikey:${hashedKey}`)
      if (v) records.push(JSON.parse(String(v)))
    }
    return records
  }
  const idx = inMemoryOwnerIndex.get(ownerId)
  if (!idx) return []
  const records: ApiKeyRecord[] = []
  for (const id of idx) {
    for (const rec of inMemoryKeys.values()) {
      if (rec.id === id) {
        records.push(rec)
        break
      }
    }
  }
  return records
}

/**
 * Per-key rate limit (1 req/sec default).
 * Uses KV with a short TTL window.
 */
export async function checkApiRateLimit(hashedKey: string, rps = 1): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const client = getKV()
  const windowKey = `ratelimit:${hashedKey}:${Math.floor(Date.now() / 1000)}`
  if (client) {
    const cur = Number(((await client.get(windowKey)) ?? 0))
    if (cur >= rps) {
      return { allowed: false, retryAfterSec: 1 }
    }
    await client.set(windowKey, cur + 1, { ex: 2 })
    return { allowed: true, retryAfterSec: 0 }
  }
  // In-memory fallback — no rate limit enforcement (single-process dev only)
  return { allowed: true, retryAfterSec: 0 }
}

/**
 * Extract bearer token from Authorization header.
 */
export function extractBearer(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null
  const match = /^Bearer\s+(\S+)$/.exec(authHeader.trim())
  return match ? match[1] : null
}
