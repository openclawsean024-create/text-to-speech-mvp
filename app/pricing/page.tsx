import Link from 'next/link'
import { Mic, BarChart3, Globe, Rocket, MessageCircle, CreditCard } from 'lucide-react'
import { listPlans, formatPlanPrice, usingDefaultTestValues } from '@/lib/billing/plans'

// 方案內容在請求時由伺服器端設定讀取（config/plans.json 或 BILLING_PLANS_JSON），
// 頁面本身不寫死任何價格或額度。
export const dynamic = 'force-dynamic'

export default function PricingPage() {
  const plans = listPlans()
  const testValues = usingDefaultTestValues()
  const pricePending = plans.some((plan) => plan.paid && !plan.price)

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="header-glass sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}><Mic size={14} className="inline" /></div>
            <div>
              <h1 className="text-sm font-bold" style={{ color: 'var(--text)' }}>文字轉語音 </h1>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>多引擎 AI TTS</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="btn-secondary text-xs"><BarChart3 size={12} className="inline" /> 控制台</Link>
            <Link href="/" className="btn-ghost text-xs">← 開始使用</Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 py-12 space-y-12">

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 badge mb-4"><CreditCard size={12} className="inline" /> 簡單透明的定價</div>
          <h2 className="text-3xl font-bold mb-3" style={{ color: 'var(--text)' }}>選擇適合你的方案</h2>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>雲端語音按字數計量，每個方案含每月字數額度。</p>
        </div>

        {/* Pricing Grid — 由方案設定產生 */}
        {(testValues || pricePending) && (
          <div className="toast info text-sm">
            {pricePending && '付費方案的價格尚未公布，暫不開放線上訂閱。'}
            {testValues && '下列每月字數額度為測試值，正式數值將另行公告。'}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div key={plan.id} className="glass-card p-6 flex flex-col">
              <div className="font-bold text-base mb-0.5" style={{ color: 'var(--text)' }}>
                {plan.paid ? <Rocket size={14} className="inline" /> : <Globe size={14} className="inline" />} {plan.name}
              </div>
              <div className="mb-5 mt-3">
                <span className="text-3xl font-bold" style={{ color: plan.paid ? 'var(--text)' : '#10b981' }}>
                  {formatPlanPrice(plan)}
                </span>
              </div>
              <ul className="space-y-2.5 text-sm flex-1" style={{ color: 'var(--text-2)' }}>
                <li>
                  每月字數額度：
                  {plan.monthlyCharLimit === null ? '不限' : `${plan.monthlyCharLimit.toLocaleString('en-US')} 字`}
                </li>
                <li>發音校正詞庫：最多 {plan.lexiconEntryLimit.toLocaleString('en-US')} 條自訂詞條</li>
                <li>瀏覽器內建語音不計入額度</li>
              </ul>
              {!plan.paid && (
                <Link href="/" className="mt-6 block w-full py-3 text-center rounded-xl font-semibold text-sm transition-all"
                  style={{ background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                  免費開始
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* Engine Comparison */}
        <div>
          <h2 className="text-xl font-bold mb-5 text-center" style={{ color: 'var(--text)' }}><Mic size={14} className="inline" /> 引擎功能比較</h2>
          <div className="glass-card overflow-hidden !p-0">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th className="text-left p-4 font-semibold text-xs" style={{ color: 'var(--text-2)' }}>功能</th>
                  <th className="p-3 text-center text-xs" style={{ color: 'var(--text-3)' }}><Globe size={14} className="inline" /> 瀏覽器</th>
                  <th className="p-3 text-center text-xs" style={{ color: 'var(--text-3)' }}><Mic size={14} className="inline" /> OpenAI</th>
                  <th className="p-3 text-center text-xs" style={{ color: 'var(--text-3)' }}>ElevenLabs</th>
                  <th className="p-3 text-center text-xs" style={{ color: 'var(--text-3)' }}>Kokoro</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['語音品質', '★★★☆☆', '★★★★★', '★★★★★', '★★★★☆'],
                  ['中文支援', '✓', '基礎', '✓', '✓'],
                  ['多語言', '視瀏覽器', '✓ 30+', '✓ 30+', '✓'],
                  ['語速調整', '✓', '✓', '✓', '✓'],
                  ['可下載', '✗', '✓ MP3', '✓ MP3', '✓'],
                  ['費用', '免費', '依字數額度', '依字數額度', '依字數額度'],
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
          <h2 className="text-xl font-bold mb-5 text-center" style={{ color: 'var(--text)' }}><MessageCircle size={14} className="inline" /> 常見問題</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ['用量怎麼計算？', '雲端語音依「計費字數」計算：以送出合成前的原文、去除空白後的字元數為準。每月額度於下個計費月份重置；合成失敗不計字數。'],
              ['方案如何決定？', '方案由系統依你的訂閱紀錄判定，無法在頁面上自行切換。'],
              ['可以上傳哪些內容？', '僅限你擁有或已取得授權的內容。上傳電子書前需要確認權利聲明；本服務不提供 DRM 移除。'],
              ['支援哪些檔案格式？', '單段轉換可匯入 TXT、SRT、VTT、LRC、PDF、EPUB、DOCX；整本有聲書支援 TXT、EPUB 與文字型 PDF。'],
              ['我的 API Key 安全嗎？', '自帶的引擎金鑰只用於你自己的請求。金鑰的儲存方式仍在改善中，建議使用可隨時撤銷的專用金鑰。'],
              ['如何升級方案？', '付費方案的價格與線上訂閱尚未開放，開放時會在本頁公告。'],
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
              瀏覽器內建語音不需註冊即可使用。<br />
              雲端語音與有聲書轉換依方案的每月字數額度計量。
            </p>
            <Link href="/" className="inline-block px-8 py-3 rounded-full font-bold text-sm hover:scale-105 transition-transform" style={{ background: 'white', color: '#4f46e5' }}>
              <Rocket size={14} className="inline" /> 免費開始使用
            </Link>
          </div>
        </div>
      </div>

      <footer className="text-center py-6 text-xs space-y-1.5" style={{ color: 'var(--text-3)' }}>
        <div className="flex justify-center gap-3">
          <a href="/privacy" style={{ color: 'var(--text-3)', textDecoration: 'underline' }}>隱私權政策</a>
          <span>·</span>
          <a href="/terms" style={{ color: 'var(--text-3)', textDecoration: 'underline' }}>服務條款</a>
          <span>·</span>
          <a href="/contact" style={{ color: 'var(--text-3)', textDecoration: 'underline' }}>聯絡我們</a>
        </div>
        <p>© {new Date().getFullYear()} 繁中 TTS 與有聲書工作台</p>
      </footer>
    </div>
  )
}
