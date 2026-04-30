'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useClerkUser, isClerkConfigured } from '@/hooks/useClerk'
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs'
import { useLocale } from '@/contexts/LangContext'
import { useQueue, BatchTask } from '@/contexts/QueueContext'
import { useVoiceContext } from '@/contexts/VoiceContext'
import { VOICES as NEW_VOICES, LANGUAGE_LABELS } from '@/lib/voices'
import VoiceSelector from '@/components/VoiceSelector'
import BatchQueue from '@/components/BatchQueue'
import {
  Sparkles, Zap, BarChart3, Globe, Bot, CreditCard, FolderOpen,
  FileText, Volume2, Clock, Boxes, Pen, Music, Loader, Download, Share2,
  ScrollText, Lightbulb, Mic, Headphones, Volume, Rocket, Link2,
  List, Layers, PlusCircle, Server, X,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function HomePage() {
  const { user, isLoaded } = useClerkUser()
  const [clerkConfigured, setClerkConfigured] = useState(false)

  const { locale, setLocale, t } = useLocale()
  const { tasks, addTask, removeTask, clearQueue: clearQueueCtx, processing, startProcessing, overallProgress, completedCount, failedCount } = useQueue()

  const [mode, setMode] = useState<'browser' | 'api'>('browser')
  const [engine, setEngine] = useState('openai')
  const [plan, setPlan] = useState('free')
  const [voice, setVoice] = useState('zh-CN')
  const [text, setText] = useState('')
  const [speed, setSpeed] = useState(1)
  const [pitch, setPitch] = useState(0)
  const [volume, setVolume] = useState(1)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [isConverting, setIsConverting] = useState(false)
  const [status, setStatus] = useState<{ msg: string; type: 'info' | 'error' | 'success' } | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [history, setHistory] = useState<{ text: string; time: string; mode: string }[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [downloadFormat, setDownloadFormat] = useState<'mp3' | 'wav'>('mp3')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [isSharing, setIsSharing] = useState(false)
  const [chunkProgress, setChunkProgress] = useState<{ current: number; total: number } | null>(null)
  const [isMerging, setIsMerging] = useState(false)

  // Batch mode state
  const [pageMode, setPageMode] = useState<'single' | 'batch'>('single')
  const [batchText, setBatchText] = useState('')
  const [batchVoice, setBatchVoice] = useState('zh-CN')
  const [batchFormat, setBatchFormat] = useState<'mp3' | 'wav'>('mp3')

  const showStatus = (msg: string, type: 'info' | 'error' | 'success') => {
    setStatus({ msg, type })
    setTimeout(() => setStatus(null), 5000)
  }

  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const allowed = ['txt', 'srt', 'vtt', 'lrc', 'epub', 'pdf', 'docx']
    if (!allowed.includes(ext)) {
      showStatus(t('status.unsupported').replace('{ext}', ext), 'error')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      showStatus(t('status.fileLarge'), 'error')
      return
    }
    showStatus(t('status.extracting'), 'info')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/extract-text', { method: 'POST', body: formData })
      let data
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        data = await res.json()
      } else {
        const text = await res.text()
        data = { error: text || 'Server error (file too large or unsupported format)' }
      }
      if (!res.ok) throw new Error(data.error || 'Extraction failed')
      setText(data.text)
      showStatus(t('status.extracted').replace('{count}', data.charCount.toLocaleString()).replace('{filename}', data.filename), 'success')
    } catch (e: unknown) {
      showStatus(`${t('status.fileError')}: ` + (e instanceof Error ? e.message : String(e)), 'error')
    }
  }

  const charCount = text.length
  const estimatedSeconds = Math.max(1, Math.round(charCount / 6 / speed))
  const chunks = Math.max(1, Math.ceil(charCount / 5000))
  // File size estimation: MP3 ~12KB/1000chars (96kbps), WAV ~88KB/1000chars (44100Hz 16-bit stereo)
  const estimatedMp3KB = Math.round(charCount / 1000 * 12)
  const estimatedWavKB = Math.round(charCount / 1000 * 88)
  const selectedEstKB = downloadFormat === 'wav' ? estimatedWavKB : estimatedMp3KB

  // Check if Clerk is configured
  useEffect(() => {
    setClerkConfigured(isClerkConfigured())
  }, [])

  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`tts_settings_${(user as any)?.id || 'anonymous'}`)
      if (saved) {
        const s = JSON.parse(saved)
        setEngine(s.engine || 'openai')
        setPlan(s.plan || 'free')
        setVoice(s.voice || 'zh-CN')
        setApiKeyInput('')
      }
    }
  }, [user])

  const persistSettings = useCallback(() => {
    if (user) {
      localStorage.setItem(`tts_settings_${(user as any)?.id || 'anonymous'}`, JSON.stringify({ engine, plan, voice }))
    }
  }, [user, engine, plan, voice])

  const handleConvert = async () => {
    if (!text.trim()) { showStatus(t('status.noText'), 'error'); return }
    if (mode === 'api' && !user) { showStatus(t('status.loginRequired'), 'error'); return }

    setAppState('generating')
    setProgress(0)
    setAudioUrl(null)
    setStatus(null)
    try {
      if (mode === 'browser') {
        await convertBrowser()
      } else {
        await convertAPI()
      }
    } catch (e: unknown) {
      showStatus(`${t('status.error')}: ` + (e instanceof Error ? e.message : String(e)), 'error')
      setAppState('idle')
    } finally {
      setIsConverting(false)
    }
    if (appState === 'generating') setAppState('complete')
  }

  const convertBrowser = async () => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = speed
    utterance.pitch = 1 + pitch * 0.5
    utterance.volume = volume
    const voices = window.speechSynthesis.getVoices()
    const targetLang = voice.replace('-male', '')
    const voiceObj = voices.find(v => v.lang.includes(targetLang.split('-')[0]))
    if (voiceObj) utterance.voice = voiceObj

    utterance.onboundary = (e) => {
      if (e.name === 'word') setProgress(Math.min((e.charIndex / text.length) * 95, 95))
    }
    utterance.onend = () => { setProgress(100); setAppState('complete'); spawnNotes() }
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    showStatus(t('status.playing'), 'success')
  }

  const convertAPI = async () => {
    if (!user) { showStatus(t('status.loginRequired'), 'error'); return }

    setChunkProgress(null)
    setIsMerging(false)

    const body: Record<string, unknown> = { text, engine, voice, speed, plan, format: downloadFormat }
    if (apiKeyInput.trim()) body.apiKey = apiKeyInput.trim()

    // Show chunking info if text is large
    const totalChars = text.trim().length
    const estimatedChunks = Math.max(1, Math.ceil(totalChars / 5000))
    if (totalChars > 5000) {
      setChunkProgress({ current: 0, total: estimatedChunks })
      showStatus(`超大檔案：自動拆分為 ${estimatedChunks} 個片段處理中...`, 'info')
    }

    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      let msg = `HTTP ${res.status}`
      let errCode = ''
      try {
        const ct = res.headers.get('content-type') || ''
        if (ct.includes('application/json')) {
          const err = await res.json()
          msg = err.error || err.message || msg
          errCode = err.code || ''
        }
      } catch (_) {}
      setChunkProgress(null)

      // Show user-friendly guidance based on error code
      if (res.status === 429) {
        msg = `使用量已達上限（${plan} 方案：${t('nav.pricing')}），請明天再試或升級方案`
      } else if (res.status === 401 || errCode === 'INVALID_API_KEY') {
        msg = 'API Key 無效，請至控制台更新你的 API Key'
      } else if (res.status === 402 || errCode === 'QUOTA_EXCEEDED') {
        msg = 'API 配額已用盡，請在 providers 網站確認用量或聯絡客服'
      } else if (res.status === 400 && errCode === 'NO_API_KEY') {
        msg = `尚未設定 ${engine} API Key，請至控制台新增或直接在上方輸入`
      }
      throw new Error(msg)
    }

    const isChunked = res.headers.get('X-TTS-Chunked') === 'true'
    const totalChunks = parseInt(res.headers.get('X-TTS-Total-Chunks') || '1', 10)

    if (isChunked && totalChunks > 1) {
      setIsMerging(true)
      setChunkProgress({ current: totalChunks, total: totalChunks })
      showStatus('合併中...', 'info')
    } else {
      setChunkProgress(null)
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    setAudioUrl(url)
    setProgress(100)
    setAppState('complete')
    spawnNotes()
    setChunkProgress(null)
    setIsMerging(false)
    showStatus(t('status.complete').replace('{engine}', engine.toUpperCase()), 'success')

    const item = { text: text.slice(0, 50) + (text.length > 50 ? '…' : ''), time: new Date().toLocaleString('zh-TW'), mode: engine }
    setHistory(prev => [item, ...prev.slice(0, 9)])
    persistSettings()
  }

  const downloadAudio = async () => {
    if (!audioUrl) return
    try {
      const a = document.createElement('a')
      a.href = audioUrl
      a.download = `tts-output-${Date.now()}.${downloadFormat}`
      a.click()
      showStatus(t('status.downloadStart'), 'success')
    } catch {
      showStatus('下載失敗，請稍後再試', 'error')
    }
  }

  const convertToWav = async (blobUrl: string): Promise<string> => {
    // Client-side WAV conversion via Web Audio API — used when browser-side TTS returns MP3 blob
    return new Promise((resolve, reject) => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      fetch(blobUrl)
        .then(res => res.arrayBuffer())
        .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
          // WAV encoding: interleaved PCM
          const numChannels = audioBuffer.numberOfChannels
          const sampleRate = audioBuffer.sampleRate
          const bitsPerSample = 16
          const bytesPerSample = bitsPerSample / 8
          const blockAlign = numChannels * bytesPerSample
          const byteRate = sampleRate * blockAlign
          const dataSize = audioBuffer.length * blockAlign
          const headerSize = 44
          const totalSize = headerSize + dataSize
          const buffer = new ArrayBuffer(totalSize)
          const view = new DataView(buffer)
          // RIFF header
          const writeStr = (offset: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)) }
          writeStr(0, 'RIFF')
          view.setUint32(4, totalSize - 8, true)
          writeStr(8, 'WAVE')
          writeStr(12, 'fmt ')
          view.setUint32(16, 16, true)         // chunk size
          view.setUint16(20, 1, true)          // PCM format
          view.setUint16(22, numChannels, true)
          view.setUint32(24, sampleRate, true)
          view.setUint32(28, byteRate, true)
          view.setUint16(32, blockAlign, true)
          view.setUint16(34, bitsPerSample, true)
          writeStr(36, 'data')
          view.setUint32(40, dataSize, true)
          // Write interleaved samples
          const channels: Float32Array[] = []
          for (let c = 0; c < numChannels; c++) channels.push(audioBuffer.getChannelData(c))
          let offset = 44
          for (let i = 0; i < audioBuffer.length; i++) {
            for (let c = 0; c < numChannels; c++) {
              const s = Math.max(-1, Math.min(1, channels[c][i]))
              view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
              offset += 2
            }
          }
          const wavBlob = new Blob([buffer], { type: 'audio/wav' })
          resolve(URL.createObjectURL(wavBlob))
        })
        .catch(reject)
    })
  }

  const handleShare = async () => {
    if (!audioUrl || !text.trim()) return
    setIsSharing(true)
    try {
      // Store current state in URL params for sharing
      const params = new URLSearchParams({
        text: text.slice(0, 500),
        engine,
        voice,
        speed: String(speed),
      })
      const shareUrlStr = `${window.location.origin}?shared=1&${params.toString()}`
      await navigator.clipboard.writeText(shareUrlStr)
      setShareUrl(shareUrlStr)
      showStatus(t('status.linkCopied') || '分享連結已複製到剪貼簿', 'success')
    } catch {
      showStatus('分享失敗，請稍後再試', 'error')
    }
    setIsSharing(false)
  }

  const ENGINES = [
    { id: 'openai', label: 'OpenAI', sub: 'gpt-4o-mini-tts', color: '#10b981', accent: '#059669' },
    { id: 'elevenlabs', label: 'ElevenLabs', sub: 'Multilingual v2', color: '#a855f7', accent: '#9333ea' },
    { id: 'kokoro', label: 'Kokoro', sub: 'inference.sh', color: '#f59e0b', accent: '#d97706' },
  ]

  const SPEEDS = [0.75, 1, 1.25, 1.5]

  // ── Textarea state machine ──
  const MAX_CHARS = 10000
  const charPct = text.length / MAX_CHARS
  const textareaState: 'empty' | 'typing' | 'near-limit' | 'at-limit' =
    text.length === 0 ? 'empty'
    : charPct >= 1 ? 'at-limit'
    : charPct > 0.9 ? 'near-limit'
    : 'typing'

  const [showClearBtn, setShowClearBtn] = useState(false)

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    if (val.length > MAX_CHARS) return
    setText(val)
    setShowClearBtn(val.length > 0)
  }

  const [appState, setAppState] = useState<'idle' | 'generating' | 'previewing' | 'complete'>('idle')
  const [completionNotes, setCompletionNotes] = useState<{ id: number; note: string; x: number }[]>([])
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(40).fill(0.2))
  const noteIdRef = useRef(0)

  // ── Waveform animation ──
  useEffect(() => {
    if (appState === 'idle' || appState === 'generating') {
      let frame = 0
      const tick = () => {
        frame++
        setWaveformBars(prev => prev.map((_, i) => {
          const base = Math.sin((frame * 0.08) + i * 0.4) * 0.35
          const rand = Math.sin((frame * 0.05) + i * 0.7) * 0.15
          return Math.abs(0.2 + base + rand)
        }))
        const raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
      }
      const raf = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(raf)
    } else if (appState === 'complete') {
      setWaveformBars(prev => prev.map(v => Math.max(v - 0.05, 0.2)))
    }
  }, [appState])

  // ── Completion notes ──
  const spawnNotes = () => {
    const notes = ['♪', '♫', '♬', '♩']
    const newNotes = notes.map(n => ({
      id: ++noteIdRef.current,
      note: n,
      x: 30 + Math.random() * 40,
    }))
    setCompletionNotes(newNotes)
    setTimeout(() => setCompletionNotes([]), 900)
  }

  const handleLocaleChange = (l: 'zh' | 'en') => {
    setLocale(l)
    try { localStorage.setItem('tts_locale', l) } catch (_) {}
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', position: 'relative' }}>
      {/* Fixed background layer */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <header className="header-glass sticky top-0 z-50">
          <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm animate-float"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 4px 16px rgba(124,58,237,0.4)' }}>
                <Mic size={14} className="inline" />
              </div>
              <div>
                <h1 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                  {t('app.title')} <span style={{ color: 'var(--primary-light)', fontSize: '0.7em', fontWeight: 700 }}>{t('app.version')}</span>
                </h1>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>{t('app.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Language Segmented Control */}
              <div className="locale-toggle" role="group" aria-label={t('nav.localeToggle')}>
                <button
                  className={locale === 'zh' ? 'active' : ''}
                  onClick={() => handleLocaleChange('zh')}
                  aria-pressed={locale === 'zh'}
                  aria-label="中文"
                >中文</button>
                <button
                  className={locale === 'en' ? 'active' : ''}
                  onClick={() => handleLocaleChange('en')}
                  aria-pressed={locale === 'en'}
                  aria-label="English"
                >EN</button>
              </div>
              <Link href="/pricing" className="btn-secondary text-xs"><CreditCard size={12} className="inline mr-1"/>{t('nav.pricing')}</Link>
              {isLoaded && clerkConfigured && (
                <>
                  <SignedIn>
                    <Link href="/dashboard" className="btn-secondary text-xs"><BarChart3 size={12} className="inline mr-1"/>{t('nav.dashboard')}</Link>
                    <UserButton afterSignOutUrl="/" />
                  </SignedIn>
                  <SignedOut>
                    <SignInButton mode="modal">
                      <button className="btn-primary text-xs !py-1.5 !px-4 !text-sm !rounded-xl">{t('nav.login')}</button>
                    </SignInButton>
                  </SignedOut>
                </>
              )}
              {isLoaded && !clerkConfigured && (
                <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                  僅本地模式
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <div style={{ position: 'relative', overflow: 'hidden', padding: '3rem 0 2.5rem' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 100% 60% at 50% -10%, rgba(124,58,237,0.2) 0%, transparent 65%)' }} />
          <div className="max-w-3xl mx-auto px-5 relative" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
            {/* Text content */}
            <div style={{ textAlign: 'center' }}>
              {/* Status badge */}
              <div className="inline-flex items-center gap-2 badge mb-6" style={{ animation: 'slideUp 0.5s ease both' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981', animation: 'pulseGlow 2s ease-in-out infinite' }} />
                {t('hero.badge')}
              </div>

              {/* Main headline */}
              <h2 className="text-4xl sm:text-5xl font-black mb-4 leading-tight" style={{ animation: 'slideUp 0.5s ease 0.1s both' }}>
                <span style={{ color: 'var(--text)' }}>{locale === 'zh' ? 'Transform' : 'Transform'}</span>{' '}
                <span style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  {t('hero.headline.accent')}
                </span>
              </h2>

              {/* Subheadline */}
              <p className="text-base mb-2" style={{ color: 'var(--text-2)', animation: 'slideUp 0.5s ease 0.2s both', maxWidth: '480px', margin: '0 auto' }}>
                {t('hero.subheadline')}
              </p>

              {/* Quick stats */}
              <div className="flex items-center justify-center gap-6 mt-6" style={{ animation: 'slideUp 0.5s ease 0.3s both' }}>
                {[
                  { icon: <Globe size={12} className="inline" />, label: t('hero.stats.lang') },
                  { icon: <Zap size={14} className="inline" />, label: t('hero.stats.instant') },
                  { icon: <Music size={12} className="inline" />, label: t('hero.stats.mp3') },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Page Mode Toggle */}
        <div className="max-w-3xl mx-auto px-5">
          <div className="flex items-center justify-center gap-3 py-2">
            <button
              onClick={() => setPageMode('single')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: pageMode === 'single' ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'var(--surface)',
                color: pageMode === 'single' ? '#fff' : 'var(--text-2)',
                border: pageMode === 'single' ? 'none' : '1px solid var(--border)',
                boxShadow: pageMode === 'single' ? '0 4px 14px rgba(124,58,237,0.35)' : 'none',
              }}
            >
              <Volume2 size={14} /> 單一轉換
            </button>
            <button
              onClick={() => setPageMode('batch')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: pageMode === 'batch' ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'var(--surface)',
                color: pageMode === 'batch' ? '#fff' : 'var(--text-2)',
                border: pageMode === 'batch' ? 'none' : '1px solid var(--border)',
                boxShadow: pageMode === 'batch' ? '0 4px 14px rgba(124,58,237,0.35)' : 'none',
              }}
            >
              <Layers size={14} /> 批次處理
              {(() => {
                const pending = tasks.filter((t: BatchTask) => t.status === 'pending').length
                return pending > 0 ? (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs" style={{ background: 'rgba(255,255,255,0.25)', color: '#fff' }}>{pending}</span>
                ) : null
              })()}
            </button>
          </div>
        </div>

        <main className="max-w-3xl mx-auto px-5 py-2 space-y-5 stagger" style={{ position: 'relative', zIndex: 1 }}>

          {/* ── BATCH MODE UI ── */}
          {pageMode === 'batch' && (
            <div className="space-y-5">
              {/* Batch Queue Status */}
              <div className="glass-card p-6">
                <BatchQueue />
              </div>

              {/* Batch Task Entry Form */}
              <div className="glass-card p-6">
                <span className="label mb-3 block"><PlusCircle size={14} className="inline" /> 新增批次任務 <span className="text-xs font-normal" style={{ color: 'var(--text-3)' }}>(最多 10 個任務)</span></span>

                {/* Text input for batch task */}
                <textarea
                  value={batchText}
                  onChange={e => setBatchText(e.target.value)}
                  placeholder="輸入要轉換的文字..."
                  className="tts-textarea mb-3"
                  rows={4}
                  style={{ fontSize: '0.95rem' }}
                />
                <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: 'var(--text-3)' }}>
                  <span>{batchText.length.toLocaleString()} 字</span>
                  {batchText.length > 5000 && (
                    <span style={{ color: 'var(--primary-light)' }}>· 自動拆分處理</span>
                  )}
                </div>

                {/* Voice + Format row */}
                <div className="flex flex-wrap gap-3 mb-4">
                  {/* Voice selector (simplified) */}
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-xs font-bold block mb-1.5" style={{ color: 'var(--text-2)' }}>聲音</label>
                    <select
                      value={batchVoice}
                      onChange={e => setBatchVoice(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    >
                      {NEW_VOICES.map(v => (
                        <option key={v.id} value={v.openaiVoice}>{v.name} · {LANGUAGE_LABELS[v.language]}</option>
                      ))}
                    </select>
                  </div>

                  {/* Format selector */}
                  <div className="flex-shrink-0">
                    <label className="text-xs font-bold block mb-1.5" style={{ color: 'var(--text-2)' }}>格式</label>
                    <div className="flex gap-2">
                      {(['mp3', 'wav'] as const).map(fmt => (
                        <button
                          key={fmt}
                          onClick={() => setBatchFormat(fmt)}
                          className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                            batchFormat === fmt ? 'btn-primary' : 'btn-secondary'
                          }`}
                        >
                          {fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Add to Queue button */}
                <button
                  onClick={() => {
                    if (!batchText.trim()) return
                    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
                    const added = addTask({
                      id,
                      text: batchText.trim(),
                      language: batchVoice,
                      voice: batchVoice,
                      format: batchFormat,
                    })
                    if (added) {
                      setBatchText('')
                    }
                  }}
                  disabled={!batchText.trim() || tasks.length >= 10}
                  className="btn-primary w-full !py-3"
                  style={{ fontSize: '0.95rem' }}
                >
                  <PlusCircle size={14} className="inline" />
                  {tasks.length >= 10 ? '佇列已滿（最多 10 個）' : '加入佇列'}
                </button>
              </div>
            </div>
          )}

          {/* ── SINGLE MODE UI ── */}
          {pageMode === 'single' && (
          <>

          {/* File Upload */}
          <div className="glass-card p-6">
            <span className="label"><FolderOpen size={14} className="inline" /> {t('upload.label')}</span>
            <div
              className={`dropzone ${isDragging ? 'dragging' : ''}`}
              onClick={() => document.getElementById('fileInput')?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => {
                e.preventDefault(); setIsDragging(false)
                const file = e.dataTransfer.files[0]
                if (file) handleFile(file)
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', filter: 'drop-shadow(0 4px 8px rgba(124,58,237,0.3))' }}><FileText size={24} className="inline" /></div>
              <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text-2)' }}>{t('upload.dropzone')}</div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {['.txt', '.srt', '.vtt', '.lrc', '.epub', '.pdf', '.docx'].map(f => (
                  <span key={f} className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>{f}</span>
                ))}
              </div>
            </div>
            <input type="file" id="fileInput" accept=".txt,.srt,.vtt,.lrc,.epub,.pdf,.docx" className="hidden"
              onChange={e => { const file = e.target.files?.[0]; if (file) handleFile(file) }} />
          </div>

          {/* Mode Toggle */}
          <div className="glass-card p-6">
            <span className="label"><Volume2 size={16} className="inline" /> {t('mode.label')}</span>
            <div className="mode-pill mb-5">
              <button className={mode === 'browser' ? 'active' : ''} onClick={() => setMode('browser')}>
                <span><Globe size={14} className="inline" /> {t('mode.browser')}</span>
                <span className="sub">{t('mode.browser.sub')}</span>
              </button>
              <button className={mode === 'api' ? 'active' : ''} onClick={() => setMode('api')}>
                <span><Bot size={14} className="inline" /> {t('mode.api')}</span>
                <span className="sub">{t('mode.api.sub')}</span>
              </button>
            </div>

            {mode === 'api' && (
              <div className="space-y-5 animate-slide-up">
                {/* Engine Selection */}
                <div>
                  <span className="label">{t('mode.engine')}</span>
                  <div className="grid grid-cols-3 gap-3">
                    {ENGINES.map(eng => (
                      <button key={eng.id}
                        className={`engine-card ${engine === eng.id ? 'selected' : ''}`}
                        style={engine === eng.id ? { '--before-bg': eng.color } as React.CSSProperties : {}}
                        onClick={() => setEngine(eng.id)}>
                        {engine === eng.id && (
                          <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', borderRadius: '3px 0 0 3px', background: eng.color, boxShadow: `0 0 8px ${eng.color}` }} />
                        )}
                        <div className="font-bold text-sm mb-0.5" style={{ color: engine === eng.id ? eng.color : 'var(--text-2)' }}>{eng.label}</div>
                        <div className="text-xs" style={{ color: 'var(--text-3)' }}>{eng.sub}</div>
                        {engine === eng.id && (
                          <div className="mt-2 flex justify-center">
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: eng.color, display: 'inline-block', boxShadow: `0 0 6px ${eng.color}` }} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Plan Selection */}
                <div>
                  <span className="label">{t('mode.plan')}</span>
                  <div className="flex gap-3">
                    {[
                      ['free', 'Free', '10/day', ''],
                      ['starter', 'Starter', '100次/天', ''],
                      ['pro', 'Pro', '1000次/天', 'badge badge-cyan'],
                    ].map(([id, label, badge, badgeClass]) => (
                      <button key={id}
                        className={`flex-1 py-3 px-3 rounded-xl border text-center transition-all ${badgeClass || ''}`}
                        style={plan === id
                          ? { borderColor: 'var(--primary)', background: 'rgba(124,58,237,0.12)', boxShadow: '0 0 0 1px var(--primary)' }
                          : { background: 'var(--surface)', borderColor: 'var(--border)' }
                        }
                        onClick={() => setPlan(id as string)}>
                        <div className="font-bold text-sm" style={{ color: plan === id ? 'var(--primary-light)' : 'var(--text-2)' }}>{label}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{badge}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {!user && clerkConfigured && (
                  <div className="toast info text-sm">
                    <Lightbulb size={12} className="inline" /> {t('mode.login.hint')} <SignInButton mode="modal">
                      <button className="underline font-bold ml-1" style={{ color: 'inherit' }}>{t('mode.login.hint.btn')}</button>
                    </SignInButton> {t('mode.login.hint.suffix')}
                  </div>
                )}
                {!user && !clerkConfigured && (
                  <div className="toast info text-sm">
                    <Lightbulb size={12} className="inline" /> 請設定 Clerk API Key 才能啟用登入功能（詳見 .env.example）
                  </div>
                )}

                {user && (
                  <div>
                    <span className="label">API Key <span style={{ color: 'var(--text-3)', textTransform: 'none', fontWeight: 400 }}>(leave empty to use saved)</span></span>
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={e => setApiKeyInput(e.target.value)}
                      placeholder={engine === 'openai' ? 'sk-...' : engine === 'elevenlabs' ? 'ElevenLabs Key...' : 'inference.sh Key...'}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit' }}
                    />
                    <p className="text-xs mt-2.5" style={{ color: 'var(--text-3)' }}>
                      <Lightbulb size={12} className="inline" /> Key is only stored locally in your browser, or securely in the <Link href="/dashboard" className="font-semibold" style={{ color: 'var(--primary-light)' }}>Dashboard</Link>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Text Input (4 states) */}
          <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-3">
              <span className="label mb-0"><Pen size={12} className="inline" /> {t('text.label')}</span>
              <div className="flex items-center gap-3">
                {/* Char counter with color state */}
                <span
                  className={`char-counter text-xs font-semibold ${textareaState === 'near-limit' ? 'near-limit' : ''} ${textareaState === 'at-limit' ? 'at-limit' : ''}`}
                  style={{ color: 'var(--text-secondary)' }}
                  aria-live="polite"
                  aria-label={`${charCount.toLocaleString()} characters of ${MAX_CHARS.toLocaleString()} maximum`}
                >
                  {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </span>
                {/* Clear button */}
                <button
                  className={`clear-btn ${showClearBtn ? 'visible' : ''}`}
                  onClick={() => { setText(''); setShowClearBtn(false) }}
                  aria-label={locale === 'zh' ? '清除文字' : 'Clear text'}
                  title={locale === 'zh' ? '清除' : 'Clear'}
                >
                  <X size={12} />
                </button>
              </div>
            </div>
            <textarea
              value={text}
              onChange={handleTextChange}
              placeholder={t('text.placeholder')}
              className={`tts-textarea state-${textareaState}`}
              style={{ fontSize: '0.95rem' }}
              maxLength={MAX_CHARS}
              aria-label={t('text.label')}
            />
            {/* At limit warning */}
            {textareaState === 'at-limit' && (
              <div className="mt-2 text-xs flex items-center gap-1" style={{ color: 'var(--error)' }} aria-live="assertive">
                <span>⚠</span> {locale === 'zh' ? '已達字數上限' : 'Character limit reached'}
              </div>
            )}
            <div className="flex gap-5 mt-3 text-xs flex-wrap" style={{ color: 'var(--text-secondary)' }}>
              <span className="flex items-center gap-1"><Clock size={12} className="inline" /> {locale === 'zh' ? '預估時長' : 'Est. duration'} · <strong style={{ color: 'var(--text-primary)' }}>{estimatedSeconds}s</strong></span>
              <span className="flex items-center gap-1"><Boxes size={12} className="inline" /> <strong style={{ color: 'var(--text-primary)' }}>{chunks}</strong> {locale === 'zh' ? '段落' : 'chunks'}</span>
              <span className="flex items-center gap-1"><Music size={12} className="inline" /> {locale === 'zh' ? '預估大小' : 'Est. size'} · MP3: <strong style={{ color: 'var(--text-primary)' }}>{estimatedMp3KB} KB</strong> · WAV: <strong style={{ color: 'var(--text-primary)' }}>{estimatedWavKB} KB</strong></span>
              {charCount > 5000 && (
                <span className="flex items-center gap-1" style={{ color: 'var(--primary)' }}>
                  <Sparkles size={12} className="inline" /> {locale === 'zh' ? '自動拆分' : 'Auto-split'}
                </span>
              )}
            </div>
          </div>

          {/* Voice Selection v2 */}
          <div className="glass-card p-6">
            <span className="label"><Mic size={14} className="inline" /> {t('voice.label')}</span>
            <VoiceSelector />
          </div>

          {/* Speed Settings (iOS Segmented Control) */}
          <div className="glass-card p-6">
            <span className="label"><Zap size={14} className="inline" /> {t('speed.label')}</span>
            {/* iOS-style Segmented Control */}
            <div className="speed-segmented mb-5" role="group" aria-label={t('speed.label')}>
              {SPEEDS.map(s => (
                <button
                  key={s}
                  className={speed === s ? 'active' : ''}
                  onClick={() => setSpeed(s)}
                  aria-pressed={speed === s}
                  aria-label={`${s}× speed`}
                >
                  {s}×
                </button>
              ))}
            </div>
            {/* Fine-tune sliders */}
            <div className="grid grid-cols-3 gap-6">
              {[
                { label: t('speed.speed'), id: 'speed', min: 0.5, max: 2, step: 0.25, val: speed, display: speed + 'x' },
                { label: t('speed.pitch'), id: 'pitch', min: -2, max: 2, step: 0.1, val: pitch, display: (pitch > 0 ? '+' : '') + pitch },
                { label: t('speed.volume'), id: 'volume', min: 0, max: 1, step: 0.1, val: volume, display: Math.round(volume * 100) + '%' },
              ].map(s => (
                <div key={s.id}>
                  <label className="text-xs font-bold block mb-2" style={{ color: 'var(--text-2)', letterSpacing: '0.05em' }}>{s.label}</label>
                  <input
                    type="range"
                    min={s.min} max={s.max} step={s.step} value={s.val}
                    onChange={e => {
                      const v = parseFloat(e.target.value)
                      if (s.id === 'speed') setSpeed(v)
                      else if (s.id === 'pitch') setPitch(v)
                      else setVolume(v)
                    }}
                  />
                  <div className="text-center text-sm mt-2 font-bold" style={{ color: 'var(--primary-light)' }}>{s.display}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Convert CTA */}
          <button
            onClick={handleConvert}
            disabled={isConverting}
            className="btn-primary w-full !py-5 !text-base"
            style={{ fontSize: '1.05rem', letterSpacing: '0.03em' }}
          >
            {isConverting ? (
              <><Loader size={14} className="inline animate-spin" /> {t('convert.converting')}</>
            ) : (
              <>
                <span style={{ fontSize: '1.2em', lineHeight: 1 }}><Volume2 size={16} className="inline" /></span>
                <span>{t('convert.btn')}</span>
              </>
            )}
          </button>

          {/* Status Toast */}
          {status && (
            <div className={`toast ${status.type}`}>
              {status.msg}
            </div>
          )}

          {/* Result Card (with waveform) */}
          {audioUrl && (
            <div className="glass-card p-6 animate-slide-up" style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
              {/* Completion notes overlay */}
              {completionNotes.map(n => (
                <span key={n.id} className="note-particle" style={{ left: `${n.x}%`, top: '50%' }} aria-hidden="true">{n.note}</span>
              ))}

              <div className="flex items-center gap-3 mb-5">
                <div className="feat-icon"><Sparkles size={16} className="inline" /></div>
                <div>
                  <div className="font-black text-base" style={{ color: 'var(--text)' }}>{t('result.title')}</div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('result.subtitle')}</div>
                </div>
                {/* Idle soundwave */}
                <div style={{ marginLeft: 'auto' }} aria-hidden="true">
                  <div className="soundwave-idle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', height: '24px' }}>
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="sw-bar" style={{ width: 3, borderRadius: 999, background: 'var(--primary)', opacity: 0.7, height: `${8 + i * 2}px` }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Waveform Visualization */}
              <div className="waveform-container mb-5" aria-hidden="true">
                {waveformBars.map((h, i) => (
                  <div
                    key={i}
                    className="waveform-bar"
                    style={{ height: `${Math.max(4, h * 40)}px` }}
                  />
                ))}
              </div>

              <div className="progress-bar mb-3">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              {chunkProgress && chunkProgress.total > 1 && (
                <div className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {isMerging ? (
                    <span className="flex items-center gap-1"><Loader size={12} className="inline animate-spin" /> 合併中...</span>
                  ) : (
                    <span>片段 {chunkProgress.current} / {chunkProgress.total} 完成</span>
                  )}
                </div>
              )}
              <audio src={audioUrl} controls className="audio-player w-full mb-5" aria-label={locale === 'zh' ? '音頻播放器' : 'Audio player'} />
              <div className="flex flex-wrap items-center gap-3 mb-3">
                {/* Format selector */}
                <div className="flex gap-2" title="選擇下載格式">
                  {(['mp3', 'wav'] as const).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setDownloadFormat(fmt)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        downloadFormat === fmt ? 'btn-primary' : 'btn-secondary'
                      }`}
                      title={fmt === 'mp3' ? '適合網頁/社群分享，檔案較小' : '無損品質，適合後續音頻編輯'}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
                {/* Download button */}
                <button onClick={downloadAudio} className="btn-primary !py-2.5 !px-6 !text-sm">
                  <Download size={14} className="inline" /> {downloadFormat === 'wav' ? '下載 WAV' : '下載 MP3'}
                </button>
                {/* Share button */}
                <button onClick={handleShare} disabled={isSharing} className="btn-secondary !py-2.5 !px-6 !text-sm">
                  {isSharing
                    ? <><Loader size={12} className="inline animate-spin" /> 處理中</>
                    : <><Share2 size={14} className="inline" /> {shareUrl ? '已複製' : '分享連結'}</>
                  }
                </button>
              </div>
              {shareUrl && (
                <div className="mt-2 text-xs rounded-lg p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-3)', wordBreak: 'break-all' }}>
                  <Link2 size={12} className="inline mr-1" />
                  <span style={{ color: 'var(--text-2)' }}>分享連結：</span>
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-light)' }}>{shareUrl}</a>
                </div>
              )}
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="glass-card p-6">
              <div className="flex justify-between items-center mb-4">
                <span className="label mb-0"><ScrollText size={12} className="inline" /> {t('history.label')}</span>
                <button onClick={() => setHistory([])} className="btn-ghost text-xs">{t('history.clear')}</button>
              </div>
              <div className="space-y-2">
                {history.map((item, i) => (
                  <div key={i}
                    className="p-3.5 rounded-xl text-sm cursor-pointer transition-all"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
                    onClick={() => setText(item.text)}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.08)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                  >
                    <div style={{ fontSize: '0.85rem' }}>{item.text}</div>
                    <div className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>{item.time} · {item.mode}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          </>
          )}

          {/* Footer */}
          <div className="text-center pt-4 pb-8 space-y-2">
            <div className="flex justify-center gap-4 text-xs" style={{ color: 'var(--text-3)' }}>
              <a href="/privacy" style={{ color: 'var(--text-3)', textDecoration: 'underline' }}>隱私權政策</a>
              <span>·</span>
              <a href="/terms" style={{ color: 'var(--text-3)', textDecoration: 'underline' }}>服務條款</a>
              <span>·</span>
              <a href="mailto:alan@example.com" style={{ color: 'var(--text-3)', textDecoration: 'underline' }}>聯絡我們</a>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              © {new Date().getFullYear()} 文字轉語音 v2.0 · {t('footer.powered')}
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}

