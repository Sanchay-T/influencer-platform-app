// search-engine/job-service.ts — centralized helpers for scraping_jobs state updates
import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults } from '@/lib/db/schema';
import { dedupeCreators as sharedDedupeCreators } from '@/lib/utils/dedupe-creators';
import { eq } from 'drizzle-orm';
import type { NormalizedCreator, ScrapingJobRecord, SearchMetricsSnapshot } from './types';

const DEFAULT_PROGRESS_PRECISION = 2;

type DedupeKeyFn = (creator: NormalizedCreator) => string | null;

type MergeableCreator = NormalizedCreator & { mergeKey?: string };

const attachMergeKeys = (creators: NormalizedCreator[], getKey?: DedupeKeyFn): MergeableCreator[] =>
  creators.map((creator) => {
    if (!getKey) {
      return creator as MergeableCreator;
    }
    const key = getKey(creator);
    if (typeof key === 'string' && key.trim().length > 0) {
      const normalizedKey = key.trim().toLowerCase();
      if ((creator as MergeableCreator).mergeKey === normalizedKey) {
        return creator as MergeableCreator;
      }
      return {
        ...(creator as Record<string, unknown>),
        mergeKey: normalizedKey,
      } as MergeableCreator;
    }
    return creator as MergeableCreator;
  });

const stripMergeKeys = (creators: MergeableCreator[]): NormalizedCreator[] =>
  creators.map((creator) => {
    if (creator && Object.prototype.hasOwnProperty.call(creator, 'mergeKey')) {
      const { mergeKey: _mergeKey, ...rest } = creator as Record<string, unknown> & { mergeKey?: string };
      return rest as NormalizedCreator;
    }
    return creator as NormalizedCreator;
  });

const dedupeWithHint = (
  creators: MergeableCreator[],
  platformHint: string | null,
): MergeableCreator[] =>
  sharedDedupeCreators(creators as Record<string, unknown>[], { platformHint }) as MergeableCreator[];

export class SearchJobService {
  private job: ScrapingJobRecord;

  private constructor(job: ScrapingJobRecord) {
    this.job = job;
  }

  static async load(jobId: string) {
    const job = await db.query.scrapingJobs.findFirst({
      where: (jobs, { eq }) => eq(jobs.id, jobId),
    });
    return job ? new SearchJobService(job) : null;
  }

  snapshot() {
    return this.job;
  }

  async refresh() {
    const updated = await db.query.scrapingJobs.findFirst({
      where: (jobs, { eq }) => eq(jobs.id, this.job.id),
    });
    if (updated) {
      this.job = updated;
    }
    return this.job;
  }

  async markProcessing() {
    await db
      .update(scrapingJobs)
      .set({
        status: 'processing',
        startedAt: this.job.startedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(scrapingJobs.id, this.job.id));
    await this.refresh();
  }

  async recordProgress({ processedRuns, processedResults, cursor, progress }: {
    processedRuns: number;
    processedResults: number;
    cursor: number;
    progress: number;
  }) {
    await db
      .update(scrapingJobs)
      .set({
        processedRuns,
        processedResults,
        cursor,
        progress: progress.toFixed(DEFAULT_PROGRESS_PRECISION),
        updatedAt: new Date(),
      })
      .where(eq(scrapingJobs.id, this.job.id));
    await this.refresh();
  }

  async mergeCreators(creators: NormalizedCreator[], getKey: DedupeKeyFn) {
    if (!creators.length) {
      return { total: this.job.processedResults, newCount: 0 };
    }

    const existing = await db.query.scrapingResults.findFirst({
      where: (results, { eq }) => eq(results.jobId, this.job.id),
    });

    const platformHint = typeof this.job.platform === 'string' ? this.job.platform : null;

    const existingRaw = existing && Array.isArray(existing.creators)
      ? (existing.creators as NormalizedCreator[])
      : [];

    const existingWithKeys = attachMergeKeys(existingRaw, getKey);
    const normalizedExisting = dedupeWithHint(existingWithKeys, platformHint);

    const incomingWithKeys = attachMergeKeys(creators, getKey);
    const combined = [...normalizedExisting, ...incomingWithKeys];
    const dedupedWithKeys = dedupeWithHint(combined, platformHint);
    const dedupedCreators = stripMergeKeys(dedupedWithKeys);

    const previousCount = normalizedExisting.length;
    const newCount = Math.max(dedupedCreators.length - previousCount, 0);

    if (existing) {
      await db
        .update(scrapingResults)
        .set({ creators: dedupedCreators })
        .where(eq(scrapingResults.id, existing.id));
    } else {
      await db.insert(scrapingResults).values({
        jobId: this.job.id,
        creators: dedupedCreators,
      });
    }

    await this.refresh();
    return { total: dedupedCreators.length, newCount };
  }

  async complete(finalStatus: 'completed' | 'error', data: { error?: string }) {
    await db
      .update(scrapingJobs)
      .set({
        status: finalStatus,
        error: data.error ?? null,
        completedAt: new Date(),
        updatedAt: new Date(),
        progress: finalStatus === 'completed' ? '100' : this.job.progress,
      })
      .where(eq(scrapingJobs.id, this.job.id));
    await this.refresh();
  }

  async recordBenchmark(metrics: SearchMetricsSnapshot) {
    const nextParams = {
      ...(this.job.searchParams ?? {}),
      searchEngineBenchmark: metrics,
    };

    await db
      .update(scrapingJobs)
      .set({ searchParams: nextParams, updatedAt: new Date() })
      .where(eq(scrapingJobs.id, this.job.id));
    await this.refresh();
  }

  async updateSearchParams(patch: Record<string, any>) {
    const nextParams = {
      ...(this.job.searchParams ?? {}),
      ...patch,
    };

    await db
      .update(scrapingJobs)
      .set({ searchParams: nextParams, updatedAt: new Date() })
      .where(eq(scrapingJobs.id, this.job.id));

    await this.refresh();
  }

  async replaceCreators(creators: NormalizedCreator[]) {
    const existing = await db.query.scrapingResults.findFirst({
      where: (results, { eq }) => eq(results.jobId, this.job.id),
    });

    const platformHint = typeof this.job.platform === 'string' ? this.job.platform : null;
    const deduped = stripMergeKeys(dedupeWithHint(attachMergeKeys(creators), platformHint));

    if (existing) {
      await db
        .update(scrapingResults)
        .set({ creators: deduped })
        .where(eq(scrapingResults.id, existing.id));
    } else {
      await db.insert(scrapingResults).values({
        jobId: this.job.id,
        creators: deduped,
      });
    }

    await this.refresh();
    return deduped.length;
  }
}
