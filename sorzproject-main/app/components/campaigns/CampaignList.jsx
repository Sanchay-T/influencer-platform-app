'use client'

import { useState, useEffect } from "react";
import CampaignCard from "./campaign-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, RefreshCw } from "lucide-react";

function CampaignCardSkeleton() {
  return (
    <Card className="border-none bg-gray-50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2 w-full">
            <Skeleton className="h-6 w-[200px]" />
            <Skeleton className="h-4 w-[300px]" />
          </div>
          <Skeleton className="h-5 w-[60px]" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Skeleton className="h-4 w-[140px]" />
      </CardContent>
    </Card>
  );
}

export default function CampaignList() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [totalRetries, setTotalRetries] = useState(0); // Contador global de reintentos
  const [pagination, setPagination] = useState({
    currentPage: 1,
    total: 0,
    pages: 0,
    limit: 12
  });

  const fetchCampaigns = async (page = 1, retry = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/campaigns?page=${page}&limit=${pagination.limit}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Error al obtener campañas');
      }

      setCampaigns(data.campaigns);
      setPagination(data.pagination);
      setRetryCount(0);
      setTotalRetries(0); // Reset global retries on success
    } catch (error) {
      console.error('Error detallado:', error);
      setError(error.message);
      
      // Solo reintentamos errores de red o timeout, no errores de validación
      const shouldRetry = error.message.includes('network') || 
                         error.message.includes('timeout') ||
                         error.message.includes('504') ||
                         error.message.includes('503');
      
      // Limitamos reintentos totales por sesión
      if (!retry && retryCount < 2 && totalRetries < 5 && shouldRetry) {
        setRetryCount(prev => prev + 1);
        setTotalRetries(prev => prev + 1);
        
        // Incrementamos el tiempo de espera exponencialmente
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        
        setTimeout(() => {
          fetchCampaigns(page, true);
        }, retryDelay);
      } else {
        toast.error(`Error: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handlePageChange = (page) => {
    fetchCampaigns(page);
  };

  // Función para generar el array de páginas a mostrar
  const getPageNumbers = () => {
    const pageNumbers = [];
    const totalPages = pagination.pages;
    const currentPage = pagination.currentPage;
    
    // Siempre mostrar primera página
    pageNumbers.push(1);
    
    // Calcular rango de páginas alrededor de la página actual
    let start = Math.max(2, currentPage - 2);
    let end = Math.min(totalPages - 1, currentPage + 2);
    
    // Ajustar si estamos cerca del inicio
    if (currentPage <= 3) {
      end = Math.min(5, totalPages - 1);
    }
    
    // Ajustar si estamos cerca del final
    if (currentPage >= totalPages - 2) {
      start = Math.max(2, totalPages - 4);
    }
    
    // Agregar ellipsis después de la primera página si es necesario
    if (start > 2) {
      pageNumbers.push('...');
    }
    
    // Agregar páginas del medio
    for (let i = start; i <= end; i++) {
      pageNumbers.push(i);
    }
    
    // Agregar ellipsis antes de la última página si es necesario
    if (end < totalPages - 1) {
      pageNumbers.push('...');
    }
    
    // Siempre mostrar última página si hay más de una página
    if (totalPages > 1) {
      pageNumbers.push(totalPages);
    }
    
    return pageNumbers;
  };

  if (error) {
    return (
      <Card className="border-none bg-red-50">
        <CardContent className="flex flex-col items-center justify-center h-32 space-y-4">
          <p className="text-red-600 font-medium">Error al cargar campañas</p>
          <p className="text-red-500 text-sm">{error}</p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => fetchCampaigns(pagination.currentPage)}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(12)].map((_, index) => (
            <CampaignCardSkeleton key={index} />
          ))}
        </div>
      );
    }

    if (campaigns.length === 0) {
      return (
        <Card className="border-none bg-gray-50">
          <CardContent className="flex items-center justify-center h-32">
            <p className="text-gray-500">No campaigns found</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaigns.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderContent()}
      
      {pagination.pages > 1 && (
        <div className="flex justify-center items-center space-x-2 pt-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handlePageChange(1)}
            disabled={pagination.currentPage === 1 || loading}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => handlePageChange(pagination.currentPage - 1)}
            disabled={pagination.currentPage === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center space-x-1">
            {getPageNumbers().map((pageNum, index) => (
              pageNum === '...' ? (
                <span key={`ellipsis-${index}`} className="px-2">...</span>
              ) : (
                <Button
                  key={pageNum}
                  variant={pageNum === pagination.currentPage ? "default" : "outline"}
                  size="sm"
                  className="min-w-[32px]"
                  onClick={() => handlePageChange(pageNum)}
                  disabled={loading}
                >
                  {pageNum}
                </Button>
              )
            ))}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => handlePageChange(pagination.currentPage + 1)}
            disabled={pagination.currentPage === pagination.pages || loading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => handlePageChange(pagination.pages)}
            disabled={pagination.currentPage === pagination.pages || loading}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>

          {loading && (
            <div className="flex items-center justify-center ml-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
} 