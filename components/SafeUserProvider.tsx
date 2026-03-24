'use client'

import { ClerkProvider, useUser, SignedIn, SignedOut, SignInButton, SignOutButton } from '@clerk/nextjs'
import Link from 'next/link'

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ''

export function SafeUserProvider({ children }: { children: React.ReactNode }) {
  if (!publishableKey || !publishableKey.startsWith('pk_')) {
    // Demo mode: return children without auth
    return <>{children}</>
  }
  return <ClerkProvider>{children}</ClerkProvider>
}

export { useUser, SignedIn, SignedOut, SignInButton, SignOutButton, Link }
