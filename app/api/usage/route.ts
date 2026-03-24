import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getTodayUsage, getUsageHistory, getMonthlyTotal, LIMITS } from '@/lib/db'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [todayUsage, history, monthlyTotal] = await Promise.all([
    getTodayUsage(userId),
    getUsageHistory(userId, 14),
    getMonthlyTotal(userId),
  ])

  return NextResponse.json({
    today: {
      used: todayUsage,
      limit: LIMITS.free.requests, // Client passes plan in request to override
    },
    monthly: {
      used: monthlyTotal,
    },
    history,
  })
}
