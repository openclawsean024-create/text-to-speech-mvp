import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUserApiKeys, setUserApiKey, deleteUserApiKey } from '@/lib/db'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const keys = await getUserApiKeys(userId)
  // Mask the keys for display
  const masked: Record<string, string | null> = {}
  for (const [engine, key] of Object.entries(keys)) {
    if (key && key.length > 8) {
      masked[engine] = key.slice(0, 4) + '****' + key.slice(-4)
    } else {
      masked[engine] = key ? '****' : null
    }
  }
  return NextResponse.json(masked)
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const { engine, apiKey } = body
  if (!engine || !['openai', 'elevenlabs', 'kokoro'].includes(engine)) {
    return NextResponse.json({ error: 'Invalid engine' }, { status: 400 })
  }
  if (typeof apiKey !== 'string' || apiKey.length < 8) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 400 })
  }
  await setUserApiKey(userId, engine, apiKey.trim())
  return NextResponse.json({ success: true, engine })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const engine = searchParams.get('engine')
  if (!engine || !['openai', 'elevenlabs', 'kokoro'].includes(engine)) {
    return NextResponse.json({ error: 'Invalid engine' }, { status: 400 })
  }
  await deleteUserApiKey(userId, engine)
  return NextResponse.json({ success: true, engine })
}
