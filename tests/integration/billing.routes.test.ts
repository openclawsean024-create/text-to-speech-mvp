import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { POST as ttsPost } from '@/app/api/tts/route'
import { POST as batchPost } from '@/app/api/batch/route'
import { GET as usageGet } from '@/app/api/usage/route'
import { countBillableChars } from '@/lib/billing/char-count'
import { getEngineUsage, getMonthlyUsage, reserveChars } from '@/lib/billing/usage'
import { getPlanOrFree } from '@/lib/billing/plans'
import { storeUserSubscription } from '@/lib/subscriptions'
import { getMockProvider } from '@/lib/tts/synthesis'
import { signInAs, signOut, unconfigureClerk } from '../helpers/auth'
import { getRequest, jsonRequest, uniqueUser } from '../helpers/http'

const FREE_LIMIT = getPlanOrFree('free').monthlyCharLimit as number
const env = process.env as Record<string, string | undefined>

const tts = (body: Record<string, unknown>) => ttsPost(jsonRequest('/api/tts', { engine: 'openai', ...body }))
const usage = async () => (await usageGet(getRequest('/api/usage'))).json()

async function fillTo(userId: string, used: number) {
  const result = await reserveChars(userId, getPlanOrFree('custom'), used)
  expect(result.ok).toBe(true)
}

describe('AC-005 按字數計量與每月額度（API）', () => {
  beforeEach(() => {
    getMockProvider().reset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('AC-005 成功合成後依計費字數記錄用量，/api/usage 回傳本月字數、上限、剩餘', async () => {
    const userId = uniqueUser('meter')
    signInAs(userId)
    const text = '你好，世界！ Hello 123'
    const expected = countBillableChars(text)
    expect(expected).toBe(14)

    const res = await tts({ text })
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Billable-Chars')).toBe(String(expected))
    expect(res.headers.get('X-Quota-Remaining')).toBe(String(FREE_LIMIT - expected))

    const body = await usage()
    expect(body.plan).toMatchObject({ id: 'free', paid: false })
    expect(body.chars).toMatchObject({ used: expected, limit: FREE_LIMIT, remaining: FREE_LIMIT - expected })
    expect(body.chars.period).toMatch(/^\d{4}-\d{2}$/)
    expect(body.chars.limitIsTestValue).toBe(true)
    expect(await getEngineUsage(userId, 'mock')).toBe(expected)
  })

  it('AC-005 計數以原文為準：前後空白與換行不計，也不因 trim 而少算標點', async () => {
    const userId = uniqueUser('meter')
    signInAs(userId)
    const res = await tts({ text: '  第一行。\n\n  第二行！  ' })
    expect(res.status).toBe(200)
    expect(await getMonthlyUsage(userId)).toBe(8)
  })

  it('AC-005 額度剛好用完的請求成功；之後任何合成回 402', async () => {
    const userId = uniqueUser('meter')
    signInAs(userId)
    await fillTo(userId, FREE_LIMIT - 5)

    const exact = await tts({ text: '剛好五個字' })
    expect(exact.status).toBe(200)
    expect(exact.headers.get('X-Quota-Remaining')).toBe('0')
    expect(await getMonthlyUsage(userId)).toBe(FREE_LIMIT)

    const callsBefore = getMockProvider().calls.length
    const over = await tts({ text: '多' })
    expect(over.status).toBe(402)
    const body = await over.json()
    expect(body).toMatchObject({
      code: 'CHAR_QUOTA_EXCEEDED',
      plan: 'free',
      used: FREE_LIMIT,
      limit: FREE_LIMIT,
      remaining: 0,
      requested: 1,
    })
    expect(typeof body.resetsAt).toBe('string')
    // 超額的請求沒有送去合成，也沒有扣量
    expect(getMockProvider().calls).toHaveLength(callsBefore)
    expect(await getMonthlyUsage(userId)).toBe(FREE_LIMIT)
  })

  it('AC-005 超額 402：請求字數大於剩餘額度時整筆拒絕', async () => {
    const userId = uniqueUser('meter')
    signInAs(userId)
    await fillTo(userId, FREE_LIMIT - 3)
    const res = await tts({ text: '這句話超過三個字' })
    expect(res.status).toBe(402)
    expect(await getMonthlyUsage(userId)).toBe(FREE_LIMIT - 3)
    expect(getMockProvider().calls).toHaveLength(0)
  })

  it('AC-005 合成失敗不扣量', async () => {
    const userId = uniqueUser('meter')
    signInAs(userId)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(getMockProvider(), 'synthesize').mockRejectedValueOnce(new Error('simulated synthesis outage'))

    const failed = await tts({ text: '這次合成會失敗。' })
    expect(failed.status).toBe(500)
    expect(await getMonthlyUsage(userId)).toBe(0)
    expect(await getEngineUsage(userId, 'mock')).toBe(0)
    expect((await usage()).chars.used).toBe(0)

    // 之後成功的合成才計量
    const ok = await tts({ text: '這次成功。' })
    expect(ok.status).toBe(200)
    expect(await getMonthlyUsage(userId)).toBe(5)
  })

  it('AC-005 輸入驗證失敗（空文字、無效引擎）不扣量', async () => {
    const userId = uniqueUser('meter')
    signInAs(userId)
    expect((await tts({ text: '   ' })).status).toBe(400)
    expect((await tts({ text: '哈囉', engine: 'not-an-engine' })).status).toBe(400)
    expect(await getMonthlyUsage(userId)).toBe(0)
  })

  it('AC-005 跨月重置：新的計費月份用量歸零並可再次合成', async () => {
    const userId = uniqueUser('meter')
    signInAs(userId)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-30T23:59:50Z'))

    await fillTo(userId, FREE_LIMIT)
    expect((await tts({ text: '月底已經沒有額度。' })).status).toBe(402)
    expect((await usage()).chars).toMatchObject({ period: '2026-11', used: FREE_LIMIT, remaining: 0, resetsAt: '2026-12-01T00:00:00.000Z' })

    vi.setSystemTime(new Date('2026-12-01T00:00:10Z'))
    expect((await usage()).chars).toMatchObject({ period: '2026-12', used: 0, remaining: FREE_LIMIT })
    const res = await tts({ text: '新的月份。' })
    expect(res.status).toBe(200)
    expect((await usage()).chars).toMatchObject({ period: '2026-12', used: 5 })
  })

  it('AC-005 額度依伺服器端訂閱方案判斷：有效訂閱使用該方案的上限', async () => {
    const userId = uniqueUser('meter')
    signInAs(userId)
    await storeUserSubscription(userId, 'personal', { lastOrderNo: 'TEST-ORDER-100' })
    const personalLimit = getPlanOrFree('personal').monthlyCharLimit as number
    await fillTo(userId, FREE_LIMIT + 10)

    const res = await tts({ text: '已超過免費額度但在個人版額度內。' })
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Plan')).toBe('personal')
    expect(res.headers.get('X-Quota-Limit')).toBe(String(personalLimit))
    expect((await usage()).plan.id).toBe('personal')
  })

  it('AC-005 額度數值來自設定：以 BILLING_PLANS_JSON 調整後立即生效', async () => {
    const userId = uniqueUser('meter')
    signInAs(userId)
    env.BILLING_PLANS_JSON = JSON.stringify({
      plans: [{ id: 'free', name: '免費', paid: false, monthlyCharLimit: 6, lexiconEntryLimit: 1, price: null }],
    })
    expect((await tts({ text: '六個字剛好。' })).status).toBe(200)
    expect((await tts({ text: '多' })).status).toBe(402)
    const body = await usage()
    expect(body.chars).toMatchObject({ used: 6, limit: 6, remaining: 0, limitIsTestValue: false })
  })

  it('AC-005 /api/batch：每個任務各自計量；超額的任務 402、失敗的任務不扣量', async () => {
    const userId = uniqueUser('meter')
    signInAs(userId)
    await fillTo(userId, FREE_LIMIT - 12)
    vi.spyOn(getMockProvider(), 'synthesize')
      .mockImplementationOnce(MockPassthrough)
      .mockRejectedValueOnce(new Error('simulated synthesis outage'))

    const res = await batchPost(
      jsonRequest('/api/batch', {
        tasks: [
          { id: 'ok', text: '成功的任務有八字', engine: 'openai' },
          { id: 'fail', text: '會失敗', engine: 'openai' },
          { id: 'over', text: '這個任務超過剩餘額度', engine: 'openai' },
          { id: 'fits', text: '剩四個字', engine: 'openai' },
        ],
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    const byId = Object.fromEntries(body.results.map((r: { id: string }) => [r.id, r]))
    expect(byId.ok).toMatchObject({ success: true, billableChars: 8 })
    expect(byId.fail).toMatchObject({ success: false })
    expect(byId.over).toMatchObject({ success: false, code: 'CHAR_QUOTA_EXCEEDED', status: 402 })
    expect(byId.fits).toMatchObject({ success: true, billableChars: 4 })
    // 只有成功的兩個任務扣量：8 + 4
    expect(await getMonthlyUsage(userId)).toBe(FREE_LIMIT)
  })

  it('AC-005 /api/usage：已設定 Clerk 但未登入回 401；demo mode 使用 demo 使用者', async () => {
    signOut()
    expect((await usageGet(getRequest('/api/usage'))).status).toBe(401)

    unconfigureClerk()
    const body = await usage()
    expect(body.demo).toBe(true)
    expect(body.plan.id).toBe('free')
  })
})

/** 讓第一次呼叫走原本的 Mock 實作（spy 鏈中用）。 */
async function MockPassthrough(this: unknown, opts: Parameters<ReturnType<typeof getMockProvider>['synthesize']>[0]) {
  const { MockTtsProvider } = await import('@/lib/tts/provider')
  return new MockTtsProvider({ maxDurationMs: 1000 }).synthesize(opts)
}
