import { NextRequest, NextResponse } from 'next/server'
import { getTodayUsage, getUsageHistory, getMonthlyTotal } from '@/lib/db'
import { resolveIdentity, identityUserId } from '@/lib/identity'
import { resolveServerPlan, usingDefaultTestValues } from '@/lib/billing/plans'
import { getQuotaStatus } from '@/lib/billing/usage'
import { CHAR_COUNT_RULE_VERSION } from '@/lib/billing/char-count'

export const dynamic = 'force-dynamic'

/**
 * 本月字數用量（GOAL AC-005）。
 *
 * 方案一律由伺服器端依訂閱紀錄決定；`?plan=` 查詢參數不採信（AC-008）。
 */
export async function GET(req: NextRequest) {
  const identity = await resolveIdentity(req)
  const userId = identityUserId(identity)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'NO_AUTH' }, { status: 401 })
  }

  const plan = await resolveServerPlan(identity)
  const [quota, todayRequests, history, monthlyRequests] = await Promise.all([
    getQuotaStatus(userId, plan),
    getTodayUsage(userId),
    getUsageHistory(userId, 14),
    getMonthlyTotal(userId),
  ])

  return NextResponse.json({
    plan: { id: plan.id, name: plan.name, paid: plan.paid },
    demo: identity.kind === 'demo',
    // 按字數計量（計費依據）
    chars: {
      period: quota.period,
      used: quota.used,
      limit: quota.limit,
      remaining: quota.remaining,
      resetsAt: quota.resetsAt,
      ruleVersion: CHAR_COUNT_RULE_VERSION,
      limitIsTestValue: usingDefaultTestValues(),
    },
    // 請求次數（僅供顯示，不作為額度依據）
    today: { used: todayRequests },
    monthly: { used: monthlyRequests },
    history,
  })
}
