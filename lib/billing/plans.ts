/**
 * 方案（plan／tier）— 一律由伺服器端決定（GOAL AC-008）。
 *
 * 用戶端傳入的 `plan`、`tier` 參數不會被採信；所有額度判斷都經過 `resolveServerPlan()`，
 * 依訂閱紀錄（`lib/subscriptions.ts`，只由 NewebPay 通知寫入）決定。
 */

import planConfig from './plan-config'
import { getEffectiveTier } from '@/lib/subscriptions'
import type { Identity } from '@/lib/identity'

export interface PlanPrice {
  amount: number
  currency: string
}

export interface PlanDefinition {
  id: string
  name: string
  paid: boolean
  /** 每月計費字數上限；null＝不限。 */
  monthlyCharLimit: number | null
  lexiconEntryLimit: number
  /** null＝價格尚未決定。 */
  price: PlanPrice | null
}

export const listPlans: () => PlanDefinition[] = planConfig.listPlans
export const findPlan: (id: string) => PlanDefinition | null = planConfig.findPlan
export const getPlanOrFree: (id: string) => PlanDefinition = planConfig.getPlanOrFree
export const planRank: (id: string) => number = planConfig.planRank
export const usingDefaultTestValues: () => boolean = planConfig.usingDefaultTestValues
export const formatPlanPrice: (plan: PlanDefinition) => string = planConfig.formatPlanPrice

/** 依 userId 的有效訂閱決定方案；沒有訂閱、已到期或已取消一律為 free。 */
export async function resolvePlanForUser(userId: string): Promise<PlanDefinition> {
  const tier = await getEffectiveTier(userId)
  return getPlanOrFree(tier)
}

/**
 * 依呼叫者身分決定方案。
 * - user：訂閱紀錄。
 * - apiKey：建立金鑰時由伺服器核定並存於金鑰紀錄的 tier。
 * - demo／anonymous：free。
 */
export async function resolveServerPlan(identity: Identity): Promise<PlanDefinition> {
  switch (identity.kind) {
    case 'user':
      return resolvePlanForUser(identity.userId)
    case 'apiKey':
      return getPlanOrFree(identity.tier)
    default:
      return getPlanOrFree('free')
  }
}

/** `requested` 的等級是否不高於 `owned`（用於核發 API key）。 */
export function planCovers(owned: string, requested: string): boolean {
  const ownedRank = planRank(owned)
  const requestedRank = planRank(requested)
  if (ownedRank < 0 || requestedRank < 0) return false
  return requestedRank <= ownedRank
}
