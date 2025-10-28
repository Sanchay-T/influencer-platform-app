"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";

import type { CreatorEnrichmentRecord, CreatorEnrichmentUsage } from "@/types/creator-enrichment";
import { structuredConsole } from "@/lib/logging/console-proxy";

type EnrichmentTarget = {
  handle: string;
  platform: string;
  creatorId?: string | null;
  externalId?: string | null;
  displayName?: string | null;
  profileUrl?: string | null;
  metadata?: unknown;
  forceRefresh?: boolean;
};

type BulkState = {
  inProgress: boolean;
  processed: number;
  total: number;
};

type EnrichOptions = {
  silent?: boolean;
};

const sanitizeHandle = (handle: string) => handle.replace(/^@/, "").trim();
const buildKey = (platform: string, handle: string) => `${platform.toLowerCase()}::${handle.toLowerCase()}`;

export function useCreatorEnrichment(initial?: Record<string, CreatorEnrichmentRecord>) {
  const [enrichments, setEnrichments] = useState<Record<string, CreatorEnrichmentRecord>>(initial ?? {});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [bulkState, setBulkState] = useState<BulkState>({ inProgress: false, processed: 0, total: 0 });
  const [usage, setUsage] = useState<CreatorEnrichmentUsage | null>(null);
  const prefetchingRef = useRef<Set<string>>(new Set());

  const setLoading = useCallback((key: string, value: boolean) => {
    setLoadingMap((prev) => {
      if (value) {
        if (prev[key]) return prev;
        return { ...prev, [key]: true };
      }
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const seedEnrichment = useCallback((platform: string, handle: string, record: CreatorEnrichmentRecord) => {
    const sanitized = sanitizeHandle(handle);
    if (!sanitized) return;
    const key = buildKey(platform, sanitized);
    setEnrichments((prev) => {
      if (prev[key]) {
        return prev;
      }
      return { ...prev, [key]: record };
    });
  }, []);

  const prefetchEnrichment = useCallback(async (platform: string, handle: string) => {
    const sanitized = sanitizeHandle(handle);
    if (!sanitized) return;
    const key = buildKey(platform, sanitized);
    if (enrichments[key] || prefetchingRef.current.has(key)) {
      return;
    }
    prefetchingRef.current.add(key);
    try {
      const response = await fetch(
        `/api/creators/enriched-data?platform=${encodeURIComponent(platform)}&handle=${encodeURIComponent(sanitized)}`,
        { cache: "no-store" },
      );
      if (response.status === 204) {
        return;
      }
      if (!response.ok) {
        return;
      }
      const json = await response.json();
      if (json?.data) {
        setEnrichments((prev) => ({ ...prev, [key]: json.data as CreatorEnrichmentRecord }));
      }
    } catch (error) {
      structuredConsole.warn('[creator-enrichment] prefetch failed', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      prefetchingRef.current.delete(key);
    }
  }, [enrichments]);

  const enrichCreator = useCallback(
    async (target: EnrichmentTarget, options: EnrichOptions = {}) => {
      const sanitizedHandle = sanitizeHandle(target.handle);
      if (!sanitizedHandle) {
        if (!options.silent) {
          toast.error('Missing creator handle for enrichment');
        }
        throw new Error('Missing creator handle');
      }

      const key = buildKey(target.platform, sanitizedHandle);
      setLoading(key, true);

      try {
        const payload: Record<string, unknown> = {
          handle: sanitizedHandle,
          platform: target.platform,
          forceRefresh: Boolean(target.forceRefresh),
        };

        if (target.creatorId) payload.creatorId = target.creatorId;
        if (target.externalId) payload.externalId = target.externalId;
        if (target.displayName) payload.displayName = target.displayName;
        if (target.profileUrl) payload.profileUrl = target.profileUrl;
        if (target.metadata) payload.metadata = target.metadata;

        const response = await fetch('/api/creators/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (result?.usage) {
            setUsage(result.usage as CreatorEnrichmentUsage);
          }
          const message = typeof result?.message === 'string' ? result.message : 'Unable to enrich creator.';
          if (!options.silent) {
            toast.error(message);
          }
          throw new Error(message);
        }

        if (result?.usage) {
          setUsage(result.usage as CreatorEnrichmentUsage);
        }

        if (result?.data) {
          setEnrichments((prev) => ({ ...prev, [key]: result.data as CreatorEnrichmentRecord }));
        }

        if (!options.silent) {
          const label = target.displayName || `@${sanitizedHandle}`;
          toast.success(`Enriched ${label}`);
        }

        return result.data as CreatorEnrichmentRecord;
      } finally {
        setLoading(key, false);
      }
    },
    [setLoading],
  );

  const enrichMany = useCallback(
    async (targets: EnrichmentTarget[]) => {
      if (!targets.length) {
        return { success: 0, failed: [] as Array<{ target: EnrichmentTarget; error: string }>, records: [] as Array<{ target: EnrichmentTarget; record: CreatorEnrichmentRecord | null }> };
      }

      setBulkState({ inProgress: true, processed: 0, total: targets.length });
      const failed: Array<{ target: EnrichmentTarget; error: string }> = [];
      const successes: Array<{ target: EnrichmentTarget; record: CreatorEnrichmentRecord | null }> = [];
      let successCount = 0;

      for (let index = 0; index < targets.length; index += 1) {
        const target = targets[index];
        try {
          const record = await enrichCreator(target, { silent: true });
          successes.push({ target, record: record ?? null });
          successCount += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to enrich creator.';
          failed.push({ target, error: message });
        } finally {
          setBulkState({ inProgress: true, processed: index + 1, total: targets.length });
        }
      }

      setBulkState({ inProgress: false, processed: targets.length, total: targets.length });

      if (failed.length) {
        toast.error(`Enriched ${successCount}/${targets.length}. ${failed.length} failed.`);
      } else {
        toast.success(`Enriched ${successCount}/${targets.length} creators.`);
      }

      return { success: successCount, failed, records: successes };
    },
    [enrichCreator],
  );

  const getEnrichment = useCallback(
    (platform: string, handle: string) => {
      const sanitized = sanitizeHandle(handle);
      if (!sanitized) return null;
      return enrichments[buildKey(platform, sanitized)] ?? null;
    },
    [enrichments],
  );

  const isLoading = useCallback(
    (platform: string, handle: string) => {
      const sanitized = sanitizeHandle(handle);
      if (!sanitized) return false;
      return Boolean(loadingMap[buildKey(platform, sanitized)]);
    },
    [loadingMap],
  );

  const helpers = useMemo(
    () => ({
      getEnrichment,
      isLoading,
      enrichCreator,
      enrichMany,
      prefetchEnrichment,
      seedEnrichment,
      usage,
      bulkState,
    }),
    [getEnrichment, isLoading, enrichCreator, enrichMany, prefetchEnrichment, seedEnrichment, usage, bulkState],
  );

  return helpers;
}
