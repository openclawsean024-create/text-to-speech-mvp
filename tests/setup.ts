/**
 * 全域測試設定。
 *
 * 1. 離線：global.fetch 一律拋錯並記錄呼叫（AC-003：測試不得呼叫付費 TTS／任何外部 API）。
 * 2. Clerk：以可控的假 session 取代 `@clerk/nextjs/server`，測試用 tests/helpers/auth.ts 切換身分。
 * 3. 每個測試前清空環境中的引擎金鑰，避免本機 .env 影響結果。
 */
import { beforeEach, vi } from 'vitest'

type TestGlobals = typeof globalThis & {
  __FETCH_CALLS__: string[]
  __TEST_AUTH_USER_ID__: string | null
}
const g = globalThis as TestGlobals
g.__FETCH_CALLS__ = []
g.__TEST_AUTH_USER_ID__ = null

function blockedFetch(input: unknown): never {
  const url = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input)
  g.__FETCH_CALLS__.push(url)
  throw new Error(`[tests] 測試不得連網：fetch(${url}) 被呼叫`)
}
g.fetch = blockedFetch as unknown as typeof fetch

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: (globalThis as TestGlobals).__TEST_AUTH_USER_ID__ }),
  clerkMiddleware: () => () => undefined,
}))

const ENGINE_KEY_ENVS = [
  'OPENAI_API_KEY',
  'ELEVENLABS_API_KEY',
  'KOKORO_API_KEY',
  'INFERENCE_SH_API_KEY',
  'AZURE_SPEECH_KEY',
  'AZURE_API_KEY',
  'AZURE_SPEECH_REGION',
  'GOOGLE_TTS_API_KEY',
  'GOOGLE_API_KEY',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
]

beforeEach(() => {
  g.__FETCH_CALLS__.length = 0
  g.__TEST_AUTH_USER_ID__ = null
  g.fetch = blockedFetch as unknown as typeof fetch
  for (const name of ENGINE_KEY_ENVS) delete process.env[name]
  const env = process.env as Record<string, string | undefined>
  env.NODE_ENV = 'test'
  env.TTS_PROVIDER = 'mock'
  delete process.env.CLERK_SECRET_KEY
  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
})
