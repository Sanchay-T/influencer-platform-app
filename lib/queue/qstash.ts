import { Client } from '@upstash/qstash';

export const qstash = new Client({
	token: process.env.QSTASH_TOKEN!,
});

/**
 * Get the base URL for QStash callbacks.
 * Uses NEXT_PUBLIC_SITE_URL in production, falls back to VERCEL_URL or localhost.
 */
export function getQstashBaseUrl(): string {
	if (process.env.NEXT_PUBLIC_SITE_URL) {
		return process.env.NEXT_PUBLIC_SITE_URL;
	}
	if (process.env.VERCEL_URL) {
		return `https://${process.env.VERCEL_URL}`;
	}
	return 'http://localhost:3002';
}

/**
 * Get the Dead Letter Queue URL for failed QStash messages.
 * All failed messages (after retries exhausted) go here for logging and potential retry.
 */
export function getDeadLetterQueueUrl(): string {
	return `${getQstashBaseUrl()}/api/qstash/dead-letter`;
}
