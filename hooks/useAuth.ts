'use client'

import { useEffect, useState } from 'react'

// Safe auth state — works with or without Clerk configured
interface AuthState {
  user: null
  isLoaded: true
  isSignedIn: false
  email: string | null
}

function isClerkConfigured(): boolean {
  if (typeof window === 'undefined') return false
  const key = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '').trim()
  return key.length > 0 && (key.startsWith('pk_test_') || key.startsWith('pk_live_'))
}

export function useAuthState(): AuthState {
  const [configured, setConfigured] = useState(false)

  useEffect(() => {
    setConfigured(isClerkConfigured())
  }, [])

  if (!configured) {
    return { user: null, isLoaded: true, isSignedIn: false, email: null }
  }

  // Dynamically import Clerk hooks only when Clerk is configured
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { useUser } = require('@clerk/nextjs')
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { user, isLoaded, isSignedIn } = useUser()

  return {
    user,
    isLoaded,
    isSignedIn,
    email: user?.emailAddresses?.[0]?.emailAddress ?? null,
  }
}
