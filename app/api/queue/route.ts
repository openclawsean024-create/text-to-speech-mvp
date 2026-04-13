import { NextRequest, NextResponse } from 'next/server'

// In-memory queue state (resets on cold start in serverless — queue also persisted in localStorage client-side)
interface QueueTask {
  id: string
  text: string
  language: string
  voice: string
  format: 'mp3' | 'wav'
  status: 'pending' | 'processing' | 'done' | 'failed'
  createdAt: number
  result?: {
    audioUrl?: string
    contentType?: string
    error?: string
    isChunked?: boolean
    totalChunks?: number
  }
}

const MAX_QUEUE_SIZE = 10

// Module-level store (serverless: resets per function instance)
// For persistence across requests in the same instance, we keep it in memory.
let queueStore: QueueTask[] = []

export async function GET() {
  return NextResponse.json({
    tasks: queueStore,
    count: queueStore.length,
    maxSize: MAX_QUEUE_SIZE,
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, text, language, voice, format = 'mp3' } = body

    if (!id || !text) {
      return NextResponse.json({ error: 'id and text are required' }, { status: 400 })
    }

    if (queueStore.length >= MAX_QUEUE_SIZE) {
      return NextResponse.json({ error: 'Queue is full (max 10 tasks)' }, { status: 409 })
    }

    // Prevent duplicates
    if (queueStore.find(t => t.id === id)) {
      return NextResponse.json({ error: 'Task with this ID already exists' }, { status: 409 })
    }

    const task: QueueTask = {
      id,
      text,
      language: language || 'zh-CN',
      voice: voice || 'zh-CN',
      format: format === 'wav' ? 'wav' : 'mp3',
      status: 'pending',
      createdAt: Date.now(),
    }

    queueStore.push(task)

    return NextResponse.json({
      task,
      queueSize: queueStore.length,
      maxSize: MAX_QUEUE_SIZE,
    }, {
      status: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to add task: ${message}` }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 })
    }

    const index = queueStore.findIndex(t => t.id === id)
    if (index === -1) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    queueStore.splice(index, 1)

    return NextResponse.json({
      removed: id,
      queueSize: queueStore.length,
      maxSize: MAX_QUEUE_SIZE,
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to remove task: ${message}` }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse('', {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
