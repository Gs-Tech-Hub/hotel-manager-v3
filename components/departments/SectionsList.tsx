"use client"

import Link from 'next/link'

export default function SectionsList({ children, childrenLoading }: any) {
  if (childrenLoading) return <div className="text-sm text-muted-foreground">Loading sections...</div>
  if (!children || children.length === 0) return null

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold">Sections</h2>
      <div className="mt-3 space-y-3">
        {children.map((c: any) => (
          <div key={c.code} className="border rounded p-3 bg-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-sm text-muted-foreground">Code: <span className="font-mono">{c.code}</span></div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm">Orders: <span className="font-medium">{c.totalOrders ?? 0}</span></div>
                <div className="text-sm">Pending: <span className="font-medium">{c.pendingOrders ?? 0}</span></div>
                <div>
                  <Link href={`/departments/${encodeURIComponent(c.code)}`} prefetch={false} className="text-sm text-sky-600">Open</Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
