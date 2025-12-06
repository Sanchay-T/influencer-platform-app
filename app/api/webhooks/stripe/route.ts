/**
 * DEPRECATED: This webhook endpoint is no longer in use.
 *
 * The active Stripe webhook endpoint is: /api/stripe/webhook
 *
 * If you're seeing this error, update your Stripe webhook configuration:
 * 1. Go to Stripe Dashboard → Developers → Webhooks
 * 2. Change the endpoint URL from /api/webhooks/stripe to /api/stripe/webhook
 *
 * This file kept as a safety net to catch misconfigured webhooks.
 *
 * History: Consolidated on 2025-12-03 to eliminate duplicate webhook logic.
 */

import { structuredConsole } from '@/lib/logging/console-proxy';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // Log the attempt so we can detect misconfigurations
  structuredConsole.error('🚨 [DEPRECATED-WEBHOOK] Request received at /api/webhooks/stripe - this endpoint is deprecated!', {
    timestamp: new Date().toISOString(),
    headers: {
      'stripe-signature': req.headers.get('stripe-signature') ? 'present' : 'missing',
      'content-type': req.headers.get('content-type'),
    },
    correctEndpoint: '/api/stripe/webhook',
    action: 'Update Stripe webhook configuration to use /api/stripe/webhook',
  });

  // Return error so Stripe will retry and alert the team
  return NextResponse.json(
    {
      error: 'DEPRECATED_ENDPOINT',
      message: 'This webhook endpoint (/api/webhooks/stripe) is deprecated. Please update your Stripe webhook configuration to use /api/stripe/webhook instead.',
      correctEndpoint: '/api/stripe/webhook',
    },
    { status: 410 } // 410 Gone - indicates resource is no longer available
  );
}
