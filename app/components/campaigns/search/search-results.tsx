'use client';

import * as React from "react";
import type { HTMLAttributes } from "react";
import { ErrorBoundary } from '@/components/error-boundary';
import { useComponentLogger, useUserActionLogger, useApiLogger } from '@/lib/logging/react-logger';
import { campaignLogger } from '@/lib/logging';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Filter, Instagram, MessageCircle } from "lucide-react";
import Image from "next/image";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { toast } from "react-hot-toast";

// Definir la interfaz para un creator
export interface Creator {
  id: string;
  profileImage: string;
  name: string;
  username: string;
  keyword: string;
  platform: string;
  totalLikes: number;
  totalViews: number;
  followers: number;
  region: string;
  videos: number;
  profileLink: string;
  bio: string;
  email: string;
  following: number;
  accountAge: string;
}

// Definir las props del componente
interface SearchResultsProps {
  title: string;
  creators: Creator[];
  jobId?: string | null;
}

function SearchResultsContent({
  title,
  creators: initialCreators = [],
  jobId = null
}: SearchResultsProps) {
  const componentLogger = useComponentLogger('SearchResults', { title, jobId });
  const userActionLogger = useUserActionLogger();
  const apiLogger = useApiLogger();
  const [currentPage, setCurrentPage] = React.useState(1);
  const [creators, setCreators] = React.useState<Creator[]>(initialCreators);
  const [isLoading, setIsLoading] = React.useState(!!jobId);
  const itemsPerPage = 10;

  React.useEffect(() => {
    if (!jobId) return;

    const pollResults = async () => {
      try {
        const response = await fetch(`/api/scraping/tiktok?jobId=${jobId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Error al obtener resultados');
        }

        if (data.status === 'completed') {
          setCreators(data.creators);
          setIsLoading(false);
        } else if (data.status === 'error' || data.status === 'timeout') {
          toast.error(`Error: ${data.error}`);
          setIsLoading(false);
        } else {
          // Continue polling - log progress
          campaignLogger.info('Job still in progress, continuing to poll', {
            jobId,
            status: data.status,
            progress: data.progress,
            operation: 'job-polling'
          });
          setTimeout(pollResults, 5000);
        }
      } catch (error) {
        campaignLogger.error('Error polling job results', error instanceof Error ? error : new Error(String(error)), {
          jobId,
          title,
          operation: 'job-polling-error'
        });
        setIsLoading(false);
      }
    };

    pollResults();
  }, [jobId, title]);

  const currentInfluencers = creators.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-200"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-zinc-100">{title}</h2>
        <Button 
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
          onClick={() => {
            userActionLogger.logClick('export-results', {
              title,
              creatorCount: creators.length,
              operation: 'export-campaign-results'
            });
            
            componentLogger.logInfo('Export button clicked', {
              title,
              creatorCount: creators.length,
              operation: 'export-clicked'
            });
          }}
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      <div className="flex justify-between items-center">
        <Button 
          variant="outline" 
          className="border-zinc-700/50 text-zinc-200 hover:bg-zinc-800/50"
          onClick={() => {
            userActionLogger.logClick('filter-results', {
              title,
              creatorCount: creators.length,
              operation: 'filter-campaign-results'
            });
            
            componentLogger.logInfo('Filter button clicked', {
              title,
              creatorCount: creators.length,
              operation: 'filter-clicked'
            });
          }}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30">
        <div className="overflow-hidden lg:overflow-visible">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="border-b border-zinc-800">
                <TableHead className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Profile</TableHead>
                <TableHead className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Keywords</TableHead>
                <TableHead className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Platform</TableHead>
                <TableHead className="hidden xl:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Total Likes</TableHead>
                <TableHead className="hidden xl:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Total Views</TableHead>
                <TableHead className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Followers</TableHead>
                <TableHead className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Region</TableHead>
                <TableHead className="hidden xl:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Videos</TableHead>
                <TableHead className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Email</TableHead>
                <TableHead className="hidden xl:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Following</TableHead>
                <TableHead className="hidden xl:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Account Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-zinc-800">
              {currentInfluencers.map((influencer) => (
                <TableRow key={influencer.id} className="table-row align-top">
                  <TableCell className="px-4 py-4 align-top">
                    <div className="flex items-start gap-3">
                      <div className="relative h-10 w-10 flex-shrink-0">
                        <Image
                          src={influencer.profileImage}
                          alt={influencer.name}
                          fill
                          className="rounded-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="font-semibold text-zinc-100 leading-tight">
                          {influencer.name}
                        </div>
                        <div className="text-sm text-zinc-500 truncate">{influencer.username}</div>
                        <dl className="mt-3 space-y-1 text-xs text-zinc-400 sm:hidden">
                          {influencer.keyword && (
                            <div>
                              <span className="font-medium text-zinc-300">Keywords:</span>{' '}
                              {influencer.keyword}
                            </div>
                          )}
                          <div>
                            <span className="font-medium text-zinc-300">Platform:</span>{' '}
                            {influencer.platform}
                          </div>
                          <div>
                            <span className="font-medium text-zinc-300">Followers:</span>{' '}
                            {influencer.followers.toLocaleString()}
                          </div>
                          {influencer.region && (
                            <div>
                              <span className="font-medium text-zinc-300">Region:</span>{' '}
                              {influencer.region}
                            </div>
                          )}
                          {influencer.email && (
                            <div className="break-words">
                              <span className="font-medium text-zinc-300">Email:</span>{' '}
                              {influencer.email}
                            </div>
                          )}
                        </dl>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell px-4 py-4 text-sm text-zinc-300 break-words">
                    {influencer.keyword || '—'}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell px-4 py-4">
                    {influencer.platform === 'instagram' ? (
                      <Instagram className="h-5 w-5" aria-label="Instagram" />
                    ) : (
                      <MessageCircle className="h-5 w-5" aria-label="TikTok" />
                    )}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell px-4 py-4 text-sm text-zinc-300">
                    {influencer.totalLikes.toLocaleString()}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell px-4 py-4 text-sm text-zinc-300">
                    {influencer.totalViews.toLocaleString()}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell px-4 py-4 text-sm text-zinc-300">
                    {influencer.followers.toLocaleString()}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell px-4 py-4 text-sm text-zinc-300">
                    {influencer.region || '—'}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell px-4 py-4 text-sm text-zinc-300">
                    {influencer.videos}
                  </TableCell>
                  <TableCell className="hidden md:table-cell px-4 py-4 text-sm text-pink-400 break-words">
                    {influencer.email || '—'}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell px-4 py-4 text-sm text-zinc-300">
                    {influencer.following.toLocaleString()}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell px-4 py-4 text-sm text-zinc-300">
                    {influencer.accountAge}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <nav>
        <Pagination>
          <PaginationContent className="flex max-w-full flex-wrap items-center justify-center gap-2">
            <PaginationItem>
              <PaginationPrevious
                onClick={() => {
                  const newPage = Math.max(1, currentPage - 1);
                  if (newPage !== currentPage) {
                    userActionLogger.logClick('pagination-previous', {
                      fromPage: currentPage,
                      toPage: newPage,
                      operation: 'paginate-results'
                    });
                    setCurrentPage(newPage);
                  }
                }}
                disabled={currentPage === 1}
              />
            </PaginationItem>
            {Array.from({ length: Math.ceil(creators.length / itemsPerPage) }).map((_, i) => (
              <PaginationItem key={i}>
                <PaginationLink
                  onClick={() => {
                    const newPage = i + 1;
                    if (newPage !== currentPage) {
                      userActionLogger.logClick('pagination-page', {
                        fromPage: currentPage,
                        toPage: newPage,
                        operation: 'paginate-results'
                      });
                      setCurrentPage(newPage);
                    }
                  }}
                  isActive={currentPage === i + 1}
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => {
                  const maxPage = Math.ceil(creators.length / itemsPerPage);
                  const newPage = Math.min(maxPage, currentPage + 1);
                  if (newPage !== currentPage) {
                    userActionLogger.logClick('pagination-next', {
                      fromPage: currentPage,
                      toPage: newPage,
                      operation: 'paginate-results'
                    });
                    setCurrentPage(newPage);
                  }
                }}
                disabled={currentPage === Math.ceil(creators.length / itemsPerPage)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </nav>
    </div>
  );
}

export default function SearchResults(props: SearchResultsProps) {
  return (
    <ErrorBoundary componentName="SearchResults">
      <SearchResultsContent {...props} />
    </ErrorBoundary>
  );
} 
