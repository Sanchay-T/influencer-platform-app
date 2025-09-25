'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import ExportButton from '../export-button';
import SearchProgress from '../keyword-search/search-progress';
import Breadcrumbs from "../../breadcrumbs";
import { Checkbox } from "@/components/ui/checkbox";
import { AddToListButton } from "@/components/lists/add-to-list-button";
import { cn } from "@/lib/utils";
import { dedupeCreators } from "../utils/dedupe-creators";

export default function SimilarSearchResults({ searchData }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [creators, setCreators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [campaignName, setCampaignName] = useState('Campaign');
  const [stillProcessing, setStillProcessing] = useState(false);
  const [progressInfo, setProgressInfo] = useState(null);
  const [enhancedMeta, setEnhancedMeta] = useState(null);
  const [selectedCreators, setSelectedCreators] = useState({});
  const itemsPerPage = 10;
  const platformHint = (searchData?.platform || '').toString().toLowerCase();

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
        console.error('Error fetching campaign name:', error);
        // Keep fallback name 'Campaign'
      }
    };

    fetchCampaignName();
  }, [searchData?.campaignId]);

  useEffect(() => {
    setSelectedCreators({});
  }, [searchData?.jobId]);

  const selectedSnapshots = useMemo(() => Object.values(selectedCreators), [selectedCreators]);
  const selectionCount = selectedSnapshots.length;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const renderProfileLink = useCallback((creator) => {
    if (creator.profileUrl) {
      return creator.profileUrl;
    }

    const platform = creator.platform || searchData.platform || 'Instagram';
    if (platform === 'TikTok' || platform === 'tiktok') {
      return `https://www.tiktok.com/@${creator.username}`;
    }
    if (platform === 'YouTube' || platform === 'youtube') {
      return `https://www.youtube.com/${creator.handle || `@${creator.username}`}`;
    }
    return `https://instagram.com/${creator.username}`;
  }, [searchData.platform]);

  const currentRows = useMemo(() => {
    return creators.slice(startIndex, endIndex).map((creator, index) => {
      const platformValue = creator.platform || searchData.platform || 'instagram';
      const platform = typeof platformValue === 'string' ? platformValue : String(platformValue);

      const handleRaw =
        creator.username ||
        creator.handle ||
        creator.name ||
        creator.channelId ||
        `creator-${startIndex + index}`;
      const handleValue = typeof handleRaw === 'string' ? handleRaw : String(handleRaw ?? `creator-${startIndex + index}`);
      const handle = handleValue.trim().length ? handleValue : `creator-${startIndex + index}`;

      const externalRaw =
        creator.id ??
        creator.profile_id ??
        creator.profileId ??
        creator.channelId ??
        creator.externalId ??
        handle ??
        `creator-${startIndex + index}`;
      const externalId = typeof externalRaw === 'string' ? externalRaw : String(externalRaw ?? `creator-${startIndex + index}`);

      const snapshot = {
        platform,
        externalId,
        handle,
        displayName: creator.full_name || creator.name || null,
        avatarUrl: creator.profile_pic_url || creator.thumbnail || creator.avatarUrl || null,
        url: renderProfileLink(creator),
        followers:
          creator.followers ||
          creator.followers_count ||
          creator.followersCount ||
          creator.subscriberCount ||
          null,
        engagementRate: creator.engagementRate || creator.engagement_rate || null,
        category: creator.category || creator.niche || null,
        metadata: creator,
      };

      return {
        id: `${platform}-${externalId}`,
        snapshot,
        raw: creator,
      };
    });
  }, [creators, startIndex, endIndex, searchData.platform, renderProfileLink]);

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

  // Validación básica
  if (!searchData?.jobId) return null;

  const handleResultsComplete = (data) => {
    console.log('🔄 [RESULTS-HANDOFF] handleResultsComplete called with:', {
      status: data.status,
      hasCreators: !!data.creators,
      creatorsLength: data.creators?.length || 0,
      dataKeys: Object.keys(data),
      fullData: data
    });

    if (data.status === 'completed') {
      console.log('✅ [RESULTS-HANDOFF] Setting final creators:', {
        creatorsReceived: data.creators?.length || 0,
        firstCreator: data.creators?.[0]
      });
      const finalCreators = dedupeCreators(Array.isArray(data.creators) ? data.creators : [], {
        platformHint,
      });
      setCreators(finalCreators);
      setIsLoading(false);
      setStillProcessing(false);
    } else {
      console.log('⚠️ [RESULTS-HANDOFF] Received non-completed status:', data.status);
    }
  };

  const getImageUrl = (originalUrl) => {
    if (!originalUrl) {
      console.log('🖼️ [BROWSER-IMAGE] No image URL provided');
      return '';
    }
    
    // 🔧 FIXED: Handle already-proxied URLs and blob URLs
    const isBlobUrl = originalUrl.includes('blob.vercel-storage.com');
    const isAlreadyProxied = originalUrl.startsWith('/api/proxy/image');
    
    if (isBlobUrl) {
      console.log('🖼️ [BROWSER-IMAGE] Using cached blob URL directly:', originalUrl);
      return originalUrl;
    }
    
    if (isAlreadyProxied) {
      console.log('🖼️ [BROWSER-IMAGE] Using already-proxied URL directly:', originalUrl);
      return originalUrl;
    }
    
    // Only proxy raw URLs that haven't been processed yet
    const proxiedUrl = `/api/proxy/image?url=${encodeURIComponent(originalUrl)}`;
    console.log('🖼️ [BROWSER-IMAGE] Proxying raw URL:');
    console.log('  📍 Original:', originalUrl);
    console.log('  🔗 Proxied:', proxiedUrl);
    return proxiedUrl;
  };

  // Enhanced image loading handlers with comprehensive logging
  const handleImageLoad = (e, username) => {
    const img = e.target;
    console.log('✅ [BROWSER-IMAGE] Image loaded successfully for', username);
    console.log('  📏 Natural size:', img.naturalWidth + 'x' + img.naturalHeight);
    console.log('  📐 Display size:', img.width + 'x' + img.height);
    console.log('  🔗 Loaded URL:', img.src);
    console.log('  ⏱️ Load time: ~' + (Date.now() - parseInt(img.dataset.startTime || '0')) + 'ms');
  };

  const handleImageError = (e, username, originalUrl) => {
    const img = e.target;
    console.error('❌ [BROWSER-IMAGE] Image failed to load for', username);
    console.error('  🔗 Failed URL:', img.src);
    console.error('  📍 Original URL:', originalUrl);
    console.error('  ⏱️ Time to failure:', (Date.now() - parseInt(img.dataset.startTime || '0')) + 'ms');
    console.error('  📊 Image element:', img);
    
    // Hide broken image
    img.style.display = 'none';
  };

  const handleImageStart = (e, username) => {
    const img = e.target;
    img.dataset.startTime = Date.now().toString();
    console.log('🚀 [BROWSER-IMAGE] Starting image load for', username);
    console.log('  🔗 Loading URL:', img.src);
    console.log('  🕐 Start time:', new Date().toISOString());
  };

  // If still loading, show enhanced progress component
  if (isLoading) {
    console.log('🔄 [SEARCH-RESULTS] Still loading, showing SearchProgress component for jobId:', searchData.jobId);
    return <SearchProgress 
      jobId={searchData.jobId}
      platform={searchData.platform}
      searchData={searchData}
      onMeta={setEnhancedMeta}
      onProgress={(p) => {
        setProgressInfo(p);
        if (p?.status === 'processing') setStillProcessing(true);
      }}
      onIntermediateResults={(data) => {
        try {
          const incoming = Array.isArray(data?.creators) ? data.creators : [];
          if (incoming.length === 0) return;
          setCreators((prev) => {
            const merged = dedupeCreators([...prev, ...incoming], { platformHint });
            if (merged.length > prev.length) {
              setIsLoading(false);
              setStillProcessing(true);
            }
            return merged;
          });
        } catch (e) {
          console.error('Error handling intermediate results (similar):', e);
        }
      }}
      onComplete={handleResultsComplete} 
    />;
  }

  // If no creators found
  if (!creators || creators.length === 0) {
    console.log('❌ [SEARCH-RESULTS] No creators to display:', {
      creators,
      creatorsLength: creators?.length,
      isLoading,
      searchDataJobId: searchData?.jobId
    });
    return (
      <div className="text-center py-8">
        <div className="text-zinc-400">
          <p className="text-lg font-medium">No similar creators found</p>
          <p className="text-sm mt-2">Try searching for a different username or platform.</p>
        </div>
      </div>
    );
  }

  // Calcular el total de páginas
  const totalPages = Math.ceil(creators.length / itemsPerPage);

  const handlePageChange = async (newPage) => {
    if (newPage === currentPage) return;
    setIsPageLoading(true);
    // Simular un pequeño delay para mostrar el loading
    await new Promise(resolve => setTimeout(resolve, 300));
    setCurrentPage(newPage);
    setIsPageLoading(false);
  };

  const getPageNumbers = () => {
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
    if (startPage > 2) pageNumbers.push('...');
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
    if (endPage < totalPages - 1) pageNumbers.push('...');

    // Siempre mostrar la última página
    if (totalPages > 1) pageNumbers.push(totalPages);

    return pageNumbers;
  };


  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          {
            label: campaignName,
            href: searchData?.campaignId ? `/campaigns/${searchData.campaignId}` : '/dashboard',
            type: 'campaign'
          },
          { label: 'Search Results' }
        ]}
        backHref={searchData?.campaignId ? `/campaigns/search?campaignId=${searchData.campaignId}` : '/campaigns/search'}
        backLabel="Back to Search Options"
      />

      {/* Silent poller to keep progress flowing while table renders */}
      {stillProcessing && (
        <div className="hidden" aria-hidden="true">
          <SearchProgress 
            jobId={searchData.jobId}
            platform={searchData.platform}
            searchData={searchData}
            onMeta={setEnhancedMeta}
            onProgress={setProgressInfo}
            onComplete={(data) => {
              if (data?.status === 'completed') setStillProcessing(false);
            }}
          />
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Similar Profiles Found</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Similar {
              searchData.platform === 'tiktok' ? 'TikTok' : 
              searchData.platform === 'youtube' ? 'YouTube' : 
              'Instagram'
            } creators to @{searchData.targetUsername}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} • Showing {startIndex + 1}-{Math.min(endIndex, creators.length)} of {creators.length}
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
          {searchData?.jobId && <ExportButton jobId={searchData.jobId} />}
        </div>
      </div>

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
              <span className="inline-flex items-center">
                <svg className="h-3.5 w-3.5 animate-spin text-pink-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
              </span>
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
        <div className="w-full overflow-x-auto">
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
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider w-[50px]">
                Profile
              </TableHead>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider w-[15%] min-w-[120px]">
                {searchData.platform === 'youtube' ? 'Channel Name' : 'Username'}
              </TableHead>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider w-[15%] min-w-[100px]">
                Full Name
              </TableHead>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider w-[25%] min-w-[200px]">
                Bio
              </TableHead>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider w-[20%] min-w-[150px]">
                Email
              </TableHead>
              {searchData.platform !== 'youtube' && (
                <>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider w-[7%] min-w-[60px]">
                    Private
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider w-[7%] min-w-[60px]">
                    Verified
                  </TableHead>
                </>
              )}
              <TableHead className="px-6 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider w-[80px]">
                Save
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-zinc-800">
            {currentRows.map(({ raw: creator, id: rowId, snapshot }) => {
              const imageUrl = getImageUrl(
                creator.profile_pic_url || creator.thumbnail || ''
              );
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
                        alt={creator.username || creator.name}
                        onLoad={(e) => handleImageLoad(e, creator.username || creator.name)}
                        onError={(e) => handleImageError(e, creator.username || creator.name, creator.profile_pic_url || creator.thumbnail)}
                        onLoadStart={(e) => handleImageStart(e, creator.username || creator.name)}
                        style={{ 
                          maxWidth: '100%', 
                          height: 'auto',
                          backgroundColor: '#f3f4f6' // Light gray background while loading
                        }}
                      />
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <a 
                      href={renderProfileLink(creator)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pink-400 hover:text-pink-300 hover:underline font-medium transition-colors duration-200 flex items-center gap-1"
                      title={`View ${creator.username || creator.name}'s profile on ${creator.platform || searchData.platform || 'Instagram'}`}
                    >
                      {searchData.platform === 'youtube' ? creator.name : `@${creator.username}`}
                      <svg className="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <span className="text-sm text-zinc-300">
                      {creator.full_name || creator.name || 'N/A'}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-4 max-w-0">
                    <div className="truncate" title={creator.bio || 'No bio available'}>
                      {creator.bio && creator.bio.length > 0 ? (
                        <span className="text-sm text-zinc-300">{creator.bio}</span>
                      ) : (
                        <span className="text-zinc-500 text-sm">Not available</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 max-w-0">
                    {creator.emails && creator.emails.length > 0 ? (
                      <div className="space-y-1">
                        {creator.emails.map((email, emailIndex) => (
                          <div key={emailIndex} className="flex items-center gap-1">
                            <a 
                              href={`mailto:${email}`}
                              className="text-pink-400 hover:underline text-sm truncate block"
                              title={`Send email to ${email}`}
                            >
                              {email}
                            </a>
                            <svg className="w-3 h-3 opacity-60 text-pink-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-500 text-sm">Not available</span>
                    )}
                  </TableCell>
                  {searchData.platform !== 'youtube' && (
                    <>
                      <TableCell className="px-6 py-4">{creator.is_private ? "Yes" : "No"}</TableCell>
                      <TableCell className="px-6 py-4">{creator.is_verified ? "Yes" : "No"}</TableCell>
                    </>
                  )}
                  <TableCell className="px-6 py-4 text-right">
                    <AddToListButton
                      creators={[snapshot]}
                      buttonLabel=""
                      variant="ghost"
                      size="icon"
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
              {pageNum === '...' ? (
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
    </div>
  );
}
