"use client"

import { useRouter } from 'next/navigation'
import { ReactNode } from 'react'
import { Trash2 } from 'lucide-react'

type ParentDepartmentViewProps = {
  children: any[]
  loading?: boolean
  onCreateSection?: () => void
  canCreateSection?: boolean
  createSectionLoading?: boolean
  onDeleteSection?: (sectionCode: string) => void
  canDeleteSection?: boolean
  deletingSection?: string | null
}

export default function ParentDepartmentView({
  children,
  loading = false,
  onCreateSection,
  canCreateSection = false,
  createSectionLoading = false,
  onDeleteSection,
  canDeleteSection = false,
  deletingSection = null,
}: ParentDepartmentViewProps) {
  const router = useRouter()

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading sections...</div>
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Sections</h2>
        {canCreateSection && onCreateSection && (
          <button
            onClick={onCreateSection}
            disabled={createSectionLoading}
            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {createSectionLoading ? 'Creating...' : 'Create Section'}
          </button>
        )}
      </div>

      {!children || children.length === 0 ? (
        <div className="text-sm text-muted-foreground">No sections available</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {children.map((c: any) => (
            <div
              key={c.code}
              className="border rounded p-4 bg-white hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => router.push(`/departments/${encodeURIComponent(c.code)}`)}
                >
                  <h3 className="font-semibold text-lg">{c.name}</h3>
                  {c.description && (
                    <p className="text-sm text-muted-foreground mt-1">{c.description}</p>
                  )}
                  <div className="text-xs text-muted-foreground mt-2">
                    Code: <span className="font-mono">{c.code}</span>
                  </div>
                </div>
                <div className="text-right ml-4 flex flex-col gap-2">
                  <div className="text-sm">
                    <div>
                      <span className="font-medium">{c.totalOrders ?? 0}</span> orders
                    </div>
                    <div className="text-xs text-yellow-600 font-medium">
                      {c.pendingOrders ?? 0} pending
                    </div>
                  </div>
                  {canDeleteSection && onDeleteSection && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteSection(c.code)
                      }}
                      disabled={deletingSection === c.code}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      title="Delete section"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
