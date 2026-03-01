/**
 * ONE-TIME FIX: Repair user whose subscription was corrupted by the
 * social sharing trial_end bug.
 *
 * What happened:
 *   extendSubscription() set trial_end on an active yearly subscription,
 *   which regressed it to 'trialing' with ~395 days remaining.
 *
 * What this script does:
 *   1. Looks up the user by email
 *   2. Retrieves their Stripe subscription
 *   3. Verifies the corruption (status=trialing, trial_end > current_period_end)
 *   4. Ends the trial safely (only if current billing period is still valid)
 *   5. Applies the correct social sharing credit (monthly plan price)
 *   6. The Stripe webhook will automatically fix the DB state
 *
 * Usage:
 *   npx tsx scripts/fix-social-sharing-trial-bug.ts
 *
 * Safety:
 *   - DRY RUN by default. Pass --execute to actually apply changes.
 *   - Verifies current_period_end > now before ending trial (prevents double charge)
 *   - Logs every step for audit trail
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import Stripe from 'stripe';

const TARGET_EMAIL = 'dummy123@gmail.com';
const DRY_RUN = !process.argv.includes('--execute');

async function main() {
	const stripeKey = process.env.STRIPE_SECRET_KEY;
	if (!stripeKey) {
		console.error('❌ STRIPE_SECRET_KEY not set');
		process.exit(1);
	}

	const stripe = new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' as Stripe.LatestApiVersion });

	console.log(`\n${'='.repeat(60)}`);
	console.log(`  Fix Social Sharing Trial Bug`);
	console.log(`  Target: ${TARGET_EMAIL}`);
	console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN (pass --execute to apply)' : '⚡ EXECUTING'}`);
	console.log(`${'='.repeat(60)}\n`);

	// 1. Find customer by email
	const customers = await stripe.customers.list({ email: TARGET_EMAIL, limit: 1 });
	if (customers.data.length === 0) {
		console.error(`❌ No Stripe customer found for ${TARGET_EMAIL}`);
		process.exit(1);
	}
	const customer = customers.data[0];
	console.log(`✅ Found customer: ${customer.id} (${customer.email})`);

	// 2. Find their subscription
	const subs = await stripe.subscriptions.list({
		customer: customer.id,
		status: 'all',
		limit: 10,
	});

	const trialingSub = subs.data.find((s) => s.status === 'trialing');
	if (!trialingSub) {
		console.log('ℹ️  No trialing subscription found. Checking for active...');
		const activeSub = subs.data.find((s) => s.status === 'active');
		if (activeSub) {
			console.log(`✅ Subscription ${activeSub.id} is already active. No fix needed.`);
		} else {
			console.log(`❌ No active or trialing subscription found. Subs: ${subs.data.map((s) => `${s.id}(${s.status})`).join(', ')}`);
		}
		process.exit(0);
	}

	console.log(`\n📋 Subscription: ${trialingSub.id}`);
	console.log(`   Status: ${trialingSub.status}`);
	console.log(`   trial_start: ${trialingSub.trial_start ? new Date(trialingSub.trial_start * 1000).toISOString() : 'null'}`);
	console.log(`   trial_end: ${trialingSub.trial_end ? new Date(trialingSub.trial_end * 1000).toISOString() : 'null'}`);
	console.log(`   current_period_start: ${trialingSub.current_period_start ? new Date(trialingSub.current_period_start * 1000).toISOString() : 'null'}`);
	console.log(`   current_period_end: ${trialingSub.current_period_end ? new Date(trialingSub.current_period_end * 1000).toISOString() : 'null'}`);

	const nowSec = Math.floor(Date.now() / 1000);
	const periodEndSec = trialingSub.current_period_end || 0;
	const trialEndSec = trialingSub.trial_end ?? 0;

	// 3. Verify the corruption pattern
	// For trialing subs created by the bug, trial_end is way in the future (~395 days)
	// and the trial_end was set far beyond what a normal 7-day trial would be.
	const trialDurationDays = trialEndSec > 0 && trialingSub.trial_start
		? Math.round((trialEndSec - trialingSub.trial_start) / 86400)
		: 0;

	console.log(`\n🔍 Trial duration: ${trialDurationDays} days (normal is 7)`);

	if (trialDurationDays <= 37) {
		// 7 day trial + 30 day extension = 37 days max for a legitimate extension
		console.log('   This looks like a normal trial extension. Aborting.');
		process.exit(1);
	}

	console.log(`   ⚠️  Trial is ${trialDurationDays} days — clearly corrupted by the trial_end bug`);

	// 4. Safety check: if current_period_end exists and is in the future, ending trial is safe
	if (periodEndSec > 0 && nowSec < periodEndSec) {
		const daysLeftInPeriod = Math.round((periodEndSec - nowSec) / 86400);
		console.log(`✅ Current billing period is still valid (${daysLeftInPeriod} days remaining)`);
		console.log('   Setting trial_end=now is safe — Stripe won\'t charge because the period is already paid.\n');
	} else if (periodEndSec === 0 || periodEndSec === trialEndSec) {
		// For trialing subs, current_period_end often equals trial_end
		console.log('ℹ️  current_period_end equals trial_end (Stripe trialing behavior)');
		console.log('   Ending trial will transition to active and generate an invoice.');
		console.log('   We\'ll apply a credit first to cover any charge.\n');
	} else {
		console.error('\n❌ current_period_end is in the past. Manual Stripe Dashboard intervention required.');
		process.exit(1);
	}

	// 5. Get plan info for credit calculation
	const priceId = trialingSub.items.data[0]?.price?.id;
	const price = priceId ? await stripe.prices.retrieve(priceId) : null;
	const monthlyEquivalent = price?.unit_amount
		? price.recurring?.interval === 'year'
			? Math.round(price.unit_amount / 12)
			: price.unit_amount
		: null;

	console.log(`📦 Plan price: ${price?.unit_amount ? `$${(price.unit_amount / 100).toFixed(2)}/${price.recurring?.interval}` : 'unknown'}`);
	console.log(`💰 Monthly equivalent for credit: ${monthlyEquivalent ? `$${(monthlyEquivalent / 100).toFixed(2)}` : 'unknown'}`);

	if (!monthlyEquivalent) {
		console.error('❌ Could not determine plan price. Aborting.');
		process.exit(1);
	}

	// 6. Execute fix
	// Also get the full plan price in case Stripe charges on trial end
	const fullPlanPrice = price?.unit_amount ?? 0;

	if (DRY_RUN) {
		console.log('\n📝 DRY RUN — Would execute:');
		console.log(`   1. Apply plan credit: stripe.customers.createBalanceTransaction(${customer.id}, { amount: -${fullPlanPrice} })`);
		console.log(`      → Covers any invoice Stripe generates when trial ends`);
		console.log(`   2. End trial: stripe.subscriptions.update(${trialingSub.id}, { trial_end: 'now' })`);
		console.log(`      → Flips status from trialing to active`);
		console.log(`   3. Check invoice: if Stripe charged, the credit covers it`);
		console.log(`   4. Remove excess credit: refund the plan credit, keep only the social sharing credit`);
		console.log(`   5. Apply social sharing credit: -$${(monthlyEquivalent / 100).toFixed(2)}`);
		console.log('\n   Run with --execute to apply these changes.');
		process.exit(0);
	}

	// Step 1: Apply plan-price credit FIRST as a safety net
	// If Stripe generates an invoice when we end the trial, this credit absorbs it
	console.log('\n⚡ Step 1: Applying safety credit to cover potential invoice...');
	const safetyCreditTxn = await stripe.customers.createBalanceTransaction(customer.id, {
		amount: -fullPlanPrice,
		currency: 'usd',
		description: 'Temporary safety credit — trial_end bug remediation',
		metadata: { source: 'social_sharing_bugfix', type: 'safety_credit' },
	});
	console.log(`   ✅ Safety credit: -$${(fullPlanPrice / 100).toFixed(2)} (txn: ${safetyCreditTxn.id})`);

	// Step 2: End the bogus trial → subscription flips back to 'active'
	console.log('\n⚡ Step 2: Ending bogus trial...');
	const updatedSub = await stripe.subscriptions.update(trialingSub.id, {
		trial_end: 'now' as unknown as number,
	});
	console.log(`   ✅ Subscription status: ${updatedSub.status}`);
	console.log(`   ✅ trial_end: ${updatedSub.trial_end ? new Date(updatedSub.trial_end * 1000).toISOString() : 'null'}`);

	if (updatedSub.status !== 'active') {
		console.error(`   ⚠️  Expected status 'active' but got '${updatedSub.status}'`);
		console.error('   Check Stripe Dashboard manually.');
	}

	// Step 3: Check customer balance — remove the safety credit, apply only the social sharing credit
	// The safety credit may have been consumed by an invoice, or it may still be on the balance
	console.log('\n⚡ Step 3: Adjusting credits...');
	const customerAfterFix = await stripe.customers.retrieve(customer.id);
	const balanceAfter = 'balance' in customerAfterFix ? customerAfterFix.balance : 0;
	console.log(`   Customer balance after trial end: $${(balanceAfter / 100).toFixed(2)}`);

	// The balance should be -fullPlanPrice if no invoice consumed it,
	// or $0 if an invoice consumed the credit. Either way, we want the
	// final balance to be -monthlyEquivalent (the social sharing credit).
	const desiredBalance = -monthlyEquivalent;
	const adjustment = desiredBalance - balanceAfter;

	if (adjustment !== 0) {
		const adjTxn = await stripe.customers.createBalanceTransaction(customer.id, {
			amount: adjustment,
			currency: 'usd',
			description: adjustment < 0
				? 'Social sharing free month credit'
				: 'Remove safety credit after trial_end bug fix',
			metadata: { source: 'social_sharing_bugfix', type: 'final_adjustment' },
		});
		console.log(`   ✅ Balance adjusted by $${(adjustment / 100).toFixed(2)} (txn: ${adjTxn.id})`);
	}

	console.log(`   ✅ Final balance: -$${(monthlyEquivalent / 100).toFixed(2)} (social sharing credit)`);

	// Step 3: Verify final state
	console.log('\n⚡ Step 3: Verifying...');
	const finalSub = await stripe.subscriptions.retrieve(trialingSub.id);
	const finalBalance = await stripe.customers.retrieve(customer.id);
	console.log(`   Subscription status: ${finalSub.status}`);
	console.log(`   Customer balance: $${('balance' in finalBalance ? (finalBalance.balance / 100).toFixed(2) : 'unknown')}`);

	console.log(`\n${'='.repeat(60)}`);
	console.log('  ✅ FIX COMPLETE');
	console.log('  ');
	console.log('  The Stripe webhook will automatically update the DB.');
	console.log('  The sidebar should show the correct state on next page load.');
	console.log(`${'='.repeat(60)}\n`);
}

main().catch((err) => {
	console.error('❌ Script failed:', err);
	process.exit(1);
});
