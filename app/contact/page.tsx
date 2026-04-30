import { Metadata } from 'next'
import { Mic, Mail, MessageCircle, Clock } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '聯絡我們',
  description: '聯絡文字轉語音服務團隊，獲得技術支援或提出建議。',
}

export default function ContactPage() {
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

      <div className="max-w-2xl mx-auto px-5 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 badge mb-4"><Mail size={12} className="inline" /> 聯絡我們</div>
          <h1 className="text-3xl font-black mb-3" style={{ color: 'var(--text)' }}>需要幫助嗎？</h1>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            有任何問題、回饋或建議？我們很樂意收到您的來信。
          </p>
        </div>

        {/* Contact Cards */}
        <div className="space-y-4 mb-8">
          <a href="mailto:alan@example.com" className="glass-card p-6 flex items-start gap-4 no-underline hover:scale-[1.01] transition-transform block"
            style={{ border: '1px solid var(--border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.15)' }}>
              <Mail size={18} className="inline" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <div className="font-bold text-sm mb-1" style={{ color: 'var(--text)' }}>的一般查詢</div>
              <div className="text-sm" style={{ color: 'var(--primary-light)' }}>alan@example.com</div>
              <div className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>回覆時間：1-3 個工作天</div>
            </div>
          </a>

          <div className="glass-card p-6 flex items-start gap-4" style={{ border: '1px solid var(--border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.15)' }}>
              <MessageCircle size={18} className="inline" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <div className="font-bold text-sm mb-1" style={{ color: 'var(--text)' }}>常見問題</div>
              <div className="text-sm" style={{ color: 'var(--text-3)' }}>
                建議先查看<a href="/pricing" className="font-semibold" style={{ color: 'var(--primary-light)' }}> 定價頁面</a>的 FAQ，或至<a href="/dashboard" className="font-semibold" style={{ color: 'var(--primary-light)' }}> 控制台</a>查看用量統計。
              </div>
            </div>
          </div>
        </div>

        {/* Response Time Note */}
        <div className="glass-card p-5 text-center" style={{ border: '1px solid rgba(99,102,241,0.2)' }}>
          <Clock size={14} className="inline mr-1.5" style={{ color: 'var(--text-3)' }} />
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>
            我們通常會在 1-3 個工作天內回覆。如有緊急的技術問題，請在郵件中詳細說明，以便加快處理。
          </span>
        </div>

        {/* Quick Links */}
        <div className="mt-8 text-center">
          <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>快速連結</p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link href="/pricing" className="text-xs" style={{ color: 'var(--primary-light)', textDecoration: 'underline' }}>定價</Link>
            <Link href="/privacy" className="text-xs" style={{ color: 'var(--primary-light)', textDecoration: 'underline' }}>隱私權政策</Link>
            <Link href="/terms" className="text-xs" style={{ color: 'var(--primary-light)', textDecoration: 'underline' }}>服務條款</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
