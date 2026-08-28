import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createApiKey, listApiKeys, revokeApiKey, TIER_LIMITS, Tier } from '@/lib/api-keys'
import { getApiKeyUsage, listJobsForApiKey } from '@/lib/jobs'

export const dynamic = 'force-dynamic'

interface KeyCreateBody {
  tier?: Tier
  label?: string
}

export async function GET(req: NextRequest) {
  // Two paths:
  //   1. Web user via Clerk session → manage their own keys
  //   2. Self-service key generation without login (for demo mode) — return generated key
  const { userId } = await auth().catch(() => ({ userId: null }))

  // Demo mode without Clerk — use a synthetic owner
  const ownerId = userId || `demo-${req.headers.get('x-forwarded-for') || 'anonymous'}`

  const keys = await listApiKeys(ownerId)
  const enriched = []
  for (const k of keys) {
    const usage = await getApiKeyUsage(k.id)
    enriched.push({
      id: k.id,
      tier: k.tier,
      tier_info: TIER_LIMITS[k.tier],
      prefix: k.prefix,
      monthly_limit_sec: k.monthlyLimitSec,
      used_sec: usage.usedSec,
      usage_percent: k.monthlyLimitSec > 0 ? Math.round((usage.usedSec / k.monthlyLimitSec) * 100) : 0,
      created_at: k.createdAt,
      expires_at: k.expiresAt,
      revoked: k.revokedAt !== null,
    })
  }
  return NextResponse.json({
    ok: true,
    owner_id: ownerId,
    authenticated: userId !== null,
    keys: enriched,
  })
}

export async function POST(req: NextRequest) {
  let body: KeyCreateBody
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const tier = (body.tier || 'free') as Tier
  if (!Object.keys(TIER_LIMITS).includes(tier)) {
    return NextResponse.json({ error: `Invalid tier: ${tier}`, code: 'BAD_TIER' }, { status: 400 })
  }

  const { userId } = await auth().catch(() => ({ userId: null }))
  const ownerId = userId || `demo-${req.headers.get('x-forwarded-for') || 'anonymous'}`

  const { record, plaintext } = await createApiKey(ownerId, tier)

  return NextResponse.json({
    ok: true,
    api_key: plaintext,             // Only shown once — user must save immediately
    id: record.id,
    tier: record.tier,
    prefix: record.prefix,
    expires_at: record.expiresAt,
    warning: 'Save this key now — you will not be able to view it again.',
  }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id query param required', code: 'BAD_INPUT' }, { status: 400 })
  }
  const { userId } = await auth().catch(() => ({ userId: null }))
  const ownerId = userId || `demo-${req.headers.get('x-forwarded-for') || 'anonymous'}`

  const ok = await revokeApiKey(id, ownerId)
  if (!ok) {
    return NextResponse.json({ error: 'Key not found or not owned by caller', code: 'NOT_FOUND' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, revoked_id: id })
}

export async function OPTIONS() {
  return new NextResponse('', {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
