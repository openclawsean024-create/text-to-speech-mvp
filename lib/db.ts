/**
 * Vercel KV helpers — gracefully degrades when KV is not configured
 *
 * In-memory fallback for local dev without Vercel KV:
 * - API keys stored in memory (lost on cold start)
 * - Usage counts stored in memory (lost on cold start)
 */

import { LIMITS } from '@/lib/rate-limits'

// ── In-memory fallback store ──────────────────────────────────────────────────
const inMemoryKeys = new Map<string, string>()
const inMemoryUsage = new Map<string, number>()

// ── Vercel KV (optional) ─────────────────────────────────────────────────────
let kv: { get: Function; set: Function; del: Function } | null = null

function getKV() {
  if (kv) return kv
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null
  try {
    // Dynamic import to avoid build errors when KV is not configured
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

// ── API Keys ─────────────────────────────────────────────────────────────────

export async function getUserApiKeys(userId: string) {
  const engines = ['openai', 'elevenlabs', 'kokoro']
  const client = getKV()
  const keys: Record<string, string | null> = {}
  for (const engine of engines) {
    const cacheKey = `user:${userId}:apikey:${engine}`
    if (client) {
      keys[engine] = (await client.get(cacheKey)) ?? null
    } else {
      keys[engine] = inMemoryKeys.get(cacheKey) ?? null
    }
  }
  return keys
}

export async function setUserApiKey(userId: string, engine: string, key: string) {
  const client = getKV()
  const cacheKey = `user:${userId}:apikey:${engine}`
  if (client) {
    await client.set(cacheKey, key)
  } else {
    inMemoryKeys.set(cacheKey, key)
  }
}

export async function deleteUserApiKey(userId: string, engine: string) {
  const client = getKV()
  const cacheKey = `user:${userId}:apikey:${engine}`
  if (client) {
    await client.del(cacheKey)
  } else {
    inMemoryKeys.delete(cacheKey)
  }
}

// ── Usage Tracking ─────────────────────────────────────────────────────────────

function todayKey(userId: string) {
  const today = new Date().toISOString().split('T')[0]
  return `user:${userId}:usage:${today}`
}

export async function getTodayUsage(userId: string): Promise<number> {
  const client = getKV()
  const key = todayKey(userId)
  if (client) {
    return (await client.get(key)) ?? 0
  }
  return inMemoryUsage.get(key) ?? 0
}

export async function incrementUsage(userId: string): Promise<number> {
  const client = getKV()
  const key = todayKey(userId)
  if (client) {
    const current = (await client.get(key)) ?? 0
    const next = current + 1
    await client.set(key, next, { ex: 7 * 86400 })
    return next
  }
  const current = inMemoryUsage.get(key) ?? 0
  const next = current + 1
  inMemoryUsage.set(key, next)
  return next
}

export async function getUsageHistory(userId: string, days = 14) {
  const history: { date: string; count: number }[] = []
  const today = new Date()
  for (let i = 0; i < days; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const key = `user:${userId}:usage:${dateStr}`
    const client = getKV()
    const count = client
      ? ((await client.get(key)) ?? 0)
      : (inMemoryUsage.get(key) ?? 0)
    history.push({ date: dateStr, count })
  }
  return history.reverse()
}

export async function getMonthlyTotal(userId: string): Promise<number> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const daysInMonth = new Date(year, month, 0).getDate()
  const client = getKV()
  let total = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const key = `user:${userId}:usage:${dateStr}`
    total += client
      ? ((await client.get(key)) ?? 0)
      : (inMemoryUsage.get(key) ?? 0)
  }
  return total
}

// ── Rate Limits ───────────────────────────────────────────────────────────────

export { LIMITS }

export async function checkRateLimit(userId: string, plan: string) {
  const limit = LIMITS[plan as keyof typeof LIMITS] ?? LIMITS.free
  const today = new Date().toISOString().split('T')[0]
  const key = `user:${userId}:usage:${today}`
  const client = getKV()
  const count = client
    ? ((await client.get(key)) ?? 0)
    : (inMemoryUsage.get(key) ?? 0)
  return {
    allowed: count < limit.requests,
    used: count,
    limit: limit.requests,
    remaining: Math.max(0, limit.requests - count),
    resetsAt: new Date(`${today}T23:59:59Z`).toISOString(),
  }
}
