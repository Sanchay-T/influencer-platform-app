'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ExternalLink, Download, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Influencer } from '@/types/database'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface InfluencerTableProps {
  influencers: Influencer[]
  totalResults: number
  currentPage: number
  resultsPerPage: number
}

export function InfluencerTable({ 
  influencers, 
  totalResults, 
  currentPage, 
  resultsPerPage 
}: InfluencerTableProps) {
  const [selectedInfluencers, setSelectedInfluencers] = useState<string[]>([])

  const handleExportCSV = () => {
    console.log('Exporting CSV...')
    // Implementation for CSV export
  }

  const toggleSelect = (id: string) => {
    setSelectedInfluencers(prev =>
      prev.includes(id)
        ? prev.filter(influencerId => influencerId !== id)
        : [...prev, id]
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-400">
          Page {currentPage} of 3 • Showing {(currentPage - 1) * resultsPerPage + 1}-{Math.min(currentPage * resultsPerPage, totalResults)} of {totalResults}
        </div>
        <Button 
          onClick={handleExportCSV}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Profile
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Username
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Full Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Bio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Private
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Verified
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {influencers.map((influencer) => (
                <tr 
                  key={influencer.id} 
                  className="table-row-hover cursor-pointer"
                  onClick={() => toggleSelect(influencer.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={influencer.avatar_url} alt={influencer.username} />
                      <AvatarFallback className="bg-zinc-700 text-zinc-300">
                        {influencer.username.slice(1, 3).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className="text-emerald-400 font-medium">{influencer.username}</span>
                      <ExternalLink className="h-3 w-3 text-zinc-500" />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-zinc-300">
                    {influencer.full_name}
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    <p className="text-zinc-400 text-sm truncate">{influencer.bio}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {influencer.email ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-emerald-400 text-sm">{influencer.email}</span>
                        <ExternalLink className="h-3 w-3 text-zinc-500" />
                      </div>
                    ) : (
                      <span className="text-zinc-500 text-sm">Not available</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={influencer.is_private ? 'destructive' : 'secondary'}>
                      {influencer.is_private ? 'Yes' : 'No'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={influencer.is_verified ? 'default' : 'secondary'}>
                      {influencer.is_verified ? 'Yes' : 'No'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}