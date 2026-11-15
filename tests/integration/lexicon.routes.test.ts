import { describe, it, expect, beforeEach } from 'vitest'
import { GET as lexGet, POST as lexPost, DELETE as lexDelete } from '@/app/api/lexicon/route'
import { POST as ttsPost } from '@/app/api/tts/route'
import { POST as batchPost } from '@/app/api/batch/route'
import { POST as audiobookPost } from '@/app/api/audiobook/route'
import { POST as glossaryPost } from '@/app/api/glossary/route'
import { getMockProvider } from '@/lib/tts/synthesis'
import { countBillableChars } from '@/lib/billing/char-count'
import { getMonthlyUsage } from '@/lib/billing/usage'
import { DEMO_USER_ID } from '@/lib/identity'
import { signInAs, signOut, unconfigureClerk } from '../helpers/auth'
import { deleteRequest, getRequest, jsonRequest, uniqueUser, uploadRequest } from '../helpers/http'

const addEntries = (entries: unknown[]) => lexPost(jsonRequest('/api/lexicon', { entries }))
const sentToMock = () => getMockProvider().calls.map((c) => c.text)

describe('AC-006 發音校正詞庫 API 與合成路徑', () => {
  beforeEach(() => getMockProvider().reset())

  it('AC-006 GET/POST/DELETE：新增、列出、刪除自訂詞條', async () => {
    signInAs(uniqueUser('lex'))
    const created = await addEntries([{ term: '示範品牌', replacement: '是範品牌', zhuyin: 'ㄕˋ ㄈㄢˋ ㄆㄧㄣˇ ㄆㄞˊ' }])
    expect(created.status).toBe(200)

    const listed = await (await lexGet(getRequest('/api/lexicon'))).json()
    expect(listed.limit).toBe(20)
    expect(listed.user).toEqual([{ term: '示範品牌', replacement: '是範品牌', zhuyin: 'ㄕˋ ㄈㄢˋ ㄆㄧㄣˇ ㄆㄞˊ' }])
    expect(listed.system.length).toBeGreaterThan(0)

    expect((await lexDelete(deleteRequest('/api/lexicon?term=示範品牌'))).status).toBe(200)
    expect((await lexDelete(deleteRequest('/api/lexicon?term=示範品牌'))).status).toBe(404)
    expect((await (await lexGet(getRequest('/api/lexicon'))).json()).user).toEqual([])
  })

  it('AC-006 無效詞條回 400；超過方案上限回 400（上限由伺服器端方案決定）', async () => {
    signInAs(uniqueUser('lex'))
    expect((await addEntries([{ term: '甲' }])).status).toBe(400)
    const many = Array.from({ length: 21 }, (_, i) => ({ term: `詞${i}`, replacement: `辭${i}` }))
    const res = await lexPost(jsonRequest('/api/lexicon', { entries: many, tier: 'business', limit: 999 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('20')
  })

  it('AC-006 Clerk 未設定時使用 demo 使用者；已設定但未登入回 401', async () => {
    unconfigureClerk()
    const res = await lexGet(getRequest('/api/lexicon'))
    expect(res.status).toBe(200)
    expect((await res.json()).demo).toBe(true)
    await addEntries([{ term: '示範', replacement: '是範' }])
    signInAs(DEMO_USER_ID)
    // demo 使用者的資料就是 demo-user-001 的資料
    expect((await (await lexGet(getRequest('/api/lexicon'))).json()).user).toHaveLength(1)

    signOut()
    expect((await lexGet(getRequest('/api/lexicon'))).status).toBe(401)
    expect((await addEntries([{ term: '甲', replacement: '乙' }])).status).toBe(401)
  })

  it('AC-006 /api/tts：Mock provider 收到替換後文字；字數計量以原文為準', async () => {
    const userId = uniqueUser('lex')
    signInAs(userId)
    await addEntries([{ term: '示範公司', replacement: '是範公司' }])
    const original = '示範公司的行長今天重新開會。'
    const res = await ttsPost(jsonRequest('/api/tts', { text: original, engine: 'azure' }))
    expect(res.status).toBe(200)

    // 使用者詞條＋系統詞條（行長、重新）都套用
    expect(sentToMock()).toEqual(['是範公司的航長今天蟲新開會。'])
    expect(res.headers.get('X-Billable-Chars')).toBe(String(countBillableChars(original)))
    expect(await getMonthlyUsage(userId)).toBe(countBillableChars(original))
  })

  it('AC-006 計費不受詞庫影響：替換使字數變多時仍以原文計', async () => {
    const userId = uniqueUser('lex')
    signInAs(userId)
    await addEntries([{ term: 'AI', replacement: '人工智慧' }])
    await ttsPost(jsonRequest('/api/tts', { text: 'AI', engine: 'openai' }))
    expect(sentToMock()).toEqual(['人工智慧'])
    // 原文 2 字、替換後 4 字：計 2 字
    expect(await getMonthlyUsage(userId)).toBe(2)
  })

  it('AC-006 使用者詞條覆蓋系統詞條，在合成路徑生效', async () => {
    signInAs(uniqueUser('lex'))
    await addEntries([{ term: '行長', replacement: '自訂行長讀法' }])
    await ttsPost(jsonRequest('/api/tts', { text: '行長好', engine: 'openai' }))
    expect(sentToMock()).toEqual(['自訂行長讀法好'])
  })

  it('AC-006 /api/batch 與 /api/audiobook 也套用詞庫；有聲書字幕維持原文', async () => {
    signInAs(uniqueUser('lex'))
    await addEntries([{ term: '豆漿', replacement: '逗漿' }])

    const batch = await batchPost(jsonRequest('/api/batch', { tasks: [{ id: 'a', text: '一杯豆漿', engine: 'openai' }] }))
    expect(batch.status).toBe(200)
    expect(sentToMock()).toEqual(['一杯逗漿'])

    getMockProvider().reset()
    const res = await audiobookPost(
      uploadRequest('/api/audiobook', { rightsConfirmed: 'true' }, { name: 'shop.txt', content: '第一章 早餐\n阿嬤賣豆漿。\n第二章 午餐\n豆漿賣完了。' }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(sentToMock().some((t) => t.includes('逗漿'))).toBe(true)
    expect(sentToMock().some((t) => t.includes('豆漿'))).toBe(false)
    const { GET: download } = await import('@/app/api/audiobook/[id]/download/route')
    const srt = await (await download(getRequest(`/api/audiobook/${body.job_id}/download?chapter=1&format=srt`), { params: { id: body.job_id } })).text()
    expect(srt).toContain('豆漿')
    expect(srt).not.toContain('逗漿')
  })

  it('AC-006 Whisper 詞彙表（/api/glossary）的詞不會影響 TTS', async () => {
    signInAs(uniqueUser('lex'))
    await glossaryPost(jsonRequest('/api/glossary', { action: 'set', words: ['豆漿'] }))
    await ttsPost(jsonRequest('/api/tts', { text: '豆漿店', engine: 'openai' }))
    expect(sentToMock()).toEqual(['豆漿店'])
  })
})
