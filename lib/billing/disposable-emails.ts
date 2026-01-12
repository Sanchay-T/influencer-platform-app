/**
 * Disposable Email Detection
 *
 * Blocks known temporary/disposable email domains to prevent trial abuse.
 * List sourced from common disposable email providers.
 */

const DISPOSABLE_DOMAINS = new Set([
	// Popular temporary email services
	'mailinator.com',
	'guerrillamail.com',
	'tempmail.com',
	'10minutemail.com',
	'throwaway.email',
	'fakeinbox.com',
	'trashmail.com',
	'temp-mail.org',
	'temp-mail.io',
	'yopmail.com',
	'sharklasers.com',
	'getnada.com',
	'dispostable.com',
	'mailnesia.com',
	'mintemail.com',
	'tempr.email',
	'discard.email',
	'mytemp.email',
	'mohmal.com',
	'tempinbox.com',
	'mailcatch.com',
	'emailondeck.com',
	'fakemailgenerator.com',
	'guerrillamailblock.com',
	'maildrop.cc',
	'inboxalias.com',
	'spamgourmet.com',
	'mailnull.com',
	'mailexpire.com',
	'tempail.com',
	'fakemailgenerator.net',
	'getairmail.com',
	'mailforspam.com',
	'spam4.me',
	'throwawaymail.com',
	'mailslurp.com',
	'burnermail.io',
	'10minmail.com',
	'tempmailo.com',
	'mailsac.com',
]);

/**
 * Check if an email is from a disposable/temporary domain
 */
export function isDisposableEmail(email: string): boolean {
	if (!email?.includes('@')) {
		return false;
	}
	const domain = email.toLowerCase().split('@')[1];
	return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Get user-friendly error message for disposable emails
 */
export function getDisposableEmailError(): string {
	return 'Please use a permanent email address. Temporary or disposable emails are not allowed for free trials.';
}
