'use client'

import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, User } from "lucide-react";
import ExportButton from '../export-button';

export default function SimilarSearchResults({ searchData }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const itemsPerPage = 10;

  const renderProfileLink = (username) => 
    `https://instagram.com/${username}`;

  const getProxiedImageUrl = (originalUrl) => {
    if (!originalUrl) return '';
    return `/api/proxy/image?url=${encodeURIComponent(originalUrl)}`;
  };

  // Asegurarnos de que searchData y creators existen
  if (!searchData || !searchData.creators || !Array.isArray(searchData.creators)) {
    console.log('No data available:', searchData);
    return <div className="text-center py-8 text-gray-500">No results available</div>;
  }

  console.log('Rendering results:', searchData.creators);

  // Calcular el total de páginas
  const totalPages = Math.ceil(searchData.creators.length / itemsPerPage);
  
  // Obtener los elementos de la página actual
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = searchData.creators.slice(startIndex, endIndex);

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
        <h2 className="text-2xl font-bold">Similar Profiles Found</h2>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} • Showing {startIndex + 1}-{Math.min(endIndex, searchData.creators.length)} of {searchData.creators.length}
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
              console.log('Profile pic URL for', creator.username, ':', creator.profile_pic_url);
              return (
                <TableRow key={creator.id}>
                  <TableCell>
                    <Avatar className="w-10 h-10">
                      <AvatarImage 
                        src={getProxiedImageUrl(creator.profile_pic_url)} 
                        alt={creator.username}
                        onError={(e) => handleImageError(e, creator.username)}
                      />
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell>
                    <a 
                      href={renderProfileLink(creator.username)}
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