import { ApifyClient as OriginalApifyClient } from 'apify-client';
import { structuredConsole } from '@/lib/logging/console-proxy';

// Attempt to initialize the client, but allow it to be null if token is missing during dev/setup.
// Features relying on this will then need to check if apifyClientInstance is initialized.
let apifyClientInstance: OriginalApifyClient | null = null;

if (process.env.APIFY_TOKEN) {
	apifyClientInstance = new OriginalApifyClient({
		token: process.env.APIFY_TOKEN,
		// Consider adding other ApifyClient options here if needed, like maxRetries, timeoutSecs, etc.
	});
} else {
	// Log a clear warning during development if the token is missing.
	// In a production environment or when Apify features are actively used, this should be treated as a critical misconfiguration.
	if (process.env.NODE_ENV === 'development') {
		structuredConsole.warn(
			'WARNING: APIFY_TOKEN is not defined in environment variables. Apify-dependent features will not work. This is acceptable for local development if Apify features are not currently being tested, but it is a critical issue for production or active feature use.'
		);
	} else {
		// For non-development environments, if the token is missing, it's a more severe issue.
		// Depending on application design, you might throw an error here during app startup,
		// or let features fail at runtime with a clear error if apifyClientInstance is null.
		// For now, we allow it to be null and dependent features must check.
		structuredConsole.error(
			'CRITICAL ERROR: APIFY_TOKEN is not defined. Apify-dependent features WILL FAIL.'
		);
	}
}

export const apifyClient = apifyClientInstance;
