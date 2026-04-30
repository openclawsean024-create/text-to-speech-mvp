import { Metadata } from 'next'
import { Mic } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '服務條款',
  description: '文字轉語音服務的使用條款，定義您的權利與義務。',
}

export default function TermsPage() {
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
        <h1 className="text-3xl font-black mb-2" style={{ color: 'var(--text)' }}>服務條款</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-3)' }}>最後更新：2026 年 4 月 30 日</p>

        <div className="space-y-8" style={{ color: 'var(--text-2)', lineHeight: '1.8' }}>
          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text)' }}>1. 服務說明</h2>
            <p className="text-sm">
              文字轉語音 v2.0（以下簡稱「本服務」）提供 AI 文字轉語音功能，透過整合 OpenAI、ElevenLabs、Kokoro 等第三方引擎，為用戶將文字轉換為語音音訊。本服務同時提供免費的瀏覽器內建語音模式（使用 Web Speech API）。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text)' }}>2. 帳號與登入</h2>
            <p className="text-sm mb-3">使用本服務的進階功能需要註冊帳號。我們使用 Clerk 作為第三方認證服務供應商。</p>
            <ul className="text-sm space-y-1.5 list-disc pl-5">
              <li>您需對帳號資訊的真實性與安全性負責</li>
              <li>請勿與他人共用帳號</li>
              <li>若發現未經授權的使用，請立即通知我們</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text)' }}>3. API Key 管理</h2>
            <p className="text-sm mb-3">當您使用 API 模式時，需要提供您自己的 API Key：</p>
            <ul className="text-sm space-y-1.5 list-disc pl-5">
              <li>您的 API Key 只用於發送您授權的 TTS 請求</li>
              <li>我們不會使用您的 API Key 進行任何未經您發起的請求</li>
              <li>您需遵守各 TTS 提供商的使用條款（OpenAI、ElevenLabs、inference.sh）</li>
              <li>所有 API 費用由您直接支付給對應的 TTS 服務商，我們不从中牟利</li>
              <li>您可隨時刪除儲存的 API Key</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text)' }}>4. 使用量限制</h2>
            <ul className="text-sm space-y-1.5 list-disc pl-5">
              <li><strong>免費方案：</strong>每天 10 次轉換，超過後需隔日再試或升級方案</li>
              <li><strong>Starter 方案：</strong>每天 100 次轉換</li>
              <li><strong>Pro 方案：</strong>每天 1,000 次轉換</li>
              <li>用量於每日午夜 UTC 重置</li>
              <li>超額使用可能觸發 API 限流（HTTP 429），系統會明確提示</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text)' }}>5. 禁止用途</h2>
            <p className="text-sm mb-3">使用本服務時，嚴格禁止：</p>
            <ul className="text-sm space-y-1.5 list-disc pl-5">
              <li>生成違法、騷擾、誹謗、仇恨或歧視性內容</li>
              <li>未經他人同意進行語音冒充或欺騙</li>
              <li>大規模軍事、政治或虛假信息傳播</li>
              <li>試圖繞過任何第三方 API 的用量限制或服務條款</li>
              <li>未經授權修改、破解或反向工程本服務</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text)' }}>6. 智慧財產權</h2>
            <p className="text-sm mb-3">
              由您上傳的內容（文字、檔案）以及由此產生的音訊輸出，智慧財產權歸您所有。我們不會聲稱對您的輸入或輸出擁有權利。
            </p>
            <p className="text-sm">
              本服務的網站設計、程式碼、UI 元素及品牌資產版權屬於服務營運方。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text)' }}>7. 商業授權</h2>
            <p className="text-sm mb-3">Starter 和 Pro 方案包含商業使用授權：</p>
            <ul className="text-sm space-y-1.5 list-disc pl-5">
              <li>您可以使用生成的音訊用於商業專案（YouTube 影片、播客、廣告等）</li>
              <li>免費方案僅限個人非商業用途</li>
              <li>請確認您使用的 TTS 引擎提供商也允許該商業用途（多數支援，請自行確認）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text)' }}>8. 服務可用性</h2>
            <p className="text-sm mb-3">本服務以「現狀」提供，我們不保證：</p>
            <ul className="text-sm space-y-1.5 list-disc pl-5">
              <li>100% 的正常運行時間</li>
              <li>第三方 TTS API 的永續可用性</li>
              <li>資料的永久儲存（本服務保留在不通知的情況下刪除閒置資料的權利）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text)' }}>9. 責任限制</h2>
            <p className="text-sm">
              對於因使用本服務而產生的任何直接或間接損失（包括但不限於利潤損失、資料損失），我們不承擔責任。我們強烈建議在使用前備份重要資料，並確認您的 TTS 輸出符合您的用途需求。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text)' }}>10. 帳號終止</h2>
            <p className="text-sm">
              我們保留在任何情況下終止或暫停帳號的權利，特別是在違反本服務條款的情況下。終止後將清除所有相關資料。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text)' }}>11. 聯絡我們</h2>
            <p className="text-sm">服務問題或條款爭議，請聯絡：</p>
            <p className="text-sm mt-2">
              電子郵件：<a href="mailto:alan@example.com" style={{ color: 'var(--primary-light)' }}>alan@example.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
