'use client';

import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Download, Filter } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export default function SimilarResults({ data }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [campaignName, setCampaignName] = useState("Nueva Campaña");
  const itemsPerPage = 10;
  const totalPages = Math.ceil(data.length / itemsPerPage);

  useEffect(() => {
    // Obtener la campaña en progreso
    const currentCampaign = JSON.parse(sessionStorage.getItem('currentCampaign'));
    if (currentCampaign?.name) {
      setCampaignName(currentCampaign.name);
    }
  }, []);

  // Obtener los datos de la página actual
  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">{campaignName}</h2>
      </div>

      <div className="flex items-center justify-between mb-6">
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30">
        <div className="max-h-[600px] overflow-y-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="border-b border-zinc-800">
                <TableHead className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Profile</TableHead>
                <TableHead className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Categories</TableHead>
                <TableHead className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Platform</TableHead>
                <TableHead className="hidden md:table-cell px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">Followers</TableHead>
                <TableHead className="hidden xl:table-cell px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">Engagement</TableHead>
                <TableHead className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Location</TableHead>
                <TableHead className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">Similarity</TableHead>
              </TableRow>
            </TableHeader>
                <TableBody className="divide-y divide-zinc-800">
                  {getCurrentPageData().map((creator) => (
                    <TableRow key={creator.username} className="table-row align-top">
                      <TableCell className="px-4 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            <AvatarFallback>{creator.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="space-y-2 min-w-0">
                            <div className="font-semibold text-zinc-100 leading-tight">{creator.name}</div>
                            <div className="text-xs text-zinc-400">@{creator.username}</div>
                            <div className="space-y-1 text-xs text-zinc-400 md:hidden">
                              <div>
                                <span className="font-medium text-zinc-300">Followers:</span>{' '}
                                {creator.followers}
                              </div>
                              <div>
                                <span className="font-medium text-zinc-300">Platform:</span>{' '}
                                {creator.platform}
                              </div>
                              <div>
                                <span className="font-medium text-zinc-300">Location:</span>{' '}
                                {creator.location || '—'}
                              </div>
                              <div>
                                <span className="font-medium text-zinc-300">Engagement:</span>{' '}
                                {creator.engagement}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1 lg:hidden">
                              {creator.categories.map((category) => (
                                <Badge
                                  key={`${creator.username}-${category.name}`}
                                  style={{
                                    backgroundColor: category.color,
                                    color: '#000',
                                    opacity: 0.8
                                  }}
                                >
                                  {category.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {creator.categories.map((category) => (
                            <Badge
                              key={`${creator.username}-${category.name}`}
                              style={{
                                backgroundColor: category.color,
                                color: '#000',
                                opacity: 0.8
                              }}
                            >
                              {category.name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell px-4 py-4 text-sm text-zinc-300">{creator.platform}</TableCell>
                      <TableCell className="hidden md:table-cell px-4 py-4 text-right text-sm text-zinc-300">{creator.followers}</TableCell>
                      <TableCell className="hidden xl:table-cell px-4 py-4 text-right text-sm text-zinc-300">{creator.engagement}</TableCell>
                      <TableCell className="hidden lg:table-cell px-4 py-4 text-sm text-zinc-300">{creator.location}</TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <Badge className="bg-emerald-600/20 text-emerald-400 border border-emerald-600/30">
                          {creator.similarityScore}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
          </Table>
        </div>
      </div>

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            />
          </PaginationItem>
          {Array.from({ length: totalPages }).map((_, i) => (
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
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
} 
