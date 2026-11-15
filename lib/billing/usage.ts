/**
 * 每月字數用量與額度（GOAL AC-005）。
 *
 * 流程：reserve（先佔用額度）→ 合成 → 成功 commit／失敗 refund。
 * - 先佔用再合成：同一使用者並行請求不會一起超過額度。
 * - 合成失敗時 refund，失敗的合成不計字數。
 * - 計費月份以 UTC 的 YYYY-MM 為界（與 lib/jobs.ts 既有的月份鍵一致；時區【待 Sean 定案】）。
 *
 * 儲存：`usage:{userId}:chars:{YYYY-MM}`（Vercel KV；未設定時為記憶體後備，重啟即遺失）。
 */

import { getStore } from '@/lib/kv-store'
import type { PlanDefinition } from '@/lib/billing/plans'

const USAGE_TTL_SEC = 400 * 86400

export function monthKey(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

/** 下一個計費月份的起點（UTC）。 */
export function nextResetAt(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
}

function usageKey(userId: string, period: string): string {
  return `usage:${userId}:chars:${period}`
}

function engineUsageKey(userId: string, period: string, engine: string): string {
  return `usage:${userId}:chars:${period}:engine:${engine}`
}

export interface QuotaStatus {
  plan: string
  period: string
  used: number
  /** null＝不限。 */
  limit: number | null
  /** null＝不限。 */
  remaining: number | null
  resetsAt: string
}

export async function getMonthlyUsage(userId: string, now: Date = new Date()): Promise<number> {
  const value = await getStore().get<number>(usageKey(userId, monthKey(now)))
  return Math.max(0, Number(value ?? 0))
}

export async function getEngineUsage(userId: string, engine: string, now: Date = new Date()): Promise<number> {
  const value = await getStore().get<number>(engineUsageKey(userId, monthKey(now), engine))
  return Math.max(0, Number(value ?? 0))
}

export async function getQuotaStatus(userId: string, plan: PlanDefinition, now: Date = new Date()): Promise<QuotaStatus> {
  const used = await getMonthlyUsage(userId, now)
  const limit = plan.monthlyCharLimit
  return {
    plan: plan.id,
    period: monthKey(now),
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    resetsAt: nextResetAt(now),
  }
}

export interface Reservation {
  userId: string
  period: string
  chars: number
  settled: boolean
}

export type ReserveResult =
  | { ok: true; reservation: Reservation; status: QuotaStatus }
  | { ok: false; status: QuotaStatus; requested: number }

/**
 * 佔用額度。`used + chars <= limit` 才成功（剛好用完允許；多 1 字即拒絕）。
 */
export async function reserveChars(
  userId: string,
  plan: PlanDefinition,
  chars: number,
  now: Date = new Date(),
): Promise<ReserveResult> {
  const period = monthKey(now)
  const key = usageKey(userId, period)
  const store = getStore()
  const limit = plan.monthlyCharLimit
  const amount = Math.max(0, Math.floor(chars))

  const next = await store.incrby(key, amount, { ex: USAGE_TTL_SEC })
  if (limit !== null && next > limit) {
    await store.incrby(key, -amount)
    const used = next - amount
    return {
      ok: false,
      requested: amount,
      status: { plan: plan.id, period, used, limit, remaining: Math.max(0, limit - used), resetsAt: nextResetAt(now) },
    }
  }
  return {
    ok: true,
    reservation: { userId, period, chars: amount, settled: false },
    status: {
      plan: plan.id,
      period,
      used: next,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - next),
      resetsAt: nextResetAt(now),
    },
  }
}

/** 合成成功：確認扣量，並記錄各引擎字數供對帳。 */
export async function commitChars(reservation: Reservation, engine: string): Promise<void> {
  if (reservation.settled) return
  reservation.settled = true
  if (reservation.chars > 0) {
    await getStore().incrby(engineUsageKey(reservation.userId, reservation.period, engine), reservation.chars, {
      ex: USAGE_TTL_SEC,
    })
  }
}

/** 合成失敗：退回佔用的額度（可只退一部分）。 */
export async function refundChars(reservation: Reservation, chars: number = reservation.chars): Promise<void> {
  if (reservation.settled) return
  const amount = Math.min(Math.max(0, Math.floor(chars)), reservation.chars)
  if (amount > 0) {
    await getStore().incrby(usageKey(reservation.userId, reservation.period), -amount)
  }
  reservation.chars -= amount
  if (reservation.chars === 0) reservation.settled = true
}

/** 超額時的 HTTP 402 回應內容。 */
export function quotaExceededBody(status: QuotaStatus, requested: number) {
  return {
    error: '本月字數額度不足，請升級方案或等待下個計費月份。',
    code: 'CHAR_QUOTA_EXCEEDED',
    plan: status.plan,
    period: status.period,
    used: status.used,
    limit: status.limit,
    remaining: status.remaining,
    requested,
    resetsAt: status.resetsAt,
  }
}
