'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const SignIn = dynamic(() => import('@clerk/nextjs').then(m => ({ default: m.SignIn })), { ssr: false })

function isClerkConfigured(): boolean {
  if (typeof window === 'undefined') return false
  const key = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '').trim()
  return key.length > 0 && (key.startsWith('pk_test_') || key.startsWith('pk_live_'))
}

export default function LoginPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const configured = isClerkConfigured()

  if (!configured) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg, #fafafa)' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Clerk 未設定</h1>
          <p style={{ color: '#71717A' }}>請設定 NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY 環境變數以啟用登入功能。</p>
        </div>
      </div>
    )
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg, #fafafa)' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTop: '3px solid #8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
        </div>
      </div>
    )
  }

  return <SignIn />
}