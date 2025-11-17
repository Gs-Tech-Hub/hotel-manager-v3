'use client'

import React from 'react'
import { cn } from '@/lib/cn'

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({
  className,
  children,
  variant = 'default',
  size = 'md',
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'

  const variants: Record<string, string> = {
    default: 'bg-sky-600 text-white hover:bg-sky-700 focus:ring-sky-500 dark:bg-sky-600 dark:hover:bg-sky-700',
    outline: 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-50 dark:hover:bg-slate-900',
    ghost: 'bg-transparent text-slate-900 hover:bg-slate-100 focus:ring-sky-500 dark:text-slate-50 dark:hover:bg-slate-800',
    destructive: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:bg-red-600 dark:hover:bg-red-700',
  }

  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  return (
    <button
      className={cn(baseStyles, variants[variant] ?? variants.default, sizes[size] ?? sizes.md, className)}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button
