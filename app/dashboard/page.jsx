'use client'

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import DashboardLayout from "../components/layout/dashboard-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Loader2, BarChart3 } from "lucide-react";
import AnimatedSparkline from "../components/dashboard/animated-sparkline";
import AnimatedBarChart from "../components/dashboard/animated-bar-chart";
import { FavoriteInfluencersGrid } from "../components/dashboard/favorite-influencers-grid";
import { RecentListsSection } from "../components/dashboard/recent-lists";

const DASHBOARD_OVERVIEW_PATH = '/api/dashboard/overview';

export default function DashboardPage() {
  const [favorites, setFavorites] = useState([]);
  const [recentLists, setRecentLists] = useState([]);
  const [loadingHighlights, setLoadingHighlights] = useState(true);
  const [highlightsError, setHighlightsError] = useState(null);
  const [metrics, setMetrics] = useState({
    averageSearchMs: null,
    searchCount: 0,
    searchLimit: undefined,
    totalFavorites: 0,
  });

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
        const favoritesPayload = Array.isArray(data.favorites) ? data.favorites : [];
        setFavorites(favoritesPayload);
        setRecentLists(data.recentLists ?? []);
        const metricPayload = data.metrics ?? {};
        const rawLimit = metricPayload.searchLimit;
        setMetrics({
          averageSearchMs: typeof metricPayload.averageSearchMs === 'number' ? metricPayload.averageSearchMs : null,
          searchCount: typeof metricPayload.searchesLast30Days === 'number' ? metricPayload.searchesLast30Days : 0,
          searchLimit:
            rawLimit === null
              ? null
              : typeof rawLimit === 'number'
              ? rawLimit
              : undefined,
          totalFavorites:
            typeof metricPayload.totalFavorites === 'number'
              ? metricPayload.totalFavorites
              : favoritesPayload.length,
        });
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

        {/* Key metrics overview */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          <Card className="bg-zinc-900/80 border border-zinc-700/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Avg search time</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-zinc-100">
                {formatDuration(metrics.averageSearchMs)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Completed jobs in the last 30 days</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/80 border border-zinc-700/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Searches (30d / limit)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-zinc-100">
                {metrics.searchCount}
                <span className="text-base font-normal text-zinc-500">
                  {renderLimit(metrics.searchLimit)}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {metrics.searchLimit === null
                  ? 'Unlimited plan window'
                  : metrics.searchLimit === undefined
                  ? 'Usage data unavailable'
                  : 'Last 30 days usage versus plan limit'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/80 border border-zinc-700/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Total favorites</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-zinc-100">{metrics.totalFavorites}</p>
              <p className="mt-1 text-xs text-zinc-500">Creators surfaced on your dashboard</p>
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

function formatDuration(value) {
  if (typeof value !== 'number' || value <= 0) {
    return '—';
  }
  const totalSeconds = Math.round(value / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function renderLimit(limit) {
  if (limit === null) {
    return ' / ∞';
  }
  if (typeof limit !== 'number' || limit <= 0) {
    return '';
  }
  return ` / ${limit}`;
}
