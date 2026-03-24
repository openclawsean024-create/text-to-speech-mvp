'use client'

import { useEffect, useState } from 'react'

function isClerkConfigured(): boolean {
  if (typeof window === 'undefined') return false
  const key = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '').trim()
  return key.length > 0 && (key.startsWith('pk_test_') || key.startsWith('pk_live_'))
}

// Returns null when Clerk is not configured or not yet loaded
export function useClerkUser() {
  const [clerkState, setClerkState] = useState<{
    user: unknown
    isLoaded: boolean
    isSignedIn: boolean
    email: string | null
  }>({
    user: null,
    isLoaded: false,
    isSignedIn: false,
    email: null,
  })

  useEffect(() => {
    const configured = isClerkConfigured()
    if (!configured) {
      setClerkState({ user: null, isLoaded: true, isSignedIn: false, email: null })
      return
    }

    // Dynamically import useUser after mount to avoid SSR issues
    const { useUser } = require('@clerk/nextjs')
    const { user, isLoaded, isSignedIn } = useUser()
    setClerkState({
      user,
      isLoaded,
      isSignedIn,
      email: (user as { emailAddresses?: Array<{ emailAddress?: string }> } | null)?.emailAddresses?.[0]?.emailAddress ?? null,
    })
  }, [])

  return clerkState
}
