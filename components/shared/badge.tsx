'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'
}

const badgeVariants: Record<string, string> = {
  default: 'border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50',
  secondary: 'border border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-800 dark:text-blue-50',
  destructive: 'border border-red-200 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-800 dark:text-red-50',
  outline: 'border border-slate-200 text-slate-900 dark:border-slate-700 dark:text-slate-50',
  success: 'border border-green-200 bg-green-50 text-green-900 dark:border-green-700 dark:bg-green-800 dark:text-green-50',
  warning: 'border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-800 dark:text-amber-50',
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        badgeVariants[variant] || badgeVariants.default,
        className
      )}
      {...props}
    />
  )
)
Badge.displayName = 'Badge'

export { Badge, badgeVariants }
