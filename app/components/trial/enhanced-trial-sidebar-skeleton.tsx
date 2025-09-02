'use client';

import { Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function EnhancedTrialSidebarSkeleton() {
  return (
    <div className="relative bg-zinc-900/80 border border-zinc-700/50 rounded-xl p-4 space-y-4">
      
      {/* Header with Trial Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-zinc-800">
            <Clock className="h-4 w-4 text-emerald-500 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100">7-Day Trial</span>
          </div>
        </div>
      </div>

      {/* Main Timer Display skeleton */}
      <div className="text-center py-2">
        <div className="text-2xl font-bold text-zinc-100 mb-1">
          <div className="h-8 bg-zinc-800 rounded w-20 mx-auto animate-pulse"></div>
        </div>
        <div className="text-xs text-zinc-400">
          <div className="h-3 bg-zinc-800 rounded w-24 mx-auto animate-pulse"></div>
        </div>
      </div>

      {/* Enhanced Progress Bar skeleton */}
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">Trial Progress</span>
            <span className="font-medium text-zinc-200">
              <div className="h-3 bg-zinc-800 rounded w-16 animate-pulse"></div>
            </span>
          </div>
          <div className="relative">
            <Progress value={0} className="h-2 bg-zinc-800" />
          </div>
          <div className="flex justify-between text-xs opacity-60">
            <span className="text-zinc-500">Day 1</span>
            <span className="text-zinc-500">Day 7</span>
          </div>
        </div>

        {/* Timeline Dates skeleton */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="text-blue-900 opacity-75 flex items-center gap-1">
            <div className="h-3 w-3 bg-blue-200 rounded animate-pulse"></div>
            <div className="h-3 bg-blue-200 rounded w-12 animate-pulse"></div>
          </div>
          <div className="text-blue-900 opacity-75 flex items-center gap-1">
            <div className="h-3 w-3 bg-blue-200 rounded animate-pulse"></div>
            <div className="h-3 bg-blue-200 rounded w-12 animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Usage Info skeleton */}
      <div className="space-y-2 p-3 bg-zinc-800/60 rounded-lg">
        <div className="flex justify-between items-center text-xs">
          <span className="text-zinc-400">Searches Used</span>
          <span className="font-medium text-zinc-200">
            <div className="h-3 bg-blue-200 rounded w-8 animate-pulse"></div>
          </span>
        </div>
        <Progress value={0} className="h-1.5 bg-zinc-800" />
      </div>

      {/* Enhanced Upgrade CTA skeleton */}
      <div className="space-y-2">
        <Link href="/pricing" className="block">
          <Button 
            size="sm" 
            className="w-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white opacity-75 animate-pulse"
          >
            Loading...
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default EnhancedTrialSidebarSkeleton;
