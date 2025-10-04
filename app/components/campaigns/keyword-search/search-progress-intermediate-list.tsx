'use client'

import { memo } from 'react'

// [IntermediateList] Renders a compact snapshot of the latest creators surfaced mid-run
function IntermediateList({ creators, status }: { creators: any[]; status: string }) {
  if (!creators.length) return null
  const latest = creators.slice(-5)
  return (
    <div className="w-full space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-zinc-200">Latest creators</h3>
        <span className="text-xs text-zinc-400">
          {status === 'processing' ? 'Streaming new results…' : 'Processing finished'}
        </span>
      </div>
      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {latest.map((creator, index) => {
          const name = creator?.creator?.name || creator?.creator?.username || 'Unknown creator'
          const followers = creator?.creator?.followers || creator?.creator?.followerCount
          return (
            <div
              key={`${name}-${index}`}
              className="flex items-start gap-3 p-3 bg-zinc-900/80 border border-zinc-700/50 rounded-lg"
            >
              <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-sm font-medium text-zinc-200">
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-100 truncate">{name}</p>
                {followers ? (
                  <p className="text-xs text-zinc-500 mt-1">{Number(followers).toLocaleString()} followers</p>
                ) : null}
              </div>
            </div>
          )
        })}
        {creators.length > 5 && (
          <div className="text-center text-xs text-zinc-400 py-2 bg-zinc-800/40 rounded">
            +{creators.length - 5} more creators
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(IntermediateList)
