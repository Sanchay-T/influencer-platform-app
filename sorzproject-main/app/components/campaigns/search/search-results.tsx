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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{title}</h2>
        <Button>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      <div className="flex justify-between items-center">
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <div className="min-w-[1500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profile</TableHead>
                <TableHead>Keywords</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Total Likes</TableHead>
                <TableHead>Total Views</TableHead>
                <TableHead>Followers</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Videos</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Following</TableHead>
                <TableHead>Account Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentInfluencers.map((influencer) => (
                <TableRow key={influencer.id}>
                  <TableCell>
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
                        <div className="font-semibold">{influencer.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {influencer.username}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{influencer.keyword}</TableCell>
                  <TableCell>
                    {influencer.platform === 'instagram' ? (
                      <Instagram className="h-5 w-5" />
                    ) : (
                      <MessageCircle className="h-5 w-5" />
                    )}
                  </TableCell>
                  <TableCell>{influencer.totalLikes.toLocaleString()}</TableCell>
                  <TableCell>{influencer.totalViews.toLocaleString()}</TableCell>
                  <TableCell>{influencer.followers.toLocaleString()}</TableCell>
                  <TableCell>{influencer.region}</TableCell>
                  <TableCell>{influencer.videos}</TableCell>
                  <TableCell>{influencer.email}</TableCell>
                  <TableCell>{influencer.following.toLocaleString()}</TableCell>
                  <TableCell>{influencer.accountAge}</TableCell>
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