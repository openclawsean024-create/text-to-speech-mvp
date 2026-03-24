'use client'

import { Component, ReactNode } from 'react'
import { ClerkProvider } from '@clerk/nextjs'
import Link from 'next/link'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ClerkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center max-w-sm">
            <div className="text-4xl mb-4">🔐</div>
            <h1 className="text-xl font-bold mb-2">Clerk 未設定</h1>
            <p className="text-sm text-gray-500 mb-4">
              請在 Vercel 環境變數設定有效的 Clerk API Key，或聯繫管理員。
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Error: {this.state.error?.message?.slice(0, 100)}
            </p>
            <Link href="/" className="text-sm text-blue-600 hover:underline">
              ← 返回首頁
            </Link>
          </div>
        </div>
      )
    }

    const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ''
    if (!key || !key.startsWith('pk_')) {
      // No valid key — skip ClerkProvider
      return <>{this.props.children}</>
    }

    return (
      <ClerkProvider publishableKey={key}>
        {this.props.children}
      </ClerkProvider>
    )
  }
}
