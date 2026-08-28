import { NextResponse } from 'next/server'
import { getCatalog } from '@/lib/tts-prompts'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const catalog = getCatalog()
    return NextResponse.json({
      ok: true,
      version: '3.0',
      ...catalog,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
