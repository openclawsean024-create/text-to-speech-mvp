import { NextRequest, NextResponse } from 'next/server'
import { resolveIdentity } from '@/lib/identity'
import { authorizeOwner } from '@/lib/access-control'
import { getAudiobookJob, summarizeJob } from '@/lib/audiobook/jobs'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: { id: string }
}

/** 有聲書工作狀態與進度。只允許擁有者讀取（AC-007）。 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const identity = await resolveIdentity(req, { allowApiKey: true })
  if (identity.kind === 'anonymous') {
    const denied = authorizeOwner(identity, {})
    if (denied.allowed === false) {
      return NextResponse.json({ error: denied.error, code: denied.code }, { status: denied.status })
    }
  }

  const job = await getAudiobookJob(params.id)
  if (!job) {
    return NextResponse.json({ error: 'Job not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const decision = authorizeOwner(identity, job.owner)
  if (decision.allowed === false) {
    return NextResponse.json({ error: decision.error, code: decision.code }, { status: decision.status })
  }

  return NextResponse.json({ ok: true, ...summarizeJob(job) }, { headers: { 'Cache-Control': 'private, no-store' } })
}
