'use client'

import React, { useEffect, useState } from 'react'

interface RadialProgressProps {
  value?: number // 0-100
  size?: number
}

export default function RadialProgress({ value = 64, size = 84 }: RadialProgressProps) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setProgress(value))
    return () => cancelAnimationFrame(id)
  }, [value])

  const offset = circumference - (progress / 100) * circumference

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={radius} className="fill-none stroke-zinc-800" strokeWidth={8} />
      <circle
        cx="50"
        cy="50"
        r={radius}
        className="fill-none stroke-emerald-500"
        strokeWidth={8}
        strokeLinecap="round"
        style={{
          strokeDasharray: `${circumference} ${circumference}`,
          strokeDashoffset: offset,
          transition: 'stroke-dashoffset 900ms ease-out'
        }}
      />
      <text x="50" y="54" textAnchor="middle" className="fill-zinc-200 text-[14px] font-semibold">
        {Math.round(progress)}%
      </text>
    </svg>
  )
}

