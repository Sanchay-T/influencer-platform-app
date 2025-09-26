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

      <div className="border rounded-lg">
        <div className="overflow-x-auto">
          <div className="min-w-[1500px]">
            <div className="max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead>Profile</TableHead>
                    <TableHead>Categories</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Followers</TableHead>
                    <TableHead>Engagement</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Similarity Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getCurrentPageData().map((creator) => (
                    <TableRow key={creator.username}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{creator.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold">{creator.name}</div>
                            <div className="text-sm text-gray-500">@{creator.username}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
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
                      <TableCell>{creator.platform}</TableCell>
                      <TableCell>{creator.followers}</TableCell>
                      <TableCell>{creator.engagement}</TableCell>
                      <TableCell>{creator.location}</TableCell>
                      <TableCell>
                        <Badge variant="success" className="bg-green-100 text-green-800">
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