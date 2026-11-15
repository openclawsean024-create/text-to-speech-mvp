/**
 * 測試用身分切換。全部是假資料（例：demo-user-001、user_test_alice），不含真實個資。
 */
type TestGlobals = typeof globalThis & { __TEST_AUTH_USER_ID__: string | null; __FETCH_CALLS__: string[] }
const g = globalThis as TestGlobals

/** 模擬「已設定 Clerk」的部署（值為明顯的假占位字串）。 */
export function configureClerk(): void {
  process.env.CLERK_SECRET_KEY = 'clerk-secret-placeholder-for-tests'
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder'
}

/** 模擬「未設定 Clerk」的 demo mode。 */
export function unconfigureClerk(): void {
  delete process.env.CLERK_SECRET_KEY
  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
}

/** 以指定的假 userId 登入（同時視為已設定 Clerk）。 */
export function signInAs(userId: string): void {
  configureClerk()
  g.__TEST_AUTH_USER_ID__ = userId
}

/** 已設定 Clerk 但未登入（匿名）。 */
export function signOut(): void {
  configureClerk()
  g.__TEST_AUTH_USER_ID__ = null
}

export function fetchCalls(): string[] {
  return g.__FETCH_CALLS__
}
