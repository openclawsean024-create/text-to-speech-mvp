import { NextResponse } from 'next/server'
import { TIER_LIMITS } from '@/lib/api-keys'
import { getApiKeyUsage } from '@/lib/jobs'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    ok: true,
    tiers: TIER_LIMITS,
    note: 'Use POST /api/v1/keys with tier=personal|creator|business to create an API key',
  })
}
