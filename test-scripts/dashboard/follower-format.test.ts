import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { formatFollowerCount, formatRelativeTime } from '@/lib/dashboard/formatters';

describe('dashboard formatters', () => {
  it('format millions with one decimal place and suffix', () => {
    assert.equal(formatFollowerCount(2400000), '2.4M');
  });

  it('format thousands without decimal when whole', () => {
    assert.equal(formatFollowerCount(1800), '1.8K');
  });

  it('falls back to dash when value missing', () => {
    assert.equal(formatFollowerCount(null), '—');
  });

  it('shows relative time for past dates', () => {
    const reference = new Date('2025-09-26T12:00:00Z');
    assert.equal(formatRelativeTime('2025-09-24T12:00:00Z', reference), '2 days ago');
  });

  it('shows relative time for recent future events', () => {
    const reference = new Date('2025-09-26T12:00:00Z');
    assert.equal(formatRelativeTime('2025-09-26T13:00:00Z', reference), 'in 1 hour');
  });

  it('returns dash when date invalid', () => {
    const reference = new Date('2025-09-26T12:00:00Z');
    assert.equal(formatRelativeTime('not-a-date', reference), '—');
  });
});
