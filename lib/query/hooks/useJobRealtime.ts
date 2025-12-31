/**
 * useJobRealtime - Real-time job status updates via Supabase
 *
 * @context Replaces polling with WebSocket push updates.
 * Workers update the database → Supabase captures changes via WAL →
 * Pushes to subscribed clients in real-time.
 *
 * Features:
 * - Real-time updates (no polling latency)
 * - Auto-reconnection on disconnect
 * - Visibility change handling (re-sync when tab becomes active)
 * - Falls back gracefully if Realtime unavailable
 */

'use client';

import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

// Debug logging helper
const debugLog = (tag: string, msg: string, data?: Record<string, unknown>) => {
	if (typeof window !== 'undefined' && localStorage.getItem('debug_job_status') === 'true') {
		const timestamp = new Date().toISOString().slice(11, 23);
		console.log(`%c[${tag}][${timestamp}] ${msg}`, 'color: #4caf50', data ?? '');
	}
};

export interface RealtimeJobData {
	id: string;
	status: string;
	progress: number;
	keywordsDispatched: number;
	keywordsCompleted: number;
	creatorsFound: number;
	creatorsEnriched: number;
	enrichmentStatus: string;
	error?: string;
}

export interface UseJobRealtimeResult {
	/** Latest job data from Realtime */
	data: RealtimeJobData | null;
	/** Whether WebSocket is connected */
	isConnected: boolean;
	/** Connection error if any */
	error: Error | null;
	/** Manually trigger reconnection */
	reconnect: () => void;
}

/**
 * Subscribe to real-time job updates via Supabase Realtime
 *
 * @example
 * ```tsx
 * const { data, isConnected } = useJobRealtime(jobId);
 * if (data) {
 *   console.log('Status:', data.status, 'Progress:', data.progress);
 * }
 * ```
 */
export function useJobRealtime(jobId: string | null | undefined): UseJobRealtimeResult {
	const [data, setData] = useState<RealtimeJobData | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const channelRef = useRef<RealtimeChannel | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Parse database row to our interface
	const parseJobRow = useCallback((row: Record<string, unknown>): RealtimeJobData => {
		return {
			id: row.id as string,
			status: row.status as string,
			progress: parseFloat(row.progress as string) || 0,
			keywordsDispatched: (row.keywords_dispatched as number) ?? 0,
			keywordsCompleted: (row.keywords_completed as number) ?? 0,
			creatorsFound: (row.creators_found as number) ?? 0,
			creatorsEnriched: (row.creators_enriched as number) ?? 0,
			enrichmentStatus: (row.enrichment_status as string) ?? 'pending',
			error: row.error as string | undefined,
		};
	}, []);

	// Setup subscription
	const subscribe = useCallback(() => {
		if (!jobId) {
			return;
		}

		// Clean up existing channel
		if (channelRef.current) {
			supabase.removeChannel(channelRef.current);
		}

		debugLog('REALTIME', 'Subscribing to job updates', { jobId: jobId.slice(0, 8) });

		const channel = supabase
			.channel(`job-${jobId}`)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'scraping_jobs',
					filter: `id=eq.${jobId}`,
				},
				(payload) => {
					debugLog('REALTIME', 'Received update', {
						jobId: jobId.slice(0, 8),
						status: payload.new.status,
						progress: payload.new.progress,
					});
					const parsed = parseJobRow(payload.new);
					setData(parsed);
				}
			)
			.subscribe((status, err) => {
				debugLog('REALTIME', 'Subscription status changed', { status, error: err?.message });

				if (status === 'SUBSCRIBED') {
					setIsConnected(true);
					setError(null);
				} else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
					setIsConnected(false);
					if (err) {
						setError(new Error(err.message));
					}

					// Auto-reconnect after 3 seconds
					if (reconnectTimeoutRef.current) {
						clearTimeout(reconnectTimeoutRef.current);
					}
					reconnectTimeoutRef.current = setTimeout(() => {
						debugLog('REALTIME', 'Auto-reconnecting...');
						subscribe();
					}, 3000);
				} else if (status === 'TIMED_OUT') {
					setIsConnected(false);
					setError(new Error('Connection timed out'));
				}
			});

		channelRef.current = channel;
	}, [jobId, parseJobRow]);

	// Manual reconnect
	const reconnect = useCallback(() => {
		debugLog('REALTIME', 'Manual reconnect triggered');
		subscribe();
	}, [subscribe]);

	// Subscribe on mount / jobId change
	useEffect(() => {
		if (!jobId) {
			setData(null);
			setIsConnected(false);
			return;
		}

		subscribe();

		// Cleanup on unmount
		return () => {
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
			if (channelRef.current) {
				debugLog('REALTIME', 'Cleaning up subscription', { jobId: jobId.slice(0, 8) });
				supabase.removeChannel(channelRef.current);
				channelRef.current = null;
			}
		};
	}, [jobId, subscribe]);

	// Handle tab visibility changes
	// @why When tab goes to background, subscriptions can become stale
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'visible' && jobId) {
				debugLog('REALTIME', 'Tab became visible, checking connection');
				if (!isConnected) {
					subscribe();
				}
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
	}, [jobId, isConnected, subscribe]);

	return { data, isConnected, error, reconnect };
}
