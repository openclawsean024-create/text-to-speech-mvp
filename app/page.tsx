'use client'

import { useState, useEffect, useCallback } from 'react'
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

  const showStatus = (msg: string, type: 'info' | 'error' | 'success') => {
    setStatus({ msg, type })
    setTimeout(() => setStatus(null), 6000)
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
    if (!text.trim()) { showStatus('請輸入文字', 'error'); return }
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
    showStatus('✅ 播放中（瀏覽器模式）', 'success')
  }

  const convertAPI = async () => {
    if (!user) { showStatus('請先登入', 'error'); return }

    const body: Record<string, unknown> = {
      text,
      engine,
      voice,
      speed,
      plan,
    }
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
    showStatus(`✅ 轉換完成！(${engine} 引擎)`, 'success')

    // Save to history
    const item = { text: text.slice(0, 50) + (text.length > 50 ? '...' : ''), time: new Date().toLocaleString('zh-TW'), mode: engine }
    setHistory(prev => [item, ...prev.slice(0, 9)])
    persistSettings()
  }

  const downloadAudio = () => {
    if (!audioUrl) return
    const a = document.createElement('a')
    a.href = audioUrl
    a.download = `tts-${Date.now()}.mp3`
    a.click()
    showStatus('⬇️ 下載開始！', 'success')
  }

  const VOICES = [
    { code: 'zh-CN', name: '曉曉', lang: '中文-女' },
    { code: 'zh-TW', name: '雲希', lang: '中文-男' },
    { code: 'en-US', name: 'Jenny', lang: '英文-女' },
    { code: 'ja-JP', name: '七海', lang: '日文-女' },
    { code: 'ko-KR', name: 'SunHi', lang: '韓文-女' },
    { code: 'en-US-male', name: 'James', lang: '英文-男' },
  ]

  const ENGINES = [
    { id: 'openai', label: '🎙️ OpenAI', sub: 'gpt-4o-mini-tts' },
    { id: 'elevenlabs', label: '🎧 ElevenLabs', sub: 'Multilingual v2' },
    { id: 'kokoro', label: '🔉 Kokoro', sub: 'inference.sh' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
              🎤 文字轉語音 v2.0
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">多引擎 AI TTS</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full font-semibold">
              💰 定價
            </Link>
            {isLoaded && (
              user ? (
                <>
                  <Link href="/dashboard" className="text-xs px-3 py-1.5 bg-purple-50 text-purple-600 rounded-full font-semibold">
                    📊 控制台
                  </Link>
                  <button className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full" onClick={() => alert("請設定 Clerk API Key 以啟用登入功能")}>登出</button>
                </>
              ) : (
                <button className="text-xs px-4 py-1.5 bg-blue-600 text-white rounded-full font-semibold" onClick={() => alert("請設定 Clerk API Key 以啟用登入功能")}>登入</button>
              )
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* File Upload Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="font-semibold text-sm mb-3">📁 上傳檔案</div>
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            onClick={() => document.getElementById('fileInput')?.click()}>
            <div className="text-3xl mb-2">📄</div>
            <div className="text-gray-400 text-sm">點擊或拖曳檔案至此</div>
            <div className="flex flex-wrap gap-1 justify-center mt-2">
              {['.txt', '.srt', '.vtt', '.lrc', '.epub', '.pdf', '.docx'].map(f => (
                <span key={f} className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-400">{f}</span>
              ))}
            </div>
          </div>
          <input type="file" id="fileInput" accept=".txt,.srt,.vtt,.lrc,.epub,.pdf,.docx" className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = ev => {
                let t = (ev.target?.result as string) || ''
                if (file.name.endsWith('.srt') || file.name.endsWith('.vtt')) {
                  t = t.replace(/\d+\n\d{2}:\d{2}:\d{2}[,\.]\d{3} --> \d{2}:\d{2}:\d{2}[,\.]\d{3}/g, '')
                }
                if (file.name.endsWith('.lrc')) {
                  t = t.replace(/\[\d{2}:\d{2}\.\d{2}\]/g, '')
                }
                t = t.trim()
                if (t.length > 5000) { t = t.slice(0, 5000); showStatus('檔案已截斷至 5000 字', 'info') }
                setText(t)
                showStatus(`已載入 ${file.name}（${t.length} 字）`, 'info')
              }
              reader.readAsText(file)
            }} />
        </div>

        {/* Mode Toggle */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="font-semibold text-sm mb-3">🔊 轉換模式</div>
          <div className="flex gap-2">
            <button
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${mode === 'browser' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'}`}
              onClick={() => setMode('browser')}
            >
              🌐 瀏覽器內建<br /><span className="font-normal text-xs opacity-70">免費，立即使用</span>
            </button>
            <button
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${mode === 'api' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'}`}
              onClick={() => setMode('api')}
            >
              🤖 AI 雲端引擎<br /><span className="font-normal text-xs opacity-70">高品質，需登入</span>
            </button>
          </div>

          {mode === 'api' && (
            <div className="mt-4 space-y-3">
              <div>
                <div className="font-semibold text-xs mb-2">選擇 TTS 引擎</div>
                <div className="grid grid-cols-3 gap-2">
                  {ENGINES.map(eng => (
                    <button key={eng.id}
                      className={`py-2 px-1 rounded-xl border-2 text-center transition-colors ${engine === eng.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                      onClick={() => setEngine(eng.id)}>
                      <div className="font-semibold text-xs">{eng.label}</div>
                      <div className="text-xs text-gray-400">{eng.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="font-semibold text-xs mb-2">選擇方案</div>
                <div className="flex gap-2">
                  {[['free', '免費', '10次/天'], ['starter', 'Starter', '100次/天'], ['pro', 'Pro', '1000次/天']].map(([id, label, badge]) => (
                    <button key={id}
                      className={`flex-1 py-1.5 px-2 rounded-lg border-2 text-xs font-semibold transition-colors ${plan === id ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200'}`}
                      onClick={() => setPlan(id as string)}>
                      {label} <span className="bg-orange-400 text-white px-1 rounded text-xs ml-0.5">{badge}</span>
                    </button>
                  ))}
                </div>
              </div>

              {!user && (
                <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-600">
                  請先 <button className="underline font-semibold" onClick={() => alert("請設定 Clerk API Key 以啟用登入功能")}>登入</button> 後再使用 API 模式
                </div>
              )}

              {user && (
                <>
                  <div>
                    <div className="font-semibold text-xs mb-1.5">API Key {engine === 'openai' ? '(可留空，使用已儲存的)' : '(可留空，使用已儲存的)'}</div>
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={e => setApiKeyInput(e.target.value)}
                      placeholder={engine === 'openai' ? 'sk-...（留空使用已儲存的 Key）' : engine === 'elevenlabs' ? 'ElevenLabs Key...' : 'inference.sh Key...'}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-2.5">
                    💡 API Key 僅在你瀏覽器本地儲存，也可至 <Link href="/dashboard" className="text-blue-600 underline">控制台</Link> 安全儲存
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Text Input */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <div className="font-semibold text-sm">✍️ 輸入文字</div>
            <div className={`text-xs ${charCount > 5000 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
              {charCount}/5000 字
            </div>
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="請輸入要轉換的文字，或上傳檔案..."
            className="w-full h-40 p-4 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none resize-none"
          />
          <div className="flex gap-4 text-xs text-gray-400 mt-2">
            <span>預估時長：{estimatedSeconds} 秒</span>
            <span>分段：{chunks}</span>
          </div>
        </div>

        {/* Voice Selection */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="font-semibold text-sm mb-3">選擇聲音</div>
          <div className="grid grid-cols-3 gap-2">
            {VOICES.map(v => (
              <button key={v.code}
                className={`p-3 rounded-xl border-2 text-center transition-colors ${voice === v.code ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                onClick={() => setVoice(v.code)}>
                <div className="font-semibold text-sm">{v.name}</div>
                <div className="text-xs text-gray-400">{v.lang}</div>
                <button
                  className="mt-1 text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full"
                  onClick={e => { e.stopPropagation(); previewVoice(v.code) }}>
                  ▶ 試聽
                </button>
              </button>
            ))}
          </div>
        </div>

        {/* Speed Settings */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="font-semibold text-sm mb-3">語速預設</div>
          <div className="flex gap-2 flex-wrap mb-4">
            {[0.75, 1, 1.25, 1.5, 2].map(s => (
              <button key={s}
                className={`px-4 py-2 rounded-full text-sm border-2 transition-colors ${speed === s ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 hover:border-blue-300'}`}
                onClick={() => setSpeed(s)}>
                {s}x
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: '語速', id: 'speed', min: 0.5, max: 2, step: 0.25, val: speed, display: speed + 'x' },
              { label: '音調', id: 'pitch', min: -2, max: 2, step: 0.1, val: pitch, display: (pitch > 0 ? '+' : '') + pitch },
              { label: '音量', id: 'volume', min: 0, max: 1, step: 0.1, val: volume, display: Math.round(volume * 100) + '%' },
            ].map(s => (
              <div key={s.id}>
                <label className="text-xs font-medium block mb-1">{s.label}</label>
                <input
                  type="range"
                  min={s.min} max={s.max} step={s.step} value={s.val}
                  onChange={e => {
                    const v = parseFloat(e.target.value)
                    if (s.id === 'speed') setSpeed(v)
                    else if (s.id === 'pitch') setPitch(v)
                    else setVolume(v)
                  }}
                  className="w-full accent-blue-500"
                />
                <div className="text-center text-xs text-gray-400 mt-0.5">{s.display}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Convert Button */}
        <button
          onClick={handleConvert}
          disabled={isConverting}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold text-base rounded-2xl transition-colors">
          {isConverting ? '⏳ 轉換中...' : '🔊 開始轉換'}
        </button>

        {/* Status */}
        {status && (
          <div className={`px-4 py-3 rounded-xl text-sm ${status.type === 'error' ? 'bg-red-50 text-red-600' : status.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
            {status.msg}
          </div>
        )}

        {/* Result */}
        {audioUrl && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="font-bold mb-3">🎉 轉換完成！</div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <audio src={audioUrl} controls className="w-full mt-2" />
            <button onClick={downloadAudio} className="mt-3 flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white font-semibold text-sm rounded-xl transition-colors">
              ⬇️ 下載音頻
            </button>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="font-semibold text-sm mb-3 flex justify-between items-center">
              轉換歷史
              <button onClick={() => setHistory([])} className="text-xs px-2 py-1 bg-gray-100 rounded-lg">清除</button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {history.map((item, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-xl text-sm cursor-pointer hover:bg-blue-50"
                  onClick={() => setText(item.text)}>
                  {item.text}<div className="text-xs text-gray-400 mt-1">{item.time} · {item.mode}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
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
  const voiceObj = voices.find(v => v.lang.includes(voiceCode.replace('-male', '')))
  if (voiceObj) utterance.voice = voiceObj
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}
