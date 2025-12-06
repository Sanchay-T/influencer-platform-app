"use client";

import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Suspense } from "react"

const greens = [
  { key: "affc41", label: "AFFC41 (neon lime)" },
  { key: "89fc00", label: "89FC00 (vivid green)" },
  { key: "04e762", label: "04E762 (emerald)" },
]

function ThemePreviewContent() {
  const params = useSearchParams()
  const router = useRouter()
  const current = (params.get("green") || "affc41").toLowerCase()

  const setGreen = (key: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set("green", key)
    router.push(url.pathname + url.search)
  }

  return (
    <div className={`theme-neon green-${current} min-h-screen`}> 
      <div className="mx-auto max-w-5xl px-6 md:px-8 py-10">
        <h1 className="text-2xl font-bold mb-2">Theme Preview (Client Palette)</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Explore how the dashboard shell, campaigns table, and landing view look with the client's colors. 
          Use the green toggle to try the requested alternatives.
        </p>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Accent Green Variant</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {greens.map(g => (
                <Button
                  key={g.key}
                  size="sm"
                  variant={current === g.key ? "default" : "outline"}
                  onClick={() => setGreen(g.key)}
                >
                  {g.label}
                </Button>
              ))}
            </div>
            {/* Live swatches showing the current variables */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <div className="h-10 rounded-md bg-chart-1" />
                <p className="text-xs text-muted-foreground">chart-1 (Green)</p>
              </div>
              <div className="space-y-1">
                <div className="h-10 rounded-md bg-primary" />
                <p className="text-xs text-muted-foreground">primary (Magenta)</p>
              </div>
              <div className="space-y-1">
                <div className="h-10 rounded-md bg-accent" />
                <p className="text-xs text-muted-foreground">accent (Fandango)</p>
              </div>
              <div className="space-y-1">
                <div className="h-10 rounded-md bg-secondary" />
                <p className="text-xs text-muted-foreground">secondary (Gunmetal+)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1) Dashboard Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sidebar, sticky header with tabs/search, and sample KPI cards.
              </p>
              <Link href={`/theme-preview/dashboard?green=${current}`}>
                <Button>Open Dashboard Preview</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">2) Campaigns Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                A representative campaigns table and actions with the new palette.
              </p>
              <Link href={`/theme-preview/campaign?green=${current}`}>
                <Button>Open Campaigns Preview</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">3) Landing After Login</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                The first page after sign-in (shell + actions) under the palette.
              </p>
              <Link href={`/theme-preview/landing?green=${current}`}>
                <Button>Open Landing Preview</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">4) Pricing Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Plan cards and CTAs with client accents (magenta + green).
              </p>
              <Link href={`/theme-preview/pricing?green=${current}`}>
                <Button>Open Pricing Preview</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function ThemePreviewIndex() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ThemePreviewContent />
    </Suspense>
  )
}
