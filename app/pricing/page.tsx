export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { SignInButton, SignOutButton, SignedIn, SignedOut } from '@clerk/nextjs'

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            🎤 文字轉語音 v2.0
          </Link>
          <div className="flex items-center gap-3">
            <SignedIn>
              <Link href="/dashboard" className="text-xs px-3 py-1.5 bg-purple-50 text-purple-600 rounded-full font-semibold">
                📊 控制台
              </Link>
              <SignOutButton>
                <button className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full">登出</button>
              </SignOutButton>
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="text-xs px-4 py-1.5 bg-blue-600 text-white rounded-full font-semibold">登入</button>
              </SignInButton>
            </SignedOut>
            <Link href="/" className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full">← 開始使用</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-3">簡單透明的定價</h1>
          <p className="text-gray-500">從免費開始，隨著需求成長升級方案。所有方案均無隱藏費用。</p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          {/* Free */}
          <div className="bg-white rounded-2xl p-7 shadow-sm border-2 border-transparent hover:shadow-md transition-shadow">
            <div className="font-bold text-lg mb-1">🌐 免費方案</div>
            <div className="text-sm text-gray-400 mb-4">適合體驗與輕量使用</div>
            <div className="mb-5">
              <span className="text-4xl font-bold text-green-600">NT$0</span>
              <span className="text-sm text-gray-400 ml-1">/ 永久免費</span>
            </div>
            <div className="border-t border-gray-100 my-4" />
            <ul className="space-y-2.5 text-sm flex-1">
              {[
                ['✓', true, '每天 10 次轉換'],
                ['✓', true, '瀏覽器內建語音（免費）'],
                ['✓', true, '支援 .txt / .srt / .vtt / .lrc'],
                ['✓', true, '5,000 字上限'],
                ['✗', false, 'OpenAI TTS'],
                ['✗', false, 'ElevenLabs'],
                ['✗', false, 'Kokoro（inference.sh）'],
                ['✗', false, '商業使用授權'],
              ].map(([icon, ok, text], i) => (
                <li key={i} className={`flex items-center gap-2 ${ok ? '' : 'text-gray-400'}`}>
                  <span className={ok ? 'text-green-500 font-bold' : 'text-red-400'}>{icon}</span>
                  {text}
                </li>
              ))}
            </ul>
            <Link href="/" className="mt-6 block w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-center rounded-xl font-semibold transition-colors">
              免費開始
            </Link>
          </div>

          {/* Starter */}
          <div className="bg-white rounded-2xl p-7 shadow-sm border-2 border-transparent hover:shadow-md transition-shadow">
            <div className="font-bold text-lg mb-1">⚡ Starter</div>
            <div className="text-sm text-gray-400 mb-4">適合個人創作者與小專案</div>
            <div className="mb-5">
              <span className="text-4xl font-bold">NT$199</span>
              <span className="text-sm text-gray-400 ml-1">/ 月</span>
            </div>
            <div className="border-t border-gray-100 my-4" />
            <ul className="space-y-2.5 text-sm flex-1">
              {[
                ['✓', true, '每天 100 次轉換'],
                ['✓', true, '瀏覽器內建語音'],
                ['✓', true, 'OpenAI gpt-4o-mini-tts'],
                ['✓', true, 'ElevenLabs Multilingual v2'],
                ['✓', true, 'Kokoro（inference.sh）'],
                ['✓', true, '支援所有電子書格式'],
                ['✓', true, '商業使用授權'],
                ['✗', false, '優先客服支援'],
              ].map(([icon, ok, text], i) => (
                <li key={i} className={`flex items-center gap-2 ${ok ? '' : 'text-gray-400'}`}>
                  <span className={ok ? 'text-green-500 font-bold' : 'text-red-400'}>{icon}</span>
                  {text}
                </li>
              ))}
            </ul>
            <SignedIn>
              <Link href="/dashboard" className="mt-6 block w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-center rounded-xl font-semibold transition-colors">
                選擇 Starter
              </Link>
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="mt-6 w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors">
                  選擇 Starter
                </button>
              </SignInButton>
            </SignedOut>
          </div>

          {/* Pro */}
          <div className="bg-white rounded-2xl p-7 shadow-md border-2 border-blue-500 relative transform md:scale-105 hover:shadow-lg transition-shadow">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
              🔥 最受歡迎
            </div>
            <div className="font-bold text-lg mb-1">🚀 Pro</div>
            <div className="text-sm text-gray-400 mb-4">適合專業內容創作與商業用途</div>
            <div className="mb-5">
              <span className="text-4xl font-bold">NT$599</span>
              <span className="text-sm text-gray-400 ml-1">/ 月</span>
            </div>
            <div className="border-t border-gray-100 my-4" />
            <ul className="space-y-2.5 text-sm flex-1">
              {[
                ['✓', true, '每天 1,000 次轉換'],
                ['✓', true, '瀏覽器內建語音'],
                ['✓', true, 'OpenAI gpt-4o-mini-tts'],
                ['✓', true, 'ElevenLabs Multilingual v2'],
                ['✓', true, 'Kokoro（inference.sh）'],
                ['✓', true, '支援所有電子書格式'],
                ['✓', true, '無限歷史記錄'],
                ['✓', true, '優先客服 + 商業授權'],
              ].map(([icon, ok, text]) => (
                <li key={text as string} className="flex items-center gap-2">
                  <span className="text-green-500 font-bold">{icon}</span>
                  {text}
                </li>
              ))}
            </ul>
            <SignedIn>
              <Link href="/dashboard" className="mt-6 block w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-center rounded-xl font-semibold transition-colors">
                選擇 Pro
              </Link>
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="mt-6 w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors">
                  選擇 Pro
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </div>

        {/* Engine Comparison */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-5 text-center">🎙️ 引擎功能比較</h2>
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-4 font-semibold">功能</th>
                  <th className="p-3 text-center">🌐 瀏覽器</th>
                  <th className="p-3 text-center">🎙️ OpenAI</th>
                  <th className="p-3 text-center">🎧 ElevenLabs</th>
                  <th className="p-3 text-center">🔉 Kokoro</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['語音品質', '★★★☆☆', '★★★★★', '★★★★★', '★★★★☆'],
                  ['中文支援', '✓', '基礎', '✓', '✓'],
                  ['多語言', '視瀏覽器', '✓ 30+', '✓ 30+', '✓'],
                  ['語速調整', '✓', '✓', '✓', '✓'],
                  ['可下載', '✗', '✓ MP3', '✓ MP3', '✓'],
                  ['費用', '免費', 'API 计費', 'API 计費', 'API 计費'],
                  ['適合用途', '快速試用', '高品質配音', '專業製作', '開源/實驗'],
                ].map(([feature, ...cols]) => (
                  <tr key={feature as string} className="border-t border-gray-100">
                    <td className="p-4 font-medium">{feature}</td>
                    {cols.map((c, i) => (
                      <td key={i} className={`p-3 text-center ${c === '✗' ? 'text-red-400' : c === '✓' ? 'text-green-500 font-bold' : 'text-gray-600'}`}>
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
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-5 text-center">💬 常見問題</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              ['免費方案會過期嗎？', '不會。免費方案可以永久使用，每天 10 次轉換，無時間限制。'],
              ['轉換次數如何計算？', '每次點擊「開始轉換」算一次，不論文字長度或引擎選擇。API 模式下的轉換使用你自己的 API Key。'],
              ['我的 API Key 安全嗎？', '非常安全。API Key 儲存在你自己瀏覽器本地或我們的安全資料庫，不會分享給第三方。'],
              ['支援哪些電子書格式？', '支援 EPUB、PDF、DOCX 直接在瀏覽器內解析。Mobi 和 Azw3 格式需要轉換後上傳。'],
              ['我可以自訂聲音嗎？', 'ElevenLabs 支援聲音克隆（需帳號設定）。其他引擎使用預設聲音。'],
              ['如何升級方案？', '直接在控制台切換方案即可。即將支援線上升級功能。'],
            ].map(([q, a]) => (
              <div key={q} className="bg-white rounded-xl p-5 shadow-sm">
                <div className="font-bold text-sm mb-2">{q}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{a}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Banner */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-10 text-center text-white mb-8">
          <h2 className="text-2xl font-bold mb-3">準備好開始了嗎？</h2>
          <p className="opacity-85 text-sm mb-5">
            免費方案無需註冊，立即使用瀏覽器內建語音。<br />
            需要高品質配音？選擇適合你的方案。
          </p>
          <Link href="/" className="inline-block px-8 py-3.5 bg-white text-purple-600 rounded-full font-bold hover:scale-105 transition-transform">
            🚀 免費開始使用
          </Link>
        </div>
      </div>

      <footer className="text-center py-6 text-gray-400 text-xs">
        © 2026 文字轉語音 v2.0 · 支援多引擎 AI TTS
      </footer>
    </div>
  )
}
