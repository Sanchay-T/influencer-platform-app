// search-engine/job-service.ts — centralized helpers for scraping_jobs state updates
import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { NormalizedCreator, ScrapingJobRecord, SearchMetricsSnapshot } from './types';

const DEFAULT_PROGRESS_PRECISION = 2;

type DedupeKeyFn = (creator: NormalizedCreator) => string | null;

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

    const merged = new Map<string, NormalizedCreator>();
    const normalizeKey = (key: string | null, item: NormalizedCreator, index: number) => {
      if (key && key.trim().length > 0) {
        return key.toLowerCase();
      }
      return `fallback-${index}-${Buffer.from(JSON.stringify(item)).toString('base64').slice(0, 16)}`;
    };
    const register = (item: NormalizedCreator) => {
      const dedupeKey = normalizeKey(getKey(item), item, merged.size);
      if (!merged.has(dedupeKey)) {
        merged.set(dedupeKey, item);
      }
    };

    if (existing?.creators && Array.isArray(existing.creators)) {
      for (const item of existing.creators as NormalizedCreator[]) {
        register(item);
      }
    }

    for (const item of creators) {
      register(item);
    }

    const mergedCreators = Array.from(merged.values());
    const previousCount = existing?.creators && Array.isArray(existing.creators) ? existing.creators.length : 0;

    if (existing) {
      await db
        .update(scrapingResults)
        .set({ creators: mergedCreators })
        .where(eq(scrapingResults.id, existing.id));
    } else {
      await db.insert(scrapingResults).values({
        jobId: this.job.id,
        creators: mergedCreators,
      });
    }

    await this.refresh();
    return { total: mergedCreators.length, newCount: Math.max(mergedCreators.length - previousCount, 0) };
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
}
