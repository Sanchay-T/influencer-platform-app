#!/usr/bin/env node
// Prints a fresh Clerk session JWT for agent+dev@example.com using CLERK_SECRET_KEY
const path = require('path')
try { require('dotenv').config({ path: path.resolve(process.cwd(), '.env.worktree') }) } catch {}
try { require('dotenv').config({ path: path.resolve(process.cwd(), '.env.development') }) } catch {}

(async () => {
  const key = process.env.CLERK_SECRET_KEY
  const email = process.argv[2] || 'agent+dev@example.com'
  if (!key) { console.error('CLERK_SECRET_KEY not set'); process.exit(1) }
  const list = await fetch('https://api.clerk.com/v1/users?email_address=' + encodeURIComponent(email), { headers: { Authorization: 'Bearer ' + key } })
  const arr = await list.json()
  const id = arr?.[0]?.id
  if (!id) { console.error('User not found: ' + email); process.exit(1) }
  const s = await fetch('https://api.clerk.com/v1/sessions', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: id }) })
  const sess = await s.json()
  if (!s.ok) { console.error('Create session failed:', sess); process.exit(1) }
  const t = await fetch('https://api.clerk.com/v1/sessions/' + sess.id + '/tokens', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
  const tok = await t.json()
  if (!t.ok || !tok?.jwt) { console.error('Mint token failed:', tok); process.exit(1) }
  process.stdout.write(tok.jwt)
})().catch((e) => { console.error('mint-dev-token failed:', e); process.exit(1) })

