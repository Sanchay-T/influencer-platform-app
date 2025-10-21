'use client'

import React, { useEffect, useState } from 'react'
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { LayoutDashboard, LogOut, UserRoundCog, Settings, Mail, CreditCard, ListTree, Pin, PinOff, Megaphone } from "lucide-react";
import { useRouter, usePathname } from 'next/navigation'
import { useClerk, useUser } from '@clerk/nextjs'
import { useAdmin } from '@/lib/hooks/use-admin'
import TrialSidebarCompact from '@/app/components/trial/trial-sidebar-compact'
import { cn } from '@/lib/utils'

// Sidebar is shared across dashboard shells; default to pinned to keep navigation visible until the user explicitly unpins.
export default function Sidebar({ onNavigate, onTogglePin, isPinned = true, showAutoHideHint = false }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const router = useRouter()
  const pathname = usePathname()
  const { signOut } = useClerk()
  const { user } = useUser()
  const { isAdmin } = useAdmin()

  const nav = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
    { name: 'Lists', href: '/lists', icon: ListTree },
    { name: 'Account Settings', href: '/profile', icon: UserRoundCog },
    { name: 'Billing & Plans', href: '/billing', icon: CreditCard },
  ]
  const adminNav = [
    { name: 'System Config', href: '/admin/system-config', icon: Settings },
    { name: 'Email Testing', href: '/admin/email-testing', icon: Mail },
  ]

  const handleLogout = async () => {
    try {
      await signOut()
      router.push('/sign-in')
    } catch (err) {
      console.error('Error signing out:', err)
    }
  }

  return (
    <div className="flex h-full w-full max-w-xs sm:max-w-sm lg:w-64 lg:max-w-none flex-col bg-zinc-900 border-r border-zinc-700/50">
      <div className="flex h-16 items-center px-6 border-b border-zinc-800/50">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center space-x-3">
            <Image
              src="/logo.png"
              alt="Gemz Logo"
              width={40}
              height={40}
              className="object-contain"
              priority
            />
            <span className="text-xl font-bold text-zinc-100">Gemz</span>
          </div>
          {onTogglePin && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60"
              onClick={onTogglePin}
              aria-label={mounted ? (isPinned ? 'Unpin sidebar' : 'Pin sidebar') : undefined}
            >
              {mounted ? (isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />) : null}
            </Button>
          )}
        </div>
      </div>

      {showAutoHideHint && (
        <div className="px-6 py-3 text-xs text-zinc-500 border-b border-zinc-800/50 leading-5">
          Hover the left edge to reveal the menu. Pin it to keep the sidebar open.
        </div>
      )}

      <nav className="flex-1 space-y-1 px-4 py-6">
        {nav.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => { onNavigate?.(); }}
              className={cn(
                'group flex items-center space-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive ? 'bg-zinc-800/60 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/30 hover:text-zinc-200'
              )}
            >
              <Icon className={cn(
                'h-4 w-4 transition-colors duration-200',
                isActive ? 'text-zinc-100' : 'text-zinc-500 group-hover:text-zinc-300'
              )} />
              <span>{item.name}</span>
            </Link>
          )
        })}

        {isAdmin && (
          <div className="mt-6 pt-6 border-t border-zinc-800/50">
            {adminNav.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => { onNavigate?.(); }}
                  className={cn(
                    'group flex items-center space-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isActive ? 'bg-zinc-800/60 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/30 hover:text-zinc-200'
                  )}
                >
                  <Icon className={cn(
                    'h-4 w-4 transition-colors duration-200',
                    isActive ? 'text-zinc-100' : 'text-zinc-500 group-hover:text-zinc-300'
                  )} />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </div>
        )}
      </nav>

      <div className="px-4 mb-4">
        <TrialSidebarCompact />
      </div>

      <div className="border-t border-zinc-700/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-8 h-8 bg-pink-600 rounded-full flex items-center justify-center text-sm font-bold text-white">
              {user?.firstName?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-zinc-300 truncate">
                {user?.emailAddresses?.[0]?.emailAddress || '—'}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50" onClick={() => { onNavigate?.(); handleLogout(); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
