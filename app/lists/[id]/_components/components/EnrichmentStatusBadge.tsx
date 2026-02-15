import { Clock3, Loader2, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ListItem } from '../types/list-detail';
import { getItemEnrichmentStatus } from '../utils/list-helpers';
import { getStringProperty, toRecord } from '@/lib/utils/type-guards';

function formatTimeAgo(iso: string | null): string | null {
	if (!iso) {
		return null;
	}
	const ts = Date.parse(iso);
	if (!Number.isFinite(ts)) {
		return null;
	}
	const deltaMs = Date.now() - ts;
	if (deltaMs < 0) {
		return 'just now';
	}
	const seconds = Math.floor(deltaMs / 1000);
	if (seconds < 10) {
		return 'just now';
	}
	if (seconds < 60) {
		return `${seconds}s ago`;
	}
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) {
		return `${minutes}m ago`;
	}
	const hours = Math.floor(minutes / 60);
	return `${hours}h ago`;
}

function buildTooltip(item: ListItem): string | undefined {
	const status = getItemEnrichmentStatus(item);
	const customFields = toRecord(item.customFields) ?? {};
	const auto = toRecord(customFields.autoEnrichment) ?? {};
	const queuedAt = getStringProperty(auto, 'queuedAt');
	const startedAt = getStringProperty(auto, 'startedAt');
	const completedAt = getStringProperty(auto, 'completedAt');
	const lastError = getStringProperty(auto, 'lastError');

	if (status === 'queued') {
		const when = formatTimeAgo(queuedAt);
		return when ? `Queued ${when}` : 'Queued';
	}
	if (status === 'in_progress') {
		const when = formatTimeAgo(startedAt);
		return when ? `Started ${when}` : 'Enriching…';
	}
	if (status === 'failed') {
		return lastError ? `Failed: ${lastError}` : 'Failed';
	}
	if (status === 'enriched') {
		const when = formatTimeAgo(completedAt);
		return when ? `Enriched ${when}` : 'Enriched';
	}
	if (status === 'skipped_limit') {
		return 'Skipped (plan limit reached)';
	}
	return completedAt ? `Updated ${completedAt}` : 'Not started';
}

export function EnrichmentStatusBadge({ item }: { item: ListItem }) {
	const status = getItemEnrichmentStatus(item);
	const tooltip = buildTooltip(item);

	if (status === 'enriched') {
		return (
			<Badge
				title={tooltip}
				className="bg-emerald-500/15 text-emerald-200 border border-emerald-500/40"
			>
				✓ Enriched
			</Badge>
		);
	}
	if (status === 'in_progress') {
		return (
			<Badge title={tooltip} className="bg-pink-500/15 text-pink-200 border border-pink-500/40">
				<Loader2 className="mr-1 h-3 w-3 animate-spin" /> Enriching
			</Badge>
		);
	}
	if (status === 'queued') {
		return (
			<Badge title={tooltip} className="bg-zinc-700/40 text-zinc-200 border border-zinc-600">
				<Clock3 className="mr-1 h-3 w-3" /> Queued
			</Badge>
		);
	}
	if (status === 'failed') {
		return (
			<Badge title={tooltip} className="bg-amber-500/15 text-amber-200 border border-amber-500/40">
				<TriangleAlert className="mr-1 h-3 w-3" /> Failed
			</Badge>
		);
	}
	if (status === 'skipped_limit') {
		return (
			<Badge title={tooltip} className="bg-violet-500/15 text-violet-200 border border-violet-500/40">
				Limit
			</Badge>
		);
	}
	return (
		<Badge title={tooltip} className="bg-zinc-800/60 text-zinc-400 border border-zinc-700">
			Not started
		</Badge>
	);
}

