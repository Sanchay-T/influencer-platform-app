'use client'

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LayoutDashboard, LogOut, UserRoundCog, Settings, Mail, CreditCard, TrendingUp } from "lucide-react";
import { useRouter, usePathname } from 'next/navigation'
import { useClerk, useUser } from '@clerk/nextjs'
import { useAdmin } from '@/lib/hooks/use-admin'
import TrialSidebarCompact from '@/app/components/trial/trial-sidebar-compact'
import { cn } from '@/lib/utils'

export default function Sidebar({ onNavigate }) {
  const router = useRouter()
  const pathname = usePathname()
  const { signOut } = useClerk()
  const { user } = useUser()
  const { isAdmin } = useAdmin()

  const nav = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Profile Settings', href: '/profile', icon: UserRoundCog },
    { name: 'Billing & Plans', href: '/billing', icon: CreditCard },
    { name: 'View All Plans', href: '/pricing', icon: CreditCard },
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
    <div className="flex h-full w-64 flex-col bg-zinc-900 border-r border-zinc-700/50">
      <div className="flex h-16 items-center px-6 border-b border-zinc-800/50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-zinc-100">Gemz</span>
        </div>
      </div>

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
