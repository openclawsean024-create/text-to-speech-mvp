/**
 * User subscription store — NewebPay webhook target
 *
 * Stores per-user tier + expiry in Vercel KV.
 */

const KEY_PREFIX = 'subscription:'

// In-memory fallback
const inMemorySubs = new Map<string, any>()

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

function key(userId: string) {
  return `${KEY_PREFIX}${userId}`
}

export interface Subscription {
  userId: string
  tier: 'free' | 'personal' | 'creator' | 'business' | 'custom'
  startedAt: number
  expiresAt: number
  autoRenew: boolean
  paymentMethod: string
  lastOrderNo: string
  totalPaid: number
  status: 'active' | 'expired' | 'cancelled'
}

/**
 * Store/upgrade subscription for a user.
 * Pass tier='free' to downgrade (after subscription expires).
 */
export async function storeUserSubscription(
  userId: string,
  tier: Subscription['tier'],
  meta: Partial<Pick<Subscription, 'paymentMethod' | 'lastOrderNo' | 'totalPaid' | 'autoRenew'>> = {},
): Promise<Subscription> {
  const now = Date.now()
  const expiresAt = tier === 'free' || tier === 'custom'
    ? Number.MAX_SAFE_INTEGER
    : now + 30 * 86400 * 1000  // 30 days from now

  const sub: Subscription = {
    userId,
    tier,
    startedAt: now,
    expiresAt,
    autoRenew: meta.autoRenew ?? false,
    paymentMethod: meta.paymentMethod || 'unknown',
    lastOrderNo: meta.lastOrderNo || '',
    totalPaid: meta.totalPaid || 0,
    status: 'active',
  }

  const client = getKV()
  if (client) {
    await client.set(key(userId), JSON.stringify(sub), { ex: 30 * 86400 + 86400 })
  } else {
    inMemorySubs.set(userId, sub)
  }
  return sub
}

export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const client = getKV()
  if (client) {
    const v = await client.get(key(userId))
    if (!v) return null
    const sub = JSON.parse(String(v))
    if (sub.expiresAt < Date.now() && sub.tier !== 'free' && sub.tier !== 'custom') {
      sub.status = 'expired'
      // Auto-downgrade to free
      await storeUserSubscription(userId, 'free', { paymentMethod: 'auto-downgrade' })
      return { ...sub, tier: 'free', expiresAt: Number.MAX_SAFE_INTEGER, status: 'expired' }
    }
    return sub
  }
  const sub = inMemorySubs.get(userId)
  if (!sub) return null
  if (sub.expiresAt < Date.now() && sub.tier !== 'free' && sub.tier !== 'custom') {
    return { ...sub, status: 'expired' }
  }
  return sub
}

export async function cancelUserSubscription(userId: string): Promise<boolean> {
  const existing = await getUserSubscription(userId)
  if (!existing) return false
  existing.status = 'cancelled'
  const client = getKV()
  if (client) {
    await client.set(key(userId), JSON.stringify(existing), { ex: 86400 })
  } else {
    inMemorySubs.set(userId, existing)
  }
  return true
}

/**
 * Convenience: get effective tier for rate-limit / glossary lookup.
 * Auto-downgrades expired paid tiers to 'free'.
 */
export async function getEffectiveTier(userId: string): Promise<Subscription['tier']> {
  const sub = await getUserSubscription(userId)
  if (!sub) return 'free'
  if (sub.status !== 'active') return 'free'
  return sub.tier
}
