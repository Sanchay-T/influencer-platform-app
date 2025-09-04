'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Settings, 
  CreditCard, 
  Eye, 
  LogOut,
  TrendingUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Profile Settings', href: '/settings', icon: Settings },
  { name: 'Billing & Plans', href: '/billing', icon: CreditCard },
  { name: 'View All Plans', href: '/plans', icon: Eye },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-screen w-64 flex-col bg-zinc-900 border-r border-zinc-700/50">
      <div className="flex h-16 items-center px-6 border-b border-zinc-800/50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-zinc-100">Gemz</span>
        </div>
      </div>
      
      <nav className="flex-1 space-y-1 px-4 py-6">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center space-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-zinc-800/60 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800/30 hover:text-zinc-200'
              )}
            >
              <item.icon className={cn(
                "h-4 w-4 transition-colors duration-200",
                isActive ? "text-zinc-100" : "text-zinc-500 group-hover:text-zinc-300"
              )} />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* Trial Status */}
      <div className="p-4">
        <div className="rounded-lg bg-zinc-800/60 border border-zinc-700/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-zinc-300">7-Day Trial</span>
            <span className="text-xs bg-pink-400/20 text-pink-400 px-2 py-1 rounded-full border border-pink-400/30">
              Expired
            </span>
          </div>
          
          <div className="space-y-2 mb-4">
            <div className="text-sm text-zinc-200 font-medium">No trial</div>
            <div className="text-xs text-zinc-500">Trial has ended</div>
            <div className="w-full bg-zinc-700/50 rounded-full h-1.5">
              <div className="bg-pink-400 h-1.5 rounded-full" style={{ width: '100%' }}></div>
            </div>
            <div className="text-xs text-zinc-500">Searches Used: 0/3</div>
          </div>

          <Button className="w-full bg-pink-400 hover:bg-pink-500 text-white text-sm">
            Upgrade Now
          </Button>
        </div>
      </div>

      {/* User */}
      <div className="border-t border-zinc-700/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-sm font-bold text-white">
              R
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-zinc-300 truncate">ramongberrios+test123@gmail.com</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}