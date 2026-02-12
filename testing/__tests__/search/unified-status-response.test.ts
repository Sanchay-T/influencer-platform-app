import { describe, expect, it } from 'vitest';
import { buildUnifiedStatusResponse } from '@/lib/search-engine/utils/unified-status-response';

describe('buildUnifiedStatusResponse', () => {
	it('maps low-progress processing jobs to searching', () => {
		const payload = buildUnifiedStatusResponse({
			jobId: 'job_1',
			rawStatus: 'processing',
			processedResults: 10,
			targetResults: 100,
			progressPercent: 25,
			totalCreators: 10,
			platform: 'similar_discovery_instagram',
		});

		expect(payload.status).toBe('searching');
		expect(payload.progress.percentComplete).toBe(25);
		expect(payload.progress.creatorsFound).toBe(10);
	});

	it('maps high-progress processing jobs to enriching', () => {
		const payload = buildUnifiedStatusResponse({
			jobId: 'job_2',
			rawStatus: 'processing',
			processedResults: 75,
			targetResults: 100,
			progressPercent: 80,
			totalCreators: 75,
			platform: 'youtube_similar',
		});

		expect(payload.status).toBe('enriching');
		expect(payload.progress.percentComplete).toBe(80);
	});

	it('maps completed jobs with error to partial', () => {
		const payload = buildUnifiedStatusResponse({
			jobId: 'job_3',
			rawStatus: 'completed',
			processedResults: 40,
			targetResults: 100,
			progressPercent: 100,
			totalCreators: 40,
			platform: 'similar_discovery_tiktok',
			error: 'partial failure',
		});

		expect(payload.status).toBe('partial');
		expect(payload.error).toBe('partial failure');
	});
});
