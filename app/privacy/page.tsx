import { Metadata } from 'next'
import { Mic } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '隱私權政策',
  description: '文字轉語音服務的隱私權政策，說明我們如何收集、使用、儲存和保護您的個人資料。',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="header-glass sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}><Mic size={14} className="inline" /></div>
            <div>
              <h1 className="text-sm font-bold" style={{ color: 'var(--text)' }}>文字轉語音 <span style={{ color: 'var(--primary)', fontSize: '0.7em' }}>v2.0</span></h1>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>多引擎 AI TTS</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/pricing" className="btn-secondary text-xs">定價</Link>
            <Link href="/" className="btn-ghost text-xs">← 開始使用</Link>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-12">
        <h1 className="text-3xl font-black mb-2" style={{ color: 'var(--text)' }}>隱私權政策</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-3)' }}>最後更新：2026 年 4 月 30 日</p>

        <div className="space-y-8" style={{ color: 'var(--text-2)', lineHeight: '1.8' }}>
          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text)' }}>1. 資料收集</h2>
            <p className="text-sm mb-3">我們收集以下資訊：</p>
            <ul className="text-sm space-y-1.5 list-disc pl-5">
              <li><strong>帳號資料：</strong>當您使用 Clerk 登入時，我們會收集您的電子郵件地址，這由 Clerk 提供並受其隱私權政策約束。</li>
              <li><strong>上傳的檔案：</strong>您上傳的 .txt、.srt、.vtt、.lrc、.epub、.pdf、.docx 檔案只用於文字提取，系統不會永久儲存這些檔案。</li>
              <li><strong>API Key：</strong>您選擇儲存的 API Key 以加密方式儲存在 Vercel KV（Upstash），僅用於發起 TTS 請求。</li>
              <li><strong>使用量資料：</strong>每日轉換次數、使用的引擎、字元數，以用於用量統計與額度控制。</li>
              <li><strong>技術日誌：</strong>IP 位址、瀏覽器類型、操作系統（用於除錯與安全監控）。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text)' }}>2. 資料使用</h2>
            <ul className="text-sm space-y-1.5 list-disc pl-5">
              <li>處理您的文字轉語音請求</li>
              <li>驗證您的帳號與用量限額</li>
              <li>儲存您選擇的 API Key（加密）</li>
              <li>提供用量統計與歷史記錄</li>
              <li>改善服務品質與效能</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text)' }}>3. 第三方服務</h2>
            <p className="text-sm mb-3">我們使用以下第三方服務，它們各有獨立的隱私權政策：</p>
            <ul className="text-sm space-y-1.5 list-disc pl-5">
              <li><strong>Clerk：</strong>認證服務（<a href="https://clerk.com/privacy" target="_blank" rel="noopener" style={{ color: 'var(--primary-light)' }}>隱私權政策</a>）</li>
              <li><strong>Vercel：</strong>網站託管服務（<a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener" style={{ color: 'var(--primary-light)' }}>隱私權政策</a>）</li>
              <li><strong>OpenAI：</strong>TTS 引擎（<a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener" style={{ color: 'var(--primary-light)' }}>隱私權政策</a>）</li>
              <li><strong>ElevenLabs：</strong>TTS 引擎（<a href="https://elevenlabs.io/privacy" target="_blank" rel="noopener" style={{ color: 'var(--primary-light)' }}>隱私權政策</a>）</li>
              <li><strong>Kokoro / inference.sh：</strong>TTS 引擎</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text)' }}>4. 資料儲存與加密</h2>
            <p className="text-sm mb-3">您的 API Key 使用 TLS 加密傳輸，並以加密形式儲存在 Vercel KV。我們不會將您的 API Key 用於任何未經您授權的用途。</p>
            <p className="text-sm">所有向第三方 TTS API 的請求均通過 HTTPS 加密傳輸。</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text)' }}>5. Cookies</h2>
            <p className="text-sm">我們使用必要的 Cookies 來維持您的登入狀態（由 Clerk 提供）。不使用追蹤或廣告 Cookies。</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text)' }}>6. 您的權利</h2>
            <p className="text-sm mb-3">根據適用的資料保護法規，您有權：</p>
            <ul className="text-sm space-y-1.5 list-disc pl-5">
              <li>要求刪除您的帳號及相關資料</li>
              <li>隨時刪除您儲存的 API Key</li>
              <li>查看我們持有關於您的資料</li>
            </ul>
            <p className="text-sm mt-3">請透過<a href="mailto:alan@example.com" style={{ color: 'var(--primary-light)' }}> 聯絡表單</a>提出上述要求。</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text)' }}>7. 兒童隱私</h2>
            <p className="text-sm">本服務不針對 13 歲以下兒童設計，我們也不會刻意收集未成年人的個人資料。</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text)' }}>8. 政策變更</h2>
            <p className="text-sm">我們可能不時更新本隱私權政策。任何重大變更將透過網站公告通知。</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text)' }}>9. 聯絡我們</h2>
            <p className="text-sm">如果您對本隱私權政策有任何疑問，請透過以下方式聯絡我們：</p>
            <p className="text-sm mt-2">
              電子郵件：<a href="mailto:alan@example.com" style={{ color: 'var(--primary-light)' }}>alan@example.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
