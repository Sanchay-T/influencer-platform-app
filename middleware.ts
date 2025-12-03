import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Bring back default Clerk middleware so auth() works everywhere with real sessions.
// No dev-only bypass; production parity.
const shouldLogMiddleware = process.env.NEXT_PUBLIC_ENABLE_MIDDLEWARE_LOGS === 'true';

// Bot/crawler user agents that need to read OG meta tags
const BOT_USER_AGENTS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'WhatsApp',
  'LinkedInBot',
  'Slackbot',
  'TelegramBot',
  'Discordbot',
  'Googlebot',
  'bingbot',
  'Applebot',
  'Pinterest',
  'Embedly',
  'Quora Link Preview',
  'Showyoubot',
  'outbrain',
  'vkShare',
  'W3C_Validator',
  'redditbot',
  'Mediapartners-Google',
];

function isBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot.toLowerCase()));
}

export default clerkMiddleware((auth, request) => {
  const userAgent = request.headers.get('user-agent');

  // Allow bots/crawlers to access public pages without Clerk handshake
  // This lets OG meta tags be read for social sharing previews
  if (isBot(userAgent) && request.nextUrl.pathname === '/') {
    if (shouldLogMiddleware) {
      console.log('[MIDDLEWARE] Bot detected, allowing through:', userAgent);
    }
    return NextResponse.next();
  }

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
  ],
})

export const config = {
  // Use .+ instead of .* to require at least one character after /
  // This excludes the root path / from middleware, letting OG crawlers read meta tags
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|landing/).+)'],
}
