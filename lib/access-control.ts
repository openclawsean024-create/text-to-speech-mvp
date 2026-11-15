/**
 * 產出存取控制（GOAL AC-007）。
 *
 * 工作狀態與下載只允許擁有者存取：
 *   - Clerk userId（或 demo mode 的 demo 使用者）等於工作的 userId，或
 *   - 用來建立該工作的那一把 API key。
 * 不存在「建立後 N 小時內可匿名讀取」的放行；工作 ID 不是存取憑證。
 */

import type { Identity } from '@/lib/identity'

export interface OwnedResource {
  userId?: string | null
  apiKeyId?: string | null
}

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; status: 401 | 403; code: 'NO_AUTH' | 'INVALID_API_KEY' | 'FORBIDDEN'; error: string }

export function authorizeOwner(identity: Identity, resource: OwnedResource): AccessDecision {
  if (identity.kind === 'anonymous') {
    if (identity.reason === 'invalid-api-key') {
      return { allowed: false, status: 401, code: 'INVALID_API_KEY', error: 'Invalid or expired API key' }
    }
    return { allowed: false, status: 401, code: 'NO_AUTH', error: 'Authentication required' }
  }

  if (identity.kind === 'apiKey') {
    if (resource.apiKeyId && resource.apiKeyId === identity.apiKeyId) return { allowed: true }
    return { allowed: false, status: 403, code: 'FORBIDDEN', error: 'Not authorized to access this resource' }
  }

  // user／demo
  if (resource.userId && resource.userId === identity.userId) return { allowed: true }
  return { allowed: false, status: 403, code: 'FORBIDDEN', error: 'Not authorized to access this resource' }
}
