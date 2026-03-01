import { eq } from 'drizzle-orm';
import { Resend } from 'resend';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { SentryLogger } from '@/lib/logging/sentry-logger';

// Initialize Resend client
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID;

// =====================================================
// USE2-79: Resend Auto-Tagging
// =====================================================
// Resend SDK does NOT support native contact tags.
// Tags are stored in our DB (users.resendTags) and used
// for broadcast targeting/segmentation.

/** Lifecycle tags for Resend audience segmentation */
export const RESEND_TAGS = {
	SIGNUP: 'signup',
	TRIAL: 'trial',
	CANCELLED_TRIAL: 'cancelled_trial',
	CUSTOMER: 'customer',
} as const;

export type ResendTag = (typeof RESEND_TAGS)[keyof typeof RESEND_TAGS];

/**
 * Derive the correct set of tags from a user's subscription status.
 * Tags are additive/cumulative — once a user signs up, they always have 'signup'.
 */
export function deriveResendTags(
	subscriptionStatus: string | null | undefined,
	previousStatus?: string | null
): ResendTag[] {
	const tags: ResendTag[] = [RESEND_TAGS.SIGNUP];

	switch (subscriptionStatus) {
		case 'trialing':
			tags.push(RESEND_TAGS.TRIAL);
			break;
		case 'active':
			tags.push(RESEND_TAGS.CUSTOMER);
			break;
		case 'canceled':
			// Distinguish between cancelled trial and cancelled paid subscription
			if (previousStatus === 'trialing') {
				tags.push(RESEND_TAGS.CANCELLED_TRIAL);
			} else {
				// Was a paying customer who cancelled
				tags.push(RESEND_TAGS.CUSTOMER);
			}
			break;
		case 'past_due':
		case 'unpaid':
			tags.push(RESEND_TAGS.CUSTOMER);
			break;
		// 'none' or null — just 'signup'
	}

	return tags;
}

export interface AddContactResult {
	success: boolean;
	id?: string;
	error?: string;
	alreadyExists?: boolean;
}

/**
 * Resend Audience Service - Manages syncing users to Resend audience for marketing emails
 *
 * Uses fire-and-forget pattern for webhook handlers to avoid blocking user creation.
 * Errors are logged to Sentry but don't fail the parent operation.
 */
export class ResendAudienceService {
	/**
	 * Add a contact to the Resend audience
	 * Handles "already exists" gracefully as success
	 */
	static async addContact(params: {
		email: string;
		firstName?: string;
		lastName?: string;
	}): Promise<AddContactResult> {
		const { email, firstName, lastName } = params;

		// Validate email
		if (!email?.includes('@')) {
			structuredConsole.warn('⚠️ [RESEND-AUDIENCE] Invalid email, skipping sync:', email);
			return { success: false, error: 'Invalid email address' };
		}

		// Check configuration
		if (!AUDIENCE_ID) {
			structuredConsole.warn(
				'⚠️ [RESEND-AUDIENCE] RESEND_AUDIENCE_ID not configured, skipping sync'
			);
			SentryLogger.captureException(
				new Error('RESEND_AUDIENCE_ID not configured — audience sync disabled'),
				{
					tags: { feature: 'resend_audience', operation: 'add_contact' },
					extra: { email },
					level: 'warning',
				}
			);
			return { success: false, error: 'Audience ID not configured' };
		}

		if (!resend) {
			structuredConsole.warn('⚠️ [RESEND-AUDIENCE] Resend client not initialized, skipping sync');
			return { success: false, error: 'Resend client not initialized' };
		}

		try {
			structuredConsole.log('📥 [RESEND-AUDIENCE] Adding contact:', {
				email,
				firstName,
				lastName,
				audienceId: AUDIENCE_ID,
			});

			const result = await resend.contacts.create({
				audienceId: AUDIENCE_ID,
				email,
				firstName: firstName || undefined,
				lastName: lastName || undefined,
				unsubscribed: false,
			});

			// Handle API response
			if (result.error) {
				const errorMessage = result.error.message || 'Unknown error';

				// Check if contact already exists (not a real error)
				if (
					errorMessage.toLowerCase().includes('already exists') ||
					errorMessage.toLowerCase().includes('duplicate')
				) {
					structuredConsole.log('✅ [RESEND-AUDIENCE] Contact already exists:', email);
					return { success: true, alreadyExists: true };
				}

				structuredConsole.error('❌ [RESEND-AUDIENCE] API error:', {
					email,
					error: errorMessage,
				});

				SentryLogger.captureException(new Error(errorMessage), {
					tags: { feature: 'resend_audience', operation: 'add_contact' },
					extra: { email, firstName, lastName },
					level: 'warning',
				});

				return { success: false, error: errorMessage };
			}

			structuredConsole.log('✅ [RESEND-AUDIENCE] Contact added successfully:', {
				email,
				contactId: result.data?.id,
			});

			return { success: true, id: result.data?.id };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			// Check for "already exists" in exception
			if (
				errorMessage.toLowerCase().includes('already exists') ||
				errorMessage.toLowerCase().includes('duplicate')
			) {
				structuredConsole.log('✅ [RESEND-AUDIENCE] Contact already exists:', email);
				return { success: true, alreadyExists: true };
			}

			structuredConsole.error('❌ [RESEND-AUDIENCE] Failed to add contact:', {
				email,
				error: errorMessage,
			});

			SentryLogger.captureException(error, {
				tags: { feature: 'resend_audience', operation: 'add_contact' },
				extra: { email, firstName, lastName },
				level: 'warning',
			});

			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Update an existing contact in the Resend audience
	 * Uses the proper update API for existing contacts
	 */
	static async updateContact(params: {
		email: string;
		firstName?: string;
		lastName?: string;
	}): Promise<AddContactResult> {
		const { email, firstName, lastName } = params;

		// Validate email
		if (!email?.includes('@')) {
			structuredConsole.warn('⚠️ [RESEND-AUDIENCE] Invalid email for update, skipping:', email);
			return { success: false, error: 'Invalid email address' };
		}

		// Check configuration
		if (!AUDIENCE_ID) {
			structuredConsole.warn(
				'⚠️ [RESEND-AUDIENCE] RESEND_AUDIENCE_ID not configured, skipping update'
			);
			SentryLogger.captureException(
				new Error('RESEND_AUDIENCE_ID not configured — audience sync disabled'),
				{
					tags: { feature: 'resend_audience', operation: 'update_contact' },
					extra: { email },
					level: 'warning',
				}
			);
			return { success: false, error: 'Audience ID not configured' };
		}

		if (!resend) {
			structuredConsole.warn('⚠️ [RESEND-AUDIENCE] Resend client not initialized, skipping update');
			return { success: false, error: 'Resend client not initialized' };
		}

		try {
			structuredConsole.log('📝 [RESEND-AUDIENCE] Updating contact:', {
				email,
				firstName,
				lastName,
				audienceId: AUDIENCE_ID,
			});

			const result = await resend.contacts.update({
				audienceId: AUDIENCE_ID,
				email,
				firstName: firstName || undefined,
				lastName: lastName || undefined,
			});

			if (result.error) {
				const errorMessage = result.error.message || 'Unknown error';

				// Contact not found - try to add instead
				if (
					errorMessage.toLowerCase().includes('not found') ||
					errorMessage.toLowerCase().includes('does not exist')
				) {
					structuredConsole.log('⚠️ [RESEND-AUDIENCE] Contact not found, adding instead:', email);
					return ResendAudienceService.addContact(params);
				}

				structuredConsole.error('❌ [RESEND-AUDIENCE] API error on update:', {
					email,
					error: errorMessage,
				});

				SentryLogger.captureException(new Error(errorMessage), {
					tags: { feature: 'resend_audience', operation: 'update_contact' },
					extra: { email, firstName, lastName },
					level: 'warning',
				});

				return { success: false, error: errorMessage };
			}

			structuredConsole.log('✅ [RESEND-AUDIENCE] Contact updated successfully:', {
				email,
				contactId: result.data?.id,
			});

			return { success: true, id: result.data?.id };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			// Contact not found - try to add instead
			if (
				errorMessage.toLowerCase().includes('not found') ||
				errorMessage.toLowerCase().includes('does not exist')
			) {
				structuredConsole.log('⚠️ [RESEND-AUDIENCE] Contact not found, adding instead:', email);
				return ResendAudienceService.addContact(params);
			}

			structuredConsole.error('❌ [RESEND-AUDIENCE] Failed to update contact:', {
				email,
				error: errorMessage,
			});

			SentryLogger.captureException(error, {
				tags: { feature: 'resend_audience', operation: 'update_contact' },
				extra: { email, firstName, lastName },
				level: 'warning',
			});

			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Remove a contact from the Resend audience
	 */
	static async removeContact(email: string): Promise<AddContactResult> {
		// Validate email
		if (!email?.includes('@')) {
			structuredConsole.warn('⚠️ [RESEND-AUDIENCE] Invalid email for removal, skipping:', email);
			return { success: false, error: 'Invalid email address' };
		}

		// Check configuration
		if (!AUDIENCE_ID) {
			structuredConsole.warn(
				'⚠️ [RESEND-AUDIENCE] RESEND_AUDIENCE_ID not configured, skipping removal'
			);
			SentryLogger.captureException(
				new Error('RESEND_AUDIENCE_ID not configured — audience sync disabled'),
				{
					tags: { feature: 'resend_audience', operation: 'remove_contact' },
					extra: { email },
					level: 'warning',
				}
			);
			return { success: false, error: 'Audience ID not configured' };
		}

		if (!resend) {
			structuredConsole.warn('⚠️ [RESEND-AUDIENCE] Resend client not initialized, skipping removal');
			return { success: false, error: 'Resend client not initialized' };
		}

		try {
			structuredConsole.log('📤 [RESEND-AUDIENCE] Removing contact:', {
				email,
				audienceId: AUDIENCE_ID,
			});

			// Resend requires contact ID for deletion, but we can use email
			// Use the contacts.remove method with email
			const result = await resend.contacts.remove({
				audienceId: AUDIENCE_ID,
				email,
			});

			if (result.error) {
				const errorMessage = result.error.message || 'Unknown error';

				// Contact not found is not an error for removal
				if (
					errorMessage.toLowerCase().includes('not found') ||
					errorMessage.toLowerCase().includes('does not exist')
				) {
					structuredConsole.log(
						'✅ [RESEND-AUDIENCE] Contact already removed or not found:',
						email
					);
					return { success: true };
				}

				structuredConsole.error('❌ [RESEND-AUDIENCE] API error on removal:', {
					email,
					error: errorMessage,
				});

				SentryLogger.captureException(new Error(errorMessage), {
					tags: { feature: 'resend_audience', operation: 'remove_contact' },
					extra: { email },
					level: 'warning',
				});

				return { success: false, error: errorMessage };
			}

			structuredConsole.log('✅ [RESEND-AUDIENCE] Contact removed successfully:', email);
			return { success: true };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			// Contact not found is not an error for removal
			if (
				errorMessage.toLowerCase().includes('not found') ||
				errorMessage.toLowerCase().includes('does not exist')
			) {
				structuredConsole.log('✅ [RESEND-AUDIENCE] Contact already removed or not found:', email);
				return { success: true };
			}

			structuredConsole.error('❌ [RESEND-AUDIENCE] Failed to remove contact:', {
				email,
				error: errorMessage,
			});

			SentryLogger.captureException(error, {
				tags: { feature: 'resend_audience', operation: 'remove_contact' },
				extra: { email },
				level: 'warning',
			});

			return { success: false, error: errorMessage };
		}
	}

	/**
	 * List all contacts in the audience (for backfill comparison)
	 * Returns email addresses of existing contacts
	 */
	static async listContacts(): Promise<{
		success: boolean;
		emails?: string[];
		error?: string;
	}> {
		if (!AUDIENCE_ID) {
			return { success: false, error: 'Audience ID not configured' };
		}

		if (!resend) {
			return { success: false, error: 'Resend client not initialized' };
		}

		try {
			const result = await resend.contacts.list({ audienceId: AUDIENCE_ID });

			if (result.error) {
				return { success: false, error: result.error.message };
			}

			const emails = result.data?.data?.map((contact) => contact.email) ?? [];
			return { success: true, emails };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return { success: false, error: errorMessage };
		}
	}

	// =====================================================
	// USE2-79: Tag Management (DB-local, not Resend API)
	// =====================================================

	/**
	 * Set lifecycle tags for a user (stored in DB, not Resend).
	 * Used for broadcast targeting and segmentation.
	 *
	 * @param clerkUserId - The Clerk user ID (users.userId)
	 * @param tags - Array of ResendTag values to set
	 */
	static async setContactTags(
		clerkUserId: string,
		tags: ResendTag[]
	): Promise<{ success: boolean; error?: string }> {
		try {
			structuredConsole.log('🏷️ [RESEND-TAGS] Setting tags:', {
				userId: clerkUserId,
				tags,
			});

			await db
				.update(users)
				.set({
					resendTags: tags,
					updatedAt: new Date(),
				})
				.where(eq(users.userId, clerkUserId));

			structuredConsole.log('✅ [RESEND-TAGS] Tags set successfully:', {
				userId: clerkUserId,
				tags,
			});

			return { success: true };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			structuredConsole.error('❌ [RESEND-TAGS] Failed to set tags:', {
				userId: clerkUserId,
				tags,
				error: errorMessage,
			});

			SentryLogger.captureException(error instanceof Error ? error : new Error(errorMessage), {
				tags: { feature: 'resend_tags', operation: 'set_contact_tags' },
				extra: { clerkUserId, resendTags: tags },
				level: 'warning',
			});

			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Derive and set tags based on the user's current subscription status.
	 * Convenience method that combines deriveResendTags + setContactTags.
	 */
	static async syncTagsFromStatus(
		clerkUserId: string,
		subscriptionStatus: string | null | undefined,
		previousStatus?: string | null
	): Promise<{ success: boolean; error?: string }> {
		const tags = deriveResendTags(subscriptionStatus, previousStatus);
		return ResendAudienceService.setContactTags(clerkUserId, tags);
	}
}
