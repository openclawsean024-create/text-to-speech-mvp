/**
 * NewebPay (藍新) 訂閱金流整合
 *
 * M1 限制（GOAL「Out of scope」）：
 *   - **只允許測試模式**：一律指向測試端點 ccore.newebpay.com；設定 NEWEBPAY_MODE=production
 *     會直接拋錯。正式金流屬 M3，需 Sean 核准後才解除。
 *   - **不寫死價格**：金額取自方案設定（config/plans.json 或 BILLING_PLANS_JSON）。
 *     價格尚未決定（price: null）時無法建立結帳。
 *   - 尚未經沙箱端到端驗證（M2）。
 *
 * NewebPay MPG (Multi Payment Gateway) flow:
 *   1. Server creates TradeInfo (AES-CBC encrypted with HashKey/HashIV)
 *   2. Client posts encrypted TradeInfo to the MPG gateway
 *   3. NewebPay redirects user → 3D Secure / ATM / Credit Card
 *   4. User completes payment → NewebPay POSTs to ReturnURL + NotifyURL
 *   5. We decrypt + verify + update user tier
 *
 * This module implements the encryption + signature + tier resolution.
 * Webhook handling lives in /api/webhook/newebpay/route.ts.
 */

const crypto = require('node:crypto')
const planConfig = require('./billing/plan-config')

const NEWEBPAY_ENDPOINTS = {
  // 正式端點僅列出供 M3 參考；M1 的 getEnv() 永遠不會回傳它。
  production: 'https://core.newebpay.com',
  test: 'https://ccore.newebpay.com',
}

/** NewebPay 只支援新台幣。 */
const NEWEBPAY_CURRENCY = 'TWD'

/**
 * 可透過 NewebPay 訂閱的方案。金額不寫死：`amount` 取自方案設定，尚未決定時為 null。
 */
function defineTier(planId, code) {
  return {
    code,
    tier: planId,
    get name() {
      return planConfig.getPlanOrFree(planId).name
    },
    get amount() {
      const plan = planConfig.findPlan(planId)
      if (!plan || !plan.price || plan.price.currency !== NEWEBPAY_CURRENCY) return null
      return plan.price.amount
    },
    get productDescription() {
      return `繁中 TTS 與有聲書工作台 — ${planConfig.getPlanOrFree(planId).name}（月訂閱）`
    },
  }
}

const NEWEBPAY_TIERS = {
  personal: defineTier('personal', 'PERSONAL'),
  creator: defineTier('creator', 'CREATOR'),
  business: defineTier('business', 'BUSINESS'),
}

/** M1 一律為測試模式；要求正式模式時拋錯。 */
function resolveMode() {
  const requested = (process.env.NEWEBPAY_MODE || 'test').toLowerCase()
  if (requested !== 'test') {
    throw new Error('NewebPay 在 M1 只允許測試模式（NEWEBPAY_MODE 必須為 test 或不設定）')
  }
  return 'test'
}

function getEnv() {
  const merchantId = process.env.NEWEBPAY_MERCHANT_ID || ''
  const hashKey = process.env.NEWEBPAY_HASH_KEY || ''
  const hashIV = process.env.NEWEBPAY_HASH_IV || ''
  const mode = resolveMode()
  return {
    merchantId,
    hashKey,
    hashIV,
    mode,
    endpoint: NEWEBPAY_ENDPOINTS[mode],
    returnUrl: process.env.NEWEBPAY_RETURN_URL || 'https://text-to-speech-mvp.vercel.app/billing/success',
    notifyUrl: process.env.NEWEBPAY_NOTIFY_URL || 'https://text-to-speech-mvp.vercel.app/api/webhook/newebpay',
    isProd: false,
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
  const { tier, userId, email } = opts
  const env = getEnv()
  if (!env.merchantId || !env.hashKey || !env.hashIV) {
    throw new Error('NewebPay credentials not configured (NEWEBPAY_MERCHANT_ID, NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV)')
  }
  const cfg = NEWEBPAY_TIERS[tier]
  if (!cfg) throw new Error(`Unknown tier: ${tier}`)

  // 金額只來自伺服器端方案設定；尚未決定價格時不得建立訂單
  const amt = cfg.amount
  if (amt === null) {
    const err = new Error(`方案 ${tier} 的價格尚未設定（待定），無法建立結帳`)
    err.code = 'PRICE_NOT_CONFIGURED'
    throw err
  }

  const merchantOrderNo = `HTS-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
  const desc = cfg.productDescription

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
 *
 * 只依 ProdCode 判斷（不再用金額反推方案——價格不寫死）。
 * 若該方案已設定價格，通知金額必須與設定相符，否則視為無效。
 */
function resolveTierFromTrade(trade) {
  const entry = Object.values(NEWEBPAY_TIERS).find((t) => t.code === trade.ProdCode)
  if (!entry) return null
  const expected = entry.amount
  if (expected !== null && Number(trade.Amt || 0) !== expected) return null
  return entry.tier
}

/**
 * 可安全寫入 log 的交易摘要：只含狀態、訂單號、方案代碼與金額。
 * 不含 Email、卡號片段、付款人資訊、銀行授權碼等個資，也不輸出整筆解密內容。
 */
function summarizeTradeForLog(trade) {
  const t = trade || {}
  return {
    status: String(t.Status || ''),
    orderNo: String(t.MerchantOrderNo || ''),
    prodCode: String(t.ProdCode || ''),
    amount: Number(t.Amt || 0),
  }
}

module.exports = {
  NEWEBPAY_TIERS,
  createCheckout,
  decryptNotify,
  verifyNotify,
  resolveTierFromTrade,
  summarizeTradeForLog,
  NEWEBPAY_CURRENCY,
  aesEncrypt,
  aesDecrypt,
  checkValue,
}
