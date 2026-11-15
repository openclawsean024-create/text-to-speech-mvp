import { NextRequest } from 'next/server'

const BASE = 'http://localhost:3000'

export function jsonRequest(
  path: string,
  body: unknown,
  init: { method?: string; headers?: Record<string, string> } = {},
): NextRequest {
  return new NextRequest(`${BASE}${path}`, {
    method: init.method ?? 'POST',
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    body: JSON.stringify(body),
  })
}

export function getRequest(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`${BASE}${path}`, { method: 'GET', headers })
}

export function deleteRequest(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`${BASE}${path}`, { method: 'DELETE', headers })
}

let counter = 0
/** 產生不會互相干擾的假使用者 ID（例：user_test_alice_3）。 */
export function uniqueUser(label = 'user'): string {
  counter += 1
  return `user_test_${label}_${counter}`
}
