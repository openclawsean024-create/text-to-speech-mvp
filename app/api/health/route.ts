import { NextResponse } from 'next/server'

export async function GET() {
  const engines = {
    openai: {
      available: !!process.env.OPENAI_API_KEY,
      envVar: 'OPENAI_API_KEY',
    },
    elevenlabs: {
      available: !!process.env.ELEVENLABS_API_KEY,
      envVar: 'ELEVENLABS_API_KEY',
    },
    kokoro: {
      available: !!process.env.KOKORO_API_KEY || !!process.env.INFERENCE_SH_API_KEY,
      envVar: 'KOKORO_API_KEY or INFERENCE_SH_API_KEY',
    },
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    engines,
    limits: {
      free: { requestsPerDay: 10 },
      starter: { requestsPerDay: 100 },
      pro: { requestsPerDay: 1000 },
    },
  })
}
