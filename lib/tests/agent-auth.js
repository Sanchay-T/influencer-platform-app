// Lightweight Node helper for agents/CLIs to build signed test auth headers.
// Usage: const { buildTestAuthHeaders } = require('@/lib/tests/agent-auth')

const crypto = require('crypto')

function base64UrlEncode(buf) {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function signHmacSha256Base64Url(data, secret) {
  const h = crypto.createHmac('sha256', secret)
  h.update(data)
  return base64UrlEncode(h.digest())
}

function buildTestAuthHeaders(payload, secret) {
  const key = secret || process.env.TEST_AUTH_SECRET
  if (!key) throw new Error('TEST_AUTH_SECRET is required to build test auth headers')

  const body = { ...payload }
  if (!body.iat) body.iat = Math.floor(Date.now() / 1000)
  const token = base64UrlEncode(Buffer.from(JSON.stringify(body), 'utf8'))
  const sig = signHmacSha256Base64Url(token, key)
  return {
    'x-test-auth': token,
    'x-test-signature': sig,
  }
}

module.exports = { buildTestAuthHeaders }

