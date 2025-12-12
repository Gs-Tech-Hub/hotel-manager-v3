"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { RotateCcw, Plus } from "lucide-react"
import Price from '@/components/ui/Price'

type Section = {
  id: string
  name: string
  slug: string
  departmentCode: string
  departmentName: string
  today: { count: number; total: number }
}

type Terminal = {
  id: string
  name: string
  slug?: string
  departmentCode?: string
  departmentName?: string
  status?: string
  sections?: Section[]
  today?: { count: number; total: number }
}

type TabType = 'terminals' | 'sections'

export default function POSTerminalsIndex() {
  const [terminals, setTerminals] = useState<Terminal[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('terminals')

  const fetchTerminals = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/pos/terminals')
      if (!res.ok) throw new Error(`Failed to fetch terminals (${res.status})`)
      const json = await res.json()
      if (!json || !json.success) throw new Error(json?.error || 'Invalid response')
      setTerminals(json.data || [])
    } catch (err: any) {
      console.error('Failed to load terminals', err)
      setError(err?.message || 'Failed to load terminals')
    } finally {
      setLoading(false)
    }
  }

  const fetchSections = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/pos/sections')
      if (!res.ok) throw new Error(`Failed to fetch sections (${res.status})`)
      const json = await res.json()
      if (!json || !json.success) throw new Error(json?.error || 'Invalid response')
      setSections(json.data || [])
    } catch (err: any) {
      console.error('Failed to load sections', err)
      setError(err?.message || 'Failed to load sections')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    if (activeTab === 'terminals') {
      fetchTerminals()
    } else {
      fetchSections()
    }
  }

  useEffect(() => {
    fetchTerminals()
    fetchSections()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">POS Sales Platform</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage terminals and initiate sales on sections</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleRefresh} 
            disabled={loading}
            className="px-3 py-2 border rounded text-sm flex items-center gap-2 hover:bg-gray-50 disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Refresh
          </button>
          <button className="px-3 py-2 bg-blue-600 text-white rounded text-sm flex items-center gap-2 hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            New Terminal
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('terminals')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'terminals'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            POS Terminals ({terminals.length})
          </button>
          <button
            onClick={() => setActiveTab('sections')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'sections'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Sales Sections ({sections.length})
          </button>
        </div>
      </div>

      {/* Terminals Tab */}
      {activeTab === 'terminals' && (
        <div className="space-y-4">
          {loading && <div className="text-sm text-muted-foreground">Loading terminals...</div>}
          {terminals.length === 0 && !loading && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
              No terminals configured. Create one to get started.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {terminals.map((t) => (
              <div key={t.id} className="border rounded-lg p-4 bg-white hover:shadow-md transition">
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{t.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">{t.departmentName || 'No department'}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${t.status === 'online' ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-xs text-gray-600">{t.status ?? 'unknown'}</span>
                  </div>

                  {t.today && (
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="text-xs text-gray-600">Today&apos;s Sales</div>
                      <div className="flex justify-between items-baseline mt-1">
                        <span className="font-semibold text-gray-900">{t.today.count} transactions</span>
                        <span className="text-sm text-gray-700">
                          <Price amount={Math.round(t.today.total)} isMinor={true} />
                        </span>
                      </div>
                    </div>
                  )}

                  {t.sections && t.sections.length > 0 && (
                    <div className="text-xs">
                      <div className="text-gray-600 mb-1">{t.sections.length} sections available</div>
                      <div className="flex flex-wrap gap-1">
                        {t.sections.slice(0, 3).map((s) => (
                          <span key={s.id} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                            {s.name}
                          </span>
                        ))}
                        {t.sections.length > 3 && (
                          <span className="px-2 py-1 text-gray-600 text-xs">+{t.sections.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  )}

                  <Link
                    href={`/pos-terminals/${encodeURIComponent(t.slug ?? t.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, ''))}/checkout`}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition text-center block"
                  >
                    Open Terminal
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sections Tab */}
      {activeTab === 'sections' && (
        <div className="space-y-4">
          {loading && <div className="text-sm text-muted-foreground">Loading sections...</div>}
          {sections.length === 0 && !loading && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
              No sections available. Create department sections first.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sections.map((section) => (
              <div key={section.id} className="border rounded-lg p-4 bg-white hover:shadow-md transition">
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{section.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">{section.departmentName}</p>
                  </div>

                  {section.today && (
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="text-xs text-gray-600">Today&apos;s Sales</div>
                      <div className="flex justify-between items-baseline mt-1">
                        <span className="font-semibold text-gray-900">{section.today.count} tx</span>
                        <span className="text-sm text-gray-700">
                          <Price amount={Math.round(section.today.total)} isMinor={true} />
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      // Initiate sales on this section
                      window.location.href = `/pos-terminals/checkout?section=${section.id}`
                    }}
                    className="w-full px-3 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 transition"
                  >
                    Start Sale
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
