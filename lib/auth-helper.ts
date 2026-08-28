/**
 * Safe auth wrapper — handles missing Clerk config gracefully.
 *
 * In demo mode (no Clerk env vars), returns null userId instead of throwing.
 */

import { auth } from '@clerk/nextjs/server'

export interface AuthResult {
  userId: string | null
  isDemo: boolean
}

export async function safeAuth(): Promise<AuthResult> {
  try {
    const { userId } = await auth()
    return { userId, isDemo: !userId }
  } catch {
    // Clerk not configured (demo mode) — return null userId
    return { userId: null, isDemo: true }
  }
}

export function getClerkConfigured(): boolean {
  return !!(
    process.env.CLERK_SECRET_KEY &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_')
  )
}
