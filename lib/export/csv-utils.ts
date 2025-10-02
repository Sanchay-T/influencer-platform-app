import { dedupeCreators as sharedDedupeCreators } from '@/lib/utils/dedupe-creators';
export type { DedupeOptions } from '@/lib/utils/dedupe-creators';

/**
 * Helper utilities used by CSV export API routes. The functions here mirror the
 * client-side behaviour (deduping creators and extracting contact emails) so the
 * downloaded files match what users see inside the dashboard.
 */

const EMAIL_KEY_PATTERN = /email/i;
const EMAIL_REGEX = /[^\s@]+@[^\s@]+\.[^\s@]+/i;

type CreatorRecord = Record<string, unknown>;

export const dedupeCreators = (
  creators: unknown[],
  options: DedupeOptions = {},
): CreatorRecord[] => sharedDedupeCreators(creators as CreatorRecord[], options) as CreatorRecord[];

const normalizeEmail = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (EMAIL_REGEX.test(trimmed)) {
    return trimmed;
  }

  return null;
};

export const extractEmails = (input: unknown): string[] => {
  const collected = new Set<string>();
  const stack: unknown[] = [input];
  const visited = new Set<CreatorRecord>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null) continue;

    if (typeof current === 'string') {
      const normalized = normalizeEmail(current);
      if (normalized) {
        collected.add(normalized);
      }
      continue;
    }

    if (Array.isArray(current)) {
      current.forEach((value) => stack.push(value));
      continue;
    }

    if (typeof current === 'object') {
      const record = current as CreatorRecord;
      if (visited.has(record)) {
        continue;
      }
      visited.add(record);

      Object.entries(record).forEach(([key, value]) => {
        if (!value) return;

        if (EMAIL_KEY_PATTERN.test(key)) {
          stack.push(value);
        } else if (typeof value === 'string' && EMAIL_REGEX.test(value)) {
          stack.push(value);
        } else if (typeof value === 'object') {
          stack.push(value);
        }
      });
    }
  }

  return Array.from(collected);
};

export const formatEmailsForCsv = (input: unknown): string => {
  const emails = extractEmails(input);
  return emails.join('; ');
};
