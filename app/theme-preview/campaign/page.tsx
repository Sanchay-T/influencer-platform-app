"use client"

import DashboardLayout from "@/app/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

const rows = [
  { name: "Spring Launch", platform: "TikTok", status: "active", creators: 24, updated: "2d ago" },
  { name: "Creator Collab A", platform: "Instagram", status: "draft", creators: 8, updated: "5d ago" },
  { name: "UGC Test", platform: "YouTube", status: "completed", creators: 11, updated: "1w ago" },
]

function CampaignContent() {
  const params = useSearchParams()
  const green = (params.get("green") || "affc41").toLowerCase()

  return (
    <div className={`theme-neon green-${green}`}> 
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Campaigns (Theme Preview)</h1>
              <p className="text-sm text-muted-foreground">Presentational table using the palette tokens.</p>
            </div>
            <Button>Create Campaign</Button>
          </div>

          <div className="flex items-center gap-3">
            <Input placeholder="Filter campaigns…" className="w-64" />
            <Button variant="outline">Filters</Button>
          </div>

          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-sm text-muted-foreground">Recent Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border">
                      <TableHead>Name</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Creators</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, idx) => (
                      <TableRow key={idx} className="table-row">
                        <TableCell className="font-medium text-primary">{r.name}</TableCell>
                        <TableCell>{r.platform}</TableCell>
                        <TableCell>
                          <span className="text-xs px-2 py-1 rounded-full border border-chart-1/40 bg-chart-1/10 text-chart-1">
                            {r.status}
                          </span>
                        </TableCell>
                        <TableCell>{r.creators}</TableCell>
                        <TableCell className="text-muted-foreground">{r.updated}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </div>
  )
}

export default function CampaignPreview() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CampaignContent />
    </Suspense>
  )
}
