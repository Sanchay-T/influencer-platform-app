'use client'

import DashboardLayout from "../components/layout/dashboard-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, TrendingUp, BarChart3, Users, FileText } from "lucide-react";
import Link from "next/link";
import AnimatedSparkline from "../components/dashboard/animated-sparkline";
import AnimatedBarChart from "../components/dashboard/animated-bar-chart";
import RadialProgress from "../components/dashboard/radial-progress";

export default function DashboardPage() {
  return (
    <DashboardLayout>

      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-zinc-400 mt-1">High-level overview and quick actions</p>
          </div>
          <Link href="/campaigns/new" className="inline-flex">
            <Button className="bg-pink-600 hover:bg-pink-500 text-white">
              <PlusCircle className="h-4 w-4 mr-2" /> New Campaign
            </Button>
          </Link>
        </div>

        {/* Stat cards with sparklines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          <Card className="bg-zinc-900/80 border border-zinc-700/50">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-zinc-400">Searches (7d)</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold">128</div>
                <div className="text-xs text-zinc-500">+12% vs prev</div>
              </div>
              <AnimatedSparkline data={[4,6,5,9,8,11,13]} />
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/80 border border-zinc-700/50">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-zinc-400">Creators Found</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold">2,945</div>
                <div className="text-xs text-zinc-500">+5% vs prev</div>
              </div>
              <AnimatedSparkline data={[8,9,7,10,12,11,15]} />
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/80 border border-zinc-700/50">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-zinc-400">Trial Conversion</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <RadialProgress value={42} />
                <div>
                  <div className="text-xl font-semibold">42%</div>
                  <div className="text-xs text-zinc-500">last 30 days</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Wide cards */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="bg-zinc-900/80 border border-zinc-700/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Search Activity</CardTitle>
                  <CardDescription>Last 14 days</CardDescription>
                </div>
                <BarChart3 className="h-5 w-5 text-zinc-500" />
              </div>
            </CardHeader>
            <CardContent>
              <AnimatedSparkline data={[5,6,7,8,6,9,11,10,12,13,12,14,13,15]} width={520} height={96} />
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/80 border border-zinc-700/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Top Platforms</CardTitle>
                  <CardDescription>Results by platform</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <AnimatedBarChart />
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
