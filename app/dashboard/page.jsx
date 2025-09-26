'use client'

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import DashboardLayout from "../components/layout/dashboard-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Loader2, BarChart3 } from "lucide-react";
import AnimatedSparkline from "../components/dashboard/animated-sparkline";
import AnimatedBarChart from "../components/dashboard/animated-bar-chart";
import RadialProgress from "../components/dashboard/radial-progress";
import { FavoriteInfluencersGrid } from "../components/dashboard/favorite-influencers-grid";
import { RecentListsSection } from "../components/dashboard/recent-lists";

const DASHBOARD_OVERVIEW_PATH = '/api/dashboard/overview';

export default function DashboardPage() {
  const [favorites, setFavorites] = useState([]);
  const [recentLists, setRecentLists] = useState([]);
  const [loadingHighlights, setLoadingHighlights] = useState(true);
  const [highlightsError, setHighlightsError] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadDashboardHighlights() {
      setLoadingHighlights(true);
      setHighlightsError(null);
      try {
        const response = await fetch(DASHBOARD_OVERVIEW_PATH);
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to load dashboard data');
        }
        const data = await response.json();
        if (!active) return;
        setFavorites(data.favorites ?? []);
        setRecentLists(data.recentLists ?? []);
      } catch (error) {
        if (!active) return;
        setHighlightsError(error instanceof Error ? error.message : 'Failed to load dashboard data');
        toast.error('Unable to load dashboard highlights right now.');
      } finally {
        if (active) {
          setLoadingHighlights(false);
        }
      }
    }

    loadDashboardHighlights();
    return () => {
      active = false;
    };
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-zinc-400 mt-1">High-level overview and quick actions</p>
          </div>
          {/* Primary CTA already lives in the global header; remove duplicate here */}
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

        {/* Favorites section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-pink-400"></span>
            <h2 className="text-lg font-semibold text-zinc-100">Favorite Influencers</h2>
          </div>
          {loadingHighlights ? (
            <div className="flex h-32 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/60 text-sm text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading favorites…
            </div>
          ) : highlightsError ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-red-400">
              {highlightsError}
            </div>
          ) : (
            <FavoriteInfluencersGrid influencers={favorites} />
          )}
        </section>

        {/* Recent lists */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple-400"></span>
            <h2 className="text-lg font-semibold text-zinc-100">Recent Lists</h2>
          </div>
          {loadingHighlights ? (
            <div className="flex h-32 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/60 text-sm text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading lists…
            </div>
          ) : highlightsError ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-red-400">
              {highlightsError}
            </div>
          ) : (
            <RecentListsSection lists={recentLists} />
          )}
        </section>

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
