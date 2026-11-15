import { describe, it, expect, vi } from 'vitest'
import { POST as ttsPost } from '@/app/api/tts/route'
import { POST as batchPost } from '@/app/api/batch/route'
import { GET as usageGet } from '@/app/api/usage/route'
import { POST as glossaryPost } from '@/app/api/glossary/route'
import { GET as keysGet, POST as keysPost } from '@/app/api/v1/keys/route'
import { getPlanOrFree } from '@/lib/billing/plans'
import { getMonthlyUsage, reserveChars } from '@/lib/billing/usage'
import { storeUserSubscription, cancelUserSubscription } from '@/lib/subscriptions'
import { DEMO_USER_ID } from '@/lib/identity'
import { signInAs, signOut, unconfigureClerk } from '../helpers/auth'
import { jsonRequest, getRequest, uniqueUser } from '../helpers/http'

// AC-003 完成前的暫時措施：以假引擎取代 lib/tts-engines，避免呼叫付費 API。
vi.mock('@/lib/tts-engines', () => {
  const synthesize = async ({ engine }: { engine?: string }) => ({
    audio: Buffer.from('fake-audio'),
    contentType: 'audio/mpeg',
    engine: engine ?? 'openai',
  })
  return { default: { synthesize }, synthesize, SUPPORTED_ENGINES: ['openai', 'elevenlabs', 'kokoro', 'azure', 'google'] }
})

const FREE = getPlanOrFree('free')
const FREE_LIMIT = FREE.monthlyCharLimit as number

/** 把使用者本月用量填到「距離 free 上限只剩 remaining 字」。 */
async function fillUsage(userId: string, remaining: number) {
  const result = await reserveChars(userId, getPlanOrFree('custom'), FREE_LIMIT - remaining)
  expect(result.ok).toBe(true)
}

describe('AC-008 方案與 tier 由伺服器端決定', () => {
  describe('/api/tts', () => {
    it('AC-008 用戶端傳 plan: "pro" 仍以 free 額度判斷（超額 402）', async () => {
      const userId = uniqueUser('alice')
      signInAs(userId)
      await fillUsage(userId, 5)

      const res = await ttsPost(
        jsonRequest('/api/tts', { text: '這句話有十個字以上喔。', engine: 'openai', apiKey: 'test-key', plan: 'pro' }),
      )
      expect(res.status).toBe(402)
      const body = await res.json()
      expect(body.code).toBe('CHAR_QUOTA_EXCEEDED')
      expect(body.plan).toBe('free')
      expect(body.limit).toBe(FREE_LIMIT)
      // 被拒絕的請求不扣量
      expect(await getMonthlyUsage(userId)).toBe(FREE_LIMIT - 5)
    })

    it('AC-008 成功回應標示伺服器端決定的方案，而非用戶端傳入值', async () => {
      const userId = uniqueUser('bob')
      signInAs(userId)
      for (const claimed of ['pro', 'business', 'custom']) {
        const res = await ttsPost(
          jsonRequest('/api/tts', { text: '哈囉', engine: 'openai', apiKey: 'test-key', plan: claimed, tier: claimed }),
        )
        expect(res.status).toBe(200)
        expect(res.headers.get('X-Plan')).toBe('free')
        expect(res.headers.get('X-Quota-Limit')).toBe(String(FREE_LIMIT))
      }
    })

    it('AC-008 有效付費訂閱才會得到付費額度', async () => {
      const userId = uniqueUser('carol')
      signInAs(userId)
      await storeUserSubscription(userId, 'creator', { lastOrderNo: 'TEST-ORDER-001' })
      const res = await ttsPost(jsonRequest('/api/tts', { text: '哈囉', engine: 'openai', apiKey: 'test-key' }))
      expect(res.status).toBe(200)
      expect(res.headers.get('X-Plan')).toBe('creator')
      expect(res.headers.get('X-Quota-Limit')).toBe(String(getPlanOrFree('creator').monthlyCharLimit))

      // 取消訂閱後立即回到 free
      await cancelUserSubscription(userId)
      const after = await ttsPost(jsonRequest('/api/tts', { text: '哈囉', engine: 'openai', apiKey: 'test-key', plan: 'creator' }))
      expect(after.headers.get('X-Plan')).toBe('free')
    })

    it('AC-008 已設定 Clerk 但未登入時拒絕（401），不會以匿名身分繞過額度', async () => {
      signOut()
      const res = await ttsPost(jsonRequest('/api/tts', { text: '哈囉', engine: 'openai', apiKey: 'test-key', plan: 'pro' }))
      expect(res.status).toBe(401)
      expect((await res.json()).code).toBe('NO_AUTH')
    })
  })

  describe('/api/batch', () => {
    it('AC-008 用戶端傳 plan: "pro" 仍以 free 額度判斷', async () => {
      const userId = uniqueUser('dave')
      signInAs(userId)
      await fillUsage(userId, 3)
      const res = await batchPost(
        jsonRequest('/api/batch', {
          plan: 'pro',
          tasks: [{ id: 't1', text: '這段文字超過三個字。', engine: 'openai', apiKey: 'test-key' }],
        }),
      )
      expect(res.status).toBe(402)
      const body = await res.json()
      expect(body.plan).toBe('free')
      expect(body.results[0]).toMatchObject({ id: 't1', success: false, code: 'CHAR_QUOTA_EXCEEDED', status: 402 })
      expect(await getMonthlyUsage(userId)).toBe(FREE_LIMIT - 3)
    })
  })

  describe('/api/usage', () => {
    it('AC-008 ?plan=pro 查詢參數不被採信', async () => {
      const userId = uniqueUser('erin')
      signInAs(userId)
      const res = await usageGet(getRequest('/api/usage?plan=pro'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.plan.id).toBe('free')
      expect(body.chars.limit).toBe(FREE_LIMIT)
      expect(body.chars.remaining).toBe(FREE_LIMIT)
    })
  })

  describe('/api/glossary', () => {
    it('AC-008 用戶端傳 tier: "business" 仍套用 free 的詞彙表上限', async () => {
      const userId = uniqueUser('frank')
      signInAs(userId)
      const words = Array.from({ length: 60 }, (_, i) => `示範詞${i}`)
      const res = await glossaryPost(jsonRequest('/api/glossary', { action: 'set', words, tier: 'business' }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.tier).toBe('free')
      expect(body.limit).toBe(20)
      expect(body.words).toHaveLength(20)
    })
  })

  describe('/api/v1/keys', () => {
    it('AC-008 匿名建立 business key 被拒（401）', async () => {
      signOut()
      const res = await keysPost(
        jsonRequest('/api/v1/keys', { tier: 'business' }, { headers: { 'x-forwarded-for': '203.0.113.7' } }),
      )
      expect(res.status).toBe(401)
      expect((await res.json()).api_key).toBeUndefined()
    })

    it('AC-008 匿名連 free key 也不能建立或列出（不再以 x-forwarded-for 當擁有者）', async () => {
      signOut()
      const created = await keysPost(jsonRequest('/api/v1/keys', { tier: 'free' }, { headers: { 'x-forwarded-for': '203.0.113.7' } }))
      expect(created.status).toBe(401)
      const listed = await keysGet(getRequest('/api/v1/keys', { 'x-forwarded-for': '203.0.113.7' }))
      expect(listed.status).toBe(401)
    })

    it('AC-008 demo 使用者（未設定 Clerk）只能建立 free key，business 被拒（403）', async () => {
      unconfigureClerk()
      const paid = await keysPost(jsonRequest('/api/v1/keys', { tier: 'business' }))
      expect(paid.status).toBe(403)
      expect((await paid.json()).code).toBe('TIER_NOT_ENTITLED')

      const free = await keysPost(jsonRequest('/api/v1/keys', { tier: 'free' }))
      expect(free.status).toBe(201)
      const listed = await (await keysGet(getRequest('/api/v1/keys'))).json()
      expect(listed.owner_id).toBe(DEMO_USER_ID)
      expect(listed.keys.every((k: { tier: string }) => k.tier === 'free')).toBe(true)
    })

    it('AC-008 已登入但沒有有效訂閱時不得建立付費 tier key', async () => {
      const userId = uniqueUser('grace')
      signInAs(userId)
      for (const tier of ['personal', 'creator', 'business', 'custom']) {
        const res = await keysPost(jsonRequest('/api/v1/keys', { tier }))
        expect(res.status, tier).toBe(403)
        expect((await res.json()).api_key).toBeUndefined()
      }
    })

    it('AC-008 有效訂閱可建立不高於自身方案的 key，高於則拒絕', async () => {
      const userId = uniqueUser('heidi')
      signInAs(userId)
      await storeUserSubscription(userId, 'creator', { lastOrderNo: 'TEST-ORDER-002' })

      const ok = await keysPost(jsonRequest('/api/v1/keys', { tier: 'creator' }))
      expect(ok.status).toBe(201)
      const body = await ok.json()
      expect(body.tier).toBe('creator')
      expect(body.api_key).toMatch(/^hms_/)

      const lower = await keysPost(jsonRequest('/api/v1/keys', { tier: 'personal' }))
      expect(lower.status).toBe(201)

      const higher = await keysPost(jsonRequest('/api/v1/keys', { tier: 'business' }))
      expect(higher.status).toBe(403)
    })
  })
})
