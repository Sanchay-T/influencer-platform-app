'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { CampaignSummary } from '@/components/dashboard/campaign-summary'
import { InfluencerResults } from '@/components/dashboard/influencer-results'
import { Influencer } from '@/types/database'

// Mock data based on the current app content
const mockInfluencers: Influencer[] = [
  {
    id: '1',
    username: '@conanobrien',
    full_name: 'Conan O\'Brien',
    bio: 'The YouTube home for clips from "Late Night with Conan O\'Brien"',
    email: null,
    platform: 'YouTube',
    avatar_url: null,
    is_private: false,
    is_verified: false,
    follower_count: 1200000,
    engagement_rate: 3.5,
    category: 'Entertainment',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    username: '@SWIFTNESSTUTORIALS',
    full_name: 'SWIFTNESS',
    bio: 'quick tutorials about anything & everything',
    email: 'swiftnesscontact@gmail.com',
    platform: 'YouTube',
    avatar_url: null,
    is_private: false,
    is_verified: false,
    follower_count: 850000,
    engagement_rate: 4.2,
    category: 'Education',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '3',
    username: '@AmusingLuis',
    full_name: 'AmusingLuis',
    bio: 'hours of useless trivia and For business inquiries',
    email: 'itsnotluis420@gmail.com',
    platform: 'YouTube',
    avatar_url: null,
    is_private: false,
    is_verified: false,
    follower_count: 320000,
    engagement_rate: 5.1,
    category: 'Entertainment',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '4',
    username: '@WatchMojo',
    full_name: 'WatchMojo.com',
    bio: 'We bring you top 10 lists across a variety of topics',
    email: null,
    platform: 'YouTube',
    avatar_url: null,
    is_private: false,
    is_verified: false,
    follower_count: 24000000,
    engagement_rate: 2.8,
    category: 'Entertainment',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '5',
    username: '@PeppaPigOfficial',
    full_name: 'Peppa Pig - Official Channel',
    bio: 'Peppa lives with her mummy and daddy and little brother George',
    email: null,
    platform: 'YouTube',
    avatar_url: null,
    is_private: false,
    is_verified: false,
    follower_count: 8500000,
    engagement_rate: 6.2,
    category: 'Kids',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '6',
    username: '@21stCenturyGuilherme',
    full_name: '21st Century Guilherme',
    bio: 'Phone: Samsung Galaxy A04e',
    email: null,
    platform: 'YouTube',
    avatar_url: null,
    is_private: false,
    is_verified: false,
    follower_count: 180000,
    engagement_rate: 3.9,
    category: 'Tech',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '7',
    username: '@WatchMojoUK',
    full_name: 'WatchMojoUK',
    bio: 'WatchMojoUK is everything that you love about WatchMojo',
    email: null,
    platform: 'YouTube',
    avatar_url: null,
    is_private: false,
    is_verified: false,
    follower_count: 1800000,
    engagement_rate: 2.5,
    category: 'Entertainment',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
]

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    console.log('Searching for:', query)
  }

  return (
    <div className="flex h-screen bg-zinc-900">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          showBreadcrumbs={true}
          breadcrumbs={[
            { label: 'Dashboard', href: '/' },
            { label: 'Campaign', href: '/campaign' },
            { label: 'Search Results' }
          ]}
          showSearch={true}
          onSearch={handleSearch}
        />
        
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <CampaignSummary 
              name="Chriskoerner"
              targetUsername="@thekoerneroffice"
              searchType="similar"
              platform="YouTube"
              status="draft"
            />
            
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-zinc-100 mb-2">Similar Profiles Found</h3>
              <p className="text-sm text-zinc-400">Similar Instagram creators to @thekoerneroffice</p>
            </div>
            
            <InfluencerResults 
              influencers={mockInfluencers}
              totalResults={30}
              currentPage={1}
              resultsPerPage={10}
            />
          </div>
        </div>
      </div>
    </div>
  )
}