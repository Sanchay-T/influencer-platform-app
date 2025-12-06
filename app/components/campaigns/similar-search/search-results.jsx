'use client';

import { structuredConsole } from '@/lib/logging/console-proxy';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LayoutGrid, Table2, MailCheck } from 'lucide-react';
import ExportButton from '../export-button';
import SearchProgress from '../keyword-search/search-progress';
import Breadcrumbs from '../../breadcrumbs';
import { cn } from '@/lib/utils';
import { AddToListButton } from '@/components/lists/add-to-list-button';
import { dedupeCreators } from '../utils/dedupe-creators';
import SimilarResultsTable from './results-table';
import SimilarResultsGallery from './results-gallery';
import { useViewPreferences } from './useViewPreferences';
import { buildProfileLink } from '../keyword-search/utils/profile-link';
import { deriveInitialStateFromSearchData } from './utils/initial-state';

const VIEW_MODES = ['table', 'gallery'];
const VIEW_MODE_META = {
  table: { label: 'Table', Icon: Table2 },
  gallery: { label: 'Gallery', Icon: LayoutGrid },
};

const normalizePlatform = (value) => {
  if (!value) return '';
  return value.toString().toLowerCase();
};

const extractEmails = (creator) => {
  if (!creator) return [];

  const collected = new Set();
  const listCandidates = [
    creator.emails,
    creator.contactEmails,
    creator.contact?.emails,
    creator.creator?.emails,
    creator.metadata?.emails,
  ];

  for (const list of listCandidates) {
    if (Array.isArray(list)) {
      for (const email of list) {
        if (typeof email === 'string' && email.trim().length > 0) {
          collected.add(email.trim());
        }
      }
    }
  }

  const singleCandidates = [
    creator.email,
    creator.contactEmail,
    creator.businessEmail,
    creator.creator?.email,
    creator.profile_email,
  ];

  for (const email of singleCandidates) {
    if (typeof email === 'string' && email.trim().length > 0) {
      collected.add(email.trim());
    }
  }

  return Array.from(collected);
};

const hasContactEmail = (creator) => extractEmails(creator).length > 0;

const formatFollowers = (value) => {
  if (value == null) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (Math.abs(numeric) >= 1_000_000) return `${(numeric / 1_000_000).toFixed(1)}M`;
  if (Math.abs(numeric) >= 1_000) return `${(numeric / 1_000).toFixed(1)}K`;
  return Math.round(numeric).toLocaleString();
};

const resolveInitials = (displayName, username) => {
  const source = displayName || username || '';
  const trimmed = source.trim();
  if (!trimmed) return '??';
  const parts = trimmed.split(/[\s_@.-]+/).filter(Boolean);
  if (parts.length === 0) return trimmed.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const resolvePreviewImage = (creator) => {
  if (!creator) return null;
  const video = creator.video || creator.latestVideo || creator.content;
  const sources = [
    video?.cover,
    video?.coverUrl,
    video?.thumbnail,
    video?.thumbnailUrl,
    video?.thumbnail_url,
    video?.image,
    creator.thumbnailUrl,
    creator.thumbnail,
    creator.avatarUrl,
    creator.profile_pic_url,
  ];

  for (const source of sources) {
    if (typeof source === 'string' && source.trim().length > 0) {
      return source;
    }
  }

  return null;
};

export default function SimilarSearchResults({ searchData }) {
  const platformHint = normalizePlatform(searchData?.platform);

  const { preferences, setPreferences } = useViewPreferences(searchData?.jobId);
  const viewMode = preferences.viewMode;
  const emailOnly = preferences.emailOnly;

  const [currentPage, setCurrentPage] = useState(1);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const initialSeed = useMemo(
    () =>
      deriveInitialStateFromSearchData({
        status: searchData?.status,
        creators: searchData?.creators,
      }),
    [searchData?.status, searchData?.creators]
  );

  const [creators, setCreators] = useState(initialSeed.creators);
  const [isLoading, setIsLoading] = useState(initialSeed.isLoading);
  const [stillProcessing, setStillProcessing] = useState(false);
  const [progressInfo, setProgressInfo] = useState(null);
  const [, setEnhancedMeta] = useState(null);
  const [selectedCreators, setSelectedCreators] = useState({});
  const [campaignName, setCampaignName] = useState('Campaign');

  // Breadcrumb campaign label lookup keeps the header stable for reruns
  useEffect(() => {
    const fetchCampaign = async () => {
      if (!searchData?.campaignId) return;
      try {
        const res = await fetch(`/api/campaigns/${searchData.campaignId}`);
        const payload = await res.json();
        if (payload?.name) {
          setCampaignName(payload.name);
        }
      } catch (error) {
        structuredConsole.warn('[SIMILAR-SEARCH] Failed to fetch campaign name', error);
      }
    };

    fetchCampaign();
  }, [searchData?.campaignId]);

  useEffect(() => {
    setSelectedCreators({});
    setCurrentPage(1);
  }, [searchData?.jobId]);

  useEffect(() => {
    setCreators(initialSeed.creators);
    setIsLoading(initialSeed.isLoading);
    if (!initialSeed.isLoading) {
      setStillProcessing(false);
    }
  }, [initialSeed.creators, initialSeed.isLoading]);

  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode, emailOnly]);

  const itemsPerPage = viewMode === 'gallery' ? 9 : 10;

  const filteredCreators = useMemo(() => {
    if (!emailOnly) return creators;
    return creators.filter(hasContactEmail);
  }, [creators, emailOnly]);

  const totalResults = filteredCreators.length;
  const totalPages = totalResults > 0 ? Math.ceil(totalResults / itemsPerPage) : 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const pageCreators = useMemo(() => {
    if (!totalResults) return [];
    return filteredCreators.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCreators, startIndex, itemsPerPage, totalResults]);

  const ensureProxiedImage = useCallback((rawUrl) => {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    const url = rawUrl.trim();
    if (!url) return '';
    if (
      url.startsWith('/api/proxy/image') ||
      url.startsWith('data:') ||
      url.startsWith('blob:') ||
      url.includes('blob.vercel-storage.com')
    ) {
      return url;
    }
    const normalized = url.startsWith('//') ? `https:${url}` : url;
    return `/api/proxy/image?url=${encodeURIComponent(normalized)}`;
  }, []);

  const renderProfileLink = useCallback(
    (creator) => {
      if (!creator) return '#';
      if (creator.profileUrl) return creator.profileUrl;
      const platform = normalizePlatform(creator.platform || searchData?.platform || 'tiktok');
      return buildProfileLink(creator, platform);
    },
    [searchData?.platform]
  );

  const pageRows = useMemo(() => {
    return pageCreators.map((creator, index) => {
      const base = (creator && typeof creator === 'object' && creator.creator && typeof creator.creator === 'object')
        ? creator.creator
        : creator;

      const platformValue = creator.platform || base?.platform || searchData?.platform || 'tiktok';
      const platform = normalizePlatform(platformValue) || 'tiktok';

      const handleRaw =
        creator.username ||
        base?.username ||
        base?.handle ||
        base?.uniqueId ||
        creator.handle ||
        creator.channelId ||
        base?.channelId ||
        creator.name ||
        base?.name ||
        `creator-${startIndex + index}`;
      const handle = typeof handleRaw === 'string' && handleRaw.trim().length
        ? handleRaw.trim()
        : `creator-${startIndex + index}`;

      const externalRaw =
        creator.id ??
        base?.id ??
        creator.profile_id ??
        creator.profileId ??
        base?.profileId ??
        creator.channelId ??
        base?.channelId ??
        creator.externalId ??
        base?.externalId ??
        handle;
      const externalId = typeof externalRaw === 'string' && externalRaw.trim().length
        ? externalRaw.trim()
        : `${platform}-${handle}`;

      const displayName =
        creator.full_name ||
        creator.fullName ||
        base?.full_name ||
        base?.fullName ||
        creator.name ||
        base?.name ||
        creator.title ||
        null;

      const avatarSource =
        creator.profile_pic_url ||
        base?.profile_pic_url ||
        creator.thumbnail ||
        base?.thumbnail ||
        creator.thumbnailUrl ||
        base?.thumbnailUrl ||
        creator.avatarUrl ||
        base?.avatarUrl ||
        creator.picture ||
        base?.picture ||
        base?.profilePicUrl ||
        creator.profilePicUrl ||
        null;
      const avatarUrl = ensureProxiedImage(avatarSource);
      const previewUrl = ensureProxiedImage(resolvePreviewImage(creator) || avatarSource);

      const followerRaw =
        creator.followers ??
        base?.followers ??
        creator.followers_count ??
        base?.followers_count ??
        creator.followersCount ??
        base?.followersCount ??
        creator.subscriberCount ??
        base?.subscriberCount ??
        creator.subscribers ??
        base?.subscribers ??
        null;
      const followerLabel = formatFollowers(followerRaw);

      const emails = extractEmails(creator);
      const bio = creator.bio || base?.bio || creator.description || creator.about || base?.description || base?.about || null;
      const category = creator.category || base?.category || creator.niche || base?.niche || creator.genre || base?.genre || null;
      const location = creator.location || base?.location || creator.country || base?.country || creator.region || base?.region || null;
      const engagementRate =
        creator.engagementRate ??
        base?.engagementRate ??
        creator.engagement_rate ??
        base?.engagement_rate ??
        null;
      const snapshot = {
        platform,
        externalId,
        handle,
        displayName,
        avatarUrl,
        url: renderProfileLink(creator),
        followers: followerRaw,
        engagementRate,
        category,
        metadata: creator,
      };

      return {
        id: `${platform}-${externalId}`,
        snapshot,
        platform,
        username: handle,
        displayName,
        profileUrl: snapshot.url,
        avatarUrl,
        previewUrl,
        bio,
        emails,
        category,
        location,
        followerLabel,
        followerCount: followerRaw,
        engagementRate,
        initials: resolveInitials(displayName, handle),
      };
    });
  }, [pageCreators, ensureProxiedImage, renderProfileLink, searchData?.platform, startIndex]);

  const pageRowIds = useMemo(() => pageRows.map((row) => row.id), [pageRows]);
  const allSelectedOnPage = pageRowIds.length > 0 && pageRowIds.every((id) => selectedCreators[id]);
  const someSelectedOnPage = pageRowIds.some((id) => selectedCreators[id]);

  const toggleSelection = useCallback((rowId, snapshot) => {
    setSelectedCreators((prev) => {
      const next = { ...prev };
      if (next[rowId]) {
        delete next[rowId];
      } else {
        next[rowId] = snapshot;
      }
      return next;
    });
  }, []);

  const handleSelectPage = useCallback((shouldSelect) => {
    setSelectedCreators((prev) => {
      const next = { ...prev };
      if (shouldSelect) {
        pageRows.forEach(({ id, snapshot }) => {
          next[id] = snapshot;
        });
      } else {
        pageRows.forEach(({ id }) => {
          delete next[id];
        });
      }
      return next;
    });
  }, [pageRows]);

  const clearSelection = useCallback(() => setSelectedCreators({}), []);

  const handleResultsComplete = useCallback((data) => {
    if (data?.status !== 'completed') return;
    const normalized = Array.isArray(data.creators) ? data.creators : [];
    const finalCreators = dedupeCreators(normalized, { platformHint });
    setCreators(finalCreators);
    setIsLoading(false);
    setStillProcessing(false);
  }, [platformHint]);

  const getPageNumbers = useCallback(() => {
    const maxVisiblePages = 5;
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const numbers = [1];
    let startPage = Math.max(currentPage - 1, 2);
    let endPage = Math.min(currentPage + 1, totalPages - 1);

    if (currentPage <= 3) {
      endPage = Math.min(4, totalPages - 1);
    }
    if (currentPage >= totalPages - 2) {
      startPage = Math.max(totalPages - 3, 2);
    }

    if (startPage > 2) numbers.push('...');
    for (let page = startPage; page <= endPage; page += 1) {
      numbers.push(page);
    }
    if (endPage < totalPages - 1) numbers.push('...');

    if (totalPages > 1) numbers.push(totalPages);
    return numbers;
  }, [currentPage, totalPages]);

  const handlePageChange = useCallback(async (newPage) => {
    if (newPage === currentPage || newPage < 1 || newPage > totalPages) return;
    setIsPageLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 150));
    setCurrentPage(newPage);
    setIsPageLoading(false);
  }, [currentPage, totalPages]);

  const selectedSnapshots = useMemo(() => Object.values(selectedCreators), [selectedCreators]);
  const selectionCount = selectedSnapshots.length;

  const handleEmailToggle = useCallback(() => {
    setPreferences((prev) => ({ ...prev, emailOnly: !prev.emailOnly }));
  }, [setPreferences]);

  const handleViewModeChange = useCallback((mode) => {
    setPreferences((prev) => ({ ...prev, viewMode: mode }));
  }, [setPreferences]);

  if (!searchData?.jobId) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6 text-center text-sm text-zinc-400">
        Missing search context. Re-run the similar search to generate a job.
      </div>
    );
  }

  if (isLoading) {
    return (
      <SearchProgress
        jobId={searchData.jobId}
        platform={searchData.platform}
        searchData={searchData}
        onMeta={setEnhancedMeta}
        onProgress={(payload) => {
          setProgressInfo(payload);
          if (payload?.status === 'processing') setStillProcessing(true);
        }}
        onIntermediateResults={(data) => {
          const incoming = Array.isArray(data?.creators) ? data.creators : [];
          if (!incoming.length) return;
          setCreators((prev) => {
            const merged = dedupeCreators([...prev, ...incoming], { platformHint });
            if (merged.length > prev.length) {
              setIsLoading(false);
              setStillProcessing(true);
            }
            return merged;
          });
        }}
        onComplete={handleResultsComplete}
      />
    );
  }

  const hasResults = totalResults > 0;

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          {
            label: campaignName,
            href: searchData?.campaignId ? `/campaigns/${searchData.campaignId}` : '/dashboard',
            type: 'campaign',
          },
          { label: 'Search Results' },
        ]}
        backHref={searchData?.campaignId ? `/campaigns/search?campaignId=${searchData.campaignId}` : '/campaigns/search'}
        backLabel="Back to Search Options"
      />

      {stillProcessing && (
        <div className="hidden" aria-hidden="true">
          <SearchProgress
            jobId={searchData.jobId}
            platform={searchData.platform}
            searchData={searchData}
            onMeta={setEnhancedMeta}
            onProgress={setProgressInfo}
            onComplete={(payload) => {
              if (payload?.status === 'completed') setStillProcessing(false);
            }}
          />
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-zinc-100">Similar Profiles Found</h2>
          <p className="text-sm text-muted-foreground">
            Similar {platformHint === 'tiktok' ? 'TikTok' : platformHint === 'youtube' ? 'YouTube' : 'Instagram'} creators to @{searchData?.targetUsername}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <div className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/60 p-1">
            {VIEW_MODES.map((mode) => {
              const meta = VIEW_MODE_META[mode];
              const Icon = meta?.Icon ?? Table2;
              const isActive = viewMode === mode;
              return (
                <Button
                  key={mode}
                  type="button"
                  variant={isActive ? 'default' : 'ghost'}
                  size="sm"
                  className={cn('gap-2', !isActive && 'text-zinc-400 hover:text-zinc-100')}
                  onClick={() => handleViewModeChange(mode)}
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
            variant={emailOnly ? 'default' : 'outline'}
            size="sm"
            className="gap-2"
            onClick={handleEmailToggle}
            aria-pressed={emailOnly}
          >
            <MailCheck className="h-4 w-4" />
            Email only
          </Button>
          <div className="text-sm text-zinc-400">
            Page {currentPage} of {totalPages} • Showing
            {' '}
            {hasResults ? `${startIndex + 1}-${Math.min(startIndex + itemsPerPage, totalResults)} of ${totalResults}` : '0 of 0'}
          </div>
          {selectionCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-emerald-300">{selectionCount} selected</span>
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
          {stillProcessing && (
            <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
              Processing… live results updating
            </span>
          )}
          {searchData?.jobId && <ExportButton jobId={searchData.jobId} />}
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 relative w-full overflow-hidden">
        {stillProcessing && (
          <div
            className="absolute top-0 left-0 h-[2px] bg-primary transition-all duration-500 z-40"
            style={{ width: `${Math.min(progressInfo?.progress ?? 0, 95)}%` }}
            aria-hidden="true"
          />
        )}
        {isPageLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-900/50">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-zinc-200" />
          </div>
        )}
        {hasResults ? (
          <>
            <div className={cn('w-full overflow-x-auto', viewMode === 'table' ? 'block' : 'hidden')}>
              <SimilarResultsTable
                rows={pageRows}
                selectedCreators={selectedCreators}
                onToggleSelection={toggleSelection}
                onSelectPage={handleSelectPage}
                allSelectedOnPage={allSelectedOnPage}
                someSelectedOnPage={someSelectedOnPage}
              />
            </div>
            <div className={cn('w-full p-4 md:p-6', viewMode === 'gallery' ? 'block' : 'hidden')}>
              <SimilarResultsGallery
                rows={pageRows}
                selectedCreators={selectedCreators}
                onToggleSelection={toggleSelection}
              />
            </div>
          </>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-zinc-400">
            {emailOnly ? (
              <div className="space-y-3">
                <p>No creators with a contact email yet.</p>
                <Button size="sm" variant="outline" onClick={handleEmailToggle}>
                  Show all creators
                </Button>
              </div>
            ) : (
              <p>No similar creators found. Try another platform or target.</p>
            )}
          </div>
        )}
      </div>

      {hasResults && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
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
          <div className="flex items-center gap-1">
            {getPageNumbers().map((pageNum, index) => (
              <React.Fragment key={`${pageNum}-${index}`}>
                {pageNum === '...' ? (
                  <span className="px-2">…</span>
                ) : (
                  <Button
                    variant={currentPage === pageNum ? 'default' : 'outline'}
                    onClick={() => handlePageChange(pageNum)}
                    disabled={isPageLoading}
                    className="h-10 w-10 p-0"
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
            disabled={currentPage === totalPages || isPageLoading}
            className="px-3"
          >
            Next
          </Button>
          <Button
            variant="outline"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages || isPageLoading}
            className="px-3"
          >
            Last
          </Button>
        </div>
      )}
    </div>
  );
}
