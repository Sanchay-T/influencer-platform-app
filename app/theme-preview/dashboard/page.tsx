"use client";

import DashboardLayout from "@/app/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import AnimatedSparkline from "@/app/components/dashboard/animated-sparkline"
import RadialProgress from "@/app/components/dashboard/radial-progress"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function DashboardContent() {
  const params = useSearchParams()
  const green = (params.get("green") || "affc41").toLowerCase()

  return (
    <div className={`theme-neon green-${green}`}> 
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Dashboard (Theme Preview)</h1>
              <p className="text-sm text-muted-foreground">Client palette applied via local CSS tokens.</p>
            </div>
            <Badge className="bg-primary text-primary-foreground">Magenta Primary</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Campaign Reach</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <div className="text-2xl font-bold">128.4k</div>
                  <AnimatedSparkline strokeClassName="stroke-current text-chart-1" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Up 12.4% vs last week</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Engagement Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <RadialProgress value={62} size={70} strokeClassName="stroke-current text-chart-1" />
                  <div>
                    <div className="text-2xl font-bold">6.2%</div>
                    <p className="text-xs text-muted-foreground">Green accent tracks ?green=…</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Conversions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-bold">742</div>
                  <span className="text-xs text-muted-foreground">in the last 7 days</span>
                </div>
                <Button className="mt-3">Create Campaign</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </div>
  )
}

export default function DashboardPreview() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  )
}
