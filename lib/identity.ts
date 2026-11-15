/**
 * 呼叫者身分解析（伺服器端）。
 *
 * 優先序：
 *   1. `Authorization: Bearer hms_…` 企業 API key（需 allowApiKey）。
 *   2. Clerk session（已設定 Clerk 時）。
 *   3. 未設定 Clerk（demo mode）→ 共用的 demo 使用者 `demo-user-001`（需 allowDemo）。
 *   4. 其餘為匿名。
 *
 * 注意：demo 使用者只存在於「未設定 Clerk」的部署，所有訪客共用同一身分與額度，
 * 資料只在記憶體後備；正式上線必須設定 Clerk（見 STATUS.md 待定案事項）。
 */

import { getClerkConfigured, safeAuth } from '@/lib/auth-helper'
import { extractBearer, findApiKey, type Tier } from '@/lib/api-keys'

export const DEMO_USER_ID = 'demo-user-001'

export type Identity =
  | { kind: 'user'; userId: string }
  | { kind: 'demo'; userId: typeof DEMO_USER_ID }
  | { kind: 'apiKey'; apiKeyId: string; ownerId: string; tier: Tier; hashedKey: string }
  | { kind: 'anonymous'; reason: 'not-signed-in' | 'invalid-api-key' | 'demo-not-allowed' }

export interface ResolveOptions {
  /** 是否接受企業 API key（預設 false）。 */
  allowApiKey?: boolean
  /** 未設定 Clerk 時是否回退為 demo 使用者（預設 true）。 */
  allowDemo?: boolean
}

interface HeaderCarrier {
  headers: { get(name: string): string | null }
}

export async function resolveIdentity(req?: HeaderCarrier | null, opts: ResolveOptions = {}): Promise<Identity> {
  const { allowApiKey = false, allowDemo = true } = opts

  if (allowApiKey && req) {
    const bearer = extractBearer(req.headers.get('authorization'))
    if (bearer) {
      const record = await findApiKey(bearer)
      if (!record) return { kind: 'anonymous', reason: 'invalid-api-key' }
      return {
        kind: 'apiKey',
        apiKeyId: record.id,
        ownerId: record.ownerId,
        tier: record.tier,
        hashedKey: record.hashedKey,
      }
    }
  }

  if (getClerkConfigured()) {
    const { userId } = await safeAuth()
    if (userId) return { kind: 'user', userId }
    return { kind: 'anonymous', reason: 'not-signed-in' }
  }

  if (allowDemo) return { kind: 'demo', userId: DEMO_USER_ID }
  return { kind: 'anonymous', reason: 'demo-not-allowed' }
}

/** 計量與資料歸屬用的使用者 ID；匿名回傳 null。 */
export function identityUserId(identity: Identity): string | null {
  switch (identity.kind) {
    case 'user':
    case 'demo':
      return identity.userId
    case 'apiKey':
      return identity.ownerId
    default:
      return null
  }
}

export function isAuthenticated(identity: Identity): identity is Exclude<Identity, { kind: 'anonymous' }> {
  return identity.kind !== 'anonymous'
}
