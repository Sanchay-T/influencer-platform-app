'use client'

import type { CSSProperties } from 'react'
import { useTheme } from 'next-themes'
import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()
  const resolvedTheme: ToasterProps['theme'] =
    theme === 'light' || theme === 'dark' || theme === 'system'
      ? theme
      : 'system'
  const toasterStyle: CSSProperties = {
    '--normal-bg': 'var(--popover)',
    '--normal-text': 'var(--popover-foreground)',
    '--normal-border': 'var(--border)',
  }

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      style={toasterStyle}
      {...props}
    />
  )
}

export { Toaster }
