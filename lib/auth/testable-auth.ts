import { headers as nextHeaders } from 'next/headers'

export type TestAuthPayload = {
  userId: string
  email?: string
  admin?: boolean
  iat?: number
}

const isProd = process.env.NODE_ENV === 'production'

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function base64UrlDecode(str: string): Buffer {
  const pad = 4 - (str.length % 4)
  const base64 = (str + (pad < 4 ? '='.repeat(pad) : '')).replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64')
}

function hmacSha256Base64Url(data: string, secret: string): string {
  // Use Node crypto only in Node/server runtime
  // This module is never imported by middleware (edge) in our setup.
  const { createHmac } = require('crypto') as typeof import('crypto')
  const h = createHmac('sha256', secret)
  h.update(data)
  return base64UrlEncode(h.digest())
}

export function buildTestAuthHeaders(payload: TestAuthPayload, secret?: string) {
  const key = secret || process.env.TEST_AUTH_SECRET
  if (!key) throw new Error('TEST_AUTH_SECRET is required to build test auth headers')
  const body: TestAuthPayload = { ...payload }
  if (!body.iat) body.iat = Math.floor(Date.now() / 1000)
  const json = JSON.stringify(body)
  const token = base64UrlEncode(Buffer.from(json, 'utf8'))
  const sig = hmacSha256Base64Url(token, key)
  return {
    'x-test-auth': token,
    'x-test-signature': sig,
  }
}

export function verifyTestAuthHeaders(h: Headers, opts?: { maxAgeSeconds?: number }): TestAuthPayload | null {
  if (isProd) return null
  if (process.env.ENABLE_TEST_AUTH !== 'true') return null

  const token = h.get('x-test-auth')
  const sig = h.get('x-test-signature')
  const key = process.env.TEST_AUTH_SECRET
  if (!token || !sig || !key) return null

  const expected = hmacSha256Base64Url(token, key)
  if (expected !== sig) return null

  try {
    const buf = base64UrlDecode(token)
    const payload = JSON.parse(buf.toString('utf8')) as TestAuthPayload
    if (!payload || typeof payload.userId !== 'string') return null
    // Basic age check
    const maxAge = opts?.maxAgeSeconds ?? 3600 // 1 hour default
    if (payload.iat && Math.floor(Date.now() / 1000) - payload.iat > maxAge) return null
    return payload
  } catch {
    return null
  }
}

// Convenience helper for server route handlers to peek payload
export function getTestAuthFromRequestHeaders(): TestAuthPayload | null {
  try {
    const h = nextHeaders()
    return verifyTestAuthHeaders(h)
  } catch {
    return null
  }
}

