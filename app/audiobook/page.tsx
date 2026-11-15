'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, Download, FileText, Loader } from 'lucide-react'
import { RIGHTS_STATEMENT, RIGHTS_STATEMENT_VERSION } from '@/lib/rights'

interface ChapterSummary {
  chapter: number
  title: string
  file_name: string
  duration_ms: number
  segment_count: number
  downloads: { audio: string; srt: string; vtt: string; markers: string }
}

interface JobSummary {
  job_id: string
  status: 'queued' | 'running' | 'done' | 'failed'
  book: { title: string; chapterCount: number; totalChars: number }
  settings: { mock: boolean }
  progress: { percent: number; completedChapters: number; totalChapters: number; totalSegments: number }
  billing: { plan: string; billableChars: number; billedChars: number }
  chapters: ChapterSummary[]
  manifest_url: string
  error_msg: string | null
  storage_note: string
}

interface ServiceInfo {
  mode: 'mock' | 'unavailable'
  limits: { max_file_bytes: number; max_chars_mock_mode: number }
}

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * 電子書 → 有聲書（M1：測試模式／Mock TTS）。
 * 上傳前必須勾選「僅限自有內容」聲明；產出只有擁有者可以下載。
 */
export default function AudiobookPage() {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<JobSummary | null>(null)
  const [info, setInfo] = useState<ServiceInfo | null>(null)

  useEffect(() => {
    fetch('/api/audiobook')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setInfo(data))
      .catch(() => setInfo(null))
  }, [])

  const canSubmit = Boolean(file) && rightsConfirmed && !submitting

  const submit = async () => {
    if (!file || !rightsConfirmed) return
    setSubmitting(true)
    setError(null)
    setJob(null)
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('rightsConfirmed', 'true')
      if (title.trim()) form.set('title', title.trim())
      const res = await fetch('/api/audiobook', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (data.job_id) setJob(data as JobSummary)
      if (!res.ok) setError(data.error || `轉換失敗（HTTP ${res.status}）`)
    } catch {
      setError('無法連線到伺服器，請稍後再試。')
    }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="header-glass sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <h1 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
            <BookOpen size={14} className="inline mr-1" /> 電子書轉有聲書
          </h1>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="btn-secondary text-xs">本月用量</Link>
            <Link href="/" className="btn-ghost text-xs">← 首頁</Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 space-y-5">
        <div className="toast info text-sm">
          目前為測試模式：語音由內建的 Mock 引擎產生（示意音，非真人語音），用來驗證「章節 → 逐章音檔 → 字幕」流程。
          {info && ` 單本上限 ${info.limits.max_chars_mock_mode.toLocaleString()} 字。`}
          {info?.mode === 'unavailable' && ' 這個部署未啟用測試模式，暫時無法轉換。'}
        </div>

        <div className="glass-card p-6 space-y-4">
          <div>
            <span className="label"><FileText size={14} className="inline" /> 選擇檔案（TXT、EPUB、文字型 PDF，最大 50MB）</span>
            <input
              type="file"
              accept=".txt,.epub,.pdf"
              aria-label="電子書檔案"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
              style={{ color: 'var(--text-2)' }}
            />
          </div>

          <div>
            <label className="label" htmlFor="book-title">書名（選填，用於輸出檔名）</label>
            <input
              id="book-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="未填寫時使用檔名或 EPUB 內的書名"
              className="w-full rounded-xl px-3 py-2 text-sm"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>

          <label className="flex items-start gap-3 text-sm cursor-pointer" style={{ color: 'var(--text-2)' }}>
            <input
              type="checkbox"
              checked={rightsConfirmed}
              onChange={(e) => setRightsConfirmed(e.target.checked)}
              className="mt-1"
            />
            <span>
              <strong style={{ color: 'var(--text)' }}>僅限自有內容聲明</strong>
              <br />
              {RIGHTS_STATEMENT}
              <span className="block text-xs mt-1" style={{ color: 'var(--text-3)' }}>聲明版本 {RIGHTS_STATEMENT_VERSION}；勾選時間會與這次轉換一起保存。</span>
            </span>
          </label>

          <button onClick={submit} disabled={!canSubmit} className="btn-primary w-full" style={{ opacity: canSubmit ? 1 : 0.5 }}>
            {submitting ? <><Loader size={14} className="inline animate-spin mr-1" /> 轉換中…</> : '開始轉換'}
          </button>
          {!rightsConfirmed && file && (
            <div className="text-xs" style={{ color: 'var(--text-3)' }}>請先勾選上方聲明才能開始轉換。</div>
          )}
        </div>

        {error && <div className="toast error text-sm" role="alert">{error}</div>}

        {job && (
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold" style={{ color: 'var(--text)' }}>{job.book.title}</div>
                <div className="text-xs" style={{ color: 'var(--text-3)' }}>
                  {job.status === 'done' ? '轉換完成' : job.status === 'failed' ? '轉換失敗（保留已完成的章節）' : '轉換中'}
                  ・{job.progress.completedChapters}/{job.progress.totalChapters} 章・{job.progress.totalSegments} 個片段
                  ・計費 {job.billing.billedChars.toLocaleString()} 字（{job.billing.plan} 方案）
                </div>
              </div>
              <a href={job.manifest_url} className="btn-secondary text-xs">章節標記 JSON</a>
            </div>

            <div className="progress-bar" aria-label="轉換進度">
              <div className="progress-bar-fill" style={{ width: `${job.progress.percent}%` }} />
            </div>

            <ul className="space-y-2">
              {job.chapters.map((c) => (
                <li key={c.chapter} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl text-sm"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                  <span>
                    {c.title}
                    <span className="text-xs ml-2" style={{ color: 'var(--text-3)' }}>{formatDuration(c.duration_ms)}・{c.file_name}</span>
                  </span>
                  <span className="flex gap-2">
                    <a href={c.downloads.audio} className="btn-secondary text-xs"><Download size={12} className="inline" /> 音檔</a>
                    <a href={c.downloads.srt} className="btn-ghost text-xs">SRT</a>
                    <a href={c.downloads.vtt} className="btn-ghost text-xs">VTT</a>
                  </span>
                </li>
              ))}
            </ul>
            <div className="text-xs" style={{ color: 'var(--text-3)' }}>{job.storage_note} 只有你本人可以下載這些檔案。</div>
          </div>
        )}
      </main>
    </div>
  )
}
