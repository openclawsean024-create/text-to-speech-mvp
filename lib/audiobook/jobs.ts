/**
 * 有聲書工作紀錄（M1）。
 *
 * - 工作中繼資料（狀態、進度、權利聲明、章節標記、字幕）存於 KV（未設定時為記憶體）。
 * - 【音檔只暫存在程序記憶體】：M1 為測試模式（Mock），私有物件儲存與背景佇列屬 M2。
 *   程序重啟或 serverless cold start 後音檔即消失，下載端點會回 410。
 * - 上傳的原始檔與內文不保存：解析、合成後即丟棄，工作紀錄只留書名、章節標題與字幕。
 * - 工作一律有擁有者；讀取與下載必須通過 lib/access-control.ts（AC-007）。
 * - 保留期間暫定 24 小時（【待 Sean 定案】，SPEC §14-5）。
 */

import crypto from 'node:crypto'
import { getStore } from '@/lib/kv-store'
import type { RightsRecord } from '@/lib/rights'
import type { BookChapterMarker, ChapterOutput, ConversionProgress } from './pipeline'

export const AUDIOBOOK_JOB_TTL_SEC = 24 * 3600

export interface AudiobookChapterRecord extends Omit<ChapterOutput, 'audio'> {
  audioBytes: number
}

export interface AudiobookJob {
  id: string
  owner: { userId: string | null; apiKeyId: string | null }
  status: 'queued' | 'running' | 'done' | 'failed'
  rights: RightsRecord
  book: {
    title: string
    slug: string
    author: string | null
    fileType: 'epub' | 'pdf' | 'txt'
    filename: string
    totalChars: number
    chapterCount: number
  }
  settings: { engine: string; voice: string; speed: number; mock: boolean; provider: string | null }
  progress: ConversionProgress
  billing: { plan: string; billableChars: number; billedChars: number }
  chapters: AudiobookChapterRecord[]
  chapterMarkers: BookChapterMarker[]
  errorMsg: string | null
  createdAt: number
  finishedAt: number | null
  expiresAt: number
}

const jobKey = (id: string) => `audiobook:job:${id}`
const audioKey = (id: string, chapterNumber: number) => `${id}:${chapterNumber}`

/** M1：音檔只在記憶體（見檔頭說明）。 */
const audioMemory = new Map<string, { bytes: Uint8Array; expiresAt: number }>()

export type NewAudiobookJob = Omit<AudiobookJob, 'id' | 'createdAt' | 'finishedAt' | 'expiresAt' | 'chapters' | 'chapterMarkers' | 'errorMsg'>

export async function createAudiobookJob(input: NewAudiobookJob, now: number = Date.now()): Promise<AudiobookJob> {
  const job: AudiobookJob = {
    ...input,
    id: crypto.randomUUID(),
    chapters: [],
    chapterMarkers: [],
    errorMsg: null,
    createdAt: now,
    finishedAt: null,
    expiresAt: now + AUDIOBOOK_JOB_TTL_SEC * 1000,
  }
  await getStore().set(jobKey(job.id), job, { ex: AUDIOBOOK_JOB_TTL_SEC })
  return job
}

export async function getAudiobookJob(id: string): Promise<AudiobookJob | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  return getStore().get<AudiobookJob>(jobKey(id))
}

export async function saveAudiobookJob(job: AudiobookJob): Promise<void> {
  const remainingSec = Math.max(60, Math.ceil((job.expiresAt - Date.now()) / 1000))
  await getStore().set(jobKey(job.id), job, { ex: remainingSec })
}

export function toChapterRecord(output: ChapterOutput): AudiobookChapterRecord {
  const { audio, ...rest } = output
  return { ...rest, audioBytes: audio.length }
}

export function storeChapterAudio(job: AudiobookJob, output: ChapterOutput): void {
  audioMemory.set(audioKey(job.id, output.chapterNumber), { bytes: output.audio, expiresAt: job.expiresAt })
}

export function loadChapterAudio(jobId: string, chapterNumber: number): Uint8Array | null {
  const entry = audioMemory.get(audioKey(jobId, chapterNumber))
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    audioMemory.delete(audioKey(jobId, chapterNumber))
    return null
  }
  return entry.bytes
}

/** 清掉已過期的音檔（每次建立工作時順手執行）。 */
export function sweepExpiredAudio(now: number = Date.now()): void {
  for (const [key, entry] of audioMemory) {
    if (entry.expiresAt <= now) audioMemory.delete(key)
  }
}

/** 對外回應用：不含章內片段標記與字幕全文（另由下載端點提供）。 */
export function summarizeJob(job: AudiobookJob) {
  const base = `/api/audiobook/${job.id}/download`
  return {
    job_id: job.id,
    status: job.status,
    book: job.book,
    settings: job.settings,
    progress: job.progress,
    billing: job.billing,
    rights: job.rights,
    chapters: job.chapters.map((c) => ({
      chapter: c.chapterNumber,
      title: c.title,
      file_name: c.fileName,
      base_name: c.baseName,
      content_type: c.contentType,
      duration_ms: c.durationMs,
      start_ms: c.startMs,
      end_ms: c.endMs,
      segment_count: c.segmentCount,
      audio_bytes: c.audioBytes,
      id3: c.id3,
      downloads: {
        audio: `${base}?chapter=${c.chapterNumber}&format=audio`,
        srt: `${base}?chapter=${c.chapterNumber}&format=srt`,
        vtt: `${base}?chapter=${c.chapterNumber}&format=vtt`,
        markers: `${base}?chapter=${c.chapterNumber}&format=markers`,
      },
    })),
    chapter_markers: job.chapterMarkers,
    manifest_url: `${base}?format=manifest`,
    error_msg: job.errorMsg,
    created_at: job.createdAt,
    finished_at: job.finishedAt,
    expires_at: job.expiresAt,
    storage_note: 'M1 測試模式：音檔僅暫存於伺服器記憶體，請在轉換完成後立即下載。',
  }
}
