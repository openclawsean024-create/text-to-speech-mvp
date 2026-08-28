/**
 * NewebPay (藍新) 訂閱金流整合 — v3.0 spec §9.1
 *
 * 三層 tier：
 *   - Personal  NT$99/月    TTS 30 分鐘 + 後製 1 hr
 *   - Creator   NT$299/月   TTS 3 hr + 後製 10 hr
 *   - Business  NT$2,999/月 TTS 50 hr + 後製 200 hr
 *
 * NewebPay MPG (Multi Payment Gateway) flow:
 *   1. Server creates TradeInfo (AES-CBC encrypted with HashKey/HashIV)
 *   2. Client posts encrypted TradeInfo to https://ccore.newebpay.com/MPG/mpg_gateway
 *   3. NewebPay redirects user → 3D Secure / ATM / Credit Card
 *   4. User completes payment → NewebPay POSTs to ReturnURL + NotifyURL
 *   5. We decrypt + verify + update user tier
 *
 * This module implements the encryption + signature + tier resolution.
 * Webhook handling lives in /api/webhook/newebpay/route.ts.
 */

const crypto = require('node:crypto')

const NEWEBPAY_ENDPOINTS = {
  production: 'https://core.newebpay.com',
  test: 'https://ccore.newebpay.com',
}

const NEWEBPAY_TIERS = {
  personal: {
    code: 'PERSONAL',
    name: '個人版',
    amount: 99,
    productDescription: 'Hermes TTS 個人版 — TTS 30 分鐘/月 + 後製 1 hr/月',
    tier: 'personal',
  },
  creator: {
    code: 'CREATOR',
    name: '創作者版',
    amount: 299,
    productDescription: 'Hermes TTS 創作者版 — TTS 3 hr/月 + 後製 10 hr/月',
    tier: 'creator',
  },
  business: {
    code: 'BUSINESS',
    name: '企業 API 版',
    amount: 2999,
    productDescription: 'Hermes TTS 企業 API — TTS 50 hr/月 + 後製 200 hr/月 + Webhook',
    tier: 'business',
  },
}

function getEnv() {
  const merchantId = process.env.NEWEBPAY_MERCHANT_ID || ''
  const hashKey = process.env.NEWEBPAY_HASH_KEY || ''
  const hashIV = process.env.NEWEBPAY_HASH_IV || ''
  const isProd = process.env.NODE_ENV === 'production'
  return {
    merchantId,
    hashKey,
    hashIV,
    endpoint: isProd ? NEWEBPAY_ENDPOINTS.production : NEWEBPAY_ENDPOINTS.test,
    returnUrl: process.env.NEWEBPAY_RETURN_URL || 'https://text-to-speech-mvp.vercel.app/billing/success',
    notifyUrl: process.env.NEWEBPAY_NOTIFY_URL || 'https://text-to-speech-mvp.vercel.app/api/webhook/newebpay',
    isProd,
  }
}

/**
 * NewebPay uses AES-256-CBC with PKCS7 padding.
 * Key/IV are 32/16 chars ASCII (not bytes); Node truncates to length.
 */
function aesEncrypt(plain, hashKey, hashIV) {
  const key = Buffer.from(hashKey, 'ascii').slice(0, 32)
  const iv = Buffer.from(hashIV, 'ascii').slice(0, 16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(plain, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return encrypted
}

function aesDecrypt(cipherHex, hashKey, hashIV) {
  const key = Buffer.from(hashKey, 'ascii').slice(0, 32)
  const iv = Buffer.from(hashIV, 'ascii').slice(0, 16)
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decipher.update(cipherHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/**
 * SHA256 hash chain (NewebPay CheckValue style):
 *   value = SHA256(HashKey + queryString + HashIV).toUpperCase()
 */
function checkValue(params, hashKey, hashIV) {
  const keys = Object.keys(params).sort()
  const parts = keys.map((k) => `${k}=${params[k]}`).join('&')
  const raw = `HashKey=${hashKey}&${parts}&HashIV=${hashIV}`
  return crypto.createHash('sha256').update(raw).digest('hex').toUpperCase()
}

/**
 * @typedef {Object} CheckoutOptions
 * @property {string} tier
 * @property {string} userId
 * @property {string} [email]
 * @property {number} [amount]
 * @property {string} [productDesc]
 */
/**
 * Create a MPG form-post payload for client checkout.
 *
 * Per NewebPay spec:
 *   - TradeInfo = AES-256-CBC-encrypt(query-string of trade params WITHOUT CheckValue)
 *   - CheckValue = SHA256(HashKey + query-string + HashIV).toUpperCase()
 *       where query-string uses the SAME trade params
 *   - Both are sent as separate form fields
 *
 * @param {CheckoutOptions} opts
 */
function createCheckout(opts) {
  const { tier, userId, email, amount, productDesc } = opts
  const env = getEnv()
  if (!env.merchantId || !env.hashKey || !env.hashIV) {
    throw new Error('NewebPay credentials not configured (NEWEBPAY_MERCHANT_ID, NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV)')
  }
  const cfg = NEWEBPAY_TIERS[tier]
  if (!cfg) throw new Error(`Unknown tier: ${tier}`)

  const merchantOrderNo = `HTS-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  const amt = amount || cfg.amount
  const desc = productDesc || cfg.productDescription

  const tradeInfoParams = {
    MerchantID: env.merchantId,
    RespondType: 'JSON',
    TimeStamp: Math.floor(Date.now() / 1000),
    Version: '2.0',
    MerchantOrderNo: merchantOrderNo,
    Amt: amt,
    ItemDesc: desc,
    Email: email || '',
    LoginType: '0',
    NotifyURL: env.notifyUrl,
    ReturnURL: env.returnUrl,
    ClientBackURL: env.returnUrl,
    Lang: 'zh-TW',
    USERID: userId,
    ProdCode: cfg.code,
  }

  const keys = Object.keys(tradeInfoParams).sort()
  const queryString = keys.map((k) => `${k}=${tradeInfoParams[k]}`).join('&')

  const tradeInfo = aesEncrypt(queryString, env.hashKey, env.hashIV)
  const checkValueStr = checkValue({ ...tradeInfoParams }, env.hashKey, env.hashIV)

  return {
    endpoint: `${env.endpoint}/MPG/mpg_gateway`,
    method: 'POST',
    fields: {
      MerchantID: env.merchantId,
      TradeInfo: tradeInfo,
      Version: '2.0',
      CheckValue: checkValueStr,
    },
    merchant_order_no: merchantOrderNo,
    amount: amt,
    tier: cfg.tier,
    is_production: env.isProd,
  }
}

/**
 * Decrypt a NewebPay NotifyURL payload.
 *
 * NewebPay's NotifyURL returns TradeInfo encrypted with the trade RESULT params
 * (including status, payment method, CheckValue, etc.). The decrypted blob
 * contains a CheckValue field that we verify.
 */
function decryptNotify(tradeInfoHex) {
  const env = getEnv()
  if (!env.hashKey || !env.hashIV) throw new Error('NewebPay HashKey/HashIV not configured')
  const decrypted = aesDecrypt(tradeInfoHex, env.hashKey, env.hashIV)
  const obj = {}
  for (const pair of decrypted.split('&')) {
    const idx = pair.indexOf('=')
    if (idx < 0) continue
    const k = pair.slice(0, idx)
    const v = pair.slice(idx + 1)
    if (k) obj[k] = decodeURIComponent(v || '')
  }
  return obj
}

/**
 * Verify CheckValue from a NewebPay NotifyURL payload.
 *
 * The decrypted TradeInfo from NotifyURL CONTAINS a CheckValue field.
 * We recompute it from all other fields and compare.
 */
function verifyNotify(tradeInfoDecrypted) {
  const env = getEnv()
  const provided = tradeInfoDecrypted.CheckValue
  if (!provided) return false
  const params = { ...tradeInfoDecrypted }
  delete params.CheckValue
  const expected = checkValue(params, env.hashKey, env.hashIV)
  return expected === provided
}

/**
 * Determine the tier from a successful trade.
 */
function resolveTierFromTrade(trade) {
  if (trade.ProdCode === 'PERSONAL') return 'personal'
  if (trade.ProdCode === 'CREATOR') return 'creator'
  if (trade.ProdCode === 'BUSINESS') return 'business'
  const amt = Number(trade.Amt || 0)
  if (amt === 99) return 'personal'
  if (amt === 299) return 'creator'
  if (amt === 2999) return 'business'
  return null
}

module.exports = {
  NEWEBPAY_TIERS,
  createCheckout,
  decryptNotify,
  verifyNotify,
  resolveTierFromTrade,
  aesEncrypt,
  aesDecrypt,
  checkValue,
}
