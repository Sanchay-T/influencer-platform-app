import { NextRequest, NextResponse } from 'next/server'

// DEV-ONLY: Exchanges a Clerk Admin session for a browser-compatible __session cookie
// Guarded by SESSION_EXCHANGE_KEY. No route changes elsewhere; this simply sets a real session cookie.

async function json(status: number, body: any, headers?: HeadersInit) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(headers || {}),
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return json(403, { error: 'Not available in production' })
    }

    const keyHeader = req.headers.get('x-session-exchange-key') || ''
    const expected = process.env.SESSION_EXCHANGE_KEY || ''
    if (!expected || keyHeader !== expected) {
      return json(401, { error: 'Unauthorized' })
    }

    const clerkKey = process.env.CLERK_SECRET_KEY
    if (!clerkKey) return json(500, { error: 'CLERK_SECRET_KEY not set' })

    const { userId, email, createIfMissing = true } = await req.json().catch(() => ({}))
    const targetEmail: string | undefined = email || (userId ? undefined : 'agent+dev@example.com')

    const adminHeaders: HeadersInit = {
      Authorization: `Bearer ${clerkKey}`,
      'Content-Type': 'application/json',
    }

    const clerkApiBase = clerkKey.startsWith('sk_live') ? 'https://api.clerk.com' : 'https://api.clerk.dev'

    // Resolve or create user
    let resolvedUserId: string | undefined = userId
    if (!resolvedUserId) {
      if (!targetEmail) return json(400, { error: 'Provide userId or email' })
      const listRes = await fetch(
        `${clerkApiBase}/v1/users?email_address=` + encodeURIComponent(targetEmail),
        { headers: adminHeaders }
      )
      const list = await listRes.json()
      resolvedUserId = list?.[0]?.id
      if (!resolvedUserId && createIfMissing) {
        const createRes = await fetch(`${clerkApiBase}/v1/users`, {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({ email_address: [targetEmail] }),
        })
        const created = await createRes.json()
        resolvedUserId = created?.id
      }
      if (!resolvedUserId) return json(404, { error: 'User not found and not created' })
    }

    // Create a session for this user
    const sessRes = await fetch(`${clerkApiBase}/v1/sessions`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ user_id: resolvedUserId }),
    })
    const session = await sessRes.json()
    if (!sessRes.ok) return json(sessRes.status, { error: 'Failed to create session', detail: session })

    // Mint a session token (JWT)
    const tokRes = await fetch(`${clerkApiBase}/v1/sessions/${session.id}/tokens`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({}),
    })
    const token = await tokRes.json()
    if (!tokRes.ok || !token?.jwt) return json(500, { error: 'Failed to mint session token', detail: token })

    const jwt = token.jwt as string

    // Build cookie
    const secure = (process.env.NEXT_PUBLIC_SITE_URL || '').startsWith('https://')
    const cookieParts = [
      `__session=${jwt}`,
      'Path=/',
      'HttpOnly',
      'SameSite=None',
      secure ? 'Secure' : '',
      // Optional: limit lifetime to 1 hour (Clerk will validate anyway)
      'Max-Age=3600',
    ].filter(Boolean)

    const devBrowserRes = await fetch(`${clerkApiBase}/v1/dev_browser`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({}),
    })
    const devBrowser = await devBrowserRes.json()
    if (!devBrowserRes.ok || !devBrowser?.token) {
      return json(500, { error: 'Failed to mint dev browser token', detail: devBrowser })
    }

    const devBrowserCookie = [
      `__clerk_db_jwt=${devBrowser.token}`,
      'Path=/',
      'SameSite=None',
      secure ? 'Secure' : '',
    ].filter(Boolean)

    const clientUatValue = Math.floor(Date.now() / 1000)
    const clientUatCookie = [
      `__client_uat=${clientUatValue}`,
      'Path=/',
      'SameSite=None',
      secure ? 'Secure' : '',
    ].filter(Boolean)

    const headers = new Headers()
    headers.append('Set-Cookie', cookieParts.join('; '))
    headers.append('Set-Cookie', devBrowserCookie.join('; '))
    headers.append('Set-Cookie', clientUatCookie.join('; '))

    return json(200, {
      success: true,
      userId: resolvedUserId,
      sessionId: session.id,
      cookies: {
        session: `__session=${jwt}`,
        devBrowser: `__clerk_db_jwt=${devBrowser.token}`,
        clientUat: `__client_uat=${clientUatValue}`,
      },
      note: 'Include these cookies on subsequent requests to authenticate.',
    }, headers)
  } catch (err: any) {
    return json(500, { error: 'Session exchange failed', detail: String(err?.message || err) })
  }
}
