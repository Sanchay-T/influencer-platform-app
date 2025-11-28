"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, User, LayoutGrid, Table2, MailCheck, Youtube, Sparkles, RefreshCw, Info } from "lucide-react";
import toast from "react-hot-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import ExportButton from "../export-button";
import { cn } from "@/lib/utils";
import { FeatureGate } from "@/app/components/billing/protect";
import { Checkbox } from "@/components/ui/checkbox";
import { AddToListButton } from "@/components/lists/add-to-list-button";
import { dedupeCreators } from "../utils/dedupe-creators";
import { useCreatorEnrichment } from "./useCreatorEnrichment";
import {
  filterCreatorsByLikes,
  filterCreatorsByViews,
  MIN_LIKES_THRESHOLD,
  MIN_VIEWS_THRESHOLD,
} from "@/lib/search-engine/utils/filter-creators";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import SearchProgress from "./search-progress";
import Breadcrumbs from "../../breadcrumbs";
import { buildProfileLink } from "./utils/profile-link";
import { resolveCreatorPreview } from "@/lib/utils/media-preview";

const VIEW_MODES = ["table", "gallery"];
const VIEW_MODE_META = {
  table: { label: "Table", Icon: Table2 },
  gallery: { label: "Gallery", Icon: LayoutGrid },
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Breadcrumb: PinkSpinner -> shared pink-accent loader to align with enrichment brand styling.
const PinkSpinner = ({ size = "h-4 w-4", className = "", label } = {}) => (
  <span
    className={cn("relative inline-flex items-center justify-center", size, className)}
    role="status"
    aria-label={label ?? "Loading"}
  >
    <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400/20")} />
    <span
      className={cn(
        "relative inline-flex animate-spin rounded-full border-2 border-pink-500/30 border-t-pink-400",
        size,
      )}
    />
  </span>
);

const extractEmails = (creator) => {
  if (!creator) return [];

  const collected = new Set();

  const candidateLists = [
    creator?.creator?.emails,
    creator?.emails,
    creator?.contact?.emails,
  ];

  for (const maybeList of candidateLists) {
    if (Array.isArray(maybeList)) {
      for (const email of maybeList) {
        if (typeof email === "string" && email.trim().length > 0) {
          collected.add(email.trim());
        }
      }
    }
  }

  const fallbackCandidates = [
    creator?.creator?.email,
    creator?.email,
    creator?.contact?.email,
  ];

  for (const email of fallbackCandidates) {
    if (typeof email === "string" && email.trim().length > 0) {
      collected.add(email.trim());
    }
  }

  const metadata = typeof creator?.metadata === 'object' && creator?.metadata !== null ? creator.metadata : null;
  if (metadata) {
    if (Array.isArray(metadata.contactEmails)) {
      metadata.contactEmails.forEach((candidate) => {
        const normalized = normalizeEmailCandidate(candidate);
        if (normalized) {
          collected.add(normalized);
        }
      });
    }
    const enrichmentEmails = metadata?.enrichment?.summary?.allEmails;
    if (Array.isArray(enrichmentEmails)) {
      enrichmentEmails.forEach((candidate) => {
        const normalized = normalizeEmailCandidate(candidate);
        if (normalized) {
          collected.add(normalized);
        }
      });
    }
  }

  return Array.from(collected);
};

const hasContactEmail = (creator) => extractEmails(creator).length > 0;

const normalizeEmailCandidate = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === 'object') {
    const candidateFields = ['email', 'value', 'address'];
    for (const field of candidateFields) {
      const fieldValue = value[field];
      if (typeof fieldValue === 'string') {
        const trimmed = fieldValue.trim();
        if (trimmed.length) {
          return trimmed;
        }
      }
    }
  }
  return null;
};

const mergeEmailLists = (existing, incoming) => {
  const combined = [];
  if (Array.isArray(existing)) {
    combined.push(
      ...existing.map((value) => (typeof value === 'string' ? value.trim() : value)).filter((value) => typeof value === 'string' && value.length),
    );
  }
  if (Array.isArray(incoming)) {
    combined.push(
      ...incoming.map((value) => (typeof value === 'string' ? value.trim() : value)).filter((value) => typeof value === 'string' && value.length),
    );
  }
  return Array.from(new Set(combined));
};

const normalizeHandleValue = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  return trimmed.replace(/^@/, '').toLowerCase();
};

const normalizePlatformValue = (value) => {
  if (!value) return null;
  return value.toString().toLowerCase();
};

const normalizeEmailList = (list) =>
  Array.isArray(list)
    ? list
        .map((value) => (typeof value === 'string' ? value.trim() : null))
        .filter((value) => typeof value === 'string' && value.length)
    : [];

const arraysEqual = (a, b) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const formatFollowers = (value) => {
  if (value == null) return null;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  if (Math.abs(numeric) >= 1_000_000) {
    return `${(numeric / 1_000_000).toFixed(1)}M`;
  }

  if (Math.abs(numeric) >= 1_000) {
    return `${(numeric / 1_000).toFixed(1)}K`;
  }

  return Math.round(numeric).toLocaleString();
};

const resolveCreatorIdFromSnapshot = (snapshot) => {
  if (!snapshot) return null;
  const sources = [
    snapshot,
    snapshot?.metadata,
    snapshot?.metadata?.creator,
    snapshot?.metadata?.profile,
    snapshot?.metadata?.account,
    snapshot?.metadata?.owner,
  ];

  const fields = ['creatorProfileId', 'creator_profile_id', 'creatorId', 'creator_id', 'profileId', 'profile_id', 'id', 'uuid'];

  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const field of fields) {
      const value = source[field];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (UUID_PATTERN.test(trimmed)) {
          return trimmed;
        }
      }
    }
  }

  return null;
};

const resolveExternalIdFromSnapshot = (snapshot) => {
  if (!snapshot) return null;
  const sources = [
    snapshot,
    snapshot?.metadata,
    snapshot?.metadata?.creator,
    snapshot?.metadata?.profile,
  ];

  const fields = ['externalId', 'external_id', 'profileId', 'profile_id', 'id', 'uuid'];

  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const field of fields) {
      const value = source[field];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
  }

  return null;
};

const buildEnrichmentTarget = (snapshot, fallbackPlatform) => {
  const platform = (snapshot?.platform || fallbackPlatform || 'tiktok').toString().toLowerCase();
  const handle = typeof snapshot?.handle === 'string' ? snapshot.handle.replace(/^@/, '').trim() : '';

  return {
    handle,
    platform,
    creatorId: resolveCreatorIdFromSnapshot(snapshot),
    externalId: resolveExternalIdFromSnapshot(snapshot),
    displayName: snapshot?.displayName || snapshot?.handle || null,
    profileUrl: typeof snapshot?.url === 'string' ? snapshot.url : null,
    metadata: snapshot?.metadata ?? null,
  };
};

const formatEnrichedAtLabel = (timestamp) => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Breadcrumb: keyword search gallery defers to shared preview resolver to keep TikTok/IG covers consistent.
const resolveMediaPreview = (creator, snapshot, _platformHint) =>
  resolveCreatorPreview(creator, snapshot?.avatarUrl ?? null);

const ensureImageUrl = (value) => {
  if (typeof value !== "string") return "";
  const url = value.trim();
  if (!url) return "";

  if (
    url.startsWith("/api/proxy/image") ||
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.includes("blob.vercel-storage.com")
  ) {
    return url;
  }

  const normalized = url.startsWith("//") ? `https:${url}` : url;

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return `/api/proxy/image?url=${encodeURIComponent(normalized)}`;
  }

  return normalized;
};

// Expandable Bio + Links cell component
const BioLinksCell = ({ bio, bioLinks = [], externalUrl }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasBio = bio && bio.trim().length > 0;
  const hasLinks = Array.isArray(bioLinks) && bioLinks.length > 0;
  const hasExternalUrl = externalUrl && externalUrl.trim().length > 0;
  const hasContent = hasBio || hasLinks || hasExternalUrl;

  // Check if bio is long enough to need expansion (more than ~80 chars or has newlines)
  const needsExpansion = hasBio && (bio.length > 80 || bio.includes('\n'));

  // Extract domain from URL for display
  const extractDomain = (url) => {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  if (!hasContent) {
    return <span className="text-sm text-zinc-500">No bio</span>;
  }

  return (
    <div className="space-y-2">
      {/* Bio text */}
      {hasBio && (
        <div className="relative">
          <p
            className={cn(
              "text-sm text-zinc-300 whitespace-pre-wrap break-words",
              !isExpanded && needsExpansion && "line-clamp-2"
            )}
          >
            {bio}
          </p>
          {needsExpansion && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-pink-400 hover:text-pink-300 hover:underline mt-1"
            >
              {isExpanded ? '← Show less' : 'Show more →'}
            </button>
          )}
        </div>
      )}

      {/* Bio links as chips */}
      {(hasLinks || hasExternalUrl) && (
        <div className="flex flex-wrap gap-1.5">
          {/* External URL first if not in bioLinks */}
          {hasExternalUrl && !bioLinks.some(link => link.url === externalUrl) && (
            <a
              href={externalUrl.startsWith('http') ? externalUrl : `https://${externalUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-pink-300 hover:border-pink-500/50 transition-colors"
              title={externalUrl}
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {extractDomain(externalUrl)}
            </a>
          )}

          {/* Bio links */}
          {bioLinks.slice(0, isExpanded ? bioLinks.length : 3).map((link, idx) => {
            const url = link.url || link.lynx_url;
            if (!url) return null;
            const title = link.title || extractDomain(url);
            return (
              <a
                key={idx}
                href={url.startsWith('http') ? url : `https://${url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-pink-300 hover:border-pink-500/50 transition-colors"
                title={url}
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span className="truncate max-w-[120px]">{title}</span>
              </a>
            );
          })}

          {/* Show more links indicator */}
          {!isExpanded && bioLinks.length > 3 && (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:text-pink-300 hover:border-pink-500/50 transition-colors"
            >
              +{bioLinks.length - 3} more
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Hook to automatically fetch bio data for creators when search completes.
 * Uses ScrapeCreators basic-profile API (no rate limits).
 */
const useBioEnrichment = (creators, jobStatus, jobId, platformNormalized) => {
  const [bioData, setBioData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const hasFetched = useRef(false);
  const lastJobId = useRef(null);

  // Reset when jobId changes
  useEffect(() => {
    if (jobId !== lastJobId.current) {
      lastJobId.current = jobId;
      hasFetched.current = false;
      setBioData({});
    }
  }, [jobId]);

  useEffect(() => {
    // Only fetch for instagram_scrapecreators platform
    const isScrapecreatorsPlatform = platformNormalized === 'instagram_scrapecreators';
    if (!isScrapecreatorsPlatform) return;

    // Only fetch when search is complete and we haven't fetched yet
    if (jobStatus !== 'completed' || hasFetched.current || creators.length === 0) {
      return;
    }

    const fetchBios = async () => {
      hasFetched.current = true;
      setIsLoading(true);

      // Get user IDs that need bio data (have owner.id but no biography yet)
      const userIds = creators
        .filter(c => {
          const ownerId = c.owner?.id;
          const hasBio = c.owner?.biography || c.creator?.bio || c.bio_enriched?.biography;
          return ownerId && !hasBio;
        })
        .map(c => c.owner.id);

      if (userIds.length === 0) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/creators/fetch-bios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds, jobId }),
        });

        if (!response.ok) {
          console.error('Failed to fetch bios:', response.status);
          return;
        }

        const data = await response.json();
        setBioData(data.results || {});

        // Show toast with stats
        if (data.stats) {
          const emailsFound = Object.values(data.results || {}).filter(b => b.extracted_email).length;
          if (emailsFound > 0) {
            toast.success(`Found ${emailsFound} emails from bios (${(data.stats.durationMs / 1000).toFixed(1)}s)`);
          }
        }
      } catch (error) {
        console.error('Error fetching bios:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBios();
  }, [jobStatus, creators, jobId, platformNormalized]);

  return { bioData, isLoading };
};

// Guard against HTML error pages so the table doesn't crash on JSON.parse
const parseJsonSafe = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('Non-JSON response while fetching search results', {
      status: response.status,
      snippet: text?.slice?.(0, 500),
    });
    return { error: 'invalid_json', raw: text, status: response.status };
  }
};

const SearchResults = ({ searchData }) => {
  const componentMountTime = useRef(performance.now());
  const componentId = useMemo(() =>
    `keyword-search-${searchData?.jobId}-${componentMountTime.current}`,
    [searchData?.jobId]
  );

  // Component mounted

  const [currentPage, setCurrentPage] = useState(1);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const initialCreators = useMemo(() => {
    if (Array.isArray(searchData?.initialCreators)) return searchData.initialCreators;
    if (Array.isArray(searchData?.creators)) return searchData.creators;
    return [];
  }, [searchData?.initialCreators, searchData?.creators]);

  const [creators, setCreators] = useState(initialCreators);

  // Log whenever creators data changes
  useEffect(() => {
    // Creators data updated
  }, [creators, componentId, searchData?.jobId]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [campaignName, setCampaignName] = useState("Campaign");
  const [stillProcessing, setStillProcessing] = useState(false);
  const [progressInfo, setProgressInfo] = useState(null);
  const [selectedCreators, setSelectedCreators] = useState({});
  const [viewMode, setViewMode] = useState("table");
  const [showEmailOnly, setShowEmailOnly] = useState(false);
  // Engagement filter: 'all' | '100likes' | '1000views'
  const [engagementFilter, setEngagementFilter] = useState("all");
  const itemsPerPage = viewMode === "gallery" ? 9 : 10;
  const resultsCacheRef = useRef(new Map());

  const applyEnrichmentToCreators = useCallback(
    (record, targetData, rawReference, origin = 'hydrate') => {
      if (!record) return;

      const incomingEmails = Array.isArray(record.summary?.allEmails)
        ? record.summary.allEmails
            .map((value) => (typeof value === 'string' ? value.trim() : null))
            .filter(Boolean)
        : [];
      const primaryEmail =
        typeof record.summary?.primaryEmail === 'string' && record.summary.primaryEmail.trim().length
          ? record.summary.primaryEmail.trim()
          : null;
      const normalizedHandle = normalizeHandleValue(targetData?.handle ?? record.handle);
      const normalizedPlatform = normalizePlatformValue(targetData?.platform ?? record.platform);
      const recordCreatorId = record.creatorId;

      const patchEntry = (entry) => {
        const metadata =
          entry && typeof entry.metadata === 'object' && entry.metadata !== null ? { ...entry.metadata } : {};
        const existingBefore = extractEmails(entry).map((value) => value.toLowerCase());
        const existingBeforeSet = new Set(existingBefore);
        const clientNewEmails =
          origin === 'interactive'
            ? incomingEmails.filter((email) => {
                const lower = email.toLowerCase();
                return !existingBeforeSet.has(lower);
              })
            : [];
        const contactEmails = mergeEmailLists(metadata.contactEmails, incomingEmails);
        const nextMetadata = {
          ...metadata,
          enrichment: record,
          contactEmails,
          primaryEmail: primaryEmail ?? metadata.primaryEmail ?? null,
          lastEnrichedAt: record.enrichedAt,
        };
        if (clientNewEmails.length) {
          nextMetadata.clientNewEmails = clientNewEmails;
        } else if (nextMetadata.clientNewEmails) {
          delete nextMetadata.clientNewEmails;
        }

        const nextEntry = {
          ...entry,
          metadata: nextMetadata,
        };

        if (Array.isArray(entry.emails) || incomingEmails.length) {
          nextEntry.emails = mergeEmailLists(entry.emails, incomingEmails);
        }
        if (!entry.email && primaryEmail) {
          nextEntry.email = primaryEmail;
        }

        const creatorField =
          entry && typeof entry.creator === 'object' && entry.creator !== null ? { ...entry.creator } : null;
        if (creatorField) {
          creatorField.emails = mergeEmailLists(creatorField.emails, incomingEmails);
          if (!creatorField.email && primaryEmail) {
            creatorField.email = primaryEmail;
          }
          nextEntry.creator = creatorField;
        }

        const contactField =
          entry && typeof entry.contact === 'object' && entry.contact !== null ? { ...entry.contact } : null;
        if (contactField) {
          contactField.emails = mergeEmailLists(contactField.emails, incomingEmails);
          if (!contactField.email && primaryEmail) {
            contactField.email = primaryEmail;
          }
          nextEntry.contact = contactField;
        }

        const previousContactEmails = normalizeEmailList(metadata.contactEmails);
        const nextContactEmails = normalizeEmailList(nextMetadata.contactEmails);
        let changed =
          !arraysEqual(previousContactEmails, nextContactEmails) ||
          metadata.primaryEmail !== nextMetadata.primaryEmail ||
          metadata.lastEnrichedAt !== nextMetadata.lastEnrichedAt ||
          (metadata.enrichment?.enrichedAt ?? null) !== (nextMetadata.enrichment?.enrichedAt ?? null) ||
          (!!metadata.clientNewEmails !== !!nextMetadata.clientNewEmails) ||
          (Array.isArray(metadata.clientNewEmails) &&
            Array.isArray(nextMetadata.clientNewEmails) &&
            !arraysEqual(
              normalizeEmailList(metadata.clientNewEmails),
              normalizeEmailList(nextMetadata.clientNewEmails),
            ));

        if (!changed && Array.isArray(entry.emails) && Array.isArray(nextEntry.emails)) {
          const currentEmails = normalizeEmailList(entry.emails);
          const updatedEmails = normalizeEmailList(nextEntry.emails);
          if (!arraysEqual(currentEmails, updatedEmails)) {
            changed = true;
          }
        }

        if (
          !changed &&
          entry?.email &&
          primaryEmail &&
          (entry.email ?? '').trim().toLowerCase() !== primaryEmail.toLowerCase()
        ) {
          changed = true;
        }

        if (!changed && creatorField && entry?.creator) {
          const currentCreatorEmails = normalizeEmailList(entry.creator.emails);
          const updatedCreatorEmails = normalizeEmailList(creatorField.emails);
          if (!arraysEqual(currentCreatorEmails, updatedCreatorEmails)) {
            changed = true;
          }
          if (
            (entry.creator.email ?? '').trim().toLowerCase() !== (creatorField.email ?? '').trim().toLowerCase()
          ) {
            changed = true;
          }
        }

        if (!changed && contactField && entry?.contact) {
          const currentContactEmails = normalizeEmailList(entry.contact.emails);
          const updatedContactEmails = normalizeEmailList(contactField.emails);
          if (!arraysEqual(currentContactEmails, updatedContactEmails)) {
            changed = true;
          }
          if (
            (entry.contact.email ?? '').trim().toLowerCase() !== (contactField.email ?? '').trim().toLowerCase()
          ) {
            changed = true;
          }
        }

        return { entry: changed ? nextEntry : entry, changed };
      };

      const doesEntryMatchTarget = (entry) => {
        if (!entry) return false;
        if (rawReference && (entry === rawReference || entry?.creator === rawReference)) {
          return true;
        }

        const metadata =
          entry && typeof entry.metadata === 'object' && entry.metadata !== null ? entry.metadata : undefined;
        const metadataCreatorId =
          metadata?.enrichment?.creatorId ??
          metadata?.creatorId ??
          entry?.creatorId ??
          entry?.id ??
          (metadata?.profile ?? {}).creatorId;
        if (recordCreatorId && metadataCreatorId && recordCreatorId === metadataCreatorId) {
          return true;
        }

        const entryBase = entry && typeof entry.creator === 'object' && entry.creator !== null ? entry.creator : entry;
        const entryPlatform = normalizePlatformValue(
          entryBase?.platform ?? entry?.platform ?? metadata?.platform ?? metadata?.creator?.platform,
        );
        if (normalizedPlatform && entryPlatform && normalizedPlatform !== entryPlatform) {
          return false;
        }

        if (!normalizedHandle) {
          return false;
        }

        const handleCandidates = [
          entryBase?.uniqueId,
          entryBase?.username,
          entryBase?.handle,
          entryBase?.name,
          entry?.handle,
          entry?.username,
          metadata?.handle,
          metadata?.creator?.handle,
        ];
        const normalizedHandles = handleCandidates
          .map((candidate) => normalizeHandleValue(candidate))
          .filter(Boolean);

        return normalizedHandles.includes(normalizedHandle);
      };

      let didChange = false;
      const nextCreators = (prev) =>
        prev.map((entry) => {
          if (!entry) return entry;
          if (doesEntryMatchTarget(entry)) {
            const { entry: patched, changed } = patchEntry(entry);
            if (changed) {
              didChange = true;
            }
            return patched;
          }
          if (typeof entry === 'object' && entry !== null && entry.creator && doesEntryMatchTarget(entry.creator)) {
            const { entry: patched, changed } = patchEntry(entry);
            if (changed) {
              didChange = true;
            }
            return patched;
          }
          return entry;
        });

      setCreators((prev) => {
        didChange = false;
        const updated = nextCreators(prev);
        return didChange ? updated : prev;
      });
    },
    [setCreators],
  );

  const {
    getEnrichment,
    isLoading: isEnrichmentLoading,
    enrichCreator,
    enrichMany,
    prefetchEnrichment,
    seedEnrichment,
    usage: enrichmentUsage,
    bulkState: enrichmentBulkState,
  } = useCreatorEnrichment();

  // Bio enrichment for ScrapeCreators results (auto-fetches bio data when search completes)
  const jobStatusRaw = searchData?.status;
  const jobStatusNormalized = typeof jobStatusRaw === 'string' ? jobStatusRaw.toLowerCase() : '';
  const platformNormalizedEarly = (searchData?.selectedPlatform || searchData?.platform || 'tiktok').toString().toLowerCase();

  // Bio enrichment - auto-fetches bio data when search completes for instagram_scrapecreators
  const { bioData, isLoading: bioLoading } = useBioEnrichment(
    creators,
    jobStatusNormalized,
    searchData?.jobId,
    platformNormalizedEarly
  );

  // Confirmation dialog state for "Use Bio Email" vs "Enrich Anyway"
  const [bioEmailConfirmDialog, setBioEmailConfirmDialog] = useState({
    open: false,
    creator: null,
    bioEmail: null,
    enrichmentTarget: null,
  });

  // Handler for "Use Bio Email" button
  const handleUseBioEmail = useCallback(async () => {
    const { creator, bioEmail, enrichmentTarget } = bioEmailConfirmDialog;
    if (!creator || !bioEmail) {
      setBioEmailConfirmDialog({ open: false, creator: null, bioEmail: null, enrichmentTarget: null });
      return;
    }

    try {
      const response = await fetch('/api/creators/save-bio-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: searchData?.jobId,
          creatorId: creator.owner?.id || creator.id,
          email: bioEmail,
        }),
      });

      if (response.ok) {
        // Update local state to show email is now saved
        setCreators(prev => prev.map(c => {
          const cOwnerId = c.owner?.id;
          const creatorOwnerId = creator.owner?.id;
          if (cOwnerId && creatorOwnerId && cOwnerId === creatorOwnerId) {
            return { ...c, contact_email: bioEmail, email_source: 'bio' };
          }
          return c;
        }));
        toast.success(`Email saved: ${bioEmail}`);
      } else {
        toast.error('Failed to save email');
      }
    } catch (error) {
      console.error('Error saving bio email:', error);
      toast.error('Failed to save email');
    }

    setBioEmailConfirmDialog({ open: false, creator: null, bioEmail: null, enrichmentTarget: null });
  }, [bioEmailConfirmDialog, searchData?.jobId, setCreators]);

  // Helper to get bio-extracted email for a creator
  const getBioEmailForCreator = useCallback((creator) => {
    const ownerId = creator?.owner?.id;
    if (!ownerId) return null;
    return bioData[ownerId]?.extracted_email || null;
  }, [bioData]);

  // Helper to get full bio data for a creator
  const getBioDataForCreator = useCallback((creator) => {
    const ownerId = creator?.owner?.id;
    if (!ownerId) return null;
    return bioData[ownerId] || null;
  }, [bioData]);

  const jobStatus = jobStatusNormalized;
  const jobIsActive = jobStatus === 'processing' || jobStatus === 'pending';

  // Normalize platform from either selectedPlatform (wizard) or platform (reopen flow)
  const platformNormalized = (searchData?.selectedPlatform || searchData?.platform || 'tiktok').toString().toLowerCase();
  const isInstagramUs = [
    'instagram',
    'instagram_us_reels',
    'instagram-us-reels',
    'instagram-1.0',
    'instagram_1.0',
  ].includes(platformNormalized);

  useEffect(() => {
    setSelectedCreators({});
  }, [searchData?.jobId, initialCreators, platformNormalized]);

  // Reset only when switching to a different run (jobId changes)
  useEffect(() => {
    const cacheKey = searchData?.jobId;
    if (!cacheKey) {
      setCreators([]);
      setIsFetching(false);
      setStillProcessing(false);
      setIsLoading(false);
      return;
    }

    setCurrentPage(1);
    setEmailOverlayDismissed(false);
    setProgressInfo(null);

    const cached = resultsCacheRef.current.get(cacheKey);
   if (cached && cached.length) {
      setCreators(cached);
      setIsLoading(false);
      setIsFetching(true);
    } else if (initialCreators.length) {
      setCreators(dedupeCreators(initialCreators, { platformHint: platformNormalized }));
      setIsLoading(false);
      setIsFetching(false); // Don't fetch when we already have data
    } else {
      setCreators([]);
      setIsLoading(true);
      setIsFetching(true);
    }
  }, [searchData?.jobId, initialCreators, platformNormalized]);

  // Track processing flag separately so we don't reset pagination on progress updates
  useEffect(() => {
    setStillProcessing(jobIsActive);
  }, [jobIsActive]);

  useEffect(() => {
    setCurrentPage(1);
  }, [showEmailOnly, viewMode]);

  const selectedSnapshots = useMemo(() => Object.values(selectedCreators), [selectedCreators]);
  const selectionCount = selectedSnapshots.length;
  const selectedEnrichmentTargets = useMemo(
    () => selectedSnapshots.map((snapshot) => buildEnrichmentTarget(snapshot, platformNormalized)),
    [selectedSnapshots, platformNormalized]
  );

  const handleBulkEnrich = useCallback(async () => {
    if (!selectedEnrichmentTargets.length) return;
    const result = await enrichMany(selectedEnrichmentTargets);
    if (result?.records?.length) {
      result.records.forEach(({ target, record }) => {
        if (record) {
          const normalizedHandle = normalizeHandleValue(target.handle);
          const normalizedPlatform = normalizePlatformValue(target.platform);
          const rawMatch = creators.find((entry) => {
            if (!entry) return false;
            const base = entry && typeof entry.creator === 'object' && entry.creator !== null ? entry.creator : entry;
            const entryHandle =
              normalizeHandleValue(
                base?.handle ??
                  base?.username ??
                  base?.uniqueId ??
                  entry?.handle ??
                  entry?.username ??
                  entry?.uniqueId ??
                  null,
              ) ?? null;
            if (!entryHandle || entryHandle !== normalizedHandle) {
              return false;
            }
            if (!normalizedPlatform) return true;
            const entryPlatform = normalizePlatformValue(base?.platform ?? entry?.platform ?? null);
            return !entryPlatform || entryPlatform === normalizedPlatform;
          });
          applyEnrichmentToCreators(record, target, rawMatch ?? null, 'interactive');
        }
      });
    }
  }, [applyEnrichmentToCreators, enrichMany, selectedEnrichmentTargets, creators]);

  const [emailOverlayDismissed, setEmailOverlayDismissed] = useState(false);

  useEffect(() => {
    if (searchData?.jobId && creators.length) {
      resultsCacheRef.current.set(searchData.jobId, creators);
    }
  }, [creators, searchData?.jobId]);

  // Helper to check if creator has any email (including bio-extracted)
  const hasAnyEmail = useCallback((creator) => {
    if (hasContactEmail(creator)) return true;
    if (creator.contact_email) return true;
    // Check bio_enriched from database
    if (creator.bio_enriched?.extracted_email) return true;
    // Check bioData from live state
    const ownerId = creator?.owner?.id;
    if (ownerId && bioData[ownerId]?.extracted_email) return true;
    return false;
  }, [bioData]);

  const filteredCreators = useMemo(() => {
    // Step 1: Apply engagement filter based on selected option
    let engagementFiltered = creators;
    if (engagementFilter === "100likes") {
      engagementFiltered = filterCreatorsByLikes(creators, 100, false); // Strict: exclude null likes
    } else if (engagementFilter === "1000views") {
      engagementFiltered = filterCreatorsByViews(creators, 1000, false); // Strict: exclude null views
    }
    // Note: 'all' shows all creators without engagement filtering

    // Step 2: Apply email filter if enabled
    if (!showEmailOnly) return engagementFiltered;
    return engagementFiltered.filter((creator) => hasAnyEmail(creator));
  }, [creators, showEmailOnly, engagementFilter, hasAnyEmail]);

  const waitingForResults = (jobIsActive || stillProcessing || isFetching || isLoading) && creators.length === 0;
  const shouldPoll = Boolean(searchData?.jobId) && (jobIsActive || stillProcessing || isFetching || isLoading);

  const showFilteredEmpty = useMemo(
    () => (showEmailOnly || engagementFilter !== "all") && creators.length > 0 && filteredCreators.length === 0,
    [showEmailOnly, engagementFilter, creators.length, filteredCreators.length]
  );

  useEffect(() => {
    if (!showFilteredEmpty) {
      setEmailOverlayDismissed(false);
    }
  }, [showFilteredEmpty]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(Math.max(filteredCreators.length, 1) / itemsPerPage));
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [filteredCreators.length, currentPage, itemsPerPage]);

  const totalResults = filteredCreators.length;
  const totalPages = Math.max(1, Math.ceil(Math.max(totalResults, 1) / itemsPerPage));

  useEffect(() => {
    const fetchResults = async () => {
      try {
        if (!searchData?.jobId) {
          setIsFetching(false);
          return;
        }

        // Skip API call if we already have data and job is completed
        if (creators.length > 0 && !jobIsActive && !stillProcessing) {
          // Skipping API call - data already available
          setIsFetching(false);
          return;
        }
        setIsFetching(true);
        // Determine API endpoint based on platform
        let apiEndpoint = '/api/scraping/tiktok';
        if (
          platformNormalized === 'instagram' ||
          platformNormalized === 'instagram_us_reels' ||
          platformNormalized === 'instagram-1.0' ||
          platformNormalized === 'instagram_1.0'
        ) {
          apiEndpoint = '/api/scraping/instagram-us-reels';
        } else if (platformNormalized === 'instagram_scrapecreators') {
          apiEndpoint = '/api/scraping/instagram-scrapecreators';
        } else if (platformNormalized === 'youtube') {
          apiEndpoint = '/api/scraping/youtube';
        } else if (
          platformNormalized === 'instagram-2.0' ||
          platformNormalized === 'instagram_2.0' ||
          platformNormalized === 'instagram-v2' ||
          platformNormalized === 'instagram_v2'
        ) {
          apiEndpoint = '/api/scraping/instagram-v2';
        } else if (platformNormalized === 'google-serp' || platformNormalized === 'google_serp') {
          apiEndpoint = '/api/scraping/google-serp';
        }

        // Making API call to fetch results

        const response = await fetch(`${apiEndpoint}?jobId=${searchData.jobId}` , { credentials: 'include' });
        const data = await parseJsonSafe(response);

        if (data?.error === 'invalid_json') {
          setIsLoading(false);
          setStillProcessing(false);
          setIsFetching(false);
          return;
        }

        if (data.error) {
          console.error("Error fetching results:", data.error);
          return;
        }

        // Combinar todos los creadores de todos los resultados
        const allCreators =
          data.results?.reduce((acc, result) => {
            return [...acc, ...(result.creators || [])];
          }, []) || [];

        // Debug logs removed - data flow working correctly

        const dedupedCreators = dedupeCreators(allCreators, { platformHint: platformNormalized });
        setCreators(dedupedCreators);
        if (searchData?.jobId && dedupedCreators.length) {
          resultsCacheRef.current.set(searchData.jobId, dedupedCreators);
        }
        if (dedupedCreators.length) {
          setIsLoading(false);
        }
        if (!jobIsActive) {
          setStillProcessing(false);
        }
      } catch (error) {
        console.error("Error fetching results:", error);
      } finally {
        setIsFetching(false);
      }
    };

    fetchResults();
  }, [searchData, searchData?.jobId, searchData?.selectedPlatform, searchData?.platform, searchData?.platforms, platformNormalized, jobIsActive, creators.length, stillProcessing]);

  // Fetch campaign name for breadcrumbs
  useEffect(() => {
    const fetchCampaignName = async () => {
      if (!searchData?.campaignId) return;

      try {
        const response = await fetch(`/api/campaigns/${searchData.campaignId}`);
        const data = await parseJsonSafe(response);

        if (data?.error === 'invalid_json') return;

        if (data && data.name) {
          setCampaignName(data.name);
        }
      } catch (error) {
        console.error("Error fetching campaign name:", error);
        // Keep fallback name 'Campaign'
      }
    };

    fetchCampaignName();
  }, [searchData?.campaignId]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const renderProfileLink = useCallback(
    (creator) => buildProfileLink(creator, platformNormalized),
    [platformNormalized]
  );

  const currentCreators = useMemo(
    () => filteredCreators.slice(startIndex, endIndex),
    [filteredCreators, startIndex, endIndex]
  );

  const currentRows = useMemo(() => {
    const seenRowKeys = new Set();
    return currentCreators.map((creator, index) => {
      const base = creator?.creator || creator;
      const platformValue = base?.platform || creator.platform || platformNormalized || 'tiktok';
      const platform = typeof platformValue === 'string' ? platformValue : String(platformValue);

      const handleRaw =
        base?.uniqueId ||
        base?.username ||
        base?.handle ||
        base?.name ||
        creator.username ||
        `creator-${startIndex + index}`;
      const handleValue = typeof handleRaw === 'string' ? handleRaw : String(handleRaw ?? `creator-${startIndex + index}`);
      const handle = handleValue.trim().length ? handleValue : `creator-${startIndex + index}`;

      const externalRaw =
        base?.id ??
        base?.userId ??
        base?.user_id ??
        base?.externalId ??
        base?.profileId ??
        creator.id ??
        creator.externalId ??
        handle ??
        `creator-${startIndex + index}`;
      const externalId = typeof externalRaw === 'string' ? externalRaw : String(externalRaw ?? `creator-${startIndex + index}`);

      // Normalize for stable keys
      const idPlatform = (platform || platformNormalized || 'tiktok').toString().toLowerCase();
      const idExternal = (externalId || handle).toString().toLowerCase();
      let keyId = `${idPlatform}-${idExternal}`;
      if (seenRowKeys.has(keyId)) {
        let i = 1;
        while (seenRowKeys.has(`${keyId}-${i}`)) i++;
        keyId = `${keyId}-${i}`;
      }
      seenRowKeys.add(keyId);

      const snapshot = {
        platform,
        externalId,
        handle,
        displayName: base?.name || base?.displayName || creator.displayName || null,
        avatarUrl:
          base?.avatarUrl ||
          base?.profile_pic_url ||
          base?.profilePicUrl ||
          creator.profile_pic_url ||
          creator.profilePicUrl ||
          creator.avatarUrl ||
          null,
        url: renderProfileLink(creator),
        followers:
          base?.stats?.followerCount ??
          base?.followerCount ??
          base?.followers ??
          creator.followers ??
          creator.stats?.followerCount ??
          null,
        engagementRate:
          base?.stats?.engagementRate ??
          base?.engagementRate ??
          creator.engagementRate ??
          null,
        category: base?.category || base?.topic || base?.niche || creator.category || null,
        metadata: creator,
      };

      return {
        id: keyId,
        snapshot,
        raw: creator,
      };
    });
  }, [currentCreators, platformNormalized, startIndex, renderProfileLink]);

  const currentRowIds = useMemo(() => currentRows.map((row) => row.id), [currentRows]);
  const allSelectedOnPage = currentRowIds.length > 0 && currentRowIds.every((id) => selectedCreators[id]);
  const someSelectedOnPage = currentRowIds.some((id) => selectedCreators[id]);

  useEffect(() => {
    currentRows.forEach(({ snapshot, raw }) => {
      const target = buildEnrichmentTarget(snapshot, platformNormalized);
      const platformValue = target.platform || 'tiktok';
      const existing = raw?.metadata?.enrichment || snapshot?.metadata?.enrichment || raw?.enrichment;
      if (existing) {
        seedEnrichment(platformValue, target.handle, existing);
        applyEnrichmentToCreators(existing, target, raw, 'hydrate');
      } else {
        void prefetchEnrichment(platformValue, target.handle).then((record) => {
          if (record) {
            applyEnrichmentToCreators(record, target, raw, 'hydrate');
          }
        });
      }
    });
  }, [currentRows, platformNormalized, prefetchEnrichment, seedEnrichment, applyEnrichmentToCreators]);

  const toggleSelection = (rowId, snapshot) => {
    setSelectedCreators((prev) => {
      const next = { ...prev };
      if (next[rowId]) {
        delete next[rowId];
      } else {
        next[rowId] = snapshot;
      }
      return next;
    });
  };

  const handleSelectPage = (shouldSelect) => {
    setSelectedCreators((prev) => {
      const next = { ...prev };
      if (shouldSelect) {
        currentRows.forEach(({ id, snapshot }) => {
          next[id] = snapshot;
        });
      } else {
        currentRows.forEach(({ id }) => {
          delete next[id];
        });
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedCreators({});

  // Validación básica - moved after hooks to avoid conditional hook calls
  if (!searchData?.jobId) return null;

  // Unified completion handler (used for both initial and silent polling)
  const handleSearchComplete = (data) => {
    // FIX: Always stop processing indicators immediately when job completes
    // The job is done regardless of whether we have creators data yet
    if (data && (data.status === "completed" || data.status === "error" || data.status === "timeout")) {
      // Immediately mark as not processing - the job is finished
      setStillProcessing(false);
      setIsFetching(false);

      // Use creators directly from data.creators (already processed with bio/email)
      const allCreators = dedupeCreators(data.creators || [], { platformHint: platformNormalized });
      if (allCreators.length > 0) {
        setCreators(allCreators);
        setIsLoading(false);
        if (searchData?.jobId) {
          resultsCacheRef.current.set(searchData.jobId, allCreators);
        }
      } else {
        // As a fallback, re-fetch latest results from the corresponding endpoint
        let apiEndpoint = '/api/scraping/tiktok';
        if (
          platformNormalized === 'instagram' ||
          platformNormalized === 'instagram_us_reels' ||
          platformNormalized === 'instagram-1.0' ||
          platformNormalized === 'instagram_1.0'
        ) {
          apiEndpoint = '/api/scraping/instagram-us-reels';
        } else if (platformNormalized === 'instagram_scrapecreators') {
          apiEndpoint = '/api/scraping/instagram-scrapecreators';
        } else if (platformNormalized === 'youtube') {
          apiEndpoint = '/api/scraping/youtube';
        } else if (
          platformNormalized === 'instagram-2.0' ||
          platformNormalized === 'instagram_2.0' ||
          platformNormalized === 'instagram-v2' ||
          platformNormalized === 'instagram_v2'
        ) {
          apiEndpoint = '/api/scraping/instagram-v2';
        } else if (platformNormalized === 'google-serp' || platformNormalized === 'google_serp') {
          apiEndpoint = '/api/scraping/google-serp';
        }

        // FIX: Fetch is still fire-and-forget but processing state is already stopped above
        fetch(`${apiEndpoint}?jobId=${searchData.jobId}`, { credentials: 'include' })
          .then((response) => parseJsonSafe(response))
          .then((result) => {
            if (result?.error === 'invalid_json') {
              setIsLoading(false);
              return;
            }
            const foundCreators =
              result.results?.reduce((acc, res) => {
                return [...acc, ...(res.creators || [])];
              }, []) || [];
            const deduped = dedupeCreators(foundCreators, { platformHint: platformNormalized });
            setCreators(deduped);
            setIsLoading(false);
            if (searchData?.jobId && deduped.length) {
              resultsCacheRef.current.set(searchData.jobId, deduped);
            }
          })
          .catch(() => {
            setIsLoading(false);
          });
      }
    }
  };

  if (!filteredCreators.length && !showFilteredEmpty) {
    if (waitingForResults) {
      return (
        <>
          {/* Keep polling even while showing the minimal loader */}
          {shouldPoll && (
            <div className="hidden" aria-hidden="true">
              <SearchProgress 
                jobId={searchData.jobId}
                platform={searchData.selectedPlatform || searchData.platform}
                searchData={searchData}
                onProgress={setProgressInfo}
                onIntermediateResults={(data) => {
                  try {
                    const incoming = Array.isArray(data?.creators) ? data.creators : [];
                    if (incoming.length === 0) return;
                    setStillProcessing(true);
                    setIsLoading(false);
                    setIsFetching(false);
                    setCreators((prev) => dedupeCreators([...prev, ...incoming], { platformHint: platformNormalized }));
                  } catch (e) {
                    console.error('Error handling intermediate results (initial wait):', e);
                  }
                }}
                onComplete={handleSearchComplete}
              />
            </div>
          )}
          <div className="flex flex-col items-center justify-center min-h-[240px] text-sm text-zinc-400 gap-2">
            <PinkSpinner size="h-4 w-4" label="Loading results" />
            Waiting for results...
          </div>
        </>
      );
    }

    if (isFetching) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[240px] text-sm text-zinc-400 gap-2">
          <PinkSpinner size="h-4 w-4" className="opacity-80" label="Fetching creators" />
          Fetching results...
        </div>
      );
    }

    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center text-zinc-400">
          <p>
            {showEmailOnly
              ? "No creators with a contact email match your filters"
              : "No creators found matching your criteria"}
          </p>
          <p className="text-sm mt-2">
            {showEmailOnly
              ? "Try disabling the email filter or rerun your search"
              : "Try adjusting your search keywords"}
          </p>
        </div>
      </div>
    );
  }

  const handlePageChange = async (newPage) => {
    if (newPage === currentPage) return;
    setIsPageLoading(true);
    // Simular un pequeño delay para mostrar el loading
    await new Promise((resolve) => setTimeout(resolve, 300));
    setCurrentPage(newPage);
    setIsPageLoading(false);
  };

  const getPageNumbers = () => {
    const totalPages = Math.ceil(Math.max(totalResults, 1) / itemsPerPage);
    const maxVisiblePages = 5;
    const pageNumbers = [];

    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Siempre mostrar la primera página
    pageNumbers.push(1);

    let startPage = Math.max(currentPage - 1, 2);
    let endPage = Math.min(currentPage + 1, totalPages - 1);

    // Ajustar si estamos cerca del inicio
    if (currentPage <= 3) {
      endPage = Math.min(4, totalPages - 1);
    }
    // Ajustar si estamos cerca del final
    if (currentPage >= totalPages - 2) {
      startPage = Math.max(totalPages - 3, 2);
    }

    // Agregar ellipsis y páginas del medio
    if (startPage > 2) pageNumbers.push("...");
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
    if (endPage < totalPages - 1) pageNumbers.push("...");

    // Siempre mostrar la última página
    if (totalPages > 1) pageNumbers.push(totalPages);

    return pageNumbers;
  };

  // Format duration from seconds to MM:SS or HH:MM:SS
  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return "N/A";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    }
  };

  // Enhanced image loading handlers with comprehensive logging
  const handleImageLoad = (e) => {
    const img = e.target;
    if (img) {
      delete img.dataset.startTime;
    }
  };

  const handleImageError = (e) => {
    const img = e.target;
    if (img) {
      img.style.display = "none";
    }
  };

  const handleImageStart = (e) => {
    const img = e.target;
    if (img) {
      img.dataset.startTime = Date.now().toString();
    }
  };

  const shouldShowEmailOverlay = showFilteredEmpty && !emailOverlayDismissed;

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          {
            label: campaignName,
            href: searchData?.campaignId
              ? `/campaigns/${searchData.campaignId}`
              : "/dashboard",
            type: "campaign",
          },
          { label: "Search Results" },
        ]}
        backHref={searchData?.campaignId ? `/campaigns/search?campaignId=${searchData.campaignId}` : '/campaigns/search'}
        backLabel="Back to Search Options"
      />

      {/* Removed AI Strategy box for a cleaner presentation */}

      <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-2xl font-bold text-zinc-100">Results Found</h2>
          {isInstagramUs && (
            <Badge variant="secondary" className="bg-gradient-to-r from-emerald-500/15 to-sky-500/15 text-emerald-200 border-emerald-500/30">
              US Reels
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 md:gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/60 p-1">
              {VIEW_MODES.map((mode) => {
                const meta = VIEW_MODE_META[mode];
                const Icon = meta?.Icon ?? Table2;
                const isActive = viewMode === mode;
                return (
                  <Button
                    key={mode}
                    type="button"
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "gap-2",
                      !isActive && "text-zinc-400 hover:text-zinc-100"
                    )}
                    onClick={() => setViewMode(mode)}
                    aria-pressed={isActive}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden md:inline">{meta?.label ?? mode}</span>
                  </Button>
                );
              })}
            </div>
            <Separator orientation="vertical" className="hidden h-6 md:block" />
            <Button
              type="button"
              variant={showEmailOnly ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => setShowEmailOnly((prev) => !prev)}
              aria-pressed={showEmailOnly}
            >
              <MailCheck className="h-4 w-4" />
              Email only
            </Button>
            <Separator orientation="vertical" className="hidden h-6 md:block" />
            {/* Engagement filter buttons */}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant={engagementFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setEngagementFilter("all")}
                aria-pressed={engagementFilter === "all"}
              >
                All
              </Button>
              <Button
                type="button"
                variant={engagementFilter === "100likes" ? "default" : "outline"}
                size="sm"
                onClick={() => setEngagementFilter("100likes")}
                aria-pressed={engagementFilter === "100likes"}
              >
                100+ likes
              </Button>
              <Button
                type="button"
                variant={engagementFilter === "1000views" ? "default" : "outline"}
                size="sm"
                onClick={() => setEngagementFilter("1000views")}
                aria-pressed={engagementFilter === "1000views"}
              >
                1K+ views
              </Button>
            </div>
          </div>
        <div className="text-sm text-zinc-400 order-3 md:order-none">
          Page {currentPage} of {totalPages} •
          Showing {(currentPage - 1) * itemsPerPage + 1}-
          {Math.min(currentPage * itemsPerPage, totalResults)} of{" "}
          {totalResults}
        </div>
        {selectionCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-pink-200">{selectionCount} selected</span>
            <Button
              variant="default"
              size="sm"
              className="gap-2 bg-pink-500 text-pink-950 hover:bg-pink-500/90"
              disabled={enrichmentBulkState.inProgress}
              onClick={handleBulkEnrich}
            >
              {enrichmentBulkState.inProgress ? (
                <>
                  <PinkSpinner size="h-3.5 w-3.5" label="Enriching creators" />
                  {enrichmentBulkState.processed}/{enrichmentBulkState.total}
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Enrich {selectionCount}
                </>
              )}
            </Button>
            <AddToListButton
              creators={selectedSnapshots}
              buttonLabel={`Save ${selectionCount} to list`}
              variant="default"
              size="sm"
              onAdded={clearSelection}
            />
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
          </div>
        )}
        {enrichmentUsage && (
          <div className="flex items-center gap-2 text-xs text-pink-200">
            <Badge className="border border-pink-500/40 bg-pink-500/10 px-2 py-1 text-pink-100">
              Enrichments {enrichmentUsage.limit < 0 ? `${enrichmentUsage.count} / ∞` : `${enrichmentUsage.count}/${enrichmentUsage.limit}`}
            </Badge>
          </div>
        )}
        {stillProcessing && (
          <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
            Processing… live results updating
          </span>
        )}
          {(searchData?.campaignId || searchData?.jobId) && (
            <FeatureGate
              feature="csv_export"
              fallback={
                <Button variant="outline" disabled>
                  Export CSV (Premium)
                </Button>
              }
            >
              <ExportButton
                campaignId={searchData.campaignId}
                jobId={searchData.jobId}
              />
            </FeatureGate>
          )}
        </div>
      </div>

      {shouldShowEmailOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 px-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-700/60 bg-zinc-900/95 p-6 text-center shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-100">
              {showEmailOnly && engagementFilter !== "all"
                ? "No creators match both filters"
                : showEmailOnly
                ? "No creators with a contact email"
                : engagementFilter === "100likes"
                ? "No creators with 100+ likes"
                : "No creators with 1000+ views"}
            </h3>
            <p className="text-sm text-zinc-400">
              {showEmailOnly && engagementFilter !== "all"
                ? "No creators match both the email and engagement filters. Try adjusting your filters."
                : showEmailOnly
                ? "We didn't find any creators in this list with a visible email."
                : `No creators in this search meet the ${engagementFilter === "100likes" ? "100+ likes" : "1000+ views"} threshold.`}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button
                size="sm"
                className="bg-emerald-500 text-emerald-950"
                onClick={() => {
                  setShowEmailOnly(false);
                  setEngagementFilter("all");
                }}
              >
                Show all creators
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEmailOverlayDismissed(true)}
                className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
              >
                Keep filters
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Silent poller to keep progress flowing while table renders */}
      {shouldPoll && (
        <div className="hidden" aria-hidden="true">
          <SearchProgress 
            jobId={searchData.jobId}
            platform={searchData.selectedPlatform || searchData.platform}
            searchData={searchData}
            onProgress={setProgressInfo}
            onIntermediateResults={(data) => {
              try {
                const incoming = Array.isArray(data?.creators) ? data.creators : [];
                if (incoming.length === 0) return;

                setStillProcessing(true);
                setIsLoading(false);
                setIsFetching(false);
                setCreators((prev) => {
                  const merged = dedupeCreators([...prev, ...incoming], { platformHint: platformNormalized });
                  if (searchData?.jobId && merged.length) {
                    resultsCacheRef.current.set(searchData.jobId, merged);
                  }
                  return merged;
                });
              } catch (e) {
                console.error('Error handling intermediate results:', e);
              }
            }}
            onComplete={handleSearchComplete}
          />
        </div>
      )}

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 relative w-full overflow-hidden">
        {stillProcessing && (
          <div className="absolute top-0 left-0 h-[2px] bg-primary transition-all duration-500 z-40" 
               style={{ width: `${Math.min(progressInfo?.progress ?? 0, 95)}%` }}
               aria-hidden="true"
          />
        )}

        {stillProcessing && (
          <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-zinc-400" aria-live="polite">
              <PinkSpinner size="h-3.5 w-3.5" label="Processing search" />
              <span>
                Processing{progressInfo?.processedResults != null && progressInfo?.targetResults != null
                  ? ` ${progressInfo.processedResults}/${progressInfo.targetResults}`
                  : ''}
              </span>
                </div>
          </div>
        )}
        {isPageLoading && (
          <div className="absolute inset-0 bg-zinc-900/50 flex items-center justify-center z-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-200"></div>
          </div>
        )}

        <div className={cn("w-full", viewMode === "table" ? "block" : "hidden")}>
          <div className="overflow-hidden lg:overflow-visible">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="border-b border-zinc-800">
                  <TableHead className="w-12 px-4 py-3">
                    <Checkbox
                      aria-label="Select page"
                      checked={allSelectedOnPage ? true : someSelectedOnPage ? 'indeterminate' : false}
                      onCheckedChange={() => handleSelectPage(!allSelectedOnPage)}
                    />
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Profile
                  </TableHead>
                  <TableHead className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Username
                  </TableHead>
                  <TableHead className="hidden md:table-cell px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Followers
                  </TableHead>
                  <TableHead className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400 w-[320px]">
                    Bio & Links
                  </TableHead>
                  <TableHead className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Email
                  </TableHead>
                  <TableHead className="hidden lg:table-cell px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Views
                  </TableHead>
                  <TableHead className="hidden lg:table-cell px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Post
                  </TableHead>
                  <TableHead className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Enrich
                  </TableHead>
                  <TableHead className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Save
                  </TableHead>
                </TableRow>
              </TableHeader>
            <TableBody className="divide-y divide-zinc-800">
                {currentRows.map((row) => {
                  const { id: rowId, snapshot } = row;
                  const creator = row.raw;
                  const avatarUrl =
                    creator.creator?.avatarUrl ||
                    creator.creator?.profile_pic_url ||
                    creator.creator?.profilePicUrl ||
                    creator.profile_pic_url ||
                    creator.profilePicUrl ||
                    "";
                  const imageUrl = ensureImageUrl(avatarUrl);
                  const isSelected = !!selectedCreators[rowId];
                  const metadata = creator.metadata || {};
                  const enrichmentTarget = buildEnrichmentTarget(snapshot, platformNormalized);
                  const enrichment = getEnrichment(enrichmentTarget.platform, enrichmentTarget.handle);
                  const enrichmentLoading = isEnrichmentLoading(enrichmentTarget.platform, enrichmentTarget.handle);
                  const enrichmentSummary = enrichment?.summary;
                  const enrichedAtLabel = enrichment ? formatEnrichedAtLabel(enrichment.enrichedAt) : null;
                  const enrichmentEmailsRaw = Array.isArray(enrichmentSummary?.allEmails)
                    ? enrichmentSummary.allEmails
                    : [];
                  const enrichmentEmailsNormalized = enrichmentEmailsRaw
                    .map((candidate) => normalizeEmailCandidate(candidate))
                    .filter(Boolean);
                  const primaryEmailNormalized = normalizeEmailCandidate(enrichmentSummary?.primaryEmail);
                  const enrichmentEmails = primaryEmailNormalized
                    ? Array.from(new Set([primaryEmailNormalized, ...enrichmentEmailsNormalized]))
                    : enrichmentEmailsNormalized;
                  const existingEmails = extractEmails(creator);
                  const displayEmails = enrichmentEmails.length ? enrichmentEmails : existingEmails;
                  const clientNewEmails = Array.isArray(metadata.clientNewEmails) ? metadata.clientNewEmails : [];
                  const clientNewEmailSet = new Set(clientNewEmails.map((value) => value.toLowerCase()));
                  const displayEmailEntries = displayEmails.map((email) => {
                    const lower = email.toLowerCase();
                    const isNew = clientNewEmailSet.has(lower);
                    return { value: email, isNew };
                  });
                  const highlightNewEmail = displayEmailEntries.some((entry) => entry.isNew);

                  return (
                    <TableRow
                      key={rowId}
                      className={cn(
                        "table-row transition-colors align-top",
                        isSelected ? "bg-pink-500/10" : undefined
                      )}
                    >
                  <TableCell className="w-12 px-4 py-4 align-middle">
                    <div className="flex h-full items-center justify-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelection(rowId, snapshot)}
                        aria-label={`Select ${snapshot.handle}`}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top w-[260px] max-w-[280px]">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage
                          src={imageUrl}
                          alt={creator.creator?.name || snapshot.handle}
                          onLoad={(e) => handleImageLoad(e, creator.creator?.name)}
                          onError={(e) =>
                            handleImageError(
                              e,
                              creator.creator?.name,
                              creator.creator?.profilePicUrl || creator.creator?.avatarUrl
                            )
                          }
                          onLoadStart={(e) => handleImageStart(e, creator.creator?.name)}
                          style={{
                            maxWidth: '100%',
                            height: 'auto',
                            backgroundColor: '#f3f4f6'
                          }}
                        />
                        <AvatarFallback>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1 sm:hidden">
                        {creator.creator?.name && creator.creator.name !== 'N/A' ? (
                          <a
                            href={renderProfileLink(creator)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm font-medium text-pink-400 transition-colors hover:text-pink-300 hover:underline"
                          >
                            {creator.creator.name}
                            <svg className="h-3 w-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </a>
                        ) : (
                          <span className="text-sm text-zinc-500">{snapshot.handle}</span>
                        )}
                        <div className="text-xs text-zinc-400">@{snapshot.handle}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell px-4 py-4 align-top w-[220px] max-w-[260px]">
                    {creator.creator?.name && creator.creator.name !== 'N/A' ? (
                      <a
                        href={renderProfileLink(creator)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-pink-400 transition-colors hover:text-pink-300 hover:underline"
                        title={`View ${creator.creator.name}'s profile`}
                      >
                        {creator.creator.name}
                        <svg className="h-3 w-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    ) : (
                      <span className="text-zinc-500">{snapshot.handle}</span>
                    )}
                    <div className="mt-2 space-y-1 text-xs text-zinc-400 lg:hidden">
                      <div>
                        <span className="font-medium text-zinc-300">Followers:</span>{' '}
                        {snapshot.followers != null ? formatFollowers(snapshot.followers) : 'N/A'}
                      </div>
                      {displayEmailEntries.length ? (
                        <div className="space-y-1 whitespace-normal break-words">
                          {displayEmailEntries.map(({ value: email, isNew }) => (
                            <div
                              key={email}
                              className={cn(
                                "flex items-center gap-1",
                                isNew ? "text-pink-300" : undefined
                              )}
                            >
                              <a href={`mailto:${email}`} className="hover:underline break-words whitespace-normal">
                                {email}
                              </a>
                              {isNew && (
                                <Badge className="bg-pink-500/15 text-pink-100 border border-pink-500/40">
                                  new
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-500">No email</span>
                      )}
                      {creator.video?.statistics?.views ? (
                        <div>
                          <span className="font-medium text-zinc-300">Views:</span>{' '}
                          {(creator.video.statistics.views || 0).toLocaleString()}
                        </div>
                      ) : null}
                      {creator.video?.url && (
                        <div>
                          <a
                            href={creator.video.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-pink-400 hover:underline"
                          >
                            View content
                          </a>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell px-4 py-4 text-right text-sm text-zinc-200">
                    {snapshot.followers != null ? formatFollowers(snapshot.followers) : 'N/A'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell px-4 py-4 w-[320px] max-w-[320px] align-top">
                    <BioLinksCell
                      bio={
                        creator.bio_enriched?.biography ||
                        creator.creator?.bio ||
                        creator.owner?.biography ||
                        creator.biography
                      }
                      bioLinks={
                        creator.bio_enriched?.bio_links ||
                        creator.owner?.bio_links ||
                        creator.bio_links ||
                        []
                      }
                      externalUrl={
                        creator.bio_enriched?.external_url ||
                        creator.owner?.external_url ||
                        creator.external_url
                      }
                    />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell px-4 py-4 align-top w-[260px] max-w-[320px]">
                    {(() => {
                      // Check for bio-extracted email (from DB or from live bioData state)
                      const bioEmailFromDb = creator.bio_enriched?.extracted_email;
                      const bioEmailFromState = getBioEmailForCreator(creator);
                      const bioEmail = bioEmailFromDb || bioEmailFromState;
                      const savedBioEmail = creator.contact_email;
                      const emailSource = creator.email_source;

                      // Combine all email sources
                      const allEmails = [...displayEmailEntries];

                      // Add bio-extracted email if not already in list and not enriched
                      if (bioEmail && !allEmails.some(e => e.value.toLowerCase() === bioEmail.toLowerCase())) {
                        allEmails.unshift({ value: bioEmail, isNew: false, isFromBio: true });
                      }

                      // Add saved bio email if not already in list
                      if (savedBioEmail && !allEmails.some(e => e.value.toLowerCase() === savedBioEmail.toLowerCase())) {
                        allEmails.unshift({ value: savedBioEmail, isNew: false, isFromBio: emailSource === 'bio' });
                      }

                      if (allEmails.length > 0) {
                        return (
                          <div className="space-y-1 text-sm whitespace-normal break-words">
                            {allEmails.map(({ value: email, isNew, isFromBio }) => (
                              <div
                                key={email}
                                className={cn(
                                  "flex items-center gap-1 flex-wrap",
                                  isNew ? "text-pink-300" : isFromBio ? "text-emerald-300" : undefined
                                )}
                              >
                                <a
                                  href={`mailto:${email}`}
                                  className={cn(
                                    "block hover:underline break-words whitespace-normal",
                                    isFromBio ? "text-emerald-400" : "text-pink-400"
                                  )}
                                  title={`Send email to ${email}`}
                                >
                                  {email}
                                </a>
                                {isNew && (
                                  <Badge className="bg-pink-500/15 text-pink-100 border border-pink-500/40 text-[10px]">
                                    new
                                  </Badge>
                                )}
                                {isFromBio && (
                                  <Badge className="bg-emerald-500/15 text-emerald-100 border border-emerald-500/40 text-[10px]">
                                    from bio
                                  </Badge>
                                )}
                                <svg
                                  className={cn("h-3 w-3 opacity-60", isFromBio ? "text-emerald-400" : "text-pink-400")}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                  />
                                </svg>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return <span className="text-sm text-zinc-500">No email</span>;
                    })()}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell px-4 py-4 text-right text-sm tabular-nums">
                    {(creator.video?.statistics?.views || 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell px-4 py-4 text-center">
                    {creator.video?.url && (
                      <a
                        href={creator.video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-pink-400 hover:underline"
                      >
                        View
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-right">
                    {(() => {
                      // Check bio email from DB or state
                      const bioEmailFromDb = creator.bio_enriched?.extracted_email;
                      const bioEmailFromState = getBioEmailForCreator(creator);
                      const bioEmail = bioEmailFromDb || bioEmailFromState;
                      const hasExistingEmail = displayEmailEntries.length > 0;

                      // Handler that checks for bio email before enriching
                      const handleEnrichClick = () => {
                        // If there's a bio email and no enriched email, show confirmation
                        if (bioEmail && !enrichment && !hasExistingEmail) {
                          setBioEmailConfirmDialog({
                            open: true,
                            creator,
                            bioEmail,
                            enrichmentTarget,
                          });
                          return;
                        }

                        // Otherwise, proceed with enrichment directly
                        void (async () => {
                          const record = await enrichCreator({ ...enrichmentTarget, forceRefresh: Boolean(enrichment) });
                          if (record) {
                            applyEnrichmentToCreators(record, enrichmentTarget, creator, 'interactive');
                          }
                        })();
                      };

                      return (
                        <>
                          <Button
                            variant={enrichment ? "outline" : "secondary"}
                            size="sm"
                            className={cn(
                              "gap-1",
                              enrichment
                                ? "border-pink-500/40 text-pink-200 hover:text-pink-100"
                                : "bg-pink-500 text-pink-950 hover:bg-pink-500/90"
                            )}
                            disabled={enrichmentLoading}
                            onClick={handleEnrichClick}
                          >
                            {enrichmentLoading ? (
                              <PinkSpinner size="h-3.5 w-3.5" label="Enriching creator" />
                            ) : enrichment ? (
                              <RefreshCw className="h-3.5 w-3.5" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5" />
                            )}
                            {enrichment ? 'Refresh' : 'Enrich'}
                          </Button>
                          {enrichedAtLabel && (
                            <div className="mt-1 text-[10px] uppercase tracking-wide text-pink-200/70">
                              Refreshed {enrichedAtLabel}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-right">
                    <AddToListButton
                      creator={snapshot}
                      buttonLabel="Save"
                      variant="ghost"
                      size="sm"
                      className="text-zinc-400 hover:text-emerald-300"
                    />
                  </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </div>
        <div className={cn(
          "w-full p-4 md:p-6",
          viewMode === "gallery" ? "block" : "hidden"
        )}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {currentRows.map(({ id, snapshot, raw }) => {
            const platformLabelNormalized = (snapshot.platform ?? platformNormalized ?? '').toLowerCase();
            const preview = resolveMediaPreview(raw, snapshot, platformLabelNormalized);
            const previewUrl = ensureImageUrl(preview);
            const emails = extractEmails(raw);
            const profileUrl = renderProfileLink(raw);
            const followerLabel = snapshot.followers != null ? formatFollowers(snapshot.followers) : null;
            const metadata = raw.metadata || {};
            const matchedTermsDisplay = Array.isArray(metadata.matchedTerms)
              ? metadata.matchedTerms.slice(0, 4)
              : [];
            const snippetText =
              typeof metadata.snippet === "string" && metadata.snippet.trim().length > 0
                ? metadata.snippet.trim()
                : null;
              const rawViewCount =
                raw?.video?.stats?.playCount ??
                raw?.video?.stats?.viewCount ??
                raw?.video?.playCount ??
                raw?.video?.views ??
                raw?.stats?.playCount ??
                raw?.stats?.viewCount ??
                null;
              const viewCountNumber =
                typeof rawViewCount === "number"
                  ? rawViewCount
                  : Number.isFinite(Number(rawViewCount))
                  ? Number(rawViewCount)
                  : null;
              const viewCountLabel =
                viewCountNumber != null ? Math.round(viewCountNumber).toLocaleString() : null;
              const isSelected = !!selectedCreators[id];
              const platformLabel = (snapshot.platform ?? 'creator').toString().toUpperCase();
              const isYouTube = platformLabelNormalized === 'youtube';
              const secondaryLine =
                raw?.creator?.location ||
                raw?.creator?.category ||
                snapshot.category ||
                platformLabel;

              return (
                <Card
                  key={id}
                  className={cn(
                    "relative flex h-full flex-col overflow-hidden border border-zinc-800/70 bg-zinc-900/70 shadow-sm transition-colors duration-200 hover:border-pink-400/50 hover:shadow-lg hover:shadow-pink-500/10",
                    isSelected && "border-emerald-400/60 ring-2 ring-emerald-500/30"
                  )}
                >
                  <div className="absolute left-3 top-3 z-30 flex items-center">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelection(id, snapshot)}
                      aria-label={`Select ${snapshot.handle}`}
                      className="h-5 w-5 rounded border-pink-400/60 bg-zinc-900/80 data-[state=checked]:border-pink-500 data-[state=checked]:bg-pink-500"
                    />
                  </div>
                  <div className={cn("relative w-full overflow-hidden bg-zinc-800/70", isYouTube ? "aspect-video" : "aspect-[9/16]") }>
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={snapshot.displayName || snapshot.handle}
                        className="h-full w-full object-cover"
                        onLoad={(event) => handleImageLoad(event, snapshot.handle)}
                        onError={(event) => handleImageError(event, snapshot.handle, preview)}
                        onLoadStart={(event) => handleImageStart(event, snapshot.handle)}
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-zinc-800/60 to-zinc-900/60 text-xs text-zinc-500">
                        <span className="rounded-full bg-zinc-900/70 px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-300">
                          {platformLabel}
                        </span>
                        <span>No preview available</span>
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/0" />
                    <div className="absolute right-3 top-3 rounded-full bg-zinc-950/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-100 shadow">
                      @{snapshot.handle}
                    </div>
                    {isYouTube && (
                      <div className="absolute left-3 bottom-3 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow">
                        <Youtube className="h-3.5 w-3.5" />
                        YouTube
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4 text-sm text-zinc-300">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                    <p className="line-clamp-1 text-base font-semibold text-zinc-100">
                      {snapshot.displayName || snapshot.handle}
                    </p>
                    {secondaryLine ? (
                      <p className="text-xs text-zinc-500">{secondaryLine}</p>
                        ) : null}
                      </div>
                      <Badge
                        variant="outline"
                        className="shrink-0 border-zinc-700 bg-zinc-900/70 text-[10px] tracking-wide text-zinc-300"
                      >
                        {platformLabel}
                      </Badge>
                    </div>
                    <p className="line-clamp-3 text-xs text-zinc-400">
                      {raw?.creator?.bio || raw?.bio || raw?.description || "No bio available"}
                    </p>
                    {isInstagramUs && matchedTermsDisplay.length > 0 && (
                      <div className="flex flex-wrap gap-1 text-[10px] uppercase tracking-wide text-emerald-200">
                        {matchedTermsDisplay.map((term) => (
                          <span
                            key={term}
                            className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5"
                          >
                            {term}
                          </span>
                        ))}
                      </div>
                    )}
                    {isInstagramUs && snippetText && (
                      <p className="text-[11px] italic text-zinc-400 line-clamp-2">“{snippetText}”</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-[11px] text-zinc-300">
                      {followerLabel && (
                        <span className="rounded-full border border-zinc-700/70 bg-zinc-900/60 px-2 py-1 font-medium text-zinc-200">
                          {followerLabel} followers
                        </span>
                      )}
                      {snapshot.engagementRate != null && (
                        <span className="rounded-full border border-zinc-700/70 bg-zinc-900/60 px-2 py-1 font-medium text-zinc-200">
                          {snapshot.engagementRate}% ER
                        </span>
                      )}
                      {viewCountLabel && (
                        <span className="rounded-full border border-zinc-700/70 bg-zinc-900/60 px-2 py-1 font-medium text-zinc-200">
                          {viewCountLabel} views
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-xs text-zinc-400">
                      {emails.length ? (
                        emails.slice(0, 2).map((email) => (
                          <a
                            key={email}
                            href={`mailto:${email}`}
                            className="block truncate text-pink-400 hover:text-pink-300 hover:underline"
                          >
                            {email}
                          </a>
                        ))
                      ) : (
                        <span className="text-zinc-500">No email</span>
                      )}
                    </div>
                    <div className="mt-auto pt-2 flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-zinc-300 hover:text-pink-300"
                        asChild
                      >
                        <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                          Profile <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                      {raw?.video?.url && (
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-1 bg-pink-500 hover:bg-pink-600 text-white"
                          asChild
                        >
                          <a href={raw.video.url} target="_blank" rel="noopener noreferrer">
                            View Post <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex w-full flex-wrap items-center justify-center gap-2">
        <Button
          variant="outline"
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1 || isPageLoading}
          className="px-3"
        >
          First
        </Button>
        <Button
          variant="outline"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1 || isPageLoading}
          className="px-3"
        >
          Previous
        </Button>

        <div className="flex w-full flex-wrap items-center justify-center gap-1 sm:w-auto">
          {getPageNumbers().map((pageNum, index) => (
            <React.Fragment key={index}>
              {pageNum === "..." ? (
                <span className="px-2">...</span>
              ) : (
                <Button
                  variant={currentPage === pageNum ? "default" : "outline"}
                  onClick={() => handlePageChange(pageNum)}
                  disabled={isPageLoading}
                  className="w-10 h-10 p-0"
                >
                  {pageNum}
                </Button>
              )}
            </React.Fragment>
          ))}
        </div>

        <Button
          variant="outline"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={
            currentPage === totalPages ||
            isPageLoading
          }
          className="px-3"
        >
          Next
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            handlePageChange(totalPages)
          }
          disabled={
            currentPage === totalPages ||
            isPageLoading
          }
          className="px-3"
        >
          Last
        </Button>
      </div>

      {/* Bio Email Confirmation Dialog */}
      <AlertDialog
        open={bioEmailConfirmDialog.open}
        onOpenChange={(open) =>
          setBioEmailConfirmDialog((prev) => ({ ...prev, open }))
        }
      >
        <AlertDialogContent className="border-zinc-800 bg-zinc-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">
              Email Already Found
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              We found an email in this creator&apos;s bio:{' '}
              <strong className="text-emerald-400">{bioEmailConfirmDialog.bioEmail}</strong>
              <br /><br />
              Enriching will use a credit to get additional contact info from our database. Would you like to use the bio email or enrich anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleUseBioEmail}
              className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
            >
              Use Bio Email
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const { enrichmentTarget, creator } = bioEmailConfirmDialog;
                setBioEmailConfirmDialog({ open: false, creator: null, bioEmail: null, enrichmentTarget: null });
                if (enrichmentTarget) {
                  void (async () => {
                    const record = await enrichCreator({ ...enrichmentTarget, forceRefresh: false });
                    if (record) {
                      applyEnrichmentToCreators(record, enrichmentTarget, creator, 'interactive');
                    }
                  })();
                }
              }}
              className="bg-pink-500 text-pink-950 hover:bg-pink-500/90"
            >
              Enrich Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SearchResults;
