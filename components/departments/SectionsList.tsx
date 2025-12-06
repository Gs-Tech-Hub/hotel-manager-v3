"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Props = {
  sections?: any[] | null
  loading?: boolean
  departmentCode?: string
}

export default function SectionsList({ sections: initialSections, loading: initialLoading, departmentCode }: Props) {
  const [sections, setSections] = useState<any[] | null>(initialSections ?? null)
  const [loading, setLoading] = useState<boolean>(initialLoading ?? false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const fetchSections = async () => {
      if (initialSections) return
      if (!departmentCode) {
        setSections([])
        return
      }
      setLoading(true)
      setError(null)
      try {
        // Prefer department child departments endpoint which is limited server-side
        const res = await fetch(`/api/departments?parentCode=${encodeURIComponent(departmentCode)}`)
        if (!res.ok) throw new Error('Failed to load sections')
        const j = await res.json()
        const rows = j.data || j || []
        const mapped = (rows as any[]).map((d) => ({
          code: d.code,
          name: d.name,
          description: d.description,
          totalOrders: d.metadata?.sectionStats?.totalOrders ?? d.totalOrders ?? 0,
          pendingOrders: d.metadata?.sectionStats?.pendingOrders ?? d.pendingOrders ?? 0,
        }))
        if (mounted) setSections(mapped)
      } catch (e: any) {
        console.error('fetch sections error', e)
        if (mounted) {
          setError(e?.message || 'Failed to load sections')
          setSections([])
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchSections()
    return () => { mounted = false }
  }, [initialSections, departmentCode])

  if (loading) return <div className="text-sm text-muted-foreground">Loading sections...</div>
  if (error) return <div className="text-sm text-red-600">{error}</div>
  if (!sections || sections.length === 0) return null

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold">Sections</h2>
      <div className="mt-3 space-y-3">
        {sections.map((c: any) => (
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
