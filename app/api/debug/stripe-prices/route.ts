import { type NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { structuredConsole } from '@/lib/logging/console-proxy';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
	apiVersion: '2024-06-20',
});

export async function GET(req: NextRequest) {
	try {
		structuredConsole.log('🔍 [STRIPE-DEBUG] Checking all price configurations...');

		const priceIds = {
			glow_up_monthly: process.env.STRIPE_GLOW_UP_MONTHLY_PRICE_ID,
			glow_up_yearly: process.env.STRIPE_GLOW_UP_YEARLY_PRICE_ID,
			viral_surge_monthly: process.env.STRIPE_VIRAL_SURGE_MONTHLY_PRICE_ID,
			viral_surge_yearly: process.env.STRIPE_VIRAL_SURGE_YEARLY_PRICE_ID,
			fame_flex_monthly: process.env.STRIPE_FAME_FLEX_MONTHLY_PRICE_ID,
			fame_flex_yearly: process.env.STRIPE_FAME_FLEX_YEARLY_PRICE_ID,
		};

		const priceDetails = {};

		for (const [planName, priceId] of Object.entries(priceIds)) {
			if (!priceId) {
				priceDetails[planName] = { error: 'Price ID not configured' };
				continue;
			}

			try {
				const price = await stripe.prices.retrieve(priceId);
				priceDetails[planName] = {
					id: price.id,
					amount: price.unit_amount,
					currency: price.currency,
					interval: price.recurring?.interval,
					interval_count: price.recurring?.interval_count,
					type: price.type,
					active: price.active,
					product: price.product,
					// Convert to human readable
					displayAmount: `$${(price.unit_amount! / 100).toFixed(2)}`,
					displayInterval: price.recurring ? `per ${price.recurring.interval}` : 'one-time',
				};

				structuredConsole.log(
					`✅ [STRIPE-DEBUG] ${planName}: ${priceDetails[planName].displayAmount} ${priceDetails[planName].displayInterval}`
				);
			} catch (error) {
				priceDetails[planName] = {
					error: error instanceof Error ? error.message : 'Unknown error',
					priceId,
				};
				structuredConsole.error(`❌ [STRIPE-DEBUG] ${planName}: ${error}`);
			}
		}

		structuredConsole.log(
			'📊 [STRIPE-DEBUG] Complete price analysis:',
			JSON.stringify(priceDetails, null, 2)
		);

		return NextResponse.json({
			success: true,
			priceDetails,
			summary: {
				total_prices: Object.keys(priceIds).length,
				configured_prices: Object.values(priceDetails).filter((p) => !p.error).length,
				missing_prices: Object.values(priceDetails).filter((p) => p.error).length,
			},
		});
	} catch (error) {
		structuredConsole.error('❌ [STRIPE-DEBUG] Error checking prices:', error);
		return NextResponse.json({ error: 'Failed to check Stripe prices' }, { status: 500 });
	}
}
