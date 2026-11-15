/**
 * 方案設定載入（CommonJS，供 TypeScript 與既有 `lib/*.js` 共用）。
 *
 * - 預設讀取 `config/plans.json`（額度為測試值、價格為 null＝尚未決定）。
 * - 可用環境變數 `BILLING_PLANS_JSON`（整份 JSON 字串）覆寫，不需改程式。
 * - 這裡不寫死任何價格；`price` 為 null 時，結帳流程必須拒絕建立訂單。
 *
 * 方案的先後順序即「等級」：陣列越後面等級越高（free < personal < creator < business < custom）。
 */

const defaultConfig = require('../../config/plans.json')

/**
 * @typedef {Object} PlanPrice
 * @property {number} amount   整數金額（最小顯示單位由 currency 決定，例如 TWD 元）
 * @property {string} currency ISO 4217，例如 "TWD"、"USD"
 */
/**
 * @typedef {Object} PlanDefinition
 * @property {string} id
 * @property {string} name
 * @property {boolean} paid                      是否為付費方案（需有效訂閱才可使用）
 * @property {number|null} monthlyCharLimit      每月計費字數上限；null＝不限
 * @property {number} lexiconEntryLimit          使用者發音詞庫詞條上限
 * @property {PlanPrice|null} price              null＝價格尚未決定
 */

let cacheKey = null
/** @type {PlanDefinition[] | null} */
let cachePlans = null

/** @param {unknown} raw @returns {PlanDefinition[]} */
function validate(raw) {
  const plans = raw && typeof raw === 'object' ? /** @type {any} */ (raw).plans : null
  if (!Array.isArray(plans) || plans.length === 0) {
    throw new Error('方案設定無效：plans 必須是非空陣列')
  }
  const seen = new Set()
  const out = plans.map((p) => {
    if (!p || typeof p.id !== 'string' || !p.id) throw new Error('方案設定無效：每個方案需要 id')
    if (seen.has(p.id)) throw new Error(`方案設定無效：重複的方案 id「${p.id}」`)
    seen.add(p.id)
    const limit = p.monthlyCharLimit
    if (limit !== null && !(Number.isInteger(limit) && limit >= 0)) {
      throw new Error(`方案設定無效：${p.id}.monthlyCharLimit 必須是非負整數或 null`)
    }
    let price = null
    if (p.price !== null && p.price !== undefined) {
      const { amount, currency } = p.price
      if (!(Number.isInteger(amount) && amount > 0) || typeof currency !== 'string' || !currency) {
        throw new Error(`方案設定無效：${p.id}.price 需為 { amount: 正整數, currency: 字串 } 或 null`)
      }
      price = { amount, currency }
    }
    return {
      id: p.id,
      name: typeof p.name === 'string' && p.name ? p.name : p.id,
      paid: Boolean(p.paid),
      monthlyCharLimit: limit,
      lexiconEntryLimit: Number.isInteger(p.lexiconEntryLimit) && p.lexiconEntryLimit >= 0 ? p.lexiconEntryLimit : 0,
      price,
    }
  })
  if (!out.some((p) => p.id === 'free' && !p.paid)) {
    throw new Error('方案設定無效：必須包含不需付費的 free 方案')
  }
  return out
}

/** @returns {PlanDefinition[]} */
function listPlans() {
  const envJson = process.env.BILLING_PLANS_JSON || ''
  if (cachePlans && cacheKey === envJson) return cachePlans
  const raw = envJson ? JSON.parse(envJson) : defaultConfig
  cachePlans = validate(raw)
  cacheKey = envJson
  return cachePlans
}

/** @param {string} id @returns {PlanDefinition | null} */
function findPlan(id) {
  return listPlans().find((p) => p.id === id) || null
}

/** 找不到時回退到 free（未知方案一律視為免費）。 @param {string} id @returns {PlanDefinition} */
function getPlanOrFree(id) {
  return findPlan(id) || /** @type {PlanDefinition} */ (findPlan('free'))
}

/** 方案等級（陣列索引）；未知方案為 -1。 @param {string} id */
function planRank(id) {
  return listPlans().findIndex((p) => p.id === id)
}

/** 是否使用預設（測試值）設定。 */
function usingDefaultTestValues() {
  return !process.env.BILLING_PLANS_JSON && Boolean(defaultConfig.valuesAreTestOnly)
}

/** 顯示用價格字串；未決定時回傳「待定」。 @param {PlanDefinition} plan */
function formatPlanPrice(plan) {
  if (!plan.paid) return '免費'
  if (!plan.price) return '待定'
  return `${plan.price.currency} ${plan.price.amount.toLocaleString('en-US')}/月`
}

module.exports = {
  listPlans,
  findPlan,
  getPlanOrFree,
  planRank,
  usingDefaultTestValues,
  formatPlanPrice,
}
