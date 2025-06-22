'use client'

import React, { useState, useEffect } from 'react';
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
import SimilarSearchProgress from './similar-search-progress';

export default function SimilarSearchResults({ searchData }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [creators, setCreators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const itemsPerPage = 10;

  // Validación básica
  if (!searchData?.jobId) return null;

  const handleResultsComplete = (data) => {
    if (data.status === 'completed') {
      setCreators(data.creators || []);
      setIsLoading(false);
    }
  };

  const renderProfileLink = (creator) => {
    // Check platform from creator data or searchData
    const platform = creator.platform || searchData.platform || 'Instagram';
    if (platform === 'TikTok' || platform === 'tiktok') {
      return `https://www.tiktok.com/@${creator.username}`;
    }
    return `https://instagram.com/${creator.username}`;
  };

  const getProxiedImageUrl = (originalUrl) => {
    if (!originalUrl) {
      console.log('🖼️ [BROWSER-IMAGE] No image URL provided');
      return '';
    }
    const proxiedUrl = `/api/proxy/image?url=${encodeURIComponent(originalUrl)}`;
    console.log('🖼️ [BROWSER-IMAGE] Generating proxied URL:');
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

  // If still loading, show progress component
  if (isLoading) {
    return <SimilarSearchProgress searchData={searchData} onComplete={handleResultsComplete} />;
  }

  // If no creators found
  if (!creators || creators.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500">
          <p className="text-lg font-medium">No similar creators found</p>
          <p className="text-sm mt-2">Try searching for a different username or platform.</p>
        </div>
      </div>
    );
  }

  // Calcular el total de páginas
  const totalPages = Math.ceil(creators.length / itemsPerPage);
  
  // Obtener los elementos de la página actual
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = creators.slice(startIndex, endIndex);

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

  // Función para manejar errores de carga de imagen
  const handleImageError = (e, username) => {
    console.log(`Error loading image for ${username}:`, e);
    e.target.style.display = 'none';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Similar Profiles Found</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Similar {searchData.platform === 'tiktok' ? 'TikTok' : 'Instagram'} creators to @{searchData.targetUsername}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} • Showing {startIndex + 1}-{Math.min(endIndex, creators.length)} of {creators.length}
          </div>
          {searchData?.jobId && <ExportButton jobId={searchData.jobId} />}
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
              <TableHead>Full Name</TableHead>
              <TableHead>Private</TableHead>
              <TableHead>Verified</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentItems.map((creator) => {
              const imageUrl = getProxiedImageUrl(creator.profile_pic_url);
              return (
                <TableRow key={creator.id}>
                  <TableCell>
                    <Avatar className="w-10 h-10">
                      <AvatarImage 
                        src={imageUrl}
                        alt={creator.username}
                        onLoad={(e) => handleImageLoad(e, creator.username)}
                        onError={(e) => handleImageError(e, creator.username, creator.profile_pic_url)}
                        onLoadStart={(e) => handleImageStart(e, creator.username)}
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
                    <a 
                      href={renderProfileLink(creator)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      @{creator.username}
                    </a>
                  </TableCell>
                  <TableCell>{creator.full_name}</TableCell>
                  <TableCell>{creator.is_private ? "Yes" : "No"}</TableCell>
                  <TableCell>{creator.is_verified ? "Yes" : "No"}</TableCell>
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