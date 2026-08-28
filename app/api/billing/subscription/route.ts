import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUserSubscription, cancelUserSubscription, getEffectiveTier } from '@/lib/subscriptions'
import { TIER_LIMITS } from '@/lib/api-keys'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth().catch(() => ({ userId: null }))
  if (!userId) {
    return NextResponse.json({
      ok: true,
      authenticated: false,
      tier: 'free',
      tier_info: TIER_LIMITS.free,
      message: 'Not signed in. Sign in to view your subscription.',
    })
  }
  const sub = await getUserSubscription(userId)
  const tier = await getEffectiveTier(userId)
  return NextResponse.json({
    ok: true,
    authenticated: true,
    userId,
    tier,
    tier_info: TIER_LIMITS[tier],
    subscription: sub,
    is_active: sub?.status === 'active' && sub?.expiresAt > Date.now(),
  })
}

export async function DELETE() {
  const { userId } = await auth().catch(() => ({ userId: null }))
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required', code: 'NO_AUTH' }, { status: 401 })
  }
  const ok = await cancelUserSubscription(userId)
  if (!ok) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, cancelled: true })
}

export async function OPTIONS() {
  return new NextResponse('', {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
