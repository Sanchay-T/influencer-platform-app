'use client'

import React, { useEffect, useState } from 'react'

interface Item { label: string; value: number }

interface AnimatedBarChartProps {
  items?: Item[]
}

export default function AnimatedBarChart({
  items = [
    { label: 'TikTok', value: 62 },
    { label: 'Instagram', value: 38 },
    { label: 'YouTube', value: 24 }
  ]
}: AnimatedBarChartProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const max = Math.max(...items.map(i => i.value), 1)

  return (
    <div className="space-y-3">
      {items.map((i) => (
        <div key={i.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>{i.label}</span>
            <span>{i.value}</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded">
            <div
              className="h-2 rounded bg-pink-600 transition-all duration-700"
              style={{ width: mounted ? `${(i.value / max) * 100}%` : '0%' }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
