'use client'

import { ReactNode, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const ClerkProvider = dynamic(
  () => import('@clerk/nextjs').then(m => ({ default: m.ClerkProvider })),
  { ssr: false }
)

function isClerkConfigured(): boolean {
  if (typeof window === 'undefined') return false
  const key = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '').trim()
  return key.length > 0 && (key.startsWith('pk_test_') || key.startsWith('pk_live_'))
}

interface Props {
  children: ReactNode
}

export default function ClerkLoader({ children }: Props) {
  const [configured, setConfigured] = useState(false)

  useEffect(() => {
    setConfigured(isClerkConfigured())
  }, [])

  // During SSR or when Clerk is not configured, render children without auth
  if (!configured) {
    return <>{children}</>
  }

  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ''
  return <ClerkProvider publishableKey={key}>{children}</ClerkProvider>
}
