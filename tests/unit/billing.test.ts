import { describe, it, expect } from 'vitest'
import { countBillableChars, CHAR_COUNT_RULE_VERSION } from '@/lib/billing/char-count'
import {
  commitChars,
  getEngineUsage,
  getMonthlyUsage,
  getQuotaStatus,
  monthKey,
  nextResetAt,
  refundChars,
  reserveChars,
} from '@/lib/billing/usage'
import { findPlan, formatPlanPrice, getPlanOrFree, listPlans, planCovers, planRank, usingDefaultTestValues } from '@/lib/billing/plans'
import { uniqueUser } from '../helpers/http'

const plan = (limit: number | null) => ({
  id: 'test-plan',
  name: '測試方案',
  paid: false,
  monthlyCharLimit: limit,
  lexiconEntryLimit: 0,
  price: null,
})

describe('AC-005 計費字數規則（SPEC §14-2 預設：原文、去空白、Unicode 碼位；待 Sean 定案）', () => {
  // 固定案例：改動計數規則時這張表必須同步檢討（並更新 CHAR_COUNT_RULE_VERSION）
  const cases: Array<[label: string, text: string, expected: number]> = [
    ['中文＋全形標點都計入', '你好，世界！', 6],
    ['英文與半形標點計入、空白不計', 'Hello, World!', 12],
    ['英數混合、空白不計', 'ABC 123', 6],
    ['半形空白、Tab、換行、全形空白（U+3000）都不計', '  你 好\t\n嗎　？', 4],
    ['CRLF 換行不計', '第一行\r\n第二行', 6],
    ['不換行空白（NBSP）不計', '甲 乙', 2],
    ['零寬字元（ZWSP、BOM）不計', '﻿你​好', 2],
    ['混合：英數、全形與半形標點、貨幣符號', 'TTS 2.0：價格 NT$1,200（含稅）。', 22],
    ['全形英數各計 1 字', 'ＡＢＣ１２３', 6],
    ['引號與破折號計入', '「好」——他說。', 8],
    ['emoji（代理對）計 1 字', '😀', 1],
    ['帶膚色修飾的 emoji 為 2 個碼位', '👍🏽', 2],
    ['組合字元先做 NFC 正規化', 'é', 1],
    ['空字串', '', 0],
    ['只有空白', ' \n\t　 ', 0],
  ]
  for (const [label, text, expected] of cases) {
    it(`AC-005 ${label}：${JSON.stringify(text)} → ${expected}`, () => {
      expect(countBillableChars(text)).toBe(expected)
    })
  }

  it('AC-005 非字串輸入計為 0，且規則有版本號', () => {
    expect(countBillableChars(undefined as unknown as string)).toBe(0)
    expect(countBillableChars(null as unknown as string)).toBe(0)
    expect(CHAR_COUNT_RULE_VERSION).toMatch(/^m1-default/)
  })
})

describe('AC-005 每月額度（reserve → commit／refund）', () => {
  const NOV = new Date('2026-11-16T04:00:00Z')

  it('AC-005 額度剛好用完：used + chars == limit 允許，再多 1 字即拒絕', async () => {
    const userId = uniqueUser('quota')
    const p = plan(100)

    const first = await reserveChars(userId, p, 60, NOV)
    expect(first.ok).toBe(true)
    const exact = await reserveChars(userId, p, 40, NOV)
    expect(exact.ok).toBe(true)
    if (exact.ok) expect(exact.status).toMatchObject({ used: 100, limit: 100, remaining: 0 })

    const over = await reserveChars(userId, p, 1, NOV)
    expect(over.ok).toBe(false)
    if (over.ok === false) {
      expect(over.requested).toBe(1)
      expect(over.status).toMatchObject({ used: 100, limit: 100, remaining: 0, period: '2026-11' })
    }
    // 被拒絕的請求不改變用量
    expect(await getMonthlyUsage(userId, NOV)).toBe(100)
  })

  it('AC-005 單次請求超過剩餘額度時整筆拒絕（不部分扣量）', async () => {
    const userId = uniqueUser('quota')
    const p = plan(100)
    await reserveChars(userId, p, 90, NOV)
    const over = await reserveChars(userId, p, 11, NOV)
    expect(over.ok).toBe(false)
    expect(await getMonthlyUsage(userId, NOV)).toBe(90)
    // 剩下的 10 字仍可使用
    expect((await reserveChars(userId, p, 10, NOV)).ok).toBe(true)
  })

  it('AC-005 合成失敗 refund 後不計字數；commit 後記錄引擎用量', async () => {
    const userId = uniqueUser('quota')
    const p = plan(1000)

    const failed = await reserveChars(userId, p, 300, NOV)
    expect(failed.ok).toBe(true)
    if (failed.ok) await refundChars(failed.reservation)
    expect(await getMonthlyUsage(userId, NOV)).toBe(0)

    const ok = await reserveChars(userId, p, 120, NOV)
    if (ok.ok) {
      await commitChars(ok.reservation, 'mock')
      // commit 之後再 refund 不會退款（避免重複結算）
      await refundChars(ok.reservation)
    }
    expect(await getMonthlyUsage(userId, NOV)).toBe(120)
    expect(await getEngineUsage(userId, 'mock', NOV)).toBe(120)
    expect(await getEngineUsage(userId, 'openai', NOV)).toBe(0)
  })

  it('AC-005 部分退款：只退未完成的字數', async () => {
    const userId = uniqueUser('quota')
    const p = plan(1000)
    const reserved = await reserveChars(userId, p, 500, NOV)
    if (reserved.ok) {
      await refundChars(reserved.reservation, 200)
      await commitChars(reserved.reservation, 'mock')
    }
    expect(await getMonthlyUsage(userId, NOV)).toBe(300)
    expect(await getEngineUsage(userId, 'mock', NOV)).toBe(300)
  })

  it('AC-005 跨月重置：新的計費月份用量從 0 開始，上個月的紀錄保留', async () => {
    const userId = uniqueUser('quota')
    const p = plan(100)
    const lastSecond = new Date('2026-11-30T23:59:59Z')
    const nextMonth = new Date('2026-12-01T00:00:00Z')

    await reserveChars(userId, p, 100, lastSecond)
    expect((await reserveChars(userId, p, 1, lastSecond)).ok).toBe(false)

    expect(await getMonthlyUsage(userId, nextMonth)).toBe(0)
    const fresh = await reserveChars(userId, p, 100, nextMonth)
    expect(fresh.ok).toBe(true)
    expect(await getMonthlyUsage(userId, lastSecond)).toBe(100)

    expect(monthKey(lastSecond)).toBe('2026-11')
    expect(monthKey(nextMonth)).toBe('2026-12')
    expect(nextResetAt(lastSecond)).toBe('2026-12-01T00:00:00.000Z')
    expect(nextResetAt(new Date('2026-12-15T12:00:00Z'))).toBe('2027-01-01T00:00:00.000Z')
  })

  it('AC-005 並行請求不會一起超過額度', async () => {
    const userId = uniqueUser('quota')
    const p = plan(100)
    const results = await Promise.all(Array.from({ length: 10 }, () => reserveChars(userId, p, 30, NOV)))
    expect(results.filter((r) => r.ok)).toHaveLength(3)
    expect(await getMonthlyUsage(userId, NOV)).toBe(90)
  })

  it('AC-005 不限額度的方案（limit: null）不會被拒絕', async () => {
    const userId = uniqueUser('quota')
    const result = await reserveChars(userId, plan(null), 5_000_000, NOV)
    expect(result.ok).toBe(true)
    expect(await getQuotaStatus(userId, plan(null), NOV)).toMatchObject({ used: 5_000_000, limit: null, remaining: null })
  })

  it('AC-005 getQuotaStatus 回傳本月字數、上限、剩餘與重置時間', async () => {
    const userId = uniqueUser('quota')
    await reserveChars(userId, plan(1000), 250, NOV)
    expect(await getQuotaStatus(userId, plan(1000), NOV)).toEqual({
      plan: 'test-plan',
      period: '2026-11',
      used: 250,
      limit: 1000,
      remaining: 750,
      resetsAt: '2026-12-01T00:00:00.000Z',
    })
  })
})

describe('AC-005 方案設定（可設定的結構、不寫死價格）', () => {
  const env = process.env as Record<string, string | undefined>

  it('AC-005 預設設定：額度為測試值、所有價格為 null（待定）', () => {
    const plans = listPlans()
    expect(plans.map((p) => p.id)).toEqual(['free', 'personal', 'creator', 'business', 'custom'])
    expect(usingDefaultTestValues()).toBe(true)
    for (const p of plans) {
      expect(p.price, `${p.id} 不應有寫死的價格`).toBeNull()
      expect(formatPlanPrice(p)).toBe(p.paid ? '待定' : '免費')
    }
    expect(getPlanOrFree('free').paid).toBe(false)
    expect(getPlanOrFree('does-not-exist').id).toBe('free')
    expect(findPlan('does-not-exist')).toBeNull()
  })

  it('AC-005 以 BILLING_PLANS_JSON 覆寫額度與價格，不需改程式', () => {
    env.BILLING_PLANS_JSON = JSON.stringify({
      plans: [
        { id: 'free', name: '免費', paid: false, monthlyCharLimit: 123, lexiconEntryLimit: 1, price: null },
        { id: 'plus', name: '進階', paid: true, monthlyCharLimit: 4567, lexiconEntryLimit: 9, price: { amount: 5, currency: 'USD' } },
      ],
    })
    expect(listPlans().map((p) => p.id)).toEqual(['free', 'plus'])
    expect(getPlanOrFree('free').monthlyCharLimit).toBe(123)
    expect(formatPlanPrice(getPlanOrFree('plus'))).toBe('USD 5/月')
    expect(usingDefaultTestValues()).toBe(false)
    expect(planRank('plus')).toBe(1)
    expect(planCovers('plus', 'free')).toBe(true)
    expect(planCovers('free', 'plus')).toBe(false)
    expect(planCovers('free', 'unknown')).toBe(false)

    delete env.BILLING_PLANS_JSON
    expect(listPlans()).toHaveLength(5)
  })

  it('AC-005 無效的方案設定會被拒絕（缺 free、負數額度、價格格式錯誤、重複 id）', () => {
    const bad = [
      { plans: [] },
      { plans: [{ id: 'pro', paid: true, monthlyCharLimit: 10, price: null }] },
      { plans: [{ id: 'free', paid: false, monthlyCharLimit: -1, price: null }] },
      { plans: [{ id: 'free', paid: false, monthlyCharLimit: 10, price: { amount: 0, currency: 'TWD' } }] },
      { plans: [{ id: 'free', paid: false, monthlyCharLimit: 10, price: null }, { id: 'free', paid: false, monthlyCharLimit: 10, price: null }] },
    ]
    for (const config of bad) {
      env.BILLING_PLANS_JSON = JSON.stringify(config)
      expect(() => listPlans(), JSON.stringify(config)).toThrow(/方案設定無效/)
    }
  })
})
