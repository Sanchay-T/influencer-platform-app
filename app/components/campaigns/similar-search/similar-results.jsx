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
        <div className="overflow-x-auto">
          <div className="min-w-[1500px]">
            <div className="max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-zinc-800">
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Profile</TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Categories</TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Platform</TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Followers</TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Engagement</TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Location</TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Similarity Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-zinc-800">
                  {getCurrentPageData().map((creator) => (
                    <TableRow key={creator.username} className="table-row">
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{creator.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold text-zinc-100">{creator.name}</div>
                            <div className="text-sm text-zinc-500">@{creator.username}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex gap-1 flex-wrap">
                          {creator.categories.map((category) => (
                            <Badge 
                              key={`${creator.username}-${category.name}`}
                              style={{ 
                                backgroundColor: category.color,
                                color: '#000000',
                                opacity: 0.8
                              }}
                            >
                              {category.name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-zinc-300">{creator.platform}</TableCell>
                      <TableCell className="px-6 py-4 text-zinc-300">{creator.followers}</TableCell>
                      <TableCell className="px-6 py-4 text-zinc-300">{creator.engagement}</TableCell>
                      <TableCell className="px-6 py-4 text-zinc-300">{creator.location}</TableCell>
                      <TableCell className="px-6 py-4">
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
