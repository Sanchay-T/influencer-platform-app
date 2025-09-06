'use client'

import { useState } from 'react'
import { ExternalLink, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Influencer } from '@/types/database'

interface InfluencerResultsProps {
  influencers: Influencer[]
  totalResults: number
  currentPage: number
  resultsPerPage: number
}

export function InfluencerResults({ 
  influencers, 
  totalResults, 
  currentPage, 
  resultsPerPage 
}: InfluencerResultsProps) {
  const [selectedRows, setSelectedRows] = useState<string[]>([])

  const handleRowClick = (id: string) => {
    setSelectedRows(prev =>
      prev.includes(id)
        ? prev.filter(rowId => rowId !== id)
        : [...prev, id]
    )
  }

  const handleExportCSV = () => {
    console.log('Exporting selected influencers to CSV...')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-400">
          Page {currentPage} of 3 • Showing {(currentPage - 1) * resultsPerPage + 1}-{Math.min(currentPage * resultsPerPage, totalResults)} of {totalResults}
        </div>
        <Button 
          onClick={handleExportCSV}
          className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-600/50 text-zinc-200"
          size="sm"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="bg-zinc-900/80 border border-zinc-700/50 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-zinc-800/40 border-b border-zinc-700/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Profile
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Username
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Full Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Bio
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Private
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Verified
              </th>
            </tr>
          </thead>
          <tbody>
            {influencers.map((influencer, index) => (
              <tr 
                key={influencer.id}
                className={cn(
                  'table-row',
                  selectedRows.includes(influencer.id) && 'bg-emerald-500/5'
                )}
                onClick={() => handleRowClick(influencer.id)}
              >
                <td className="px-4 py-4">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="logo-icon"
                      style={{ 
                        backgroundColor: `hsl(${index * 60 + 180}, 70%, 50%)` 
                      }}
                    >
                      {influencer.username.slice(1, 3).toUpperCase()}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-pink-400 font-medium text-sm hover:text-pink-300 transition-colors">
                      {influencer.username}
                    </span>
                    <ExternalLink className="h-3 w-3 text-zinc-600" />
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className="text-zinc-200 text-sm">{influencer.full_name}</span>
                </td>
                <td className="px-4 py-4 max-w-sm">
                  <span className="text-zinc-400 text-sm truncate block">{influencer.bio}</span>
                </td>
                <td className="px-4 py-4">
                  {influencer.email ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-pink-400 text-sm hover:text-pink-300 transition-colors">
                        {influencer.email}
                      </span>
                      <ExternalLink className="h-3 w-3 text-zinc-600" />
                    </div>
                  ) : (
                    <span className="text-zinc-500 text-sm">Not available</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <span className="text-zinc-300 text-sm">
                    {influencer.is_private ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className="text-zinc-300 text-sm">
                    {influencer.is_verified ? 'Yes' : 'No'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ')
}