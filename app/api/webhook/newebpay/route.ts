import { NextRequest, NextResponse } from 'next/server'
import { decryptNotify, verifyNotify, resolveTierFromTrade } from '@/lib/newebpay'
import { storeUserSubscription } from '@/lib/subscriptions'

export const dynamic = 'force-dynamic'

/**
 * NewebPay NotifyURL handler.
 *
 * NewebPay POSTs to this URL with:
 *   - Status:  Status of the transaction
 *   - TradeInfo:  AES-encrypted query string
 *
 * On SUCCESS:
 *   - Decrypt TradeInfo
 *   - Verify CheckValue
 *   - Determine tier from ProdCode or amount
 *   - Upgrade user subscription
 *   - Return "OK" (NewebPay requires plain text response, not JSON)
 */
export async function POST(req: NextRequest) {
  try {
    // NewebPay posts as form-urlencoded
    const ct = req.headers.get('content-type') || ''
    let tradeInfoHex = ''
    let status = ''

    if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
      const formData = await req.formData()
      tradeInfoHex = String(formData.get('TradeInfo') || '')
      status = String(formData.get('Status') || '')
    } else {
      const body = await req.json().catch(() => ({}))
      tradeInfoHex = body.TradeInfo || body.tradeInfo || ''
      status = body.Status || body.status || ''
    }

    if (!tradeInfoHex) {
      console.warn('[newebpay] No TradeInfo in payload')
      return new NextResponse('NO_TRADE_INFO', { status: 400 })
    }

    let decrypted: any
    try {
      decrypted = decryptNotify(tradeInfoHex)
    } catch (err) {
      console.error('[newebpay] Decrypt failed:', err)
      return new NextResponse('DECRYPT_FAIL', { status: 400 })
    }

    // Verify CheckValue signature
    if (!verifyNotify(decrypted)) {
      console.warn('[newebpay] CheckValue mismatch')
      return new NextResponse('INVALID_SIGNATURE', { status: 400 })
    }

    console.log('[newebpay] Decrypted:', JSON.stringify(decrypted))

    // Only process successful payments
    const tradeStatus = decrypted.Status || status
    if (tradeStatus && tradeStatus !== 'SUCCESS') {
      console.log(`[newebpay] Non-success status: ${tradeStatus}`)
      // NewebPay expects a plain text "OK" or error code; we'll return OK so it doesn't retry
      return new NextResponse('OK')
    }

    const tier = resolveTierFromTrade(decrypted)
    if (!tier) {
      console.warn('[newebpay] Could not resolve tier from trade:', decrypted)
      return new NextResponse('UNKNOWN_TIER', { status: 400 })
    }

    const userId = decrypted.USERID || ''
    if (!userId) {
      console.warn('[newebpay] No USERID in decrypted payload')
      return new NextResponse('NO_USER_ID', { status: 400 })
    }

    const amt = Number(decrypted.Amt || 0)
    await storeUserSubscription(userId, tier, {
      paymentMethod: decrypted.PaymentMethod || 'unknown',
      lastOrderNo: decrypted.MerchantOrderNo || '',
      totalPaid: amt,
      autoRenew: false,
    })

    console.log(`[newebpay] Upgraded ${userId} → ${tier} (NT$${amt})`)

    // NewebPay expects plain text "OK" or "SUCCESS" response
    return new NextResponse('OK')
  } catch (err: unknown) {
    console.error('[newebpay] Webhook error:', err)
    return new NextResponse('INTERNAL_ERROR', { status: 500 })
  }
}

export async function GET() {
  // NewebPay may use GET for testing
  return NextResponse.json({
    ok: true,
    handler: 'NewebPay NotifyURL',
    description: 'POST TradeInfo (AES-CBC encrypted with HashKey/HashIV) here. Returns "OK" on success.',
  })
}
