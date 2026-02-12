"use client"
import { useRouter, useParams } from 'next/navigation'
import { useMemo, useState, useEffect } from 'react'
import { useAuth } from '@/components/auth-context'
import DateRangeFilter from '../../../../components/departments/DateRangeFilter'
import useDepartmentData from '../../../../components/departments/useDepartmentData'
import SectionProductsTable from '../../../../components/departments/SectionProductsTable'
import DepartmentHeader from '../../../../components/departments/DepartmentHeader'
import OrderStatsCard from '../../../../components/departments/OrderStatsCard'
import CreateSectionModal from '../../../../components/departments/CreateSectionModal'
import IncomingTransfersModal from '../../../../components/departments/IncomingTransfersModal'
import ParentDepartmentView from '../../../../components/departments/ParentDepartmentView'
import SectionProductsView from '../../../../components/departments/SectionProductsView'
import { DepartmentGames } from '../../../../components/games/department-games'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'


export default function DepartmentDetail() {
  const { code } = useParams() as { code?: string }
  const decodedCode = useMemo(() => (code ? decodeURIComponent(code) : ''), [code])
  const router = useRouter()

  // Helper to get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  // Date filter state - default to today
  const [sectionFromDate, setSectionFromDate] = useState<string | null>(getTodayDate())
  const [sectionToDate, setSectionToDate] = useState<string | null>(getTodayDate())
  const [sectionStats, setSectionStats] = useState<any>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  // Modal states
  const [showCreateSection, setShowCreateSection] = useState(false)
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [pendingTransfers, setPendingTransfers] = useState<any[] | null>(null)
  const [loadingTransfers, setLoadingTransfers] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('overview')

  const {
    menu,
    loading,
    error,
    department,
    children,
    sectionStock,
    sectionProducts,
    sectionProductsLoading,
    refreshDepartment,
  } = useDepartmentData(decodedCode, sectionFromDate, sectionToDate)

  const { hasPermission } = useAuth()

  // Handle create section - extract to modal
  const handleCreateSection = async (name: string, slug: string) => {
    if (!department?.id) {
      throw new Error('Department not loaded')
    }

    const res = await fetch('/api/departments/sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug: slug || undefined, departmentId: department.id }),
    })
    const j = await res.json()
    if (!res.ok || !j?.success) {
      throw new Error(j?.error || 'Failed to create section')
    }

    // refresh department data (children/sections)
    try {
      await (refreshDepartment as any)?.(decodedCode)
    } catch (e) {
      /* ignore */
    }
  }

  // Handle pending transfers
  const fetchPendingTransfers = async (code: string) => {
    setLoadingTransfers(true)
    try {
      const url = `/api/departments/${encodeURIComponent(code)}/transfer/list?direction=received&pageSize=50`
      const res = await fetch(url)
      if (!res.ok) {
        setPendingTransfers([])
        return
      }
      const j = await res.json()
      const items = j.data?.items || []
      setPendingTransfers(items.filter((t: any) => t.status === 'pending'))
    } catch (e) {
      console.error('fetchPendingTransfers error', e)
      setPendingTransfers([])
    } finally {
      setLoadingTransfers(false)
    }
  }

  useEffect(() => {
    if (decodedCode && decodedCode.includes(':')) {
      fetchPendingTransfers(decodedCode)
    }
  }, [decodedCode])

  // Fetch stats for selected date range
  const fetchSectionStats = async (code: string, fromDate: string | null, toDate: string | null) => {
    if (!fromDate || !toDate) return

    setStatsLoading(true)
    try {
      const url = `/api/departments/${encodeURIComponent(code)}/stats?fromDate=${fromDate}&toDate=${toDate}`
      const res = await fetch(url)
      if (!res.ok) {
        console.error('Failed to fetch stats:', res.statusText)
        setSectionStats(null)
        return
      }
      const j = await res.json() as any
      setSectionStats(j.data?.stats || null)
    } catch (e) {
      console.error('fetchSectionStats error', e)
      setSectionStats(null)
    } finally {
      setStatsLoading(false)
    }
  }

  // Fetch stats when code or dates change
  useEffect(() => {
    if (decodedCode && decodedCode.includes(':') && sectionFromDate && sectionToDate) {
      fetchSectionStats(decodedCode, sectionFromDate, sectionToDate)
    }
  }, [decodedCode, sectionFromDate, sectionToDate])

  const markReceived = async (id: string) => {
    try {
      const res = await fetch(
        `/api/departments/${encodeURIComponent(decodedCode)}/transfer/${encodeURIComponent(id)}/approve`,
        { method: 'POST' }
      )
      const j = await res.json()
      if (!res.ok || !j?.success) {
        alert(j?.error?.message || 'Receive failed')
        return
      }
      // refresh UI
      await refreshDepartment(decodedCode)
      await fetchPendingTransfers(decodedCode)
      alert('Transfer received')
    } catch (e: any) {
      console.error('markReceived error', e)
      alert(e?.message || 'Receive failed')
    }
  }

  const resolveStoreName = (t: any) => {
    // Prefer explicit friendly name returned by the API, fall back to known fields
    return (
      t?.fromDepartmentName ||
      t?.fromDepartmentCode ||
      t?.fromDepartmentId ||
      'Unknown store'
    )
  }

  const resolveProductName = (it: any) => {
    if (!it) return 'Unknown product'
    if (it.productName) return it.productName
    // try to find in current section products
    const p = sectionProducts?.find(
      (s: any) => s.id === it.productId || s.inventoryId === it.productId
    )
    if (p && (p.name || p.productName)) return p.name || p.productName
    // try to find in menu
    const m = menu?.find(
      (mm: any) => mm.inventoryId === it.productId || mm.id === it.productId
    )
    if (m) return m.name
    return it.productId || 'Unknown product'
  }

  

  return (
    <div className="space-y-6">
      {/* Header with department info */}
      <DepartmentHeader
        department={department}
        sectionStock={sectionStock}
        onBack={() => router.back()}
        pendingTransfers={pendingTransfers}
        loadingTransfers={loadingTransfers}
        onAcceptTransfer={markReceived}
        resolveStoreName={resolveStoreName}
        resolveProductName={resolveProductName}
      />

      {/* Loading and error states */}
      {loading && <div className="text-sm text-muted-foreground">Loading ...</div>}
      {error && (
        <div className="text-sm text-red-600 p-4 bg-red-50 rounded border border-red-200">
          ⚠️ {error}
        </div>
      )}

      {/* Parent department sections */}
      {!decodedCode.includes(':') && !error && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {department?.type === 'games' && (
              <TabsTrigger value="games">Games</TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            <ParentDepartmentView
              loading={loading}
              canCreateSection={hasPermission('department_sections.create')}
              onCreateSection={() => setShowCreateSection(true)}
            >
              {children}
            </ParentDepartmentView>
          </TabsContent>

          {department?.type === 'games' && (
            <TabsContent value="games">
              <DepartmentGames 
                departmentCode={decodedCode}
                departmentId={department?.id || ''}
              />
            </TabsContent>
          )}
        </Tabs>
      )}

      {/* Section/sub-department view */}
      {decodedCode.includes(':') && !error && (
        <>
          {/* Date Range Filter + Stats Button */}
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex-1">
              <DateRangeFilter
                onDateChange={(from, to) => {
                  setSectionFromDate(from)
                  setSectionToDate(to)
                }}
                defaultFromDate={sectionFromDate}
                defaultToDate={sectionToDate}
              />
            </div>
            {sectionStats && (
              <button
                onClick={() => setShowStatsModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
              >
                📊 View Stats
              </button>
            )}
          </div>

          {/* Products Section (or Games UI for games departments) */}
          {department?.type === 'games' ? (
            <div className="mt-6">
              <h2 className="text-xl font-semibold">Games Management</h2>
              <div className="mt-3">
                <DepartmentGames
                  departmentCode={decodedCode.split(':')[0]}
                  departmentId={department?.id || ''}
                />
              </div>
            </div>
          ) : (
            <SectionProductsView
              code={decodedCode}
              departmentCode={decodedCode.split(':')[0]}
              defaultFromDate={sectionFromDate}
              defaultToDate={sectionToDate}
            >
              {sectionProductsLoading ? (
                <div className="text-sm text-muted-foreground">Loading products...</div>
              ) : (
                <SectionProductsTable
                  products={sectionProducts}
                  departmentCode={decodedCode.split(':')[0]}
                  sectionCode={decodedCode}
                  onDateChange={(from, to) => {
                    setSectionFromDate(from)
                    setSectionToDate(to)
                  }}
                  dateFromFilter={sectionFromDate}
                  dateToFilter={sectionToDate}
                />
              )}
            </SectionProductsView>
          )}
        </>
      )}

      {/* Modals */}
      <CreateSectionModal
        isOpen={showCreateSection}
        onClose={() => setShowCreateSection(false)}
        onSubmit={handleCreateSection}
      />

      {/* Stats Modal */}
      {showStatsModal && sectionStats && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Order Statistics</h2>
              <button
                onClick={() => setShowStatsModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <OrderStatsCard
                unpaidStats={sectionStats.unpaid}
                paidStats={sectionStats.paid}
                aggregatedStats={sectionStats.aggregated}
              />
            </div>
          </div>
        </div>
      )}

     
    </div>
  )
}
