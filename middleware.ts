import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'
import { clerkMiddleware } from '@clerk/nextjs/server'

/**
 * - 已設定 Clerk：掛上 clerkMiddleware()，讓 API route 的 `auth()` 能取得 session
 *   （伺服器端身分是字數額度、工作存取控制的依據）。這裡不強制保護任何路徑，
 *   各 API route 自行以 lib/identity.ts 判斷。
 * - 未設定 Clerk（demo mode）：no-op，行為與原本相同。
 */
const clerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_'),
)

const withClerk = clerkConfigured ? clerkMiddleware() : null

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (withClerk) return withClerk(req, event)
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
}
