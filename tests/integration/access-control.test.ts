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
