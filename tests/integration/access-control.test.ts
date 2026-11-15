import { describe, it, expect } from 'vitest'
import { GET as jobGet } from '@/app/api/v1/jobs/[id]/route'
import { GET as jobDownload } from '@/app/api/v1/jobs/[id]/download/route'
import { createJob, updateJob, type Job } from '@/lib/jobs'
import { createApiKey } from '@/lib/api-keys'
import { authorizeOwner } from '@/lib/access-control'
import { signInAs, signOut, unconfigureClerk } from '../helpers/auth'
import { getRequest, uniqueUser } from '../helpers/http'

const SRT = '1\n00:00:00,000 --> 00:00:01,000\n示範字幕\n'

async function makeDoneJob(owner: { userId?: string | null; apiKeyId?: string | null }): Promise<Job> {
  const job = await createJob({
    userId: owner.userId ?? null,
    apiKeyId: owner.apiKeyId ?? null,
    audioKey: 'audio:test-fixture',
    filename: 'demo-episode.mp3',
    mimeType: 'audio/mpeg',
    fileSize: 1024,
    durationSec: 60,
    settings: {},
    options: {},
  })
  const done = await updateJob(job.id, { status: 'done', srt: SRT, vtt: 'WEBVTT\n\n', finishedAt: Date.now() })
  return done as Job
}

const statusOf = (id: string, headers: Record<string, string> = {}) =>
  jobGet(getRequest(`/api/v1/jobs/${id}`, headers), { params: { id } })
const downloadOf = (id: string, headers: Record<string, string> = {}) =>
  jobDownload(getRequest(`/api/v1/jobs/${id}/download?format=srt`, headers), { params: { id } })

describe('AC-007 產出存取控制（/api/v1/jobs）', () => {
  it('AC-007 擁有者（Clerk userId）可讀取狀態與下載：200', async () => {
    const owner = uniqueUser('owner')
    const job = await makeDoneJob({ userId: owner })
    signInAs(owner)

    const status = await statusOf(job.id)
    expect(status.status).toBe(200)
    expect((await status.json()).job_id).toBe(job.id)

    const download = await downloadOf(job.id)
    expect(download.status).toBe(200)
    expect(await download.text()).toBe(SRT)
    expect(download.headers.get('Cache-Control')).toContain('no-store')
  })

  it('AC-007 他人 userId 讀取或下載：403', async () => {
    const job = await makeDoneJob({ userId: uniqueUser('owner') })
    signInAs(uniqueUser('intruder'))

    const status = await statusOf(job.id)
    expect(status.status).toBe(403)
    expect((await status.json()).code).toBe('FORBIDDEN')

    const download = await downloadOf(job.id)
    expect(download.status).toBe(403)
    expect(await download.text()).not.toContain('示範字幕')
  })

  it('AC-007 匿名讀取剛建立的工作：401（不再有 24 小時／30 天的匿名放行）', async () => {
    const job = await makeDoneJob({ userId: uniqueUser('owner') })
    expect(Date.now() - job.createdAt).toBeLessThan(60_000)

    signOut()
    expect((await statusOf(job.id)).status).toBe(401)
    const download = await downloadOf(job.id)
    expect(download.status).toBe(401)
    expect(await download.text()).not.toContain('示範字幕')
  })

  it('AC-007 demo mode（未設定 Clerk）下沒有帶 API key 也是 401', async () => {
    const { record } = await createApiKey('demo-user-001', 'free')
    const job = await makeDoneJob({ apiKeyId: record.id })
    unconfigureClerk()
    expect((await statusOf(job.id)).status).toBe(401)
    expect((await downloadOf(job.id)).status).toBe(401)
  })

  it('AC-007 建立工作的 API key 可存取：200；另一把 API key：403；無效 key：401', async () => {
    const ownerKey = await createApiKey(uniqueUser('api-owner'), 'free')
    const otherKey = await createApiKey(uniqueUser('api-other'), 'free')
    const job = await makeDoneJob({ apiKeyId: ownerKey.record.id })

    const asOwner = { authorization: `Bearer ${ownerKey.plaintext}` }
    expect((await statusOf(job.id, asOwner)).status).toBe(200)
    expect((await downloadOf(job.id, asOwner)).status).toBe(200)

    const asOther = { authorization: `Bearer ${otherKey.plaintext}` }
    expect((await statusOf(job.id, asOther)).status).toBe(403)
    expect((await downloadOf(job.id, asOther)).status).toBe(403)

    const invalid = { authorization: 'Bearer hms_not-a-real-key' }
    expect((await statusOf(job.id, invalid)).status).toBe(401)
    expect((await downloadOf(job.id, invalid)).status).toBe(401)
  })

  it('AC-007 已登入使用者不能讀取以 API key 建立的他人工作：403', async () => {
    const ownerKey = await createApiKey(uniqueUser('api-owner'), 'free')
    const job = await makeDoneJob({ apiKeyId: ownerKey.record.id })
    signInAs(uniqueUser('intruder'))
    expect((await statusOf(job.id)).status).toBe(403)
    expect((await downloadOf(job.id)).status).toBe(403)
  })

  it('AC-007 authorizeOwner：沒有擁有者資訊的資源對任何人都不放行', () => {
    expect(authorizeOwner({ kind: 'user', userId: 'user_test_x' }, {}).allowed).toBe(false)
    expect(authorizeOwner({ kind: 'user', userId: 'user_test_x' }, { userId: null, apiKeyId: null }).allowed).toBe(false)
    expect(authorizeOwner({ kind: 'anonymous', reason: 'not-signed-in' }, { userId: 'user_test_x' })).toMatchObject({
      allowed: false,
      status: 401,
    })
  })
})

// ── 有聲書：自有內容聲明＋產出存取控制 ─────────────────────────────────────
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { POST as audiobookPost } from '@/app/api/audiobook/route'
import { GET as audiobookStatus } from '@/app/api/audiobook/[id]/route'
import { GET as audiobookDownload } from '@/app/api/audiobook/[id]/download/route'
import { getAudiobookJob } from '@/lib/audiobook/jobs'
import { getMockProvider } from '@/lib/tts/synthesis'
import { getMonthlyUsage } from '@/lib/billing/usage'
import { RIGHTS_STATEMENT_VERSION, isRightsConfirmed } from '@/lib/rights'
import { jsonRequest, uploadRequest } from '../helpers/http'

const BOOK = { name: '巷口的一天.txt', content: readFileSync(path.resolve(__dirname, '../fixtures/sample-book.txt')) }

describe('AC-007 使用者自有內容聲明（/api/audiobook）', () => {
  it('AC-007 未帶 rightsConfirmed 的上傳回 400，不解析、不合成、不扣量', async () => {
    const userId = uniqueUser('uploader')
    signInAs(userId)
    getMockProvider().reset()

    const res = await audiobookPost(uploadRequest('/api/audiobook', {}, BOOK))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('RIGHTS_NOT_CONFIRMED')
    expect(body.rights.version).toBe(RIGHTS_STATEMENT_VERSION)
    expect(body.rights.statement).toContain('僅限處理自有或已授權內容')
    expect(body.job_id).toBeUndefined()
    expect(getMockProvider().calls).toHaveLength(0)
    expect(await getMonthlyUsage(userId)).toBe(0)
  })

  it('AC-007 rightsConfirmed 不是 true（false、"1"、"yes"、空字串）一律 400', async () => {
    signInAs(uniqueUser('uploader'))
    for (const value of ['false', '1', 'yes', '', 'TRUE']) {
      const res = await audiobookPost(uploadRequest('/api/audiobook', { rightsConfirmed: value }, BOOK))
      expect(res.status, `rightsConfirmed=${JSON.stringify(value)}`).toBe(400)
      expect((await res.json()).code).toBe('RIGHTS_NOT_CONFIRMED')
    }
    // JSON 請求同樣檢查
    for (const value of [false, 1, 'yes', null, undefined]) {
      const res = await audiobookPost(jsonRequest('/api/audiobook', { rightsConfirmed: value, filename: 'a.txt', text: '第一章 甲\n內容。' }))
      expect(res.status).toBe(400)
    }
    expect(isRightsConfirmed(true)).toBe(true)
    expect(isRightsConfirmed('true')).toBe(true)
    expect(isRightsConfirmed(1)).toBe(false)
  })

  it('AC-007 聲明與時間戳記隨工作保存', async () => {
    signInAs(uniqueUser('uploader'))
    const before = Date.now()
    const res = await audiobookPost(
      jsonRequest('/api/audiobook', { rightsConfirmed: true, filename: 'note.txt', text: '第一章 甲\n這是自編內容。\n第二章 乙\n這也是。' }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.rights).toMatchObject({ confirmed: true, statementVersion: RIGHTS_STATEMENT_VERSION })

    const stored = await getAudiobookJob(body.job_id)
    expect(stored?.rights.confirmed).toBe(true)
    expect(stored?.rights.statementVersion).toBe(RIGHTS_STATEMENT_VERSION)
    const confirmedAt = Date.parse(stored!.rights.confirmedAt)
    expect(confirmedAt).toBeGreaterThanOrEqual(before - 1000)
    expect(confirmedAt).toBeLessThanOrEqual(Date.now() + 1000)
  })

  it('AC-007 匿名上傳（已設定 Clerk、未登入）：401，即使帶了聲明', async () => {
    signOut()
    const res = await audiobookPost(uploadRequest('/api/audiobook', { rightsConfirmed: 'true' }, BOOK))
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('NO_AUTH')
  })
})

describe('AC-007 產出存取控制（/api/audiobook/[id]）', () => {
  async function createJobAs(userId: string): Promise<string> {
    signInAs(userId)
    const res = await audiobookPost(uploadRequest('/api/audiobook', { rightsConfirmed: 'true' }, BOOK))
    expect(res.status).toBe(201)
    return (await res.json()).job_id
  }
  const status = (id: string, headers: Record<string, string> = {}) =>
    audiobookStatus(getRequest(`/api/audiobook/${id}`, headers), { params: { id } })
  const download = (id: string, query: string, headers: Record<string, string> = {}) =>
    audiobookDownload(getRequest(`/api/audiobook/${id}/download?${query}`, headers), { params: { id } })

  it('AC-007 擁有者：狀態與所有下載格式 200', async () => {
    const owner = uniqueUser('owner')
    const id = await createJobAs(owner)
    expect((await status(id)).status).toBe(200)
    for (const query of ['chapter=1&format=audio', 'chapter=1&format=srt', 'chapter=1&format=vtt', 'chapter=1&format=markers', 'format=manifest']) {
      expect((await download(id, query)).status, query).toBe(200)
    }
  })

  it('AC-007 他人 userId：狀態與下載 403，回應不含內容', async () => {
    const id = await createJobAs(uniqueUser('owner'))
    signInAs(uniqueUser('intruder'))
    const s = await status(id)
    expect(s.status).toBe(403)
    expect(JSON.stringify(await s.json())).not.toContain('巷口')
    for (const query of ['chapter=1&format=audio', 'chapter=1&format=srt', 'chapter=1&format=vtt', 'chapter=1&format=markers', 'format=manifest']) {
      const res = await download(id, query)
      expect(res.status, query).toBe(403)
      expect(await res.text()).not.toContain('豆漿')
    }
  })

  it('AC-007 匿名：狀態與下載 401（工作 ID 不是存取憑證）', async () => {
    const id = await createJobAs(uniqueUser('owner'))
    signOut()
    expect((await status(id)).status).toBe(401)
    expect((await download(id, 'chapter=1&format=audio')).status).toBe(401)
    expect((await download(id, 'format=manifest')).status).toBe(401)
    // 不存在的工作對匿名同樣是 401，不洩漏是否存在
    expect((await status('00000000-0000-4000-8000-000000000000')).status).toBe(401)
  })

  it('AC-007 以 API key 建立的工作：該 key 200、其他 key 403、已登入的其他使用者 403', async () => {
    const ownerKey = await createApiKey(uniqueUser('api-owner'), 'free')
    const otherKey = await createApiKey(uniqueUser('api-other'), 'free')
    signOut()
    const created = await audiobookPost(
      uploadRequest('/api/audiobook', { rightsConfirmed: 'true' }, BOOK, { authorization: `Bearer ${ownerKey.plaintext}` }),
    )
    expect(created.status).toBe(201)
    const id = (await created.json()).job_id as string

    const asOwner = { authorization: `Bearer ${ownerKey.plaintext}` }
    const asOther = { authorization: `Bearer ${otherKey.plaintext}` }
    expect((await status(id, asOwner)).status).toBe(200)
    expect((await download(id, 'chapter=1&format=audio', asOwner)).status).toBe(200)
    expect((await status(id, asOther)).status).toBe(403)
    expect((await download(id, 'chapter=1&format=audio', asOther)).status).toBe(403)
    expect((await status(id)).status).toBe(401)

    signInAs(uniqueUser('intruder'))
    expect((await status(id)).status).toBe(403)
  })

  it('AC-007 demo mode（未設定 Clerk）：工作屬於 demo 使用者；改為需登入的部署後匿名即無法讀取', async () => {
    unconfigureClerk()
    const created = await audiobookPost(uploadRequest('/api/audiobook', { rightsConfirmed: 'true' }, BOOK))
    expect(created.status).toBe(201)
    const id = (await created.json()).job_id as string
    expect((await getAudiobookJob(id))?.owner).toEqual({ userId: 'demo-user-001', apiKeyId: null })
    expect((await status(id)).status).toBe(200)

    signOut() // 已設定 Clerk、未登入
    expect((await status(id)).status).toBe(401)
    signInAs(uniqueUser('someone'))
    expect((await status(id)).status).toBe(403)
  })
})
