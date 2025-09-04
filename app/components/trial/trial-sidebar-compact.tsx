"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Calendar } from "lucide-react"

type Status = {
  isLoaded: boolean
  isTrialing: boolean
  trialStatus?: "active" | "expired" | "converted" | "cancelled"
  trialStartDate?: string
  trialEndDate?: string
  trialProgressPercentage?: number
  daysRemaining?: number
  hasActiveSubscription?: boolean
  isPaidUser?: boolean
  usageInfo?: {
    campaignsUsed: number
    campaignsLimit: number
  }
}

export default function TrialSidebarCompact() {
  const [status, setStatus] = useState<Status>({ isLoaded: false, isTrialing: false })

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const res = await fetch("/api/billing/status", { cache: "no-store" })
        if (!res.ok) throw new Error("Failed to fetch status")
        const data = await res.json()
        if (!mounted) return
        setStatus({
          isLoaded: true,
          isTrialing: !!data.isTrialing,
          trialStatus: data.trialStatus,
          trialStartDate: data.trialStartDate,
          trialEndDate: data.trialEndDate,
          trialProgressPercentage: data.trialProgressPercentage,
          daysRemaining: data.daysRemaining,
          hasActiveSubscription: data.hasActiveSubscription,
          isPaidUser: data.hasActiveSubscription && data.currentPlan !== "free",
          usageInfo: data.usageInfo ? {
            campaignsUsed: data.usageInfo.campaignsUsed || 0,
            campaignsLimit: data.usageInfo.campaignsLimit || 0,
          } : undefined,
        })
      } catch (e) {
        if (!mounted) return
        setStatus((s) => ({ ...s, isLoaded: true }))
      }
    }
    load()
    const id = setInterval(load, 30000) // light polling for near realtime
    return () => { mounted = false; clearInterval(id) }
  }, [])

  const isExpired = status.trialStatus === "expired" || (!status.isTrialing && !status.isPaidUser)
  const progress = Math.max(0, Math.min(100, status.trialProgressPercentage ?? (isExpired ? 100 : 0)))

  return (
    <div className="rounded-lg bg-zinc-900/80 border border-zinc-700/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-zinc-800">
            <AlertTriangle className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-zinc-300">7‑Day Trial</span>
        </div>
        <Badge className={isExpired ? "bg-primary/20 text-primary border border-primary/30" : "bg-emerald-600/20 text-emerald-400 border border-emerald-600/30"}>
          {isExpired ? "Expired" : "Active"}
        </Badge>
      </div>

      <div className="space-y-3">
        <div className="text-lg font-semibold text-zinc-100">
          {isExpired ? "No trial" : `${status.daysRemaining ?? 0} days left`}
        </div>
        <div className="text-xs text-zinc-500">
          {isExpired ? "Trial has ended" : "Your trial is running"}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Trial Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-zinc-800" />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-zinc-400" />
            <span>Started:</span>
            <span className="text-zinc-300">
              {status.trialStartDate
                ? new Date(status.trialStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1 justify-end">
            <Calendar className="h-3 w-3 text-zinc-400" />
            <span>Expires:</span>
            <span className="text-zinc-300">
              {status.trialEndDate
                ? new Date(status.trialEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—'}
            </span>
          </div>
        </div>

        {status.usageInfo && status.usageInfo.campaignsLimit > 0 && (
          <div className="text-xs text-zinc-400">
            Searches Used: {status.usageInfo.campaignsUsed}/{status.usageInfo.campaignsLimit}
          </div>
        )}

        <Link href="/pricing" className="block">
          <Button className="w-full text-sm">Upgrade Now</Button>
        </Link>
        <Link href="/billing" className="block">
          <Button variant="outline" className="w-full text-sm">View Billing Details</Button>
        </Link>
      </div>
    </div>
  )
}
