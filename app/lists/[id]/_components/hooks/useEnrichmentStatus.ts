'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { structuredConsole } from '@/lib/logging/console-proxy';
import type { ListItemEnrichmentStatus } from '@/lib/lists/enrichment-status';
import { getNumberProperty, getRecordProperty, getStringProperty, toRecord } from '@/lib/utils/type-guards';

export type EnrichmentStatusPayload = {
	listId: string;
	total: number;
	counts: Record<ListItemEnrichmentStatus, number>;
	active: number;
	processed: number;
	updatedAt: string;
};

function isEnrichmentStatusPayload(value: unknown): value is EnrichmentStatusPayload {
	const record = toRecord(value);
	if (!record) {
		return false;
	}
	const listId = getStringProperty(record, 'listId');
	const total = getNumberProperty(record, 'total');
	const active = getNumberProperty(record, 'active');
	const processed = getNumberProperty(record, 'processed');
	const updatedAt = getStringProperty(record, 'updatedAt');
	const countsRecord = getRecordProperty(record, 'counts');
	if (!(listId && typeof total === 'number' && typeof active === 'number' && typeof processed === 'number' && updatedAt && countsRecord)) {
		return false;
	}
	return true;
}

export function useEnrichmentStatus(listId: string) {
	const [status, setStatus] = useState<EnrichmentStatusPayload | null>(null);
	const [loading, setLoading] = useState(false);
	const abortRef = useRef<AbortController | null>(null);

	const refresh = useCallback(async () => {
		if (!listId) {
			return;
		}
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		setLoading(true);
		try {
			const res = await fetch(`/api/lists/${listId}/enrichment-status`, {
				method: 'GET',
				cache: 'no-store',
				signal: controller.signal,
			});
			if (!res.ok) {
				return;
			}
			const data = await res.json();
			if (isEnrichmentStatusPayload(data)) {
				setStatus(data);
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return;
			}
			structuredConsole.debug('[useEnrichmentStatus] refresh failed', error);
		} finally {
			setLoading(false);
		}
	}, [listId]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	// Fast polling while active.
	useEffect(() => {
		const activeCount = status?.active ?? 0;
		if (activeCount <= 0) {
			return;
		}
		const interval = setInterval(() => {
			refresh();
		}, 2000);
		return () => clearInterval(interval);
	}, [refresh, status?.active]);

	const hasAnySignal = useMemo(() => {
		if (!status) {
			return false;
		}
		const counts = status.counts;
		const started =
			(counts?.enriched ?? 0) + (counts?.failed ?? 0) + (counts?.skipped_limit ?? 0);
		const queued = counts?.queued ?? 0;
		const inProgress = counts?.in_progress ?? 0;
		return started + queued + inProgress > 0;
	}, [status]);

	return { status, loading, refresh, hasAnySignal };
}
