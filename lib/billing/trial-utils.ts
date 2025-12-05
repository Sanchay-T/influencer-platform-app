/**
 * ═══════════════════════════════════════════════════════════════
 * TRIAL UTILITIES - Trial Time Calculations
 * ═══════════════════════════════════════════════════════════════
 *
 * Pure functions for calculating trial time remaining,
 * urgency levels, and display strings.
 */

import type { TrialTimeDisplay } from './subscription-types';

// ═══════════════════════════════════════════════════════════════
// TRIAL TIME CALCULATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate trial time remaining and display information.
 * Pure function - no side effects or external dependencies.
 */
export function calculateTrialTime(
	trialStartDate: Date | null | undefined,
	trialEndDate: Date | null | undefined
): TrialTimeDisplay {
	const now = new Date();

	// Handle missing data
	if (!(trialStartDate && trialEndDate)) {
		return {
			daysRemaining: 0,
			hoursRemaining: 0,
			minutesRemaining: 0,
			progressPercentage: 0,
			timeRemainingShort: 'No trial',
			timeRemainingLong: 'No active trial',
			urgencyLevel: 'low',
			isExpired: true,
			isAlmostExpired: false,
		};
	}

	const start = new Date(trialStartDate);
	const end = new Date(trialEndDate);

	const totalMs = end.getTime() - start.getTime();
	const elapsedMs = now.getTime() - start.getTime();
	const remainingMs = end.getTime() - now.getTime();

	// Time calculations
	const daysRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
	const hoursRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60)));
	const minutesRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60)));

	// Progress calculation (0-100)
	const progressPercentage =
		totalMs > 0 ? Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100))) : 0;

	// State flags
	const isExpired = remainingMs <= 0;
	const isAlmostExpired = remainingMs > 0 && remainingMs < 24 * 60 * 60 * 1000;
	const isNearExpiry = remainingMs > 0 && remainingMs < 48 * 60 * 60 * 1000;

	// Urgency level
	let urgencyLevel: 'low' | 'medium' | 'high' | 'expired' = 'low';
	if (isExpired) {
		urgencyLevel = 'expired';
	} else if (isAlmostExpired) {
		urgencyLevel = 'high';
	} else if (isNearExpiry) {
		urgencyLevel = 'medium';
	}

	// Display strings
	let timeRemainingShort: string;
	let timeRemainingLong: string;

	if (isExpired) {
		timeRemainingShort = 'Expired';
		timeRemainingLong = 'Trial has expired';
	} else if (isAlmostExpired) {
		timeRemainingShort = '< 1 day';
		timeRemainingLong = 'Less than 1 day remaining';
	} else {
		timeRemainingShort = `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;
		timeRemainingLong = `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`;
	}

	return {
		daysRemaining,
		hoursRemaining,
		minutesRemaining,
		progressPercentage,
		timeRemainingShort,
		timeRemainingLong,
		urgencyLevel,
		isExpired,
		isAlmostExpired,
	};
}
