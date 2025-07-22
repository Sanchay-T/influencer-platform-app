'use client';

import { Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function EnhancedTrialSidebarSkeleton() {
  return (
    <div className="relative bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 rounded-xl p-4 space-y-4 shadow-sm shadow-blue-100">
      
      {/* Header with Trial Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-100 backdrop-blur-sm">
            <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-blue-900">
              7-Day Trial
            </span>
          </div>
        </div>
      </div>

      {/* Main Timer Display skeleton */}
      <div className="text-center py-2">
        <div className="text-2xl font-bold text-blue-900 mb-1">
          <div className="h-8 bg-blue-200 rounded w-20 mx-auto animate-pulse"></div>
        </div>
        <p className="text-xs text-blue-900 opacity-75">
          <div className="h-3 bg-blue-200 rounded w-24 mx-auto animate-pulse"></div>
        </p>
      </div>

      {/* Enhanced Progress Bar skeleton */}
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-blue-900 opacity-75">Trial Progress</span>
            <span className="font-medium text-blue-900">
              <div className="h-3 bg-blue-200 rounded w-16 animate-pulse"></div>
            </span>
          </div>
          <div className="relative">
            <Progress value={0} className="h-2 bg-blue-100" />
          </div>
          <div className="flex justify-between text-xs opacity-60">
            <span className="text-blue-900">Day 1</span>
            <span className="text-blue-900">Day 7</span>
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
      <div className="space-y-2 p-3 bg-white bg-opacity-50 rounded-lg backdrop-blur-sm">
        <div className="flex justify-between items-center text-xs">
          <span className="text-blue-900 opacity-75">Searches Used</span>
          <span className="font-medium text-blue-900">
            <div className="h-3 bg-blue-200 rounded w-8 animate-pulse"></div>
          </span>
        </div>
        <Progress value={0} className="h-1.5 bg-blue-100" />
      </div>

      {/* Enhanced Upgrade CTA skeleton */}
      <div className="space-y-2">
        <Link href="/pricing" className="block">
          <Button 
            size="sm" 
            className="w-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white opacity-75 animate-pulse"
          >
            Loading...
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default EnhancedTrialSidebarSkeleton;