'use client'

import * as React from "react";
import type { HTMLAttributes } from "react";
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

export default function SearchResults({
  title,
  creators: initialCreators = [],
  jobId = null
}: SearchResultsProps) {
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
          setTimeout(pollResults, 5000);
        }
      } catch (error) {
        console.error('Error:', error);
        setIsLoading(false);
      }
    };

    pollResults();
  }, [jobId]);

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
        <Button className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      <div className="flex justify-between items-center">
        <Button variant="outline" className="border-zinc-700/50 text-zinc-200 hover:bg-zinc-800/50">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 overflow-x-auto">
        <div className="min-w-[1500px]">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-zinc-800">
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Profile</TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Keywords</TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Platform</TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Likes</TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Views</TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Followers</TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Region</TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Videos</TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Email</TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Following</TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Account Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-zinc-800">
              {currentInfluencers.map((influencer) => (
                <TableRow key={influencer.id} className="table-row">
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10">
                        <Image
                          src={influencer.profileImage}
                          alt={influencer.name}
                          fill
                          className="rounded-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="font-semibold text-zinc-100">{influencer.name}</div>
                        <div className="text-sm text-zinc-500">
                          {influencer.username}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-zinc-300">{influencer.keyword}</TableCell>
                  <TableCell className="px-6 py-4">
                    {influencer.platform === 'instagram' ? (
                      <Instagram className="h-5 w-5" />
                    ) : (
                      <MessageCircle className="h-5 w-5" />
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-zinc-300">{influencer.totalLikes.toLocaleString()}</TableCell>
                  <TableCell className="px-6 py-4 text-zinc-300">{influencer.totalViews.toLocaleString()}</TableCell>
                  <TableCell className="px-6 py-4 text-zinc-300">{influencer.followers.toLocaleString()}</TableCell>
                  <TableCell className="px-6 py-4 text-zinc-300">{influencer.region}</TableCell>
                  <TableCell className="px-6 py-4 text-zinc-300">{influencer.videos}</TableCell>
                  <TableCell className="px-6 py-4 text-pink-400">{influencer.email}</TableCell>
                  <TableCell className="px-6 py-4 text-zinc-300">{influencer.following.toLocaleString()}</TableCell>
                  <TableCell className="px-6 py-4 text-zinc-300">{influencer.accountAge}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <nav>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              />
            </PaginationItem>
            {Array.from({ length: Math.ceil(creators.length / itemsPerPage) }).map((_, i) => (
              <PaginationItem key={i}>
                <PaginationLink
                  onClick={() => setCurrentPage(i + 1)}
                  isActive={currentPage === i + 1}
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(creators.length / itemsPerPage), p + 1))}
                disabled={currentPage === Math.ceil(creators.length / itemsPerPage)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </nav>
    </div>
  );
} 
