import { describe, it, expect, vi } from 'vitest'
import newebpay from '@/lib/newebpay'
import { POST as notifyPost } from '@/app/api/webhook/newebpay/route'
import { POST as checkoutPost, GET as checkoutGet } from '@/app/api/billing/checkout/route'
import { getUserSubscription } from '@/lib/subscriptions'
import { signInAs } from '../helpers/auth'
import { jsonRequest, uniqueUser } from '../helpers/http'

// 明顯的假金鑰（長度符合 AES-256-CBC：key 32、iv 16），不是任何真實商店的憑證。
const FAKE_HASH_KEY = 'fake-hash-key-for-tests-00000000'
const FAKE_HASH_IV = 'fake-iv-tests-00'

function useFakeMerchant() {
  process.env.NEWEBPAY_MERCHANT_ID = 'MS-TEST-000000'
  process.env.NEWEBPAY_HASH_KEY = FAKE_HASH_KEY
  process.env.NEWEBPAY_HASH_IV = FAKE_HASH_IV
}

/** 用測試價格覆寫方案設定（僅供測試；正式價格尚未決定）。 */
function useTestPrices() {
  process.env.BILLING_PLANS_JSON = JSON.stringify({
    plans: [
      { id: 'free', name: '免費版', paid: false, monthlyCharLimit: 1000, lexiconEntryLimit: 5, price: null },
      { id: 'personal', name: '個人版', paid: true, monthlyCharLimit: 5000, lexiconEntryLimit: 10, price: { amount: 123, currency: 'TWD' } },
      { id: 'creator', name: '創作者版', paid: true, monthlyCharLimit: 9000, lexiconEntryLimit: 20, price: { amount: 456, currency: 'TWD' } },
      { id: 'business', name: '企業版', paid: true, monthlyCharLimit: 20000, lexiconEntryLimit: 30, price: { amount: 7, currency: 'USD' } },
    ],
  })
}

const SENSITIVE = {
  Email: 'payer@example.com',
  Card6No: '400022',
  Card4No: '1111',
  PayerAccount5Code: '54321',
  Auth: 'AUTH-930637',
  IP: '198.51.100.23',
}

function encryptedNotify(fields: Record<string, string | number>) {
  const params: Record<string, string | number> = { ...fields }
  const checkValue = newebpay.checkValue(params, FAKE_HASH_KEY, FAKE_HASH_IV)
  const query = Object.entries({ ...params, CheckValue: checkValue })
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')
  return newebpay.aesEncrypt(query, FAKE_HASH_KEY, FAKE_HASH_IV)
}

function captureLogs() {
  const calls: string[] = []
  const record = (...args: unknown[]) => {
    calls.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
  }
  vi.spyOn(console, 'log').mockImplementation(record)
  vi.spyOn(console, 'warn').mockImplementation(record)
  vi.spyOn(console, 'error').mockImplementation(record)
  vi.spyOn(console, 'info').mockImplementation(record)
  return calls
}

describe('NewebPay 安全（FR-017；GOAL 範圍：僅測試模式、不寫死價格）', () => {
  it('FR-017 通知處理不把解密後的完整交易（含個資）寫進 log', async () => {
    useFakeMerchant()
    const userId = uniqueUser('payer')
    const logs = captureLogs()

    const tradeInfo = encryptedNotify({
      Status: 'SUCCESS',
      MerchantOrderNo: 'HTS-TEST-0001',
      Amt: 100,
      ProdCode: 'CREATOR',
      USERID: userId,
      PaymentMethod: 'CREDIT',
      ...SENSITIVE,
    })
    const res = await notifyPost(jsonRequest('/api/webhook/newebpay', { TradeInfo: tradeInfo, Status: 'SUCCESS' }))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('OK')

    // 訂閱確實被更新（代表有走完解密與驗章流程）
    expect((await getUserSubscription(userId))?.tier).toBe('creator')

    const all = logs.join('\n')
    expect(all).toContain('HTS-TEST-0001') // 訂單號可記錄，供對帳
    for (const value of Object.values(SENSITIVE)) {
      expect(all, `log 不得包含 ${value}`).not.toContain(value)
    }
    expect(all).not.toContain(userId)
    expect(all).not.toContain('CheckValue')
    expect(all).not.toContain('Decrypted')
  })

  it('FR-017 無法判斷方案時的警告也不輸出整筆交易', async () => {
    useFakeMerchant()
    const logs = captureLogs()
    const tradeInfo = encryptedNotify({
      Status: 'SUCCESS',
      MerchantOrderNo: 'HTS-TEST-0002',
      Amt: 100,
      ProdCode: 'UNKNOWN',
      USERID: uniqueUser('payer'),
      ...SENSITIVE,
    })
    const res = await notifyPost(jsonRequest('/api/webhook/newebpay', { TradeInfo: tradeInfo }))
    expect(res.status).toBe(400)
    const all = logs.join('\n')
    for (const value of Object.values(SENSITIVE)) expect(all).not.toContain(value)
  })

  it('FR-017 簽章不符的通知被拒，且不升級訂閱', async () => {
    useFakeMerchant()
    captureLogs()
    const userId = uniqueUser('forged')
    const forged = newebpay.aesEncrypt(
      `Status=SUCCESS&MerchantOrderNo=HTS-FORGED&Amt=1&ProdCode=BUSINESS&USERID=${userId}&CheckValue=0000`,
      FAKE_HASH_KEY,
      FAKE_HASH_IV,
    )
    const res = await notifyPost(jsonRequest('/api/webhook/newebpay', { TradeInfo: forged }))
    expect(res.status).toBe(400)
    expect(await getUserSubscription(userId)).toBeNull()
  })

  it('FR-017 已設定價格時，通知金額與方案設定不符就不升級', async () => {
    useFakeMerchant()
    useTestPrices()
    captureLogs()
    const userId = uniqueUser('underpay')
    const tradeInfo = encryptedNotify({
      Status: 'SUCCESS',
      MerchantOrderNo: 'HTS-TEST-0003',
      Amt: 1,
      ProdCode: 'CREATOR',
      USERID: userId,
    })
    const res = await notifyPost(jsonRequest('/api/webhook/newebpay', { TradeInfo: tradeInfo }))
    expect(res.status).toBe(400)
    expect(await getUserSubscription(userId)).toBeNull()
  })

  it('FR-017 M1 只能用測試模式：端點固定為 ccore（即使 NODE_ENV=production），正式模式直接拋錯', () => {
    useFakeMerchant()
    useTestPrices()
    const env = process.env as Record<string, string | undefined>

    const checkout = newebpay.createCheckout({ tier: 'personal', userId: 'demo-user-001' })
    expect(checkout.endpoint).toBe('https://ccore.newebpay.com/MPG/mpg_gateway')
    expect(checkout.is_production).toBe(false)

    env.NODE_ENV = 'production'
    const inProdRuntime = newebpay.createCheckout({ tier: 'personal', userId: 'demo-user-001' })
    expect(inProdRuntime.endpoint).toBe('https://ccore.newebpay.com/MPG/mpg_gateway')
    expect(inProdRuntime.endpoint).not.toContain('//core.newebpay.com')
    env.NODE_ENV = 'test'

    env.NEWEBPAY_MODE = 'production'
    expect(() => newebpay.createCheckout({ tier: 'personal', userId: 'demo-user-001' })).toThrow(/只允許測試模式/)
  })

  it('AC-005 價格不寫死：預設設定下價格為「待定」，無法建立結帳（503）', async () => {
    useFakeMerchant()
    signInAs(uniqueUser('buyer'))
    for (const tier of Object.values(newebpay.NEWEBPAY_TIERS)) expect(tier.amount).toBeNull()

    expect(() => newebpay.createCheckout({ tier: 'personal', userId: 'demo-user-001' })).toThrow(/價格尚未設定/)
    const res = await checkoutPost(jsonRequest('/api/billing/checkout', { tier: 'creator' }))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('PRICE_NOT_CONFIGURED')

    const listing = await (await checkoutGet()).json()
    expect(listing.mode).toBe('test')
    expect(listing.tiers.creator).toMatchObject({ amount: null, price_configured: false })
  })

  it('AC-005 價格來自設定檔；用戶端無法指定金額；非 TWD 價格不能走 NewebPay', async () => {
    useFakeMerchant()
    useTestPrices()
    signInAs(uniqueUser('buyer'))

    const res = await checkoutPost(jsonRequest('/api/billing/checkout', { tier: 'creator', amount: 1, price: 1 }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.amount).toBe(456)
    expect(body.is_production).toBe(false)
    const decrypted = newebpay.aesDecrypt(body.fields.TradeInfo, FAKE_HASH_KEY, FAKE_HASH_IV)
    expect(decrypted).toContain('Amt=456')

    // business 在測試設定中是 USD → NewebPay 不可用
    expect(newebpay.NEWEBPAY_TIERS.business.amount).toBeNull()
    const usd = await checkoutPost(jsonRequest('/api/billing/checkout', { tier: 'business' }))
    expect(usd.status).toBe(503)
  })
})
