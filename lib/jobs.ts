/**
 * Job store + queue — F-001 through F-005 backbone
 *
 * Jobs are persisted to Vercel KV when available, falling back to in-memory.
 * Audio bytes are stored under R2-compatible keys (or locally on disk for dev).
 *
 * Job schema:
 * {
 *   id: string
 *   userId: string | null          // Clerk userId or API key owner
 *   apiKeyId: string | null        // For enterprise /api/v1/process
 *   status: 'queued' | 'running' | 'done' | 'failed'
 *   audioKey: string               // R2 key or local path
 *   filename: string
 *   durationSec: number            // Estimated from file size
 *   settings: { chapters, summary, subtitles, glossary }
 *   options: { webhookUrl, language }
 *   transcript: { segments, language } | null
 *   chapters: [{ title, startSec, endSec, key_points }] | null
 *   summary: { short, detailed, bullets } | null
 *   srt: string | null
 *   vtt: string | null
 *   epub: string | null
 *   webhookDelivered: boolean
 *   errorMsg: string | null
 *   createdAt: number
 *   finishedAt: number | null
 * }
 */

import { LIMITS } from './rate-limits'

// ── In-memory fallback ────────────────────────────────────────────────────
const inMemoryJobs = new Map<string, any>()

// ── Vercel KV (optional) ───────────────────────────────────────────────────
let kv: { get: Function; set: Function; del: Function } | null = null

function getKV() {
  if (kv) return kv
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null
  try {
    const { createClient } = require('@vercel/kv')
    kv = createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    })
    return kv
  } catch {
    return null
  }
}

const JOB_PREFIX = 'job:'
const USER_JOB_INDEX_PREFIX = 'user-jobs:'
const APIKEY_USAGE_PREFIX = 'apikey-usage:'

function jobKey(id: string) {
  return `${JOB_PREFIX}${id}`
}

function userJobsKey(userId: string) {
  return `${USER_JOB_INDEX_PREFIX}${userId}`
}

function apiKeyUsageKey(apiKeyId: string, monthKey: string) {
  return `${APIKEY_USAGE_PREFIX}${apiKeyId}:${monthKey}`
}

function monthKey() {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

function nowMs() {
  return Date.now()
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export interface JobSettings {
  chapters?: boolean
  summary?: boolean
  subtitles?: boolean
  epub?: boolean
  glossary?: string
  language?: string
}

export interface JobOptions {
  webhookUrl?: string
}

export interface JobSegment {
  start: number
  end: number
  text: string
  speaker?: string
}

export interface Chapter {
  title: string
  startSec: number
  endSec: number
  key_points: string[]
}

export interface Summary {
  short: string
  detailed: string
  bullets: string[]
  engine: string
}

export interface Job {
  id: string
  userId: string | null
  apiKeyId: string | null
  status: 'queued' | 'running' | 'done' | 'failed'
  audioKey: string
  filename: string
  mimeType: string
  fileSize: number
  durationSec: number
  settings: JobSettings
  options: JobOptions
  transcript: { segments: JobSegment[]; language: string; duration: number; engine: string } | null
  chapters: Chapter[] | null
  summary: Summary | null
  srt: string | null
  vtt: string | null
  epub: string | null
  webhookDelivered: boolean
  errorMsg: string | null
  createdAt: number
  finishedAt: number | null
  estimatedMinutes: number
}

export async function createJob(params: {
  userId: string | null
  apiKeyId: string | null
  audioKey: string
  filename: string
  mimeType: string
  fileSize: number
  durationSec: number
  settings: JobSettings
  options: JobOptions
}): Promise<Job> {
  const id = makeId()
  const job: Job = {
    id,
    userId: params.userId,
    apiKeyId: params.apiKeyId,
    status: 'queued',
    audioKey: params.audioKey,
    filename: params.filename,
    mimeType: params.mimeType,
    fileSize: params.fileSize,
    durationSec: params.durationSec,
    settings: params.settings,
    options: params.options,
    transcript: null,
    chapters: null,
    summary: null,
    srt: null,
    vtt: null,
    epub: null,
    webhookDelivered: false,
    errorMsg: null,
    createdAt: nowMs(),
    finishedAt: null,
    estimatedMinutes: Math.max(1, Math.ceil(params.durationSec / 60 * 0.3)), // ~3x realtime
  }

  const client = getKV()
  if (client) {
    await client.set(jobKey(id), JSON.stringify(job), { ex: 30 * 86400 })
    // Index by user
    const indexKey = params.userId ? userJobsKey(params.userId) : `apikey-jobs:${params.apiKeyId}`
    const existing = (await client.get(indexKey)) || []
    existing.unshift(id)
    await client.set(indexKey, existing.slice(0, 100), { ex: 30 * 86400 })
  } else {
    inMemoryJobs.set(id, job)
  }
  return job
}

export async function getJob(id: string): Promise<Job | null> {
  const client = getKV()
  if (client) {
    const v = await client.get(jobKey(id))
    return v ? JSON.parse(String(v)) : null
  }
  return inMemoryJobs.get(id) || null
}

export async function updateJob(id: string, patch: Partial<Job>): Promise<Job | null> {
  const existing = await getJob(id)
  if (!existing) return null
  const merged: Job = { ...existing, ...patch }
  const client = getKV()
  if (client) {
    await client.set(jobKey(id), JSON.stringify(merged), { ex: 30 * 86400 })
  } else {
    inMemoryJobs.set(id, merged)
  }
  return merged
}

export async function listJobsForUser(userId: string, limit = 50): Promise<Job[]> {
  const client = getKV()
  if (client) {
    const ids = (await client.get(userJobsKey(userId))) || []
    const jobs: Job[] = []
    for (const id of ids.slice(0, limit)) {
      const j = await getJob(String(id))
      if (j) jobs.push(j)
    }
    return jobs
  }
  return Array.from(inMemoryJobs.values())
    .filter((j) => j.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
}

export async function listJobsForApiKey(apiKeyId: string, limit = 50): Promise<Job[]> {
  const client = getKV()
  if (client) {
    const ids = (await client.get(`apikey-jobs:${apiKeyId}`)) || []
    const jobs: Job[] = []
    for (const id of ids.slice(0, limit)) {
      const j = await getJob(String(id))
      if (j) jobs.push(j)
    }
    return jobs
  }
  return Array.from(inMemoryJobs.values())
    .filter((j) => j.apiKeyId === apiKeyId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
}

// ── API key usage tracking (for tier-based limits) ─────────────────────────

export async function getApiKeyUsage(apiKeyId: string): Promise<{ usedSec: number; limitSec: number }> {
  const key = apiKeyUsageKey(apiKeyId, monthKey())
  const client = getKV()
  const usedSec = client
    ? Number(((await client.get(key)) ?? 0))
    : Number((inMemoryJobs.get(`__usage_${key}`) as any) || 0)
  // Default limit 200 hr / month (business tier default)
  return { usedSec, limitSec: 200 * 3600 }
}

export async function incrementApiKeyUsage(apiKeyId: string, seconds: number): Promise<{ usedSec: number; limitSec: number }> {
  const key = apiKeyUsageKey(apiKeyId, monthKey())
  const client = getKV()
  const usageKey = `__usage_${key}`
  if (client) {
    const current = Number(((await client.get(key)) ?? 0))
    const next = current + seconds
    await client.set(key, next, { ex: 31 * 86400 })
    return { usedSec: next, limitSec: 200 * 3600 }
  }
  const current = Number((inMemoryJobs.get(usageKey) as any) || 0)
  const next = current + seconds
  inMemoryJobs.set(usageKey, next)
  return { usedSec: next, limitSec: 200 * 3600 }
}

// ── Audio storage (R2 / local fallback) ────────────────────────────────────

const AUDIO_PREFIX = 'audio:'

export async function storeAudio(id: string, audio: Buffer, mimeType: string): Promise<string> {
  const key = `${AUDIO_PREFIX}${id}`
  const client = getKV()
  if (client) {
    // Vercel KV max value size ~ 100KB; audio >100KB needs Vercel Blob or R2
    // For now store small audio in KV (token-only Whisper transcriptions work)
    if (audio.length <= 100_000) {
      await client.set(key, audio.toString('base64'), { ex: 30 * 86400 })
    }
    return key
  }
  // Local in-memory fallback (not persistent)
  inMemoryJobs.set(`__audio_${id}`, { audio, mimeType })
  return key
}

export async function loadAudio(audioKey: string): Promise<{ audio: Buffer; mimeType: string } | null> {
  const client = getKV()
  if (client && audioKey.startsWith(AUDIO_PREFIX)) {
    const v = await client.get(audioKey)
    if (v) {
      return { audio: Buffer.from(String(v), 'base64'), mimeType: 'audio/mpeg' }
    }
  }
  const local = inMemoryJobs.get(`__audio_${audioKey}`)
  if (local) return local as { audio: Buffer; mimeType: string }
  return null
}

export { LIMITS }
