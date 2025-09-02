import { Badge } from '@/components/ui/badge'

interface CampaignSummaryProps {
  name: string
  targetUsername: string
  searchType: string
  platform: string
  status: 'active' | 'completed' | 'draft'
}

export function CampaignSummary({ 
  name, 
  targetUsername, 
  searchType, 
  platform, 
  status 
}: CampaignSummaryProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-bold text-zinc-100">{name}</h2>
          <Badge 
            variant={status === 'draft' ? 'secondary' : 'default'}
            className={cn(
              "text-xs font-medium",
              status === 'draft' 
                ? "bg-zinc-800/50 text-zinc-300 border-zinc-700/50" 
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            )}
          >
            {status.toUpperCase()}
          </Badge>
        </div>
        <div className="flex items-center space-x-6 mt-2 text-sm text-zinc-400">
          <span>Search Type: <span className="text-zinc-300">{searchType}</span></span>
          <span>Platform: <span className="text-zinc-300">{platform}</span></span>
          <span>Target Username: <span className="text-zinc-300">{targetUsername}</span></span>
        </div>
      </div>
    </div>
  )
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ')
}