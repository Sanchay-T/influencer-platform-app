import { describe, expect, it } from 'vitest';
import { getItemEnrichmentStatus, summarizeEnrichment } from './list-helpers';

function buildItem(overrides: Record<string, unknown> = {}) {
	return {
		id: 'item_1',
		listId: 'list_1',
		creatorId: 'creator_1',
		position: 1,
		bucket: 'backlog',
		addedBy: null,
		addedAt: new Date(),
		updatedAt: new Date(),
		notes: null,
		metricsSnapshot: {},
		customFields: {},
		pinned: false,
		lastContactedAt: null,
		creator: {
			id: 'creator_1',
			platform: 'instagram',
			externalId: 'ex_1',
			handle: 'alpha',
			displayName: null,
			avatarUrl: null,
			url: null,
			followers: 100,
			engagementRate: null,
			category: null,
			metadata: {},
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		...overrides,
	};
}

describe('list enrichment helper states', () => {
	it('reads queued/in_progress/enriched/failed/skipped from customFields', () => {
		const statuses = ['queued', 'in_progress', 'enriched', 'failed', 'skipped_limit'] as const;
		for (const status of statuses) {
			const item = buildItem({ customFields: { autoEnrichment: { status } } });
			expect(getItemEnrichmentStatus(item)).toBe(status);
		}
	});

	it('falls back to enriched when creator metadata has enrichment payload', () => {
		const item = buildItem({
			customFields: {},
			creator: {
				...buildItem().creator,
				metadata: { enrichment: { enrichedAt: new Date().toISOString() } },
			},
		});
		expect(getItemEnrichmentStatus(item)).toBe('enriched');
	});

	it('summarizes active and processed counters correctly', () => {
		const items = [
			buildItem({ id: '1', customFields: { autoEnrichment: { status: 'queued' } } }),
			buildItem({ id: '2', customFields: { autoEnrichment: { status: 'in_progress' } } }),
			buildItem({ id: '3', customFields: { autoEnrichment: { status: 'enriched' } } }),
			buildItem({ id: '4', customFields: { autoEnrichment: { status: 'failed' } } }),
			buildItem({ id: '5', customFields: { autoEnrichment: { status: 'skipped_limit' } } }),
		];

		const summary = summarizeEnrichment(items);
		expect(summary.total).toBe(5);
		expect(summary.active).toBe(2);
		expect(summary.processed).toBe(3);
		expect(summary.queued).toBe(1);
		expect(summary.in_progress).toBe(1);
		expect(summary.enriched).toBe(1);
		expect(summary.failed).toBe(1);
		expect(summary.skipped_limit).toBe(1);
	});
});
