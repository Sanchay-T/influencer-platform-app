'use client'

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ExternalLink, User } from "lucide-react";
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
        const apiEndpoint = searchData.selectedPlatform === 'youtube' ? 
          '/api/scraping/youtube' : 
          '/api/scraping/tiktok';
        
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

        console.log('🔍 [DEBUG] Raw API response:', data);
        console.log('🔍 [DEBUG] All creators combined:', allCreators);

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
              const apiEndpoint = searchData.selectedPlatform === 'youtube' ? 
                '/api/scraping/youtube' : 
                '/api/scraping/tiktok';
              
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

  // Formato de fecha
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  // Format duration from seconds to MM:SS or HH:MM:SS
  const formatDuration = (seconds) => {
    console.log('🔍 [DEBUG] formatDuration called with:', seconds, typeof seconds);
    
    if (!seconds || seconds === 0) {
      console.log('🔍 [DEBUG] Returning N/A for seconds:', seconds);
      return 'N/A';
    }
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  };

  // Función para manejar errores de carga de imagen
  const handleImageError = (e, username) => {
    console.log(`Error loading image for ${username}:`, e);
    e.target.style.display = 'none';
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
              <TableHead>Creator Name</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Video Title</TableHead>
              <TableHead>Views</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentCreators.map((creator, index) => {
              if (index === 0) {
                console.log('🔍 [DEBUG] Creator sample:', creator);
                console.log('🔍 [DEBUG] lengthSeconds:', creator.lengthSeconds);
                console.log('🔍 [DEBUG] video.statistics.views:', creator.video?.statistics?.views);
                console.log('🔍 [DEBUG] createTime:', creator.createTime);
              }
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
                        onLoad={() => console.log('Avatar loaded', proxiedUrl)}
                        onError={(e) => {
                          console.warn('Avatar failed', proxiedUrl);
                          handleImageError(e, creator.creator?.name);
                        }}
                      />
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell>{creator.creator?.name || 'N/A'}</TableCell>
                  <TableCell>{formatDate(creator.createTime)}</TableCell>
                  <TableCell>
                    <div className="max-w-[300px] truncate" title={creator.video?.description || 'No title'}>
                      {creator.video?.description || 'No title'}
                    </div>
                  </TableCell>
                  <TableCell>{(creator.video?.statistics?.views || 0).toLocaleString()}</TableCell>
                  <TableCell>{formatDuration(creator.lengthSeconds || 0)}</TableCell>
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