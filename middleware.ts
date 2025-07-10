import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/sso-callback(.*)',
])

// Define API routes that need special handling for QStash
const isWebhookRoute = createRouteMatcher([
  '/api/qstash/(.*)',
  '/api/scraping/(.*)',
  '/api/proxy/(.*)',
  '/api/export/(.*)',
  '/api/email/send-scheduled',
])

// API routes that are protected but handled differently
const isProtectedApiRoute = createRouteMatcher([
  '/api/campaigns(.*)',
  '/api/admin(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  // Handle QStash and scraping API routes - allow all headers for webhooks
  if (isWebhookRoute(request)) {
    const response = NextResponse.next()
    
    // Allow CORS for these routes
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', '*')
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: response.headers,
      })
    }
    
    return response
  }

  // For protected API routes, let them handle auth internally
  if (isProtectedApiRoute(request)) {
    return NextResponse.next()
  }

  // Protect non-public routes
  if (!isPublicRoute(request)) {
    // Get the auth object and check if user is signed in
    const { userId } = await auth()
    
    // If not signed in, redirect to sign-in page
    if (!userId) {
      const signInUrl = new URL('/sign-in', request.url)
      signInUrl.searchParams.set('redirect_url', request.url)
      return NextResponse.redirect(signInUrl)
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}