import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getTodayUsage, getUsageHistory, getMonthlyTotal, LIMITS } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { userId } = await auth().catch(() => ({ userId: null as string | null }))
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const plan = req.nextUrl.searchParams.get('plan') || 'free'
  const effectivePlan = ['free', 'starter', 'pro'].includes(plan) ? plan : 'free'
  const limit = LIMITS[effectivePlan as keyof typeof LIMITS]?.requests ?? LIMITS.free.requests

  const [todayUsage, history, monthlyTotal] = await Promise.all([
    getTodayUsage(userId),
    getUsageHistory(userId, 14),
    getMonthlyTotal(userId),
  ])

  return NextResponse.json({
    today: {
      used: todayUsage,
      limit,
    },
    monthly: {
      used: monthlyTotal,
    },
    history,
  })
}
