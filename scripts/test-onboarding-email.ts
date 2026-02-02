/**
 * Test script to send onboarding emails directly
 * Usage: npx tsx scripts/test-onboarding-email.ts [email-number]
 *
 * Example:
 *   npx tsx scripts/test-onboarding-email.ts 1  # Send onboarding email 1
 *   npx tsx scripts/test-onboarding-email.ts all  # Send all 6 emails
 */

import * as React from 'react';
// Make React available globally for email templates
(globalThis as Record<string, unknown>).React = React;

import { Resend } from 'resend';
import OnboardingWelcomeEmail from '../components/email-templates/onboarding-1-welcome';
import OnboardingKeywordEmail from '../components/email-templates/onboarding-2-keyword-search';
import OnboardingSimilarCreatorEmail from '../components/email-templates/onboarding-3-similar-creator';
import OnboardingNotDatabaseEmail from '../components/email-templates/onboarding-4-not-database';
import OnboardingCostComparisonEmail from '../components/email-templates/onboarding-5-cost-comparison';
import OnboardingFinalPushEmail from '../components/email-templates/onboarding-6-final-push';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const resend = new Resend(process.env.RESEND_API_KEY);

const TEST_EMAIL = 'sanchaythalnerkar@gmail.com';
const FROM_EMAIL = process.env.EMAIL_FROM_ADDRESS || 'support@usegemz.io';

// Make it replyable by using a real email address
const FROM_WITH_NAME = `Ramon from Gemz <${FROM_EMAIL}>`;

const emails = [
	{
		number: 1,
		subject: "Welcome to Gemz — here's what you're unlocking",
		component: OnboardingWelcomeEmail,
	},
	{
		number: 2,
		subject: 'How to find creators by what they actually talk about',
		component: OnboardingKeywordEmail,
	},
	{
		number: 3,
		subject: "Found one good creator? Here's how to find 50 more",
		component: OnboardingSimilarCreatorEmail,
	},
	{
		number: 4,
		subject: 'Why influencer databases are lying to you',
		component: OnboardingNotDatabaseEmail,
	},
	{
		number: 5,
		subject: "You don't need a $500/mo influencer tool",
		component: OnboardingCostComparisonEmail,
	},
	{
		number: 6,
		subject: "Last thing — then I'll stop emailing",
		component: OnboardingFinalPushEmail,
	},
];

async function sendEmail(emailNumber: number) {
	const email = emails.find((e) => e.number === emailNumber);
	if (!email) {
		console.error(`Email ${emailNumber} not found`);
		return;
	}

	const Component = email.component;
	const props = {
		fullName: 'Ramon',
		dashboardUrl: `https://usegems.io/dashboard?utm_source=email&utm_campaign=onboarding_${emailNumber}`,
		// unsubscribeUrl intentionally omitted - no unsubscribe page exists yet
	};

	console.log(`\n📧 Sending Onboarding Email ${emailNumber}: "${email.subject}"`);
	console.log(`   To: ${TEST_EMAIL}`);
	console.log(`   From: ${FROM_WITH_NAME}`);

	try {
		const result = await resend.emails.send({
			from: FROM_WITH_NAME,
			to: [TEST_EMAIL],
			subject: `[TEST] ${email.subject}`,
			react: Component(props),
			replyTo: FROM_EMAIL, // Makes the email replyable
		});

		console.log(`   ✅ Sent! ID: ${result.data?.id || 'unknown'}`);
		return result;
	} catch (error) {
		console.error(`   ❌ Failed:`, error);
		throw error;
	}
}

async function main() {
	const arg = process.argv[2] || '1';

	console.log('═══════════════════════════════════════════');
	console.log('  GEMZ ONBOARDING EMAIL TESTER');
	console.log('═══════════════════════════════════════════');
	console.log(`Using Resend API Key: ${process.env.RESEND_API_KEY?.slice(0, 10)}...`);
	console.log(`From: ${FROM_WITH_NAME}`);
	console.log(`Reply-To: ${FROM_EMAIL}`);

	if (arg === 'all') {
		console.log('\nSending all 6 onboarding emails...\n');
		for (const email of emails) {
			await sendEmail(email.number);
			// Wait 2 seconds between emails to avoid rate limiting
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	} else {
		const num = parseInt(arg, 10);
		if (isNaN(num) || num < 1 || num > 6) {
			console.error('Usage: npx tsx scripts/test-onboarding-email.ts [1-6|all]');
			process.exit(1);
		}
		await sendEmail(num);
	}

	console.log('\n═══════════════════════════════════════════');
	console.log('  DONE! Check your inbox.');
	console.log('═══════════════════════════════════════════\n');
}

main().catch(console.error);
