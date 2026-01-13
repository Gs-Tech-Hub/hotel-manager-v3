'use client'

import React, { useState, createContext, useContext } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Sun, LogOut } from 'lucide-react'
import { cn } from '@/lib/cn'

const SidebarContext = createContext<{ isCollapsed: boolean }>({ isCollapsed: false })
export const useSidebar = () => useContext(SidebarContext)

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', href: '/' },
  { id: 'departments', label: 'Departments', icon: '🏢', href: '/departments' },
  { id: 'rooms', label: 'Rooms', icon: '🏠', href: '/rooms' },
  { id: 'bookings', label: 'Bookings', icon: '📅', href: '/bookings' },
  { id: 'customers', label: 'Customers', icon: '👥', href: '/customers' },
  { id: 'orders', label: 'Orders', icon: '🛒', href: '/orders' },
  { id: 'inventory', label: 'Inventory', icon: '📦', href: '/inventory' },
  { id: 'staff', label: 'Staff', icon: '👨‍💼', href: '/staff' },
  { id: 'settings', label: 'Settings', icon: '⚙️', href: '/settings' },
]

export function AdminSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <SidebarContext.Provider value={{ isCollapsed }}>
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen border-r border-slate-200 bg-white transition-all duration-300 dark:border-slate-700 dark:bg-slate-950',
          isCollapsed ? 'w-20' : 'w-64'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
          <div className={cn('font-bold text-lg', isCollapsed && 'hidden')}>
            🏨 Admin
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {isCollapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <span className="text-lg flex-shrink-0">{item.icon}</span>
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="space-y-2 border-t border-slate-200 p-3 dark:border-slate-700">
          <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
            <Sun className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span>Theme</span>}
          </button>
          <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </SidebarContext.Provider>
  )
}
