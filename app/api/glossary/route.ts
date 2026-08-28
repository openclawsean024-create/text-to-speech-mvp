import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getGlossary,
  setGlossary,
  addGlossaryWords,
  removeGlossaryWord,
  clearGlossary,
} from '@/lib/glossary'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { userId } = await auth().catch(() => ({ userId: null as string | null }))
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
    const glossary = await getGlossary(userId)
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
    const { userId } = await auth().catch(() => ({ userId: null as string | null }))
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required', code: 'NO_AUTH' }, { status: 401 })
    }
    const body = await req.json()
    const { action = 'set', words, word, tier = 'free' } = body

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
    return NextResponse.json({ ok: true, ...glossary })
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
