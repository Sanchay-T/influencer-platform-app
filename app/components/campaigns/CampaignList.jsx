'use client'

import { useState, useEffect } from "react";
import CampaignCard from "./campaign-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, RefreshCw } from "lucide-react";

function CampaignCardSkeleton() {
  return (
    <Card className="border border-transparent surface-brand">
      <CardHeader className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-2 w-full">
            <Skeleton className="h-5 w-[180px] bg-zinc-800/60" />
            <Skeleton className="h-3.5 w-[260px] bg-zinc-800/60" />
          </div>
          <Skeleton className="h-5 w-[60px] bg-zinc-800/60" />
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-0 pb-4">
        <Skeleton className="h-3.5 w-[120px] bg-zinc-800/60" />
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
    limit: 9
  });
  const [filterStatus, setFilterStatus] = useState('all'); // all | draft | active | completed
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // newest | updated | alpha

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
      <Card className="bg-zinc-900/80 border border-zinc-700/50">
        <CardContent className="flex flex-col items-center justify-center h-32 space-y-4">
          <p className="text-pink-400 font-medium">Failed to load campaigns</p>
          <p className="text-zinc-400 text-sm">{error}</p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => fetchCampaigns(pagination.currentPage)}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const normalized = (s) => (s || '').toString().toLowerCase();
  const filtered = campaigns
    .filter(c => filterStatus === 'all' ? true : c.status === filterStatus)
    .filter(c => {
      if (!query) return true;
      const q = normalized(query);
      return normalized(c.name).includes(q) || normalized(c.description).includes(q);
    });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'alpha') return a.name.localeCompare(b.name);
    if (sortBy === 'updated') return new Date(b.updatedAt) - new Date(a.updatedAt);
    // default newest by createdAt
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const renderContent = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(pagination.limit || 9)].map((_, index) => (
            <CampaignCardSkeleton key={index} />
          ))}
        </div>
      );
    }

    if (campaigns.length === 0) {
      return (
        <Card className="bg-zinc-900/80 border border-zinc-700/50">
          <CardContent className="flex items-center justify-center h-32">
            <p className="text-zinc-500">No campaigns found</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Controls: filters, search, sort */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          {['all','draft','active','completed'].map((s) => {
            const isSelected = filterStatus === s
            return (
              <Button
                key={s}
                variant="outline"
                size="sm"
                className={
                  isSelected
                    ? 'relative h-8 px-3 rounded-md bg-secondary/70 text-zinc-100 shadow-sm border-l-2 border-l-primary'
                    : 'h-8 px-3 rounded-md border-input text-zinc-300 hover:bg-secondary/60'
                }
                onClick={() => setFilterStatus(s)}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            )
          })}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Input
              placeholder="Filter campaigns..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-64 bg-zinc-800/60 border-zinc-700/50"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-44 bg-zinc-800/60 border-zinc-700/50 text-zinc-200">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700/50">
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="updated">Recently Updated</SelectItem>
              <SelectItem value="alpha">A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-400">
        <div>
          Showing {sorted.length} of {campaigns.length} on this page
        </div>
        {pagination?.pages > 0 && (
          <div>
            Page {pagination.currentPage} of {pagination.pages}
          </div>
        )}
      </div>

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
              pageNum === '...'
                ? <span key={`ellipsis-${index}`} className="px-2">...</span>
                : (
                  <Button
                    key={pageNum}
                    variant="outline"
                    size="sm"
                    className={
                      pageNum === pagination.currentPage
                        ? 'min-w-[32px] relative bg-secondary/70 text-zinc-100 shadow-sm border-l-2 border-l-primary'
                        : 'min-w-[32px] border-input text-zinc-300 hover:bg-secondary/60'
                    }
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
