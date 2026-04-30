import Link from 'next/link'
import { Mic, Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <header className="header-glass sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}><Mic size={14} className="inline" /></div>
            <div>
              <h1 className="text-sm font-bold" style={{ color: 'var(--text)' }}>文字轉語音 <span style={{ color: 'var(--primary)', fontSize: '0.7em' }}>v2.0</span></h1>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>多引擎 AI TTS</p>
            </div>
          </div>
          <Link href="/" className="btn-ghost text-xs">← 開始使用</Link>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center text-center px-5">
        <div className="text-8xl font-black mb-4" style={{ color: 'rgba(99,102,241,0.15)', lineHeight: 1 }}>404</div>
        <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--text)' }}>找不到這個頁面</h1>
        <p className="text-sm mb-8 max-w-sm" style={{ color: 'var(--text-2)' }}>
          抱歉，您拜訪的頁面不存在或已被移除。請確認網址是否正確，或回到首頁開始使用。
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
          <Link href="/" className="btn-primary !py-3 !px-6">
            <Home size={14} className="inline" /> 回到首頁
          </Link>
          <Link href="/pricing" className="btn-secondary !py-3 !px-6">
            查看定價
          </Link>
        </div>
      </div>

      <footer className="text-center py-6 text-xs" style={{ color: 'var(--text-3)' }}>
        © {new Date().getFullYear()} 文字轉語音 v2.0 · 支援多引擎 AI TTS
      </footer>
    </div>
  )
}
