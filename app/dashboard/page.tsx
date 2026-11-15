
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useClerkUser } from '@/hooks/useClerk'
import { SignedIn, SignedOut, UserButton, RedirectToSignIn } from '@clerk/nextjs'
import {
  BarChart3, CreditCard, Key, Lock, RefreshCw, Calendar,
  TrendingUp, Globe, Zap, Rocket, Mic, Headphones, Volume,
  Lightbulb, ClipboardList,
} from 'lucide-react'

type UsageData = {
  plan: { id: string; name: string; paid: boolean }
  chars: {
    period: string
    used: number
    limit: number | null
    remaining: number | null
    resetsAt: string
    limitIsTestValue: boolean
  }
  today: { used: number }
  monthly: { used: number }
  history: { date: string; count: number }[]
}

type ApiKeys = Record<string, string | null>

export default function DashboardPage() {
  const { user, isLoaded } = useClerkUser()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [apiKeys, setApiKeys] = useState<ApiKeys | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [newKey, setNewKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [activeTab, setActiveTab] = useState<'usage' | 'keys'>('usage')

  const showStatus = (msg: string, type: 'success' | 'error') => {
    setStatus({ msg, type })
    setTimeout(() => setStatus(null), 5000)
  }

  useEffect(() => {
    if (user) {
      fetchUsage()
      fetchApiKeys()
    }
  }, [user])

  const fetchUsage = async () => {
    try {
      // 方案由伺服器端依訂閱紀錄決定，不由用戶端指定
      const res = await fetch('/api/usage')
      if (res.ok) {
        const data = await res.json()
        setUsage(data)
      }
    } catch (e) {
      console.error('Failed to fetch usage', e)
    }
  }

  const fetchApiKeys = async () => {
    try {
      const res = await fetch('/api/keys')
      if (res.ok) setApiKeys(await res.json())
    } catch (e) {
      console.error('Failed to fetch keys', e)
    }
  }

  const saveApiKey = async (engine: string) => {
    if (!user) return
    if (newKey.length > 0 && newKey.length < 8) {
      showStatus('API Key 太短', 'error')
      return
    }
    setSaving(true)
    try {
      if (newKey.length > 0) {
        const res = await fetch('/api/keys', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ engine, apiKey: newKey }),
        })
        if (!res.ok) {
          const e = await res.json()
          throw new Error(e.error || '儲存失敗')
        }
        showStatus(`${engine} API Key 已儲存`, 'success')
      } else {
        const res = await fetch(`/api/keys?engine=${engine}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('刪除失敗')
        showStatus(`${engine} API Key 已刪除`, 'success')
      }
      setEditingKey(null)
      setNewKey('')
      await fetchApiKeys()
    } catch (e: unknown) {
      showStatus((e instanceof Error ? e.message : '錯誤'), 'error')
    }
    setSaving(false)
  }


  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">載入中...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center max-w-sm">
          <div className="text-4xl mb-4"><Lock size={48} className="inline" style={{ color: 'var(--primary)' }}/></div>
          <h1 className="text-xl font-bold mb-2">請先登入</h1>
          <p className="text-sm text-gray-500 mb-6">登入後才能使用控制台功能</p>
          <RedirectToSignIn />
          <Link href="/" className="block mt-4 text-sm text-gray-400 hover:text-gray-600">
            ← 返回首頁
          </Link>
        </div>
      </div>
    )
  }

  const charLimit = usage?.chars.limit ?? null
  const charUsed = usage?.chars.used ?? 0
  const charPct = usage && charLimit ? Math.min((charUsed / charLimit) * 100, 100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
              <BarChart3 size={14} className="inline" /> 控制台
            </h1>
            <p className="text-xs text-gray-400">{(user as any)?.emailAddresses?.[0]?.emailAddress || 'Demo User'}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full">← 首頁</Link>
            <Link href="/pricing" className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full font-semibold"><CreditCard size={12} className="inline" /> 定價</Link>
            <SignedIn><UserButton afterSignOutUrl="/" /></SignedIn>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* Current plan (server-side, read-only) */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="font-bold mb-3"><Rocket size={12} className="inline" /> 當前方案</div>
          <div className="text-2xl font-bold">{usage?.plan.name ?? '—'}</div>
          <div className="text-xs text-gray-400 mt-2">
            <Lightbulb size={12} className="inline" /> 方案依訂閱紀錄由伺服器端決定，無法在此切換；升級請至定價頁。
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="bg-white rounded-2xl p-1 shadow-sm flex">
          <button
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'usage' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}
            onClick={() => setActiveTab('usage')}>
            <BarChart3 size={14} className="inline" /> 使用量
          </button>
          <button
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'keys' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}
            onClick={() => setActiveTab('keys')}>
            <Key size={12} className="inline" /> API Keys
          </button>
        </div>

        {/* Status */}
        {status && (
          <div className={`px-4 py-3 rounded-xl text-sm ${status.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
            {status.msg}
          </div>
        )}

        {/* Usage Tab */}
        {activeTab === 'usage' && (
          <>
            {/* Monthly character quota (billing unit) */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="font-bold mb-4"><Calendar size={12} className="inline" /> 本月字數用量</div>
              <div className="flex items-end gap-3 mb-4">
                <span className="text-5xl font-bold">{usage ? charUsed.toLocaleString() : '-'}</span>
                <span className="text-gray-400 text-lg mb-1">/ {charLimit === null ? '不限' : charLimit.toLocaleString()} 字</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${charPct > 80 ? 'bg-red-500' : charPct > 50 ? 'bg-orange-400' : 'bg-blue-500'}`}
                  style={{ width: `${charPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                <span>{charPct.toFixed(0)}% 使用</span>
                <span>{usage?.chars.remaining === null || usage?.chars.remaining === undefined ? '—' : `${usage.chars.remaining.toLocaleString()} 字剩餘`}</span>
              </div>
              {usage?.chars.limitIsTestValue && (
                <div className="text-xs text-gray-400 mt-2">額度為測試值，正式數值尚未公布。</div>
              )}
            </div>

            {/* Request counts (display only) */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="font-bold mb-3"><Calendar size={12} className="inline" /> 轉換次數</div>
              <div className="text-3xl font-bold mb-1">{usage?.monthly.used ?? '-'} <span className="text-base font-normal text-gray-400">次（本月）</span></div>
              {usage && (
                <div className="text-xs text-gray-400">
                  今日 {usage.today.used} 次・日均 {Math.round(usage.monthly.used / new Date().getDate())} 次（次數僅供參考，不作為額度依據）
                </div>
              )}
            </div>

            {/* History Chart */}
            {usage && usage.history.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="font-bold mb-4"><TrendingUp size={12} className="inline" /> 近 {usage.history.length} 天使用趨勢</div>
                <div className="flex items-end gap-1 h-32">
                  {usage.history.map((day, i) => {
                    const maxCount = Math.max(...usage.history.map(d => d.count), 1)
                    const height = day.count === 0 ? 4 : Math.max((day.count / maxCount) * 100, 8)
                    const isToday = day.date === new Date().toISOString().split('T')[0]
                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex flex-col items-center justify-end" style={{ height: '96px' }}>
                          <div
                            className={`w-full rounded-t-sm transition-all ${isToday ? 'bg-blue-600' : 'bg-blue-300'}`}
                            style={{ height: `${height}%` }}
                            title={`${day.date}: ${day.count} 次`}
                          />
                        </div>
                        <div className={`text-xs ${isToday ? 'font-bold text-blue-600' : 'text-gray-400'}`}>
                          {new Date(day.date).getDate()}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="text-xs text-gray-400 text-center mt-2">左至右：最早 → 今天</div>
              </div>
            )}

            {/* Refresh */}
            <button onClick={fetchUsage} className="w-full py-2.5 bg-white border-2 border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
              <RefreshCw size={12} className="inline" /> 重新整理
            </button>
          </>
        )}

        {/* API Keys Tab */}
        {activeTab === 'keys' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="font-bold mb-1"><Key size={12} className="inline" /> API Key 管理</div>
              <div className="text-xs text-gray-400 mb-4">
                儲存你的 API Key，下次使用時無需重新輸入。Key 使用 TLS 加密傳輸。
              </div>

              {[
                { engine: 'openai', label: '<Mic size={12} className="inline" /> OpenAI', sub: 'GPT-4o Mini TTS', placeholder: 'sk-...' },
                { engine: 'elevenlabs', label: '<Headphones size={12} className="inline" /> ElevenLabs', sub: 'Multilingual v2', placeholder: 'ElevenLabs API Key...' },
                { engine: 'kokoro', label: '<Volume size={12} className="inline" /> Kokoro / inference.sh', sub: 'inference.sh API', placeholder: 'inference.sh API Key...' },
              ].map(({ engine, label, sub, placeholder }) => (
                <div key={engine} className="border-t border-gray-100 py-4 first:border-t-0">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-semibold text-sm">{label}</div>
                      <div className="text-xs text-gray-400">{sub}</div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {apiKeys?.[engine] ?? '未設定'}
                    </div>
                  </div>
                  {editingKey === engine ? (
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={newKey}
                        onChange={e => setNewKey(e.target.value)}
                        placeholder={placeholder}
                        className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => saveApiKey(engine)}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50">
                        {saving ? '儲存中...' : '儲存'}
                      </button>
                      <button
                        onClick={() => { setEditingKey(null); setNewKey('') }}
                        className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-xl">
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingKey(engine); setNewKey('') }}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
                        {apiKeys?.[engine] ? '更新 Key' : '新增 Key'}
                      </button>
                      {apiKeys?.[engine] && (
                        <button
                          onClick={() => { setEditingKey(engine); setNewKey(''); saveApiKey(engine) }}
                          className="px-3 py-2 bg-red-50 text-red-500 text-sm rounded-xl">
                          刪除
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-blue-50 rounded-2xl p-4 text-xs text-blue-700">
              <strong>安全提示：</strong>你的 API Key 只會用於你自己的 TTS 請求。我們不會儲存、監控或收費這些請求。所有 API 費用由你直接支付給對應服務商。
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
