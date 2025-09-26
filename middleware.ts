import { clerkMiddleware } from '@clerk/nextjs/server'

// Bring back default Clerk middleware so auth() works everywhere with real sessions.
// No dev-only bypass; production parity.
export default clerkMiddleware({
  publicRoutes: [
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/sso-callback(.*)',
    // Webhooks and callbacks
    '/api/stripe/webhook',
    '/api/webhooks/(.*)',
    // Background/job triggers and proxies that should not require Clerk auth
    '/api/qstash/(.*)',
    '/api/proxy/(.*)',
    '/api/export/(.*)',
    '/api/email/send-scheduled',
  ],
})

export const config = {
  matcher: [
    // Run on all pages and API routes except Next internals and static assets
    '/((?!_next|.*\..*).*)',
    '/(api|trpc)(.*)'
  ],
}
