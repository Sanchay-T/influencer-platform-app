export interface Influencer {
  id: string
  username: string
  full_name: string
  bio: string
  email?: string
  platform: 'YouTube' | 'Instagram' | 'TikTok' | 'Twitter'
  avatar_url?: string
  is_private: boolean
  is_verified: boolean
  follower_count?: number
  engagement_rate?: number
  category: string
  created_at: string
  updated_at: string
}

export interface Campaign {
  id: string
  name: string
  description?: string
  target_username: string
  search_type: 'similar' | 'category' | 'keyword'
  platform: string
  status: 'active' | 'completed' | 'draft'
  created_at: string
  updated_at: string
}

export interface SearchResult {
  id: string
  campaign_id: string
  influencer_id: string
  similarity_score?: number
  created_at: string
}