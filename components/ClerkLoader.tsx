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

// Inner component that has access to the key
function ClerkProviderInner({ publishableKey, children }: { publishableKey: string; children: ReactNode }) {
  return <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>
}

export default function ClerkLoader({ children }: Props) {
  const [configured, setConfigured] = useState(false)
  const [key, setKey] = useState('')

  useEffect(() => {
    const c = isClerkConfigured()
    setConfigured(c)
    if (c) {
      setKey((process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '').trim())
    }
  }, [])

  // During SSR or when Clerk is not configured, render children without auth
  if (!configured) {
    return <>{children}</>
  }

  return <ClerkProviderInner publishableKey={key}>{children}</ClerkProviderInner>
}