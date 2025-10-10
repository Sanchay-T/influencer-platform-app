import { clerkMiddleware } from '@clerk/nextjs/server'

// Bring back default Clerk middleware so auth() works everywhere with real sessions.
// No dev-only bypass; production parity.
const shouldLogMiddleware = process.env.NEXT_PUBLIC_ENABLE_MIDDLEWARE_LOGS === 'true';

export default clerkMiddleware((auth, request) => {
  if (shouldLogMiddleware) {
    console.log('[MIDDLEWARE] path:', request.nextUrl.pathname);
  }
}, {
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
    // Automation/testing routes (bearer token validated inside handlers)
    '/api/onboarding(.*)',
    '/api/usage/summary(.*)',
    '/api/billing(.*)',
    '/api/debug/whoami',
  ],
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\.ico).*)'],
}
