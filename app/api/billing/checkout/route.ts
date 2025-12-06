import { structuredConsole } from '@/lib/logging/console-proxy';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';

export async function GET(request: NextRequest) {
  structuredConsole.log('🚀 [CHECKOUT-API] Request received!');
  structuredConsole.log('🚀 [CHECKOUT-API] Request URL:', request.url);
  structuredConsole.log('🚀 [CHECKOUT-API] Request method:', request.method);
  structuredConsole.log('🚀 [CHECKOUT-API] Request headers:', Object.fromEntries(request.headers.entries()));
  
  try {
    // Get the user from Clerk
    const { userId } = await getAuthOrTest();
    structuredConsole.log('🚀 [CHECKOUT-API] Auth result:', { userId });
    
    if (!userId) {
      structuredConsole.log('❌ [CHECKOUT-API] No user ID, but proceeding anyway for debugging...');
      // Let's not redirect for now, just proceed to see what happens
      // return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    // Get the price ID from query params
    const { searchParams } = new URL(request.url);
    const priceId = searchParams.get('priceId');
    structuredConsole.log('🚀 [CHECKOUT-API] Price ID from params:', priceId);

    if (!priceId) {
      structuredConsole.log('❌ [CHECKOUT-API] No price ID provided');
      return NextResponse.json({ error: 'Price ID is required' }, { status: 400 });
    }

    structuredConsole.log('🛒 [CHECKOUT] Starting checkout for:', { userId, priceId });

    // For now, let's redirect to the billing page with the pricing table
    // You can implement actual Stripe checkout here later
    const billingUrl = new URL('/billing', request.url);
    billingUrl.searchParams.set('upgrade', priceId);
    
    structuredConsole.log('🔄 [CHECKOUT] Redirecting to billing page:', billingUrl.toString());
    structuredConsole.log('🔄 [CHECKOUT] Base URL:', request.url);
    structuredConsole.log('🔄 [CHECKOUT] Full redirect URL:', billingUrl.href);
    
    return NextResponse.redirect(billingUrl);

  } catch (error) {
    structuredConsole.error('❌ [CHECKOUT] Error:', error);
    return NextResponse.json(
      { error: 'Checkout failed' }, 
      { status: 500 }
    );
  }
}
