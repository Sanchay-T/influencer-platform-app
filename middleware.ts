import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextFetchEvent, NextRequest, NextResponse } from 'next/server'

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

const PUBLIC_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/sign-in(\/.*)?$/,
  /^\/sign-up(\/.*)?$/,
  /^\/sso-callback(\/.*)?$/,
  /^\/api\/stripe\/webhook$/,
  /^\/api\/webhooks\/.*$/,
  /^\/api\/qstash\/.*$/,
  /^\/api\/v2\/worker\/.*$/,
  /^\/api\/proxy\/.*$/,
  /^\/api\/export\/.*$/,
  /^\/api\/email\/send-scheduled$/,
  // E2E test admin routes (dev only - routes check NODE_ENV internally)
  /^\/api\/admin\/e2e\/.*$/,
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

function hasBypassAuthHeader(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'production') return false;

  const bypassHeaderName = process.env.AUTH_BYPASS_HEADER?.toLowerCase() || 'x-dev-auth';
  const bypassToken = process.env.AUTH_BYPASS_TOKEN || 'dev-bypass';
  const headerValue = request.headers.get(bypassHeaderName);
  if (headerValue && headerValue === bypassToken) return true;

  if (process.env.ENABLE_TEST_AUTH === 'true') {
    const testAuth = request.headers.get('x-test-auth');
    const testSignature = request.headers.get('x-test-signature');
    if (testAuth && testSignature) {
      return true;
    }
  }

  return false;
}

// Wrap clerkMiddleware to intercept bots BEFORE Clerk processes them
const clerk = clerkMiddleware(async (auth, request) => {
  if (shouldLogMiddleware) {
    console.log('[MIDDLEWARE] path:', request.nextUrl.pathname);
  }

  if (isPublicRoute(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (hasBypassAuthHeader(request)) {
    return NextResponse.next();
  }

  await auth.protect();
  return NextResponse.next();
});

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
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
  return clerk(request, event);
}

export const config = {
  // Skip Next.js internals and all static files (images, fonts, etc.)
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
}
