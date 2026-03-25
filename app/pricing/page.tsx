'use client'

import Link from 'next/link'

export default function PricingPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="header-glass sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>🎙️</div>
            <div>
              <h1 className="text-sm font-bold" style={{ color: 'var(--text)' }}>文字轉語音 <span style={{ color: 'var(--primary)', fontSize: '0.7em' }}>v2.0</span></h1>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>多引擎 AI TTS</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="btn-secondary text-xs">📊 控制台</Link>
            <Link href="/" className="btn-ghost text-xs">← 開始使用</Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 py-12 space-y-12">

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 badge mb-4">💰 簡單透明的定價</div>
          <h2 className="text-3xl font-bold mb-3" style={{ color: 'var(--text)' }}>選擇適合你的方案</h2>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>從免費開始，隨需求成長升級。所有方案均無隱藏費用。</p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Free */}
          <div className="plan-card">
            <div className="font-bold text-base mb-0.5" style={{ color: 'var(--text)' }}>🌐 免費方案</div>
            <div className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>適合體驗與輕量使用</div>
            <div className="mb-5">
              <span className="text-4xl font-bold" style={{ color: '#10b981' }}>NT$0</span>
              <span className="text-sm ml-1" style={{ color: 'var(--text-3)' }}>/ 永久免費</span>
            </div>
            <div className="divider" />
            <ul className="space-y-2.5 text-sm flex-1">
              {[
                ['✓', true, '每天 10 次轉換'],
                ['✓', true, '瀏覽器內建語音（免費）'],
                ['✓', true, '支援 .txt / .srt / .vtt / .lrc'],
                ['✓', true, '5,000 字上限'],
                ['✗', false, 'OpenAI TTS'],
                ['✗', false, 'ElevenLabs'],
                ['✗', false, 'Kokoro'],
                ['✗', false, '商業使用授權'],
              ].map(([icon, ok, text]) => (
                <li key={text as string} className="flex items-center gap-2" style={{ color: ok ? 'var(--text-2)' : 'var(--text-3)' }}>
                  <span style={{ color: ok ? '#10b981' : '#ef4444', fontWeight: 700 }}>{icon}</span>
                  {text}
                </li>
              ))}
            </ul>
            <Link href="/" className="mt-6 block w-full py-3 text-center rounded-xl font-semibold text-sm transition-all"
              style={{ background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              免費開始
            </Link>
          </div>

          {/* Starter */}
          <div className="plan-card">
            <div className="font-bold text-base mb-0.5" style={{ color: 'var(--text)' }}>⚡ Starter</div>
            <div className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>適合個人創作者與小專案</div>
            <div className="mb-5">
              <span className="text-4xl font-bold" style={{ color: 'var(--text)' }}>NT$199</span>
              <span className="text-sm ml-1" style={{ color: 'var(--text-3)' }}>/ 月</span>
            </div>
            <div className="divider" />
            <ul className="space-y-2.5 text-sm flex-1">
              {[
                ['✓', true, '每天 100 次轉換'],
                ['✓', true, 'OpenAI gpt-4o-mini-tts'],
                ['✓', true, 'ElevenLabs Multilingual v2'],
                ['✓', true, 'Kokoro（inference.sh）'],
                ['✓', true, '支援所有電子書格式'],
                ['✓', true, '商業使用授權'],
              ].map(([icon, ok, text]) => (
                <li key={text as string} className="flex items-center gap-2" style={{ color: ok ? 'var(--text-2)' : 'var(--text-3)' }}>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>{icon}</span>
                  {text}
                </li>
              ))}
            </ul>
            <Link href="/dashboard" className="mt-6 block w-full py-3 text-center rounded-xl font-semibold text-sm btn-primary !text-xs !py-2.5">
              選擇 Starter
            </Link>
          </div>

          {/* Pro */}
          <div className="plan-card featured">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
              🔥 最受歡迎
            </div>
            <div className="font-bold text-base mb-0.5" style={{ color: 'var(--primary)' }}>🚀 Pro</div>
            <div className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>適合專業內容創作與商業用途</div>
            <div className="mb-5">
              <span className="text-4xl font-bold" style={{ color: 'var(--text)' }}>NT$599</span>
              <span className="text-sm ml-1" style={{ color: 'var(--text-3)' }}>/ 月</span>
            </div>
            <div className="divider" />
            <ul className="space-y-2.5 text-sm flex-1">
              {[
                ['✓', true, '每天 1,000 次轉換'],
                ['✓', true, 'OpenAI · ElevenLabs · Kokoro'],
                ['✓', true, '支援所有電子書格式'],
                ['✓', true, '無限歷史記錄'],
                ['✓', true, '優先客服 + 商業授權'],
              ].map(([icon, ok, text]) => (
                <li key={text as string} className="flex items-center gap-2" style={{ color: 'var(--text-2)' }}>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>{icon}</span>
                  {text}
                </li>
              ))}
            </ul>
            <Link href="/dashboard" className="mt-6 block w-full py-3 text-center rounded-xl font-semibold text-sm btn-primary !text-xs !py-2.5">
              選擇 Pro
            </Link>
          </div>
        </div>

        {/* Engine Comparison */}
        <div>
          <h2 className="text-xl font-bold mb-5 text-center" style={{ color: 'var(--text)' }}>🎙️ 引擎功能比較</h2>
          <div className="glass-card overflow-hidden !p-0">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th className="text-left p-4 font-semibold text-xs" style={{ color: 'var(--text-2)' }}>功能</th>
                  <th className="p-3 text-center text-xs" style={{ color: 'var(--text-3)' }}>🌐 瀏覽器</th>
                  <th className="p-3 text-center text-xs" style={{ color: 'var(--text-3)' }}>🎙️ OpenAI</th>
                  <th className="p-3 text-center text-xs" style={{ color: 'var(--text-3)' }}>🎧 ElevenLabs</th>
                  <th className="p-3 text-center text-xs" style={{ color: 'var(--text-3)' }}>🔉 Kokoro</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['語音品質', '★★★☆☆', '★★★★★', '★★★★★', '★★★★☆'],
                  ['中文支援', '✓', '基礎', '✓', '✓'],
                  ['多語言', '視瀏覽器', '✓ 30+', '✓ 30+', '✓'],
                  ['語速調整', '✓', '✓', '✓', '✓'],
                  ['可下載', '✗', '✓ MP3', '✓ MP3', '✓'],
                  ['費用', '免費', 'API 计费', 'API 计费', 'API 计费'],
                  ['適合用途', '快速試用', '高品質配音', '專業製作', '開源/實驗'],
                ].map(([feature, ...cols]) => (
                  <tr key={feature as string} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="p-4 font-medium text-xs" style={{ color: 'var(--text-2)' }}>{feature}</td>
                    {cols.map((c, i) => (
                      <td key={i} className="p-3 text-center text-xs" style={{ color: c === '✗' ? '#ef4444' : c === '✓' ? '#10b981' : 'var(--text-3)' }}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-xl font-bold mb-5 text-center" style={{ color: 'var(--text)' }}>💬 常見問題</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ['免費方案會過期嗎？', '不會。免費方案可以永久使用，每天 10 次轉換，無時間限制。'],
              ['轉換次數如何計算？', '每次點擊「開始轉換」算一次，不論文字長度或引擎選擇。'],
              ['我的 API Key 安全嗎？', 'API Key 儲存在你自己瀏覽器本地或安全資料庫，不會分享給第三方。'],
              ['支援哪些電子書格式？', '支援 EPUB、PDF、DOCX 直接在瀏覽器內解析。'],
              ['我可以自訂聲音嗎？', 'ElevenLabs 支援聲音克隆（需帳號設定）。其他引擎使用預設聲音。'],
              ['如何升級方案？', '直接在控制台切換方案即可。即將支援線上升級功能。'],
            ].map(([q, a]) => (
              <div key={q} className="glass-card p-4">
                <div className="font-semibold text-xs mb-2" style={{ color: 'var(--text)' }}>{q}</div>
                <div className="text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>{a}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Banner */}
        <div className="rounded-2xl p-10 text-center relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))', border: '1px solid rgba(99,102,241,0.3)' }}>
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.4) 0%, transparent 70%)' }} />
          <div className="relative">
            <h2 className="text-2xl font-bold mb-3 text-white">準備好開始了嗎？</h2>
            <p className="opacity-80 text-sm mb-5" style={{ color: '#e2e8f0' }}>
              免費方案無需註冊，立即使用瀏覽器內建語音。<br />
              需要高品質配音？選擇適合你的方案。
            </p>
            <Link href="/" className="inline-block px-8 py-3 rounded-full font-bold text-sm hover:scale-105 transition-transform" style={{ background: 'white', color: '#4f46e5' }}>
              🚀 免費開始使用
            </Link>
          </div>
        </div>
      </div>

      <footer className="text-center py-6 text-xs" style={{ color: 'var(--text-3)' }}>
        © 2026 文字轉語音 v2.0 · 支援多引擎 AI TTS
      </footer>
    </div>
  )
}
