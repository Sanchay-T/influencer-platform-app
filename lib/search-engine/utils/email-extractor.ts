/**
 * Email extraction utility for extracting email addresses from Instagram biographies.
 *
 * Used by the Bio Enrichment system to extract contact emails from creator bios
 * fetched via ScrapeCreators basic-profile API.
 */

// Comprehensive email regex that handles common patterns
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Extracts the first email address from a biography text.
 *
 * @param biography - The biography text to search
 * @returns The first email found, or null if none found
 *
 * @example
 * extractEmail('Contact: hello@example.com') // 'hello@example.com'
 * extractEmail('DM for collabs\nbusiness@brand.co') // 'business@brand.co'
 * extractEmail('No email here!') // null
 */
export function extractEmail(biography: string | null | undefined): string | null {
  if (!biography || typeof biography !== 'string') {
    return null;
  }

  const matches = biography.match(EMAIL_REGEX);
  return matches?.[0] || null;
}

/**
 * Extracts all email addresses from a biography text.
 *
 * @param biography - The biography text to search
 * @returns Array of all emails found (may be empty)
 *
 * @example
 * extractAllEmails('work@a.com or personal@b.com') // ['work@a.com', 'personal@b.com']
 */
export function extractAllEmails(biography: string | null | undefined): string[] {
  if (!biography || typeof biography !== 'string') {
    return [];
  }

  const matches = biography.match(EMAIL_REGEX);
  return matches || [];
}

/**
 * Checks if a string contains any email address.
 *
 * @param text - The text to check
 * @returns true if at least one email is found
 */
export function hasEmail(text: string | null | undefined): boolean {
  return extractEmail(text) !== null;
}
