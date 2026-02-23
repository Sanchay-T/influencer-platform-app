import {
	CreatorNotFoundError,
	EnrichmentApiError,
	PlanLimitExceededError,
} from '@/lib/services/creator-enrichment';
import { getStringProperty, isString, toRecord } from '@/lib/utils/type-guards';

export type EnrichmentFailureKind =
	| 'creator_not_found'
	| 'user_plan_limit'
	| 'provider_rate_limited'
	| 'provider_unavailable'
	| 'provider_invalid_request'
	| 'unknown';

export type NormalizedEnrichmentFailure = {
	kind: EnrichmentFailureKind;
	publicMessage: string;
	retryable: boolean;
};

function normalizeText(raw: string): string {
	return raw.replace(/\s+/g, ' ').replace(/\u0000/g, '').trim();
}

function truncateForUi(raw: string, maxLen = 140): string {
	if (raw.length <= maxLen) return raw;
	return `${raw.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

function extractProviderDetail(payload: unknown): string | null {
	if (isString(payload)) {
		return payload;
	}
	const record = toRecord(payload);
	if (!record) return null;
	return (
		getStringProperty(record, 'detail') ||
		getStringProperty(record, 'message') ||
		getStringProperty(record, 'error')
	);
}

function looksSensitiveProviderIssue(lower: string): boolean {
	// Never surface vendor/account/credential/credit messages to end users.
	return (
		lower.includes('credit') ||
		lower.includes('credits') ||
		lower.includes('billing') ||
		lower.includes('subscription') ||
		lower.includes('payment') ||
		lower.includes('api key') ||
		lower.includes('token') ||
		lower.includes('not configured') ||
		(lower.includes('quota') && (lower.includes('exceeded') || lower.includes('exhaust')))
	);
}

function normalizeApiFailure(status: number, rawDetail: string): NormalizedEnrichmentFailure {
	const detail = normalizeText(rawDetail);
	const lower = detail.toLowerCase();

	// Rate limits and transient provider issues should be retried automatically.
	if (status === 429 || lower.includes('rate limit') || lower.includes('too many requests')) {
		return {
			kind: 'provider_rate_limited',
			// Keep this message as a reason (not an action). UI can decide whether it retries automatically.
			publicMessage: 'Enrichment is temporarily busy.',
			retryable: true,
		};
	}

	// Provider billing/credits/account issues are on us: hide the specifics.
	if (status === 402 || status === 403 || looksSensitiveProviderIssue(lower)) {
		return {
			kind: 'provider_unavailable',
			publicMessage: 'Enrichment is temporarily unavailable.',
			retryable: true,
		};
	}

	if (status === 404 || lower.includes('not found') || lower.includes('does not exist')) {
		return {
			kind: 'creator_not_found',
			publicMessage: 'Creator profile could not be found on this platform.',
			retryable: false,
		};
	}

	if (status >= 500) {
		return {
			kind: 'provider_unavailable',
			publicMessage: 'Enrichment is temporarily unavailable.',
			retryable: true,
		};
	}

	// For other 4xx, surface a short vendor message if it is safe.
	if (status >= 400 && status < 500) {
		if (looksSensitiveProviderIssue(lower)) {
			return {
				kind: 'provider_invalid_request',
				publicMessage: 'Enrichment failed due to a temporary service issue.',
				retryable: false,
			};
		}
		return {
			kind: 'provider_invalid_request',
			publicMessage: truncateForUi(detail),
			retryable: false,
		};
	}

	return {
		kind: 'unknown',
		publicMessage: truncateForUi(detail || 'Enrichment failed.'),
		retryable: false,
	};
}

export function normalizeEnrichmentFailure(error: unknown): NormalizedEnrichmentFailure {
	if (error instanceof CreatorNotFoundError) {
		return {
			kind: 'creator_not_found',
			publicMessage: 'Creator profile could not be found on this platform.',
			retryable: false,
		};
	}

	if (error instanceof PlanLimitExceededError) {
		return {
			kind: 'user_plan_limit',
			publicMessage: 'Monthly enrichment limit reached for your plan.',
			retryable: false,
		};
	}

	if (error instanceof EnrichmentApiError) {
		const rawDetail = extractProviderDetail(error.payload) || error.message || 'Enrichment failed';
		return normalizeApiFailure(error.status, rawDetail);
	}

	// Network/infra errors from fetch() often show up as plain Errors.
	if (error instanceof Error) {
		const message = normalizeText(error.message || 'Enrichment failed');
		const lower = message.toLowerCase();
		if (lower.includes('fetch failed') || lower.includes('econn') || lower.includes('timeout')) {
			return {
				kind: 'provider_unavailable',
				publicMessage: 'Enrichment is temporarily unavailable.',
				retryable: true,
			};
		}
		if (looksSensitiveProviderIssue(lower)) {
			return {
				kind: 'provider_unavailable',
				publicMessage: 'Enrichment is temporarily unavailable.',
				retryable: false,
			};
		}
		return {
			kind: 'unknown',
			publicMessage: truncateForUi(message),
			retryable: false,
		};
	}

	return {
		kind: 'unknown',
		publicMessage: 'Enrichment failed.',
		retryable: false,
	};
}
