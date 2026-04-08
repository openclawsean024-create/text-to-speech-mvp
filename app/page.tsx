'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useClerkUser } from '@/hooks/useClerk'
import { useLocale } from '@/contexts/LangContext'
import {
  Sparkles, Zap, BarChart3, Globe, Bot, CreditCard, FolderOpen,
  FileText, Volume2, Clock, Boxes, Pen, Music, Loader, Download, Share2,
  ScrollText, Lightbulb, Mic, Headphones, Volume, Rocket, Play, Link2,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function HomePage() {
  const { user, isLoaded } = useClerkUser()

  const { locale, setLocale, t } = useLocale()
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
    if (file.size > 10 * 1024 * 1024) {
      showStatus(t('status.fileLarge'), 'error')
      return
    }
    showStatus(t('status.extracting'), 'info')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/extract-text', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extraction failed')
      setText(data.text)
      showStatus(t('status.extracted').replace('{count}', data.charCount.toLocaleString()).replace('{filename}', data.filename), 'success')
    } catch (e: unknown) {
      showStatus(`${t('status.fileError')}: ` + (e instanceof Error ? e.message : String(e)), 'error')
    }
  }

  const charCount = text.length
  const estimatedSeconds = Math.max(1, Math.round(charCount / 6 / speed))
  const chunks = Math.max(1, Math.ceil(charCount / 500))

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

    setIsConverting(true)
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
    }
    setIsConverting(false)
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
    utterance.onend = () => setProgress(100)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    showStatus(t('status.playing'), 'success')
  }

  const convertAPI = async () => {
    if (!user) { showStatus(t('status.loginRequired'), 'error'); return }

    const body: Record<string, unknown> = { text, engine, voice, speed, plan }
    if (apiKeyInput.trim()) body.apiKey = apiKeyInput.trim()

    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      let msg = `HTTP ${res.status}`
      try {
        const ct = res.headers.get('content-type') || ''
        if (ct.includes('application/json')) {
          const err = await res.json()
          msg = err.error || err.message || msg
        }
      } catch (_) {}
      throw new Error(msg)
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    setAudioUrl(url)
    setProgress(100)
    showStatus(t('status.complete').replace('{engine}', engine.toUpperCase()), 'success')

    const item = { text: text.slice(0, 50) + (text.length > 50 ? '…' : ''), time: new Date().toLocaleString('zh-TW'), mode: engine }
    setHistory(prev => [item, ...prev.slice(0, 9)])
    persistSettings()
  }

  const downloadAudio = async () => {
    if (!audioUrl) return
    setIsConverting(true)
    try {
      let blobUrl = audioUrl
      if (downloadFormat === 'wav') {
        blobUrl = await convertToWav(audioUrl)
      }
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `tts-${Date.now()}.${downloadFormat}`
      a.click()
      if (downloadFormat === 'wav') URL.revokeObjectURL(blobUrl)
      showStatus(t('status.downloadStart'), 'success')
    } catch {
      showStatus('下載失敗，請稍後再試', 'error')
    }
    setIsConverting(false)
  }

  const convertToWav = async (blobUrl: string): Promise<string> => {
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

  const VOICES = [
    { code: 'zh-CN', name: '曉曉', lang: '中文 · 女聲', photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face', color: '#f472b6' },
    { code: 'zh-TW', name: '雲希', lang: '中文 · 男聲', photo: 'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=200&h=200&fit=crop&crop=face', color: '#60a5fa' },
    { code: 'en-US', name: 'Jenny', lang: '英文 · 女聲', photo: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=200&h=200&fit=crop&crop=face', color: '#fb923c' },
    { code: 'ja-JP', name: '七海', lang: '日文 · 女聲', photo: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=200&h=200&fit=crop&crop=face', color: '#a78bfa' },
    { code: 'ko-KR', name: 'SunHi', lang: '韓文 · 女聲', photo: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&h=200&fit=crop&crop=face', color: '#34d399' },
    { code: 'en-US-male', name: 'James', lang: '英文 · 男聲', photo: 'https://images.unsplash.com/photo-1500048993953-d23a436266cf?w=200&h=200&fit=crop&crop=face', color: '#f87171' },
  ]

  const ENGINES = [
    { id: 'openai', label: 'OpenAI', sub: 'gpt-4o-mini-tts', color: '#10b981', accent: '#059669' },
    { id: 'elevenlabs', label: 'ElevenLabs', sub: 'Multilingual v2', color: '#a855f7', accent: '#9333ea' },
    { id: 'kokoro', label: 'Kokoro', sub: 'inference.sh', color: '#f59e0b', accent: '#d97706' },
  ]

  const SPEEDS = [0.75, 1, 1.25, 1.5, 2]

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
              <button className="btn-secondary text-xs" onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}>{t('nav.localeToggle')}</button>
              <Link href="/pricing" className="btn-secondary text-xs"><CreditCard size={12} className="inline mr-1"/>{t('nav.pricing')}</Link>
              {isLoaded && (
                user ? (
                  <>
                    <Link href="/dashboard" className="btn-secondary text-xs"><BarChart3 size={12} className="inline mr-1"/>{t('nav.dashboard')}</Link>
                    <button className="btn-ghost text-xs" onClick={() => alert(t('alert.clerk'))}>{t('nav.logout')}</button>
                  </>
                ) : (
                  <button className="btn-primary text-xs !py-1.5 !px-4 !text-sm !rounded-xl" onClick={() => alert(t('alert.clerk'))}>{t('nav.login')}</button>
                )
              )}
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <div style={{ position: 'relative', overflow: 'hidden', padding: '3rem 0 2.5rem' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 100% 60% at 50% -10%, rgba(124,58,237,0.2) 0%, transparent 65%)' }} />
          <div className="max-w-3xl mx-auto px-5 text-center relative">
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

        <main className="max-w-3xl mx-auto px-5 py-2 space-y-5 stagger" style={{ position: 'relative', zIndex: 1 }}>

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

                {!user && (
                  <div className="toast info text-sm">
                    <Lightbulb size={12} className="inline" /> {t('mode.login.hint')} <button className="underline font-bold ml-1" style={{ color: 'inherit' }} onClick={() => alert(t('alert.clerk'))}>{t('mode.login.hint.btn')}</button> {t('mode.login.hint.suffix')}
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

          {/* Text Input */}
          <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-3">
              <span className="label mb-0"><Pen size={12} className="inline" /> {t('text.label')}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold"
                  style={{ color: 'var(--text-3)' }}>
                  {charCount.toLocaleString()} 字
                </span>
              </div>
            </div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={t('text.placeholder')}
              className="tts-textarea"
              style={{ fontSize: '0.95rem' }}
            />
            <div className="flex gap-5 mt-3 text-xs" style={{ color: 'var(--text-3)' }}>
              <span className="flex items-center gap-1"><Clock size={12} className="inline" /> 預估時長 · <strong style={{ color: 'var(--text-2)' }}>{estimatedSeconds}s</strong></span>
              <span className="flex items-center gap-1"><Boxes size={12} className="inline" /> <strong style={{ color: 'var(--text-2)' }}>{chunks}</strong> 段落</span>
            </div>
          </div>

          {/* Voice Selection */}
          <div className="glass-card p-6">
            <span className="label"><Mic size={14} className="inline" /> {t('voice.label')}</span>
            <div className="grid grid-cols-3 gap-3">
              {VOICES.map(v => (
                <button
                  key={v.code}
                  className={`voice-card ${voice === v.code ? 'selected' : ''}`}
                  onClick={() => setVoice(v.code)}
                >
                  {/* Avatar circle */}
                  <div className="voice-avatar" style={{ background: `linear-gradient(135deg, ${v.color}cc, ${v.color}66)`, display: 'block', overflow: 'hidden' }}>
                    <img
                      src={v.photo}
                      alt={v.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                  <div className="font-bold text-sm" style={{ color: voice === v.code ? 'var(--primary-light)' : 'var(--text)' }}>{v.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{v.lang}</div>
                  <button
                    className="preview-btn"
                    onClick={e => { e.stopPropagation(); previewVoice(v.code) }}>
                    <Play size={12} className="inline" /> {t('voice.preview')}
                  </button>
                </button>
              ))}
            </div>
          </div>

          {/* Speed Settings */}
          <div className="glass-card p-6">
            <span className="label"><Zap size={14} className="inline" /> {t('speed.label')}</span>
            {/* Speed presets */}
            <div className="flex gap-2 flex-wrap mb-5">
              {SPEEDS.map(s => (
                <button key={s} className={`speed-btn ${speed === s ? 'active' : ''}`} onClick={() => setSpeed(s)}>
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

          {/* Result Card */}
          {audioUrl && (
            <div className="glass-card p-6 animate-slide-up" style={{ borderColor: 'rgba(124,58,237,0.25)' }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="feat-icon"><Sparkles size={16} className="inline" /></div>
                <div>
                  <div className="font-black text-base" style={{ color: 'var(--text)' }}>{t('result.title')}</div>
                  <div className="text-xs" style={{ color: 'var(--text-3)' }}>{t('result.subtitle')}</div>
                </div>
              </div>
              <div className="progress-bar mb-5">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <audio src={audioUrl} controls className="audio-player w-full mb-5" />
              <div className="flex flex-wrap items-center gap-3 mb-3">
                {/* Format selector */}
                <div className="flex gap-2">
                  {(['mp3', 'wav'] as const).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setDownloadFormat(fmt)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        downloadFormat === fmt ? 'btn-primary' : 'btn-secondary'
                      }`}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
                {/* Download button */}
                <button onClick={downloadAudio} className="btn-primary !py-2.5 !px-6 !text-sm">
                  <Download size={14} className="inline" /> {t('result.download')}
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

          {/* Footer */}
          <div className="text-center pt-4 pb-8">
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              {t('footer.powered')}
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}

function previewVoice(voiceCode: string) {
  const previewTexts: Record<string, string> = {
    'zh-CN': '您好，這是曉曉的聲音預覽。',
    'zh-TW': '您好，這是雲希的聲音預覽。',
    'en-US': 'Hello, this is a voice preview.',
    'ja-JP': 'こんにちは、七海の聲です。',
    'ko-KR': '안녕하세요, 선희 목소리 미리보기입니다.',
    'en-US-male': 'Hello, this is a voice preview.',
  }
  const text = previewTexts[voiceCode] || '您好，這是聲音預覽。'
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1; utterance.pitch = 1; utterance.volume = 1
  const voices = window.speechSynthesis.getVoices()

  // Gender-aware voice matching: prefer matching both lang AND gender
  // zh-TW is male (男聲) but lacks '-male' suffix — use explicit map
  const GENDER_MAP: Record<string, boolean> = {
    'zh-CN': false, 'en-US': false, 'ja-JP': false, 'ko-KR': false,  // female
    'zh-TW': true, 'en-US-male': true,                                // male
  }
  const isMale = GENDER_MAP[voiceCode] ?? voiceCode.endsWith('-male')
  const baseLang = voiceCode.replace('-male', '').split('-')[0]
  const lang = baseLang.split('-')[0]

  let voiceObj = voices.find(v => {
    const vLang = v.lang.toLowerCase()
    const matchesLang = vLang.includes(lang) || vLang.startsWith(lang)
    const matchesGender = isMale ? v.name.toLowerCase().includes('male') : !v.name.toLowerCase().includes('male')
    return matchesLang && matchesGender
  })
  // Fallback: just match language
  if (!voiceObj) voiceObj = voices.find(v => v.lang.toLowerCase().includes(lang))
  // Last resort: first match
  if (!voiceObj) voiceObj = voices.find(v => v.lang.toLowerCase().includes(baseLang.split('-')[0]))

  if (voiceObj) utterance.voice = voiceObj
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}
