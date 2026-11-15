import { NextRequest, NextResponse } from 'next/server'
import { createApiKey, listApiKeys, revokeApiKey, TIER_LIMITS, Tier } from '@/lib/api-keys'
import { getApiKeyUsage } from '@/lib/jobs'
import { resolveIdentity, identityUserId } from '@/lib/identity'
import { resolveServerPlan, planCovers } from '@/lib/billing/plans'

export const dynamic = 'force-dynamic'

interface KeyCreateBody {
  tier?: Tier
  label?: string
}

/**
 * 企業 API key 管理。
 *
 * 擁有者一律由伺服器端身分決定（Clerk userId；未設定 Clerk 時為 demo 使用者）。
 * 不再以 `x-forwarded-for` 等可偽造的標頭當作擁有者，匿名一律 401。
 * 可建立的 tier 不得高於呼叫者目前的有效訂閱方案（AC-008）。
 */
async function resolveOwner(req: NextRequest) {
  // 管理金鑰本身不接受以 API key 驗證
  const identity = await resolveIdentity(req, { allowApiKey: false })
  return { identity, ownerId: identityUserId(identity) }
}

function unauthorized() {
  return NextResponse.json({ error: 'Authentication required', code: 'NO_AUTH' }, { status: 401 })
}

export async function GET(req: NextRequest) {
  const { identity, ownerId } = await resolveOwner(req)
  if (!ownerId) return unauthorized()

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
    authenticated: identity.kind === 'user',
    demo: identity.kind === 'demo',
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

  const { identity, ownerId } = await resolveOwner(req)
  if (!ownerId) return unauthorized()

  // tier 由伺服器端核定：不得高於目前有效訂閱方案
  const plan = await resolveServerPlan(identity)
  if (!planCovers(plan.id, tier)) {
    return NextResponse.json(
      {
        error: `目前方案（${plan.id}）無法建立 ${tier} 等級的 API key，請先升級訂閱。`,
        code: 'TIER_NOT_ENTITLED',
        current_plan: plan.id,
        requested_tier: tier,
      },
      { status: 403 },
    )
  }

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
  const { ownerId } = await resolveOwner(req)
  if (!ownerId) return unauthorized()

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
