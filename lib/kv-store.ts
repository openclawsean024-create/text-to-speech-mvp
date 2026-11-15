/**
 * 共用 key-value 儲存層（M1 新模組使用）。
 *
 * - 有設定 `KV_REST_API_URL`／`KV_REST_API_TOKEN` 時使用 Vercel KV。
 * - 未設定時使用程序內記憶體（demo mode；重啟或 cold start 即遺失，不可用於正式計費）。
 *
 * 既有模組（lib/db.ts、lib/jobs.ts…）各自有一份相同邏輯，M1 不重構它們。
 */

export interface SetOptions {
  /** 存活秒數。 */
  ex?: number
}

export interface KeyValueStore {
  readonly kind: 'vercel-kv' | 'memory'
  get<T = unknown>(key: string): Promise<T | null>
  set(key: string, value: unknown, opts?: SetOptions): Promise<void>
  del(key: string): Promise<void>
  /** 原子性加減整數，回傳更新後的值。 */
  incrby(key: string, delta: number, opts?: SetOptions): Promise<number>
}

interface MemoryEntry {
  value: unknown
  expiresAt: number | null
}

const memory = new Map<string, MemoryEntry>()

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T)
}

function readMemory(key: string): unknown | null {
  const entry = memory.get(key)
  if (!entry) return null
  if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
    memory.delete(key)
    return null
  }
  return entry.value
}

const memoryStore: KeyValueStore = {
  kind: 'memory',
  async get<T>(key: string) {
    const value = readMemory(key)
    return value === null ? null : (clone(value) as T)
  },
  async set(key, value, opts) {
    memory.set(key, {
      value: clone(value),
      expiresAt: opts?.ex ? Date.now() + opts.ex * 1000 : null,
    })
  },
  async del(key) {
    memory.delete(key)
  },
  async incrby(key, delta, opts) {
    const current = Number(readMemory(key) ?? 0)
    const next = current + delta
    const existing = memory.get(key)
    memory.set(key, {
      value: next,
      expiresAt: existing?.expiresAt ?? (opts?.ex ? Date.now() + opts.ex * 1000 : null),
    })
    return next
  },
}

interface VercelKvClient {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown, opts?: { ex: number }): Promise<unknown>
  del(key: string): Promise<unknown>
  incrby(key: string, delta: number): Promise<number>
  expire(key: string, seconds: number): Promise<unknown>
}

let kvClient: VercelKvClient | null = null

function getVercelKv(): VercelKvClient | null {
  if (kvClient) return kvClient
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@vercel/kv')
    kvClient = createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    }) as VercelKvClient
    return kvClient
  } catch {
    return null
  }
}

function wrapVercelKv(client: VercelKvClient): KeyValueStore {
  return {
    kind: 'vercel-kv',
    async get<T>(key: string) {
      const value = await client.get(key)
      return (value ?? null) as T | null
    },
    async set(key, value, opts) {
      if (opts?.ex) await client.set(key, value, { ex: opts.ex })
      else await client.set(key, value)
    },
    async del(key) {
      await client.del(key)
    },
    async incrby(key, delta, opts) {
      const next = await client.incrby(key, delta)
      if (opts?.ex) await client.expire(key, opts.ex)
      return next
    },
  }
}

export function getStore(): KeyValueStore {
  const client = getVercelKv()
  return client ? wrapVercelKv(client) : memoryStore
}

/** 僅供測試：清空記憶體後備儲存。 */
export function resetMemoryStoreForTests(): void {
  memory.clear()
  kvClient = null
}
