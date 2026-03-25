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
    { code: 'zh-CN', name: '曉曉', lang: '中文 · 女聲' },
    { code: 'zh-TW', name: '雲希', lang: '中文 · 男聲' },
    { code: 'en-US', name: 'Jenny', lang: '英文 · 女聲' },
    { code: 'ja-JP', name: '七海', lang: '日文 · 女聲' },
    { code: 'ko-KR', name: 'SunHi', lang: '韓文 · 女聲' },
    { code: 'en-US-male', name: 'James', lang: '英文 · 男聲' },
  ]

  const ENGINES = [
    { id: 'openai', label: '🎙️ OpenAI', sub: 'gpt-4o-mini-tts', color: '#10b981' },
    { id: 'elevenlabs', label: '🎧 ElevenLabs', sub: 'Multilingual v2', color: '#a855f7' },
    { id: 'kokoro', label: '🔉 Kokoro', sub: 'inference.sh', color: '#f59e0b' },
  ]

  const SPEEDS = [0.75, 1, 1.25, 1.5, 2]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="header-glass sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              🎙️
            </div>
            <div>
              <h1 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                文字轉語音 <span style={{ color: 'var(--primary)', fontSize: '0.7em' }}>v2.0</span>
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
                <button className="btn-primary text-xs !py-1.5 !px-4" onClick={() => alert('請設定 Clerk API Key 以啟用登入功能')}>登入</button>
              )
            )}
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.08))' }}>
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.2) 0%, transparent 70%)' }} />
        <div className="max-w-3xl mx-auto px-5 py-10 text-center relative">
          <div className="inline-flex items-center gap-1.5 badge mb-4">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22d3ee', display: 'inline-block', boxShadow: '0 0 6px #22d3ee' }} />
            支援 OpenAI · ElevenLabs · Kokoro
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>
            將文字轉化為<span style={{ background: 'linear-gradient(135deg, #6366f1, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}> 自然語音</span>
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            選擇 AI 引擎與聲線，即時生成高品質配音
          </p>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-5 py-6 space-y-4 stagger">

        {/* File Upload */}
        <div className="glass-card p-5">
          <span className="label">📂 上傳檔案</span>
          <div
            className={`dropzone ${isDragging ? 'dragging' : ''}`}
            onClick={() => document.getElementById('fileInput')?.click()}
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => {
              e.preventDefault()
              setIsDragging(false)
              const file = e.dataTransfer.files[0]
              if (file) handleFile(file)
            }}
          >
            <div className="text-3xl mb-2">📄</div>
            <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-2)' }}>點擊或拖曳檔案至此</div>
            <div className="flex flex-wrap gap-1 justify-center">
              {['.txt', '.srt', '.vtt', '.lrc', '.epub', '.pdf', '.docx'].map(f => (
                <span key={f} className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--surface)', color: 'var(--text-3)' }}>{f}</span>
              ))}
            </div>
          </div>
          <input type="file" id="fileInput" accept=".txt,.srt,.vtt,.lrc,.epub,.pdf,.docx" className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }} />
        </div>

        {/* Mode Toggle */}
        <div className="glass-card p-5">
          <span className="label">🔊 轉換模式</span>
          <div className="mode-pill mb-4">
            <button className={mode === 'browser' ? 'active' : ''} onClick={() => setMode('browser')}>
              <span>🌐 瀏覽器</span>
              <span className="sub">免費，無需登入</span>
            </button>
            <button className={mode === 'api' ? 'active' : ''} onClick={() => setMode('api')}>
              <span>🤖 AI 雲端</span>
              <span className="sub">高品質，需登入</span>
            </button>
          </div>

          {mode === 'api' && (
            <div className="space-y-4 animate-slide-up">
              {/* Engine Selection */}
              <div>
                <span className="label">選擇 TTS 引擎</span>
                <div className="grid grid-cols-3 gap-2">
                  {ENGINES.map(eng => (
                    <button key={eng.id}
                      className={`engine-card ${engine === eng.id ? 'selected' : ''}`}
                      onClick={() => setEngine(eng.id)}>
                      <div className="font-semibold text-xs" style={{ color: engine === eng.id ? eng.color : 'var(--text-2)' }}>{eng.label}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{eng.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Plan Selection */}
              <div>
                <span className="label">選擇方案</span>
                <div className="flex gap-2">
                  {[
                    ['free', '免費', '10次/天', ''],
                    ['starter', 'Starter', '100次/天', ''],
                    ['pro', 'Pro', '1000次/天', 'badge badge-cyan'],
                  ].map(([id, label, badge, badgeClass]) => (
                    <button key={id}
                      className={`flex-1 py-2 px-2 rounded-xl border text-xs font-semibold transition-all ${plan === id ? 'border-indigo-500 bg-indigo-500/10' : 'border-transparent'} ${badgeClass || ''}`}
                      style={plan === id ? { borderColor: 'var(--primary)', background: 'rgba(99,102,241,0.1)' } : { background: 'var(--surface)' }}
                      onClick={() => setPlan(id as string)}>
                      <span style={{ color: plan === id ? 'var(--primary)' : 'var(--text-2)' }}>{label}</span>
                      <span className="block text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{badge}</span>
                    </button>
                  ))}
                </div>
              </div>

              {!user && (
                <div className="toast info text-xs">
                  💡 請先 <button className="underline font-bold ml-1" onClick={() => alert('請設定 Clerk API Key 以啟用登入功能')}>登入</button> 後再使用 API 模式
                </div>
              )}

              {user && (
                <div>
                  <span className="label">API Key <span style={{ color: 'var(--text-3)', textTransform: 'none', fontWeight: 400 }}>（留空使用已儲存的）</span></span>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    placeholder={engine === 'openai' ? 'sk-…' : engine === 'elevenlabs' ? 'ElevenLabs Key…' : 'inference.sh Key…'}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit' }}
                  />
                  <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>
                    💡 Key 僅儲存在瀏覽器本地，也可至 <Link href="/dashboard" className="font-semibold" style={{ color: 'var(--primary)' }}>控制台</Link> 安全儲存
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Text Input */}
        <div className="glass-card p-5">
          <div className="flex justify-between items-center mb-3">
            <span className="label mb-0">✍️ 輸入文字</span>
            <span className={`text-xs font-medium ${charCount > 5000 ? 'text-red-400' : ''}`} style={{ color: charCount > 5000 ? 'var(--danger)' : 'var(--text-3)' }}>
              {charCount.toLocaleString()} / 5,000
            </span>
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="在此輸入要轉換的文字，或上傳檔案..."
            className="tts-textarea"
          />
          <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--text-3)' }}>
            <span>⏱ 預估時長 · {estimatedSeconds}s</span>
            <span>📦 {chunks} 段落</span>
          </div>
        </div>

        {/* Voice Selection */}
        <div className="glass-card p-5">
          <span className="label">🎙️ 選擇聲音</span>
          <div className="grid grid-cols-3 gap-2">
            {VOICES.map(v => (
              <button
                key={v.code}
                className={`voice-card ${voice === v.code ? 'selected' : ''}`}
                onClick={() => setVoice(v.code)}
              >
                <div className="font-semibold text-sm" style={{ color: voice === v.code ? 'var(--primary)' : 'var(--text)' }}>{v.name}</div>
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
        <div className="glass-card p-5">
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
          <div className="grid grid-cols-3 gap-5">
            {[
              { label: '語速', id: 'speed', min: 0.5, max: 2, step: 0.25, val: speed, display: speed + 'x' },
              { label: '音調', id: 'pitch', min: -2, max: 2, step: 0.1, val: pitch, display: (pitch > 0 ? '+' : '') + pitch },
              { label: '音量', id: 'volume', min: 0, max: 1, step: 0.1, val: volume, display: Math.round(volume * 100) + '%' },
            ].map(s => (
              <div key={s.id}>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-2)' }}>{s.label}</label>
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
                <div className="text-center text-xs mt-1 font-medium" style={{ color: 'var(--text-3)' }}>{s.display}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Convert CTA */}
        <button
          onClick={handleConvert}
          disabled={isConverting}
          className="btn-primary w-full !py-4 !text-base"
          style={{ letterSpacing: '0.02em' }}
        >
          {isConverting ? (
            <>
              <span>⏳</span> 轉換中，請稍候…
            </>
          ) : (
            <>
              <span>🔊</span> 開始轉換
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
          <div className="glass-card p-5 animate-slide-up">
            <div className="flex items-center gap-2 mb-4">
              <div className="feat-icon !w-8 !h-8 !text-sm">🎉</div>
              <div>
                <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>轉換完成！</div>
                <div className="text-xs" style={{ color: 'var(--text-3)' }}>可下載 MP3 音頻檔案</div>
              </div>
            </div>
            <div className="progress-bar mb-4">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <audio src={audioUrl} controls className="audio-player w-full mb-4" />
            <button onClick={downloadAudio} className="btn-primary !py-2.5 !px-6 text-sm">
              ⬇️ 下載音頻
            </button>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="glass-card p-5">
            <div className="flex justify-between items-center mb-3">
              <span className="label mb-0">📜 轉換歷史</span>
              <button onClick={() => setHistory([])} className="btn-ghost text-xs">清除</button>
            </div>
            <div className="space-y-2">
              {history.map((item, i) => (
                <div key={i}
                  className="p-3 rounded-xl text-sm cursor-pointer transition-colors"
                  style={{ background: 'var(--surface)', color: 'var(--text-2)' }}
                  onClick={() => setText(item.text)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
                >
                  <div style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{item.text}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{item.time} · {item.mode}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer hint */}
        <div className="text-center pt-2 pb-6">
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            由 AI 驅動 · OpenAI · ElevenLabs · Kokoro
          </p>
        </div>
      </main>
    </div>
  )
}

function handleFile(file: File) {
  // file handling is done inline in onChange
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
  const voiceObj = voices.find(v => v.lang.includes(voiceCode.replace('-male', '')))
  if (voiceObj) utterance.voice = voiceObj
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}
