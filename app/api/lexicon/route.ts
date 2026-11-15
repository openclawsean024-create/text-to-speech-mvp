import { NextRequest, NextResponse } from 'next/server'
import { resolveIdentity, identityUserId } from '@/lib/identity'
import { resolveServerPlan } from '@/lib/billing/plans'
import {
  LexiconValidationError,
  clearUserEntries,
  getSystemEntries,
  getUserEntries,
  removeUserEntry,
  upsertUserEntries,
} from '@/lib/lexicon'

export const dynamic = 'force-dynamic'

/**
 * 繁中發音校正詞庫 API（FR-011；GOAL AC-006）。
 * 與 /api/glossary（Whisper 逐字稿詞彙表）無關，資料分開存放。
 * Clerk 未設定時使用 demo 使用者；詞條上限依伺服器端方案決定。
 */
async function owner(req: NextRequest) {
  const identity = await resolveIdentity(req)
  return { identity, userId: identityUserId(identity) }
}

const unauthorized = () => NextResponse.json({ error: 'Authentication required', code: 'NO_AUTH' }, { status: 401 })

export async function GET(req: NextRequest) {
  const { identity, userId } = await owner(req)
  if (!userId) return unauthorized()
  const plan = await resolveServerPlan(identity)
  return NextResponse.json({
    ok: true,
    demo: identity.kind === 'demo',
    limit: plan.lexiconEntryLimit,
    system: getSystemEntries(),
    user: await getUserEntries(userId),
    note: '使用者詞條與系統詞條原詞相同時，以使用者詞條為準。',
  })
}

/** body：{ entries: [{ term, replacement, pinyin?, zhuyin? }] } 或單筆 { term, replacement, ... } */
export async function POST(req: NextRequest) {
  const { identity, userId } = await owner(req)
  if (!userId) return unauthorized()
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON', code: 'BAD_INPUT' }, { status: 400 })
  const raw = Array.isArray(body.entries) ? body.entries : [body]
  if (raw.length === 0) return NextResponse.json({ error: 'entries 不可為空', code: 'BAD_INPUT' }, { status: 400 })

  const plan = await resolveServerPlan(identity)
  try {
    const user = await upsertUserEntries(userId, raw, plan.lexiconEntryLimit)
    return NextResponse.json({ ok: true, limit: plan.lexiconEntryLimit, user })
  } catch (err) {
    if (err instanceof LexiconValidationError) {
      return NextResponse.json({ error: err.message, code: 'BAD_ENTRY' }, { status: 400 })
    }
    throw err
  }
}

/** ?term=原詞 刪除一筆；?all=1 清空自訂詞條。系統詞條不可刪除。 */
export async function DELETE(req: NextRequest) {
  const { userId } = await owner(req)
  if (!userId) return unauthorized()
  const params = req.nextUrl.searchParams
  if (params.get('all') === '1') {
    await clearUserEntries(userId)
    return NextResponse.json({ ok: true, user: [] })
  }
  const term = params.get('term')
  if (!term) return NextResponse.json({ error: 'term query param required', code: 'BAD_INPUT' }, { status: 400 })
  const removed = await removeUserEntry(userId, term)
  if (!removed) return NextResponse.json({ error: '找不到這個自訂詞條', code: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ ok: true, user: await getUserEntries(userId) })
}
