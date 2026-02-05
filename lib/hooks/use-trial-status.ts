'use client';

/**
 * Hook to fetch and cache trial search status for the current user.
 *
 * Returns:
 * - isTrialUser: Whether user is on trial
 * - searchesUsed: Number of searches used during trial
 * - searchesRemaining: Number of searches remaining
 * - searchesLimit: Total trial search limit (3)
 * - isLoading: Loading state
 * - refetch: Function to manually refresh status
 */

import { useAuth } from '@clerk/nextjs';
import { useCallback, useEffect, useState } from 'react';

export interface TrialSearchStatus {
	isTrialUser: boolean;
	searchesUsed: number;
	searchesRemaining: number;
	searchesLimit: number;
	currentPlan: string | null;
}

export interface UseTrialStatusResult extends TrialSearchStatus {
	isLoading: boolean;
	error: string | null;
	refetch: () => Promise<void>;
}

const CACHE_KEY = 'gemz_trial_status_cache';
const CACHE_DURATION = 30 * 1000; // 30 seconds (short cache since searches change state)

interface CachedTrialStatus {
	data: TrialSearchStatus;
	timestamp: number;
	userId: string;
}

const defaultStatus: TrialSearchStatus = {
	isTrialUser: false,
	searchesUsed: 0,
	searchesRemaining: 3,
	searchesLimit: 3,
	currentPlan: null,
};

export function useTrialStatus(): UseTrialStatusResult {
	const { isLoaded, userId } = useAuth();
	const [status, setStatus] = useState<TrialSearchStatus>(defaultStatus);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchStatus = useCallback(async () => {
		if (!userId) {
			return;
		}

		try {
			setError(null);
			const response = await fetch('/api/trial/search-count');

			if (!response.ok) {
				throw new Error('Failed to fetch trial status');
			}

			const data: TrialSearchStatus = await response.json();
			setStatus(data);

			// Cache the result
			const cacheData: CachedTrialStatus = {
				data,
				timestamp: Date.now(),
				userId,
			};
			localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Unknown error');
		} finally {
			setIsLoading(false);
		}
	}, [userId]);

	// Load from cache immediately, then fetch fresh data
	useEffect(() => {
		if (!(isLoaded && userId)) {
			setIsLoading(false);
			return;
		}

		// Try to load from cache first
		try {
			const cached = localStorage.getItem(CACHE_KEY);
			if (cached) {
				const parsedCache: CachedTrialStatus = JSON.parse(cached);
				const isValidCache =
					parsedCache.userId === userId && Date.now() - parsedCache.timestamp < CACHE_DURATION;

				if (isValidCache) {
					setStatus(parsedCache.data);
					setIsLoading(false);
					// Still fetch in background to update
				}
			}
		} catch {
			// Ignore cache errors
		}

		// Fetch fresh data
		fetchStatus().catch(() => undefined);
	}, [isLoaded, userId, fetchStatus]);

	const refetch = useCallback(async () => {
		setIsLoading(true);
		// Clear cache to force fresh fetch
		localStorage.removeItem(CACHE_KEY);
		await fetchStatus();
	}, [fetchStatus]);

	return {
		...status,
		isLoading,
		error,
		refetch,
	};
}
