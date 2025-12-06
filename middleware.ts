import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse, NextRequest } from 'next/server'

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
  'curl',
  'wget',
  'python-requests',
  'Go-http-client',
  'HeadlessChrome',
  'Lighthouse',
  'JEODEAPI',
];

function isBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot.toLowerCase()));
}

// Wrap clerkMiddleware to intercept bots BEFORE Clerk processes them
const clerk = clerkMiddleware((auth, request) => {
  if (shouldLogMiddleware) {
    console.log('[MIDDLEWARE] path:', request.nextUrl.pathname);
  }
}, {
  publicRoutes: [
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/sso-callback(.*)',
    '/api/stripe/webhook',
    '/api/webhooks/(.*)',
    '/api/qstash/(.*)',
    '/api/proxy/(.*)',
    '/api/export/(.*)',
    '/api/email/send-scheduled',
  ],
});

export default async function middleware(request: NextRequest) {
  const userAgent = request.headers.get('user-agent');
  const pathname = request.nextUrl.pathname;

  // Allow bots to access homepage without Clerk handshake for OG previews
  if (pathname === '/' && isBot(userAgent)) {
    if (shouldLogMiddleware) {
      console.log('[MIDDLEWARE] Bot detected on homepage, bypassing Clerk:', userAgent);
    }
    return NextResponse.next();
  }

  // For all other requests, use Clerk middleware
  return clerk(request, {} as any);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
