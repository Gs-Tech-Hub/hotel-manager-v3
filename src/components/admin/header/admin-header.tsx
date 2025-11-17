'use client'

import React from 'react'
import { Search, Bell, User } from 'lucide-react'
import { cn } from '@/lib/cn'

export function AdminHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 transition-all duration-300">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        {/* Page title / Breadcrumbs */}
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Admin Dashboard</p>
        </div>

        {/* Search */}
        <div className="hidden md:block flex-1 max-w-xs">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-10 pr-4 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </div>

        {/* Notifications & User Menu */}
        <div className="flex items-center gap-3">
          <button className="relative h-10 w-10 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <Bell className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
          </button>
          <button className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <User className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>
      </div>
    </header>
  )
}
