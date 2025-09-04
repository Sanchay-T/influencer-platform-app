import { Badge } from '@/components/ui/badge'

interface CampaignInfoProps {
  name: string
  targetUsername: string
  searchType: string
  platform: string
  status: 'active' | 'completed' | 'draft'
}

export function CampaignInfo({ 
  name, 
  targetUsername, 
  searchType, 
  platform, 
  status 
}: CampaignInfoProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-zinc-100">{name}</h2>
        <Badge 
          variant={status === 'draft' ? 'secondary' : 'default'}
          className="uppercase"
        >
          {status}
        </Badge>
      </div>
      
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <label className="text-zinc-400">Search Type</label>
          <p className="text-zinc-200 font-medium">{searchType}</p>
        </div>
        <div>
          <label className="text-zinc-400">Platform</label>
          <p className="text-zinc-200 font-medium">{platform}</p>
        </div>
        <div>
          <label className="text-zinc-400">Target Username</label>
          <p className="text-zinc-200 font-medium">{targetUsername}</p>
        </div>
      </div>
    </div>
  )
}