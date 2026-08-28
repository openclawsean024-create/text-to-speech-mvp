import { NextRequest, NextResponse } from 'next/server'
import { signPayload, verifyPayload } from '@/lib/webhook'

export const dynamic = 'force-dynamic'

/**
 * Webhook test/verify endpoint.
 *
 * POST: signs a payload + sends it to a target URL with retries.
 *        Useful for testing receiver-side HMAC verification.
 *
 * GET: returns info about the webhook secret + signature algorithm.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    algorithm: 'HMAC-SHA256',
    header: 'X-Signature: sha256=<hex>',
    source: 'hermes-tts',
    secret_configured: !!process.env.WEBHOOK_SECRET,
    description: 'Webhook payload is signed with HMAC-SHA256. Verify by computing HMAC over the raw JSON body using WEBHOOK_SECRET and comparing with the X-Signature header (timing-safe comparison).',
  })
}

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const action = body.action || 'verify'

  if (action === 'sign') {
    const payload = body.payload || {}
    const json = JSON.stringify(payload)
    const sig = signPayload(json)
    return NextResponse.json({
      ok: true,
      payload,
      body: json,
      signature: sig,
      algorithm: 'sha256',
    })
  }

  if (action === 'verify') {
    const payloadJson = body.body || JSON.stringify(body.payload || {})
    const signatureHeader = body.signature || ''
    const ok = verifyPayload(payloadJson, signatureHeader)
    return NextResponse.json({
      ok,
      verified: ok,
      payload: payloadJson,
      signature: signatureHeader,
      expected_signature: signPayload(payloadJson),
    })
  }

  return NextResponse.json({ error: 'Unknown action: ' + action }, { status: 400 })
}
