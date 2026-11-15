import { NextRequest, NextResponse } from 'next/server'
import { resolveIdentity } from '@/lib/identity'
import { getEffectiveTier } from '@/lib/subscriptions'
import {
  getGlossary,
  setGlossary,
  addGlossaryWords,
  removeGlossaryWord,
  clearGlossary,
} from '@/lib/glossary'

export const dynamic = 'force-dynamic'

/**
 * 個人詞彙表（FR-023）——只用於 Whisper 逐字稿提示，【不影響 TTS 發音】。
 * TTS 發音校正請用 /api/lexicon（FR-011，lib/lexicon）；兩者資料與 KV 前綴完全分開。
 *
 * tier 一律由伺服器端依訂閱紀錄決定，不採信用戶端傳入的 tier（AC-008）。
 */
async function sessionUserId(): Promise<string | null> {
  // 詞彙表需要真實登入；demo 使用者不寫入（沿用既有行為）
  const identity = await resolveIdentity(null, { allowDemo: false })
  return identity.kind === 'user' ? identity.userId : null
}

export async function GET() {
  try {
    const userId = await sessionUserId()
    if (!userId) {
      // Demo mode — return empty public glossary
      return NextResponse.json({
        ok: true,
        userId: null,
        words: [],
        limit: 20,
        updatedAt: null,
        demo: true,
      })
    }
    const tier = await getEffectiveTier(userId)
    const glossary = await getGlossary(userId, tier)
    return NextResponse.json({
      ok: true,
      userId,
      ...glossary,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await sessionUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required', code: 'NO_AUTH' }, { status: 401 })
    }
    const body = await req.json()
    // 注意：body.tier 不採信（AC-008）
    const { action = 'set', words, word } = body
    const tier = await getEffectiveTier(userId)

    let glossary
    switch (action) {
      case 'set':
        if (!Array.isArray(words)) {
          return NextResponse.json({ error: 'words must be an array', code: 'BAD_INPUT' }, { status: 400 })
        }
        glossary = await setGlossary(userId, words, tier)
        break
      case 'add':
        if (!Array.isArray(words)) {
          return NextResponse.json({ error: 'words must be an array', code: 'BAD_INPUT' }, { status: 400 })
        }
        glossary = await addGlossaryWords(userId, words, tier)
        break
      case 'remove':
        if (!word || typeof word !== 'string') {
          return NextResponse.json({ error: 'word required', code: 'BAD_INPUT' }, { status: 400 })
        }
        glossary = await removeGlossaryWord(userId, word, tier)
        break
      case 'clear':
        glossary = await clearGlossary(userId, tier)
        break
      default:
        return NextResponse.json({ error: 'Unknown action: ' + action, code: 'BAD_INPUT' }, { status: 400 })
    }
    return NextResponse.json({ ok: true, tier, ...glossary })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse('', {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
