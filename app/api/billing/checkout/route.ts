import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createCheckout, NEWEBPAY_TIERS } from '@/lib/newebpay'

export const dynamic = 'force-dynamic'

interface CheckoutBody {
  tier: keyof typeof NEWEBPAY_TIERS
  email?: string
}

export async function POST(req: NextRequest) {
  let body: CheckoutBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.tier || !NEWEBPAY_TIERS[body.tier]) {
    return NextResponse.json(
      { error: 'Invalid tier. Supported: personal, creator, business', code: 'BAD_TIER' },
      { status: 400 },
    )
  }

  const { userId } = await auth().catch(() => ({ userId: null }))
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required', code: 'NO_AUTH' }, { status: 401 })
  }

  try {
    const checkout = createCheckout({
      tier: body.tier,
      userId,
      email: body.email,
    })
    return NextResponse.json({
      ok: true,
      tier: checkout.tier,
      amount: checkout.amount,
      merchant_order_no: checkout.merchant_order_no,
      endpoint: checkout.endpoint,
      method: checkout.method,
      fields: checkout.fields,
      is_production: checkout.is_production,
      note: 'POST fields to endpoint with method=POST to start checkout. Client will be redirected to NewebPay payment page.',
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if ((err as { code?: string })?.code === 'PRICE_NOT_CONFIGURED') {
      return NextResponse.json({ error: msg, code: 'PRICE_NOT_CONFIGURED' }, { status: 503 })
    }
    return NextResponse.json({ error: msg, code: 'CHECKOUT_FAIL' }, { status: 500 })
  }
}

export async function GET() {
  const tiers = Object.fromEntries(
    Object.entries(NEWEBPAY_TIERS).map(([id, t]) => [
      id,
      { code: t.code, name: t.name, tier: t.tier, amount: t.amount, price_configured: t.amount !== null },
    ]),
  )
  return NextResponse.json({
    ok: true,
    mode: 'test',
    tiers,
    note: 'POST {tier: "personal|creator|business"} to create a NewebPay checkout session (test mode only in M1). amount=null 表示價格尚未決定，無法結帳。',
  })
}

export async function OPTIONS() {
  return new NextResponse('', {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
