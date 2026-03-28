'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useClerkUser } from '@/hooks/useClerk'

export const dynamic = 'force-dynamic'

export default function HomePage() {
  const { user, isLoaded } = useClerkUser()

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

  const showStatus = (msg: string, type: 'info' | 'error' | 'success') => {
    setStatus({ msg, type })
    setTimeout(() => setStatus(null), 5000)
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
    if (!text.trim()) { showStatus('請輸入要轉換的文字', 'error'); return }
    if (text.length > 5000) { showStatus('文字不能超過 5000 字', 'error'); return }
    if (mode === 'api' && !user) { showStatus('請先登入後再使用 API 模式', 'error'); return }

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
      showStatus('轉換失敗：' + (e instanceof Error ? e.message : String(e)), 'error')
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
    showStatus('🎉 播放中 — 瀏覽器模式', 'success')
  }

  const convertAPI = async () => {
    if (!user) { showStatus('請先登入', 'error'); return }

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
    showStatus(`✨ 轉換完成 — ${engine.toUpperCase()} 引擎`, 'success')

    const item = { text: text.slice(0, 50) + (text.length > 50 ? '…' : ''), time: new Date().toLocaleString('zh-TW'), mode: engine }
    setHistory(prev => [item, ...prev.slice(0, 9)])
    persistSettings()
  }

  const downloadAudio = () => {
    if (!audioUrl) return
    const a = document.createElement('a')
    a.href = audioUrl
    a.download = `tts-${Date.now()}.mp3`
    a.click()
    showStatus('⬇️ 下載已開始', 'success')
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
    { id: 'openai', label: '🎙️ OpenAI', sub: 'gpt-4o-mini-tts', color: '#10b981', accent: '#059669' },
    { id: 'elevenlabs', label: '🎧 ElevenLabs', sub: 'Multilingual v2', color: '#a855f7', accent: '#9333ea' },
    { id: 'kokoro', label: '🔉 Kokoro', sub: 'inference.sh', color: '#f59e0b', accent: '#d97706' },
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
                🎙️
              </div>
              <div>
                <h1 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                  文字轉語音 <span style={{ color: 'var(--primary-light)', fontSize: '0.7em', fontWeight: 700 }}>v2.0</span>
                </h1>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>多引擎 AI TTS</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/pricing" className="btn-secondary text-xs">💰 定價</Link>
              {isLoaded && (
                user ? (
                  <>
                    <Link href="/dashboard" className="btn-secondary text-xs">📊 控制台</Link>
                    <button className="btn-ghost text-xs" onClick={() => alert('請設定 Clerk API Key 以啟用登入功能')}>登出</button>
                  </>
                ) : (
                  <button className="btn-primary text-xs !py-1.5 !px-4 !text-sm !rounded-xl" onClick={() => alert('請設定 Clerk API Key 以啟用登入功能')}>登入</button>
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
              支援 OpenAI · ElevenLabs · Kokoro
            </div>

            {/* Main headline */}
            <h2 className="text-4xl sm:text-5xl font-black mb-4 leading-tight" style={{ animation: 'slideUp 0.5s ease 0.1s both' }}>
              <span style={{ color: 'var(--text)' }}>將文字</span>{' '}
              <span style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                轉化為自然語音
              </span>
            </h2>

            {/* Subheadline */}
            <p className="text-base mb-2" style={{ color: 'var(--text-2)', animation: 'slideUp 0.5s ease 0.2s both', maxWidth: '480px', margin: '0 auto' }}>
              選擇頂尖 AI 引擎與風格聲線，即時生成電台級配音
            </p>

            {/* Quick stats */}
            <div className="flex items-center justify-center gap-6 mt-6" style={{ animation: 'slideUp 0.5s ease 0.3s both' }}>
              {[
                { icon: '🌍', label: '6+ 語言' },
                { icon: '⚡', label: '即時生成' },
                { icon: '🎵', label: 'MP3 輸出' },
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
            <span className="label">📂 上傳檔案</span>
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
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', filter: 'drop-shadow(0 4px 8px rgba(124,58,237,0.3))' }}>📄</div>
              <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text-2)' }}>點擊或拖曳檔案至此</div>
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
            <span className="label">🔊 轉換模式</span>
            <div className="mode-pill mb-5">
              <button className={mode === 'browser' ? 'active' : ''} onClick={() => setMode('browser')}>
                <span>🌐 瀏覽器模式</span>
                <span className="sub">免費，無需登入</span>
              </button>
              <button className={mode === 'api' ? 'active' : ''} onClick={() => setMode('api')}>
                <span>🤖 AI 雲端</span>
                <span className="sub">高品質，需登入</span>
              </button>
            </div>

            {mode === 'api' && (
              <div className="space-y-5 animate-slide-up">
                {/* Engine Selection */}
                <div>
                  <span className="label">選擇 TTS 引擎</span>
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
                  <span className="label">選擇方案</span>
                  <div className="flex gap-3">
                    {[
                      ['free', '免費', '10次/天', ''],
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
                    💡 請先 <button className="underline font-bold ml-1" style={{ color: 'inherit' }} onClick={() => alert('請設定 Clerk API Key 以啟用登入功能')}>登入</button> 後再使用 API 模式
                  </div>
                )}

                {user && (
                  <div>
                    <span className="label">API Key <span style={{ color: 'var(--text-3)', textTransform: 'none', fontWeight: 400 }}>（留空使用已儲存的）</span></span>
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={e => setApiKeyInput(e.target.value)}
                      placeholder={engine === 'openai' ? 'sk-...' : engine === 'elevenlabs' ? 'ElevenLabs Key...' : 'inference.sh Key...'}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit' }}
                    />
                    <p className="text-xs mt-2.5" style={{ color: 'var(--text-3)' }}>
                      💡 Key 僅儲存在瀏覽器本地，也可至 <Link href="/dashboard" className="font-semibold" style={{ color: 'var(--primary-light)' }}>控制台</Link> 安全儲存
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Text Input */}
          <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-3">
              <span className="label mb-0">✍️ 輸入文字</span>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-semibold ${charCount > 5000 ? 'text-red-400' : ''}`}
                  style={{ color: charCount > 5000 ? 'var(--danger)' : charCount > 4000 ? 'var(--warning)' : 'var(--text-3)' }}>
                  {charCount.toLocaleString()} / 5,000
                </span>
              </div>
            </div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="在此輸入要轉換的文字，或上傳檔案..."
              className="tts-textarea"
              style={{ fontSize: '0.95rem' }}
            />
            <div className="flex gap-5 mt-3 text-xs" style={{ color: 'var(--text-3)' }}>
              <span className="flex items-center gap-1">⏱ 預估時長 · <strong style={{ color: 'var(--text-2)' }}>{estimatedSeconds}s</strong></span>
              <span className="flex items-center gap-1">📦 <strong style={{ color: 'var(--text-2)' }}>{chunks}</strong> 段落</span>
            </div>
          </div>

          {/* Voice Selection */}
          <div className="glass-card p-6">
            <span className="label">🎙️ 選擇聲音</span>
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
                    ▶ 試聽
                  </button>
                </button>
              ))}
            </div>
          </div>

          {/* Speed Settings */}
          <div className="glass-card p-6">
            <span className="label">⚡ 語速設定</span>
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
                { label: '語速', id: 'speed', min: 0.5, max: 2, step: 0.25, val: speed, display: speed + 'x' },
                { label: '音調', id: 'pitch', min: -2, max: 2, step: 0.1, val: pitch, display: (pitch > 0 ? '+' : '') + pitch },
                { label: '音量', id: 'volume', min: 0, max: 1, step: 0.1, val: volume, display: Math.round(volume * 100) + '%' },
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
              <>⏳ 轉換中，請稍候…</>
            ) : (
              <>
                <span style={{ fontSize: '1.2em', lineHeight: 1 }}>🔊</span>
                <span>開始轉換</span>
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
                <div className="feat-icon">🎉</div>
                <div>
                  <div className="font-black text-base" style={{ color: 'var(--text)' }}>轉換完成！</div>
                  <div className="text-xs" style={{ color: 'var(--text-3)' }}>MP3 音頻檔案已準備就緒</div>
                </div>
              </div>
              <div className="progress-bar mb-5">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <audio src={audioUrl} controls className="audio-player w-full mb-5" />
              <button onClick={downloadAudio} className="btn-primary !py-3 !px-8 !text-sm">
                ⬇️ 下載音頻
              </button>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="glass-card p-6">
              <div className="flex justify-between items-center mb-4">
                <span className="label mb-0">📜 轉換歷史</span>
                <button onClick={() => setHistory([])} className="btn-ghost text-xs">清除</button>
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
              由 AI 驅動 · OpenAI · ElevenLabs · Kokoro
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}

function handleFile(file: File) {
  // File handling is done inline in onChange
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
