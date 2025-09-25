"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, User, Loader2, LayoutGrid, Table2, MailCheck, Youtube } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import ExportButton from "../export-button";
import { cn } from "@/lib/utils";
import { FeatureGate } from "@/app/components/billing/protect";
import { Checkbox } from "@/components/ui/checkbox";
import { AddToListButton } from "@/components/lists/add-to-list-button";
import { dedupeCreators } from "../utils/dedupe-creators";
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

const VIEW_MODES = ["table", "gallery"];
const VIEW_MODE_META = {
  table: { label: "Table", Icon: Table2 },
  gallery: { label: "Gallery", Icon: LayoutGrid },
};

const hasContactEmail = (creator) => {
  if (!creator) return false;

  const emailArrays = [
    creator?.creator?.emails,
    creator?.emails,
    creator?.contact?.emails,
  ].filter((value) => Array.isArray(value));

  for (const list of emailArrays) {
    if (list.some((email) => typeof email === "string" && email.trim().length > 0)) {
      return true;
    }
  }

  const emailCandidates = [
    creator?.creator?.email,
    creator?.email,
    creator?.contact?.email,
  ];

  return emailCandidates.some((email) => typeof email === "string" && email.trim().length > 0);
};

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

  return Array.from(collected);
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

const resolveMediaPreview = (creator, snapshot, platformHint) => {
  if (!creator) return snapshot?.avatarUrl ?? null;

  const video = creator.video || creator.latestVideo || creator.content;
  const platform = (platformHint || snapshot?.platform || '').toString().toLowerCase();

  const videoFirstSources = [
    video?.thumbnail,
    video?.thumbnailUrl,
    video?.thumbnail_url,
    video?.cover,
    video?.coverUrl,
    video?.image,
    video?.previewImage,
    creator?.thumbnailUrl,
    creator?.thumbnail,
    creator?.previewImage,
    snapshot?.avatarUrl
  ];

  const defaultSources = [
    video?.cover,
    video?.coverUrl,
    video?.thumbnail,
    video?.thumbnailUrl,
    video?.thumbnail_url,
    video?.image,
    creator?.thumbnailUrl,
    creator?.thumbnail,
    creator?.previewImage,
    snapshot?.avatarUrl,
  ];

  const sources = platform === 'youtube' ? videoFirstSources : defaultSources;

  for (const source of sources) {
    if (typeof source === "string" && source.trim().length > 0) {
      return source;
    }
  }

  return snapshot?.avatarUrl ?? null;
};

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

const SearchResults = ({ searchData }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const initialCreators = useMemo(() => {
    if (Array.isArray(searchData?.initialCreators)) return searchData.initialCreators;
    if (Array.isArray(searchData?.creators)) return searchData.creators;
    return [];
  }, [searchData?.initialCreators, searchData?.creators]);

  const [creators, setCreators] = useState(initialCreators);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [campaignName, setCampaignName] = useState("Campaign");
  const [stillProcessing, setStillProcessing] = useState(false);
  const [enhancedMeta, setEnhancedMeta] = useState(null);
  const [progressInfo, setProgressInfo] = useState(null);
  const [selectedCreators, setSelectedCreators] = useState({});
  const [viewMode, setViewMode] = useState("table");
  const [showEmailOnly, setShowEmailOnly] = useState(false);
  const itemsPerPage = viewMode === "gallery" ? 9 : 10;
  const resultsCacheRef = useRef(new Map());

  const jobStatusRaw = searchData?.status;
  const jobStatus = typeof jobStatusRaw === 'string' ? jobStatusRaw.toLowerCase() : '';
  const jobIsActive = jobStatus === 'processing' || jobStatus === 'pending';

  // Normalize platform from either selectedPlatform (wizard) or platform (reopen flow)
  const platformNormalized = (searchData?.selectedPlatform || searchData?.platform || 'tiktok').toString().toLowerCase();

  useEffect(() => {
    setSelectedCreators({});
  }, [searchData?.jobId]);

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
    setEnhancedMeta(null);

    const cached = resultsCacheRef.current.get(cacheKey);
    if (cached && cached.length) {
      setCreators(cached);
      setIsLoading(false);
      setIsFetching(true);
    } else if (initialCreators.length) {
      setCreators(dedupeCreators(initialCreators, { platformHint: platformNormalized }));
      setIsLoading(false);
      setIsFetching(true);
    } else {
      setCreators([]);
      setIsLoading(true);
      setIsFetching(true);
    }
  }, [searchData?.jobId]);

  // Track processing flag separately so we don't reset pagination on progress updates
  useEffect(() => {
    setStillProcessing(jobIsActive);
  }, [jobIsActive]);

  useEffect(() => {
    setCurrentPage(1);
  }, [showEmailOnly, viewMode]);

  const selectedSnapshots = useMemo(() => Object.values(selectedCreators), [selectedCreators]);
  const selectionCount = selectedSnapshots.length;

  const [emailOverlayDismissed, setEmailOverlayDismissed] = useState(false);

  useEffect(() => {
    if (searchData?.jobId && creators.length) {
      resultsCacheRef.current.set(searchData.jobId, creators);
    }
  }, [creators, searchData?.jobId]);

  const filteredCreators = useMemo(() => {
    if (!showEmailOnly) return creators;
    return creators.filter((creator) => hasContactEmail(creator));
  }, [creators, showEmailOnly]);

  const waitingForResults = (jobIsActive || stillProcessing || isFetching || isLoading) && creators.length === 0;
  const shouldPoll = Boolean(searchData?.jobId) && (jobIsActive || stillProcessing || isFetching || isLoading);

  const showFilteredEmpty = useMemo(
    () => showEmailOnly && creators.length > 0 && filteredCreators.length === 0,
    [showEmailOnly, creators.length, filteredCreators.length]
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
        setIsFetching(true);
        // Determine API endpoint based on platform
        let apiEndpoint = '/api/scraping/tiktok';
        if (platformNormalized === 'instagram') apiEndpoint = '/api/scraping/instagram-reels';
        else if (platformNormalized === 'enhanced-instagram') apiEndpoint = '/api/scraping/instagram-enhanced';
        else if (platformNormalized === 'youtube') apiEndpoint = '/api/scraping/youtube';

        const response = await fetch(`${apiEndpoint}?jobId=${searchData.jobId}` , { credentials: 'include' });
        const data = await response.json();

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
  }, [searchData, searchData?.jobId, searchData?.selectedPlatform, searchData?.platform, searchData?.platforms, platformNormalized, jobIsActive]);

  // Fetch campaign name for breadcrumbs
  useEffect(() => {
    const fetchCampaignName = async () => {
      if (!searchData?.campaignId) return;

      try {
        const response = await fetch(`/api/campaigns/${searchData.campaignId}`);
        const data = await response.json();

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

  const renderProfileLink = useCallback((creator) => {
    const platform = platformNormalized;

    if (platform === "tiktok") {
      const ttUsername = creator?.creator?.uniqueId || creator?.creator?.username;
      if (ttUsername) {
        return `https://www.tiktok.com/@${ttUsername}`;
      }

      if (creator.video?.url) {
        const match = creator.video.url.match(/@([^\/]+)/);
        if (match) {
          return `https://www.tiktok.com/@${match[1]}`;
        }
      }

      const creatorName = creator.creator?.name;
      if (creatorName && !creatorName.includes(" ")) {
        return `https://www.tiktok.com/@${creatorName}`;
      }

      if (creatorName) {
        const cleanUsername = creatorName.replace(/\s+/g, "").toLowerCase();
        return `https://www.tiktok.com/@${cleanUsername}`;
      }
    } else if (
      platform === "Instagram" ||
      platform === "instagram" ||
      platform === "enhanced-instagram"
    ) {
      const igUsername =
        creator?.creator?.uniqueId || creator?.creator?.username || creator?.ownerUsername;
      if (igUsername) {
        return `https://www.instagram.com/${igUsername}`;
      }
      const creatorName = creator?.creator?.name;
      if (creatorName) {
        const cleanUsername = creatorName
          .replace(/\s+/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9._]/g, "");
        return `https://www.instagram.com/${cleanUsername}`;
      }
    } else if (platform === "YouTube" || platform === "youtube") {
      if (creator.video?.url) {
        if (
          creator.video.url.includes("/channel/") ||
          creator.video.url.includes("/c/") ||
          creator.video.url.includes("/@")
        ) {
          const channelMatch = creator.video.url.match(/\/(channel\/[^\/]+|c\/[^\/]+|@[^\/]+)/);
          if (channelMatch) {
            return `https://www.youtube.com/${channelMatch[1]}`;
          }
        }

        return creator.video.url;
      }
    }

    return "#";
  }, [platformNormalized]);

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
    if (data && data.status === "completed") {
      // Use creators directly from data.creators (already processed with bio/email)
        const allCreators = dedupeCreators(data.creators || [], { platformHint: platformNormalized });
        if (allCreators.length > 0) {
          setCreators(allCreators);
          setIsLoading(false);
          setStillProcessing(false);
          setIsFetching(false);
          if (searchData?.jobId) {
            resultsCacheRef.current.set(searchData.jobId, allCreators);
          }
        } else {
          // As a fallback, re-fetch latest results from the corresponding endpoint
          let apiEndpoint = '/api/scraping/tiktok';
          if (platformNormalized === 'instagram') apiEndpoint = '/api/scraping/instagram-reels';
        else if (platformNormalized === 'enhanced-instagram') apiEndpoint = '/api/scraping/instagram-enhanced';
        else if (platformNormalized === 'youtube') apiEndpoint = '/api/scraping/youtube';

        fetch(`${apiEndpoint}?jobId=${searchData.jobId}`, { credentials: 'include' })
          .then((response) => response.json())
          .then((result) => {
            const foundCreators =
              result.results?.reduce((acc, res) => {
                return [...acc, ...(res.creators || [])];
              }, []) || [];
            const deduped = dedupeCreators(foundCreators, { platformHint: platformNormalized });
            setCreators(deduped);
            if (deduped.length) {
              setIsLoading(false);
            }
            setStillProcessing(false);
            setIsFetching(false);
            if (searchData?.jobId && deduped.length) {
              resultsCacheRef.current.set(searchData.jobId, deduped);
            }
          })
          .catch(() => {
            setIsLoading(false);
            setStillProcessing(false);
            setIsFetching(false);
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
                onMeta={setEnhancedMeta}
                onProgress={setProgressInfo}
                onIntermediateResults={(data) => {
                  try {
                    const incoming = Array.isArray(data?.creators) ? data.creators : [];
                    if (incoming.length === 0) return;
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
            <Loader2 className="h-4 w-4 animate-spin text-pink-400" />
            Waiting for results...
          </div>
        </>
      );
    }

    if (isFetching) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[240px] text-sm text-zinc-400 gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-zinc-300" />
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
          {platformNormalized === "enhanced-instagram" && (
            <Badge variant="secondary" className="bg-gradient-to-r from-violet-500/20 to-pink-500/20 text-violet-300 border-violet-500/30">
              AI-Enhanced
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
          </div>
        <div className="text-sm text-zinc-400 order-3 md:order-none">
          Page {currentPage} of {totalPages} •
          Showing {(currentPage - 1) * itemsPerPage + 1}-
          {Math.min(currentPage * itemsPerPage, totalResults)} of{" "}
          {totalResults}
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
            <h3 className="text-lg font-semibold text-zinc-100">No creators with a contact email</h3>
            <p className="text-sm text-zinc-400">
              We didn’t find any creators in this list with a visible email. You can disable the filter to review all results or keep the filter and try another search.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button size="sm" className="bg-emerald-500 text-emerald-950" onClick={() => setShowEmailOnly(false)}>
                Show all creators
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEmailOverlayDismissed(true)}
                className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
              >
                Keep email filter
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
            onMeta={setEnhancedMeta}
            onProgress={setProgressInfo}
            onIntermediateResults={(data) => {
              try {
                const incoming = Array.isArray(data?.creators) ? data.creators : [];
                if (incoming.length === 0) return;

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
              <Loader2 className="h-3.5 w-3.5 animate-spin text-pink-400" />
              <span>
                Processing{progressInfo?.processedResults != null && progressInfo?.targetResults != null
                  ? ` ${progressInfo.processedResults}/${progressInfo.targetResults}`
                  : ''}
              </span>
                  {platformNormalized === 'enhanced-instagram' && enhancedMeta?.execution?.maxConcurrency && (
                    <span className="text-zinc-500">• Parallel ×{enhancedMeta.execution.maxConcurrency}</span>
                  )}
                </div>
          </div>
        )}
        {isPageLoading && (
          <div className="absolute inset-0 bg-zinc-900/50 flex items-center justify-center z-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-200"></div>
          </div>
        )}

        <div className={cn("w-full", viewMode === "table" ? "overflow-x-auto" : "hidden")}> 
          <Table className="w-full">
            <TableHeader>
              <TableRow className="border-b border-zinc-800">
                <TableHead className="px-4 py-3 w-12">
                  <Checkbox
                    aria-label="Select page"
                    checked={allSelectedOnPage ? true : someSelectedOnPage ? 'indeterminate' : false}
                    onCheckedChange={() => handleSelectPage(!allSelectedOnPage)}
                  />
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[56px]">
                  Profile
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[160px]">
                  Username
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[120px]">
                  Followers
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[220px]">
                  Bio
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[200px]">
                  Email
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[220px]">
                  Video Title
                </TableHead>
                <TableHead className="px-6 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider w-[10%] min-w-[80px]">
                  Views
                </TableHead>
                <TableHead className="px-6 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider w-[60px]">
                  Link
                </TableHead>
                <TableHead className="px-6 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider w-[80px]">
                  Save
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-zinc-800">
                {currentRows.map(({ raw: creator, id: rowId, snapshot }, index) => {
                const avatarUrl =
                  creator.creator?.avatarUrl ||
                  creator.creator?.profile_pic_url ||
                  creator.creator?.profilePicUrl ||
                  creator.profile_pic_url ||
                  creator.profilePicUrl ||
                  "";
                const imageUrl = ensureImageUrl(avatarUrl);
                const isSelected = !!selectedCreators[rowId];

                return (
                  <TableRow
                    key={rowId}
                    className={cn(
                      "table-row transition-colors",
                      isSelected ? "bg-emerald-500/5" : undefined
                    )}
                  >
                    <TableCell className="px-4 py-4 w-12 align-middle">
                      <div className="flex h-full items-center justify-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelection(rowId, snapshot)}
                          aria-label={`Select ${snapshot.handle}`}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <Avatar className="w-10 h-10">
                        <AvatarImage
                          src={imageUrl}
                          alt={creator.creator?.name}
                          onLoad={(e) =>
                            handleImageLoad(e, creator.creator?.name)
                          }
                          onError={(e) =>
                            handleImageError(
                              e,
                              creator.creator?.name,
                              creator.creator?.profilePicUrl ||
                                creator.creator?.avatarUrl,
                            )
                          }
                          onLoadStart={(e) =>
                            handleImageStart(e, creator.creator?.name)
                          }
                          style={{
                            maxWidth: "100%",
                            height: "auto",
                            backgroundColor: "#f3f4f6", // Light gray background while loading
                          }}
                        />
                        <AvatarFallback>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {creator.creator?.name &&
                      creator.creator.name !== "N/A" ? (
                        <a
                          href={renderProfileLink(creator)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-pink-400 hover:text-pink-300 hover:underline font-medium transition-colors duration-200 flex items-center gap-1"
                          title={`View ${creator.creator.name}'s profile on ${
                            platformNormalized === 'enhanced-instagram' ? 'Instagram' :
                            platformNormalized === 'instagram' ? 'Instagram' :
                            platformNormalized === 'youtube' ? 'YouTube' : 'TikTok'
                          }`}
                        >
                          {creator.creator.name}
                          <svg
                            className="w-3 h-3 opacity-70"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      ) : (
                        <span className="text-zinc-500">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {snapshot.followers != null ? (
                        <span className="text-sm text-zinc-200">
                          {formatFollowers(snapshot.followers)}
                        </span>
                      ) : (
                        <span className="text-zinc-500 text-sm">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4 max-w-0">
                      <div
                        className="truncate"
                        title={creator.creator?.bio || "No bio available"}
                      >
                        {creator.creator?.bio ? (
                          <span className="text-sm text-zinc-300">
                            {creator.creator.bio}
                          </span>
                        ) : (
                          <span className="text-zinc-500 text-sm">No bio</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 max-w-0">
                      {creator.creator?.emails &&
                      creator.creator.emails.length > 0 ? (
                        <div className="space-y-1">
                          {creator.creator.emails.map((email, emailIndex) => (
                            <div
                              key={emailIndex}
                              className="flex items-center gap-1"
                            >
                              <a
                                href={`mailto:${email}`}
                              className="text-pink-400 hover:underline text-sm truncate block"
                                title={`Send email to ${email}`}
                              >
                                {email}
                              </a>
                              <svg
                                className="w-3 h-3 opacity-60 text-pink-400"
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
                      ) : (
                        <span className="text-zinc-500 text-sm">No email</span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4 max-w-0">
                      <div
                        className="truncate"
                        title={creator.video?.description || "No title"}
                      >
                        {creator.video?.description || "No title"}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right tabular-nums">
                      {(creator.video?.statistics?.views || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-center">
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
                    <TableCell className="px-6 py-4 text-right">
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
                    <div className="mt-auto flex items-center justify-between pt-2">
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
                      <AddToListButton
                        creator={snapshot}
                        buttonLabel="Save"
                        variant="secondary"
                        size="sm"
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

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
    </div>
  );
};

export default SearchResults;
