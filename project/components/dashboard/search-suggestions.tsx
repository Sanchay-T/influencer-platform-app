import { Filter } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function SearchSuggestions() {
  return (
    <div className="mb-6">
      <div className="flex items-center space-x-4">
        <Badge 
          variant="secondary" 
          className="search-suggestions text-emerald-400 border-emerald-500/30"
        >
          <Filter className="h-3 w-3 mr-2" />
          IPOs in the last year sorted by market cap
        </Badge>
        <Badge 
          variant="secondary" 
          className="search-suggestions text-blue-400 border-blue-500/30"
        >
          <Filter className="h-3 w-3 mr-2" />
          Aerospace/Defense with Div Yield &gt;3%
        </Badge>
      </div>
    </div>
  )
}