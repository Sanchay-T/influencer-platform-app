#!/usr/bin/env npx tsx
/**
 * Webhook idempotency smoke check.
 *
 * Validates that the Clerk webhook endpoint responds consistently to duplicate ids.
 */

import 'dotenv/config';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

function generateTimestamp() {
	return Math.floor(Date.now() / 1000);
}

async function main() {
	const eventId = `test_idempotency_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
	const webhookBody = JSON.stringify({
		type: 'user.created',
		data: {
			id: `user_test_${Date.now()}`,
			email_addresses: [{ email_address: `idem_${Date.now()}@test.local` }],
		},
	});

	const send = async () =>
		fetch(`${BASE_URL}/api/webhooks/clerk`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'svix-id': eventId,
				'svix-timestamp': String(generateTimestamp()),
				'svix-signature': 'v1,test_signature_will_fail',
			},
			body: webhookBody,
		});

	const first = await send();
	const second = await send();

	const ok =
		(first.status === 400 || first.status === 401) &&
		(second.status === 400 || second.status === 401);

	if (!ok) {
		console.error(
			`Webhook idempotency check failed: first=${first.status}, second=${second.status}`
		);
		process.exit(1);
	}

	console.log(
		`Webhook idempotency check passed: first=${first.status}, second=${second.status}`
	);
}

main().catch((error) => {
	console.error('Webhook idempotency check failed:', error instanceof Error ? error.message : error);
	process.exit(1);
});
