// Middleware is not needed since Clerk is in demo mode (no keys configured)
// The auth flow is handled client-side via useClerk hook
// All routes work as-is in demo mode
export default function middleware() {
  // No auth protection needed - Clerk is not configured in demo mode
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
}