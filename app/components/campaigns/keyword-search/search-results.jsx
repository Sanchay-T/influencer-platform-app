'use client'

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ExternalLink, User, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import ExportButton from '../export-button';
import { cn } from "@/lib/utils";
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

const SearchResults = ({ searchData }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [creators, setCreators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const itemsPerPage = 10;

  // Validación básica
  if (!searchData?.jobId) return null;

  useEffect(() => {
    const fetchResults = async () => {
      try {
        // Determine API endpoint based on platform
        console.log('🔍 [API-ENDPOINT] Platform detection:', {
          selectedPlatform: searchData.selectedPlatform,
          selectedPlatformType: typeof searchData.selectedPlatform,
          platforms: searchData.platforms,
          searchData: searchData
        });
        
        const apiEndpoint = searchData.selectedPlatform === 'Instagram' ? 
          '/api/scraping/instagram-hashtag' :
          searchData.selectedPlatform === 'YouTube' ? 
          '/api/scraping/youtube' : 
          '/api/scraping/tiktok';
          
        console.log('🌐 [API-ENDPOINT] Using endpoint:', apiEndpoint);
        
        const response = await fetch(`${apiEndpoint}?jobId=${searchData.jobId}`);
        const data = await response.json();

        if (data.error) {
          console.error('Error fetching results:', data.error);
          return;
        }

        // Combinar todos los creadores de todos los resultados
        const allCreators = data.results?.reduce((acc, result) => {
          return [...acc, ...(result.creators || [])];
        }, []) || [];

        // Debug logs removed - data flow working correctly

        if (allCreators.length > 0) {
          setCreators(allCreators);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching results:', error);
      }
    };

    fetchResults();
  }, [searchData.jobId]);

  if (isLoading) {
    return (
      <SearchProgress 
        jobId={searchData.jobId}
        platform={searchData.selectedPlatform}
        onComplete={(data) => {
          if (data && data.status === 'completed') {
            // Combinar todos los creadores de todos los resultados
            const allCreators = data.results?.reduce((acc, result) => {
              return [...acc, ...(result.creators || [])];
            }, []) || [];
            
            if (allCreators.length > 0) {
              setCreators(allCreators);
              setIsLoading(false);
            } else {
              // Si no hay creadores, intentar una última vez
              // Enhanced API endpoint selection with logging
              let apiEndpoint;
              if (searchData.selectedPlatform === 'youtube') {
                apiEndpoint = '/api/scraping/youtube';
              } else if (searchData.selectedPlatform === 'instagram') {
                apiEndpoint = '/api/scraping/instagram-hashtag';
              } else {
                apiEndpoint = '/api/scraping/tiktok';
              }
              
              console.log('🔍 [SEARCH-RESULTS] Final status check:', {
                platform: searchData.selectedPlatform,
                apiEndpoint: apiEndpoint,
                jobId: searchData.jobId,
                status: status
              });
              
              fetch(`${apiEndpoint}?jobId=${searchData.jobId}`)
                .then(response => response.json())
                .then(result => {
                  const foundCreators = result.results?.reduce((acc, res) => {
                    return [...acc, ...(res.creators || [])];
                  }, []) || [];
                  setCreators(foundCreators);
                  setIsLoading(false);
                })
                .catch(err => {
                  console.error('Error in final fetch:', err);
                  setIsLoading(false);
                });
            }
          }
        }} 
      />
    );
  }


  if (!creators.length) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center text-gray-500">
          <p>No creators found matching your criteria</p>
          <p className="text-sm mt-2">Try adjusting your search keywords</p>
        </div>
      </div>
    );
  }

  const currentCreators = creators.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = async (newPage) => {
    if (newPage === currentPage) return;
    setIsPageLoading(true);
    // Simular un pequeño delay para mostrar el loading
    await new Promise(resolve => setTimeout(resolve, 300));
    setCurrentPage(newPage);
    setIsPageLoading(false);
  };

  const getPageNumbers = () => {
    const totalPages = Math.ceil(creators.length / itemsPerPage);
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


  // Format duration from seconds to MM:SS or HH:MM:SS
  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return 'N/A';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
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

  const renderProfileLink = (creator) => {
    // Check platform from searchData
    const platform = searchData.selectedPlatform || 'TikTok';
    
    console.log('🔗 [PROFILE-LINK] Generating profile link for:', {
      platform,
      creatorName: creator.creator?.name,
      videoUrl: creator.video?.url
    });
    
    if (platform === 'TikTok' || platform === 'tiktok') {
      // Try to extract username from video URL first (most reliable)
      if (creator.video?.url) {
        const match = creator.video.url.match(/@([^\/]+)/);
        if (match) {
          const profileUrl = `https://www.tiktok.com/@${match[1]}`;
          console.log('🎯 [PROFILE-LINK] Extracted from video URL:', profileUrl);
          return profileUrl;
        }
      }
      
      // Fallback: use creator name if it looks like a username (no spaces)
      const creatorName = creator.creator?.name;
      if (creatorName && !creatorName.includes(' ')) {
        const profileUrl = `https://www.tiktok.com/@${creatorName}`;
        console.log('🎯 [PROFILE-LINK] Using creator name as username:', profileUrl);
        return profileUrl;
      }
      
      // Last fallback: construct from creator name by removing spaces
      if (creatorName) {
        const cleanUsername = creatorName.replace(/\s+/g, '').toLowerCase();
        const profileUrl = `https://www.tiktok.com/@${cleanUsername}`;
        console.log('🎯 [PROFILE-LINK] Cleaned creator name:', profileUrl);
        return profileUrl;
      }
    } else if (platform === 'YouTube' || platform === 'youtube') {
      // For YouTube, try to extract channel from video URL
      if (creator.video?.url) {
        // YouTube video URLs contain channel info, try to construct channel URL
        // Check if it's a channel URL pattern or just link to video
        if (creator.video.url.includes('/channel/') || creator.video.url.includes('/c/') || creator.video.url.includes('/@')) {
          const channelMatch = creator.video.url.match(/\/(channel\/[^\/]+|c\/[^\/]+|@[^\/]+)/);
          if (channelMatch) {
            const channelUrl = `https://www.youtube.com/${channelMatch[1]}`;
            console.log('🎯 [PROFILE-LINK] YouTube channel URL:', channelUrl);
            return channelUrl;
          }
        }
        
        // Fallback: link to the video
        console.log('🎯 [PROFILE-LINK] YouTube video URL fallback:', creator.video.url);
        return creator.video.url;
      }
    }
    
    console.log('⚠️ [PROFILE-LINK] No valid profile link found, returning #');
    return '#';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Results Found</h2>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {Math.ceil(creators.length / itemsPerPage)} • Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, creators.length)} of {creators.length}
          </div>
          {(searchData?.campaignId || searchData?.jobId) && <ExportButton campaignId={searchData.campaignId} jobId={searchData.jobId} />}
        </div>
      </div>

      <div className="border rounded-lg relative">
        {isPageLoading && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        )}
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Profile</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Bio</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Video Title</TableHead>
              <TableHead>Views</TableHead>
              <TableHead>Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentCreators.map((creator, index) => {
              const avatarUrl =
                creator.creator?.avatarUrl ||
                creator.creator?.profile_pic_url ||
                creator.creator?.profilePicUrl ||
                creator.profile_pic_url ||
                creator.profilePicUrl ||
                '';
              const proxiedUrl = avatarUrl ? `/api/proxy/image?url=${encodeURIComponent(avatarUrl)}` : '';

              return (
                <TableRow key={index}>
                  <TableCell>
                    <Avatar className="w-10 h-10">
                      <AvatarImage
                        src={proxiedUrl}
                        alt={creator.creator?.name}
                        onLoad={(e) => handleImageLoad(e, creator.creator?.name)}
                        onError={(e) => handleImageError(e, creator.creator?.name, creator.creator?.profilePicUrl || creator.creator?.avatarUrl)}
                        onLoadStart={(e) => handleImageStart(e, creator.creator?.name)}
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
                  <TableCell>
                    {creator.creator?.name && creator.creator.name !== 'N/A' ? (
                      <a 
                        href={renderProfileLink(creator)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors duration-200 flex items-center gap-1"
                        title={`View ${creator.creator.name}'s profile on ${searchData.selectedPlatform || 'TikTok'}`}
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
                      <span className="text-gray-500">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate" title={creator.creator?.bio || 'No bio available'}>
                      {creator.creator?.bio ? (
                        <span className="text-sm text-gray-700">{creator.creator.bio}</span>
                      ) : (
                        <span className="text-gray-400 text-sm">No bio</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {creator.creator?.emails && creator.creator.emails.length > 0 ? (
                      <div className="space-y-1">
                        {creator.creator.emails.map((email, emailIndex) => (
                          <div key={emailIndex} className="flex items-center gap-1">
                            <a 
                              href={`mailto:${email}`}
                              className="text-blue-600 hover:underline text-sm"
                              title={`Send email to ${email}`}
                            >
                              {email}
                            </a>
                            <svg 
                              className="w-3 h-3 opacity-60 text-blue-600"
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
                      <span className="text-gray-400 text-sm">No email</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[300px] truncate" title={creator.video?.description || 'No title'}>
                      {creator.video?.description || 'No title'}
                    </div>
                  </TableCell>
                  <TableCell>{(creator.video?.statistics?.views || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    {creator.video?.url && (
                      <a 
                        href={creator.video.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
          disabled={currentPage === Math.ceil(creators.length / itemsPerPage) || isPageLoading}
          className="px-3"
        >
          Next
        </Button>
        <Button
          variant="outline"
          onClick={() => handlePageChange(Math.ceil(creators.length / itemsPerPage))}
          disabled={currentPage === Math.ceil(creators.length / itemsPerPage) || isPageLoading}
          className="px-3"
        >
          Last
        </Button>
      </div>
    </div>
  );
};

export default SearchResults;