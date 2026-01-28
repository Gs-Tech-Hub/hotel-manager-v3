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

  // Modal states
  const [showCreateSection, setShowCreateSection] = useState(false)
  const [incomingModalOpen, setIncomingModalOpen] = useState(false)
  const [pendingTransfers, setPendingTransfers] = useState<any[] | null>(null)
  const [loadingTransfers, setLoadingTransfers] = useState(false)

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
        <ParentDepartmentView
          loading={loading}
          canCreateSection={hasPermission('department_sections.create')}
          onCreateSection={() => setShowCreateSection(true)}
        >
          {children}
        </ParentDepartmentView>
      )}

      {/* Section/sub-department view */}
      {decodedCode.includes(':') && !error && (
        <>
          {/* Date Range Filter */}
          <div className="mb-4">
            <DateRangeFilter
              onDateChange={(from, to) => {
                setSectionFromDate(from)
                setSectionToDate(to)
              }}
              defaultFromDate={sectionFromDate}
              defaultToDate={sectionToDate}
            />
          </div>

          {/* Order Stats Card */}
          {department?.metadata?.sectionStats && (
            <OrderStatsCard
              totalOrders={department.metadata.sectionStats.totalOrders ?? 0}
              pendingOrders={department.metadata.sectionStats.pendingOrders ?? 0}
              processingOrders={
                department.metadata.sectionStats.processingOrders ?? 0
              }
              fulfilledOrders={department.metadata.sectionStats.fulfilledOrders ?? 0}
              amountFulfilled={department.metadata.sectionStats.amountFulfilled ?? 0}
              amountPaid={department.metadata.sectionStats.amountPaid ?? 0}
              totalAmount={department.metadata.sectionStats.totalAmount ?? 0}
            />
          )}

          {/* Products Section */}
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
        </>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end">
        {decodedCode.includes(':') && (
          <button
            onClick={() => setIncomingModalOpen(true)}
            className="px-3 py-1 border rounded text-sm"
          >
            Incoming
            {pendingTransfers && pendingTransfers.length > 0
              ? ` (${pendingTransfers.length})`
              : ''}
          </button>
        )}
      </div>

      {/* Modals */}
      <CreateSectionModal
        isOpen={showCreateSection}
        onClose={() => setShowCreateSection(false)}
        onSubmit={handleCreateSection}
      />

      <IncomingTransfersModal
        isOpen={incomingModalOpen}
        onClose={() => setIncomingModalOpen(false)}
        transfers={pendingTransfers}
        isLoading={loadingTransfers}
        onAcceptTransfer={markReceived}
        resolveStoreName={resolveStoreName}
        resolveProductName={resolveProductName}
      />
    </div>
  )
}
