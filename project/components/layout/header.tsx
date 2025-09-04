'use client'

import { Search, ArrowLeft, ChevronRight } from 'lucide-react'
import { Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { useState } from 'react'

interface HeaderProps {
  title?: string
  subtitle?: string
  showBreadcrumbs?: boolean
  breadcrumbs?: Array<{ label: string; href?: string }>
  showSearch?: boolean
  searchPlaceholder?: string
  onSearch?: (query: string) => void
}

export function Header({ 
  title, 
  subtitle, 
  showBreadcrumbs,
  breadcrumbs = [],
  showSearch,
  searchPlaceholder = "Describe what you're looking for, or press / for suggestions",
  onSearch 
}: HeaderProps) {
  const [searchValue, setSearchValue] = useState('')

  const handleSearchChange = (value: string) => {
    setSearchValue(value)
    onSearch?.(value)
  }

  return (
    <div className="border-b border-zinc-700/50 bg-zinc-900">
      {/* Top bar with search */}
      {showSearch && (
        <div className="px-6 py-3 border-b border-zinc-700/30">
          <div className="flex items-center justify-between">
            {/* Navigation tabs */}
            <div className="flex items-center space-x-6">
              <button className="text-sm font-medium text-zinc-100 border-b-2 border-pink-400 pb-2">
                Dashboard
              </button>
              <button className="text-sm font-medium text-zinc-400 hover:text-zinc-200 pb-2 transition-colors">
                Campaigns
              </button>
              <button className="text-sm font-medium text-zinc-400 hover:text-zinc-200 pb-2 transition-colors">
                Analytics
              </button>
              <button className="text-sm font-medium text-zinc-400 hover:text-zinc-200 pb-2 transition-colors">
                Influencers
              </button>
            </div>
            
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-96 pl-10 bg-zinc-800/60 border-zinc-700/50 focus:border-zinc-600 transition-all duration-200 placeholder:text-zinc-500"
              />
            </div>
          </div>
        </div>
      )}
      
      <div className="px-6 py-4">
        {showBreadcrumbs && (
          <div className="flex items-center space-x-2 mb-4">
            {breadcrumbs.map((crumb, index) => (
              <div key={index} className="flex items-center space-x-2">
                {crumb.href ? (
                  <Link href={crumb.href} className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-sm text-zinc-200">{crumb.label}</span>
                )}
                {index < breadcrumbs.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-zinc-600" />
                )}
              </div>
            ))}
          </div>
        )}

        <div>
          <div>
            {title && <h1 className="text-2xl font-bold text-zinc-100 mb-1">{title}</h1>}
            {subtitle && <p className="text-sm text-zinc-400">{subtitle}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}