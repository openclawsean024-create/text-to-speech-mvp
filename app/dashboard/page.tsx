
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useClerkUser } from '@/hooks/useClerk'
import {
  BarChart3, CreditCard, Key, Lock, RefreshCw, Calendar,
  TrendingUp, Globe, Zap, Rocket, Mic, Headphones, Volume,
  Lightbulb, ClipboardList,
} from 'lucide-react'

type UsageData = {
  today: { used: number; limit: number }
  monthly: { used: number }
  history: { date: string; count: number }[]
}

type ApiKeys = Record<string, string | null>

export default function DashboardPage() {
  const { user, isLoaded } = useClerkUser()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [apiKeys, setApiKeys] = useState<ApiKeys | null>(null)
  const [plan, setPlan] = useState('free')
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
      const savedPlan = localStorage.getItem(`tts_plan_${(user as any)?.id || 'anonymous'}`)
      if (savedPlan) setPlan(savedPlan)
    }
  }, [user])

  const fetchUsage = async () => {
    try {
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

  const savePlan = (p: string) => {
    if (!user) return
    setPlan(p)
    localStorage.setItem(`tts_plan_${(user as any)?.id || 'anonymous'}`, p)
    showStatus(`方案已切換為 ${p}`, 'success')
  }

  const LIMITS: Record<string, number> = { free: 10, starter: 100, pro: 1000 }

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
          <div className="text-4xl mb-4"><Lock size={14} className="inline" /></div>
          <h1 className="text-xl font-bold mb-2">請先登入</h1>
          <p className="text-sm text-gray-500 mb-6">登入後才能使用控制台功能</p>
          <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold" onClick={() => alert("請設定 Clerk API Key 以啟用登入功能")}>登入 / 註冊</button>
          <Link href="/" className="block mt-4 text-sm text-gray-400 hover:text-gray-600">
            ← 返回首頁
          </Link>
        </div>
      </div>
    )
  }

  const todayLimit = LIMITS[plan] || 10
  const todayPct = usage ? Math.min((usage.today.used / todayLimit) * 100, 100) : 0

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
            <button className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full" onClick={() => alert("請設定 Clerk API Key 以啟用登入功能")}>登出</button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* Plan Selector */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="font-bold mb-3"><Rocket size={12} className="inline" /> 當前方案</div>
          <div className="flex gap-2">
            {[
              ['free', '<Globe size={12} className="inline" /> 免費', '10次/天'],
              ['starter', '<Zap size={12} className="inline" /> Starter', '100次/天'],
              ['pro', '<Rocket size={12} className="inline" /> Pro', '1000次/天'],
            ].map(([id, label, limit]) => (
              <button key={id}
                className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-colors ${plan === id ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200'}`}
                onClick={() => savePlan(id as string)}>
                <div>{label}</div>
                <div className="font-normal text-xs opacity-70">{limit}</div>
              </button>
            ))}
          </div>
          <div className="text-xs text-gray-400 mt-2"><Lightbulb size={12} className="inline" /> 方案切換即時生效，用量重置時間為每天午夜 UTC</div>
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
            {/* Today Stats */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="font-bold mb-4"><Calendar size={12} className="inline" /> 今日使用量</div>
              <div className="flex items-end gap-3 mb-4">
                <span className="text-5xl font-bold">{usage?.today.used ?? '-'}</span>
                <span className="text-gray-400 text-lg mb-1">/ {todayLimit} 次</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${todayPct > 80 ? 'bg-red-500' : todayPct > 50 ? 'bg-orange-400' : 'bg-blue-500'}`}
                  style={{ width: `${todayPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                <span>{todayPct.toFixed(0)}% 使用</span>
                <span>{Math.max(0, todayLimit - (usage?.today.used ?? 0))} 次剩餘</span>
              </div>
            </div>

            {/* Monthly Stats */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="font-bold mb-3"><Calendar size={12} className="inline" /> 本月使用量</div>
              <div className="text-3xl font-bold mb-1">{usage?.monthly.used ?? '-'} <span className="text-base font-normal text-gray-400">次</span></div>
              {usage && (
                <div className="text-xs text-gray-400">
                  日均 {Math.round(usage.monthly.used / new Date().getDate())} 次
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
