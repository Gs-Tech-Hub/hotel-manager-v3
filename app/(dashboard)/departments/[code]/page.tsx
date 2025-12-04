"use client"
import { useRouter, useParams } from 'next/navigation'
import { Utensils, Coffee, Activity, Gamepad, BookOpen } from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'
import { useAuth } from '@/components/auth-context'
import Price from '@/components/ui/Price'
import useDepartmentData from '../../../../components/departments/useDepartmentData'
import SectionsList from '../../../../components/departments/SectionsList'
import SectionProductsTable from '../../../../components/departments/SectionProductsTable'
// Pending orders panel removed — counts shown on the products table instead

type DepartmentInfo = {
  code: string
  name: string
  description?: string
  type?: string
  icon?: string
}

const iconForType: Record<string, any> = {
  restaurants: Utensils,
  bars: Coffee,
  gyms: Activity,
  games: Gamepad,
}

type MenuItem = {
  id: string
  inventoryId?: string
  name: string
  price?: number
  available?: boolean
}

type ProductDetail = {
  id: string
  name: string
  type: string
  available: number | boolean
  unitPrice?: number
  unitsSold?: number
  amountSold?: number
  pendingQuantity?: number
  reservedQuantity?: number
}

type ChildDept = DepartmentInfo & {
  totalOrders?: number
  pendingOrders?: number
  processingOrders?: number
  fulfilledOrders?: number
  stock?: { low: number; high: number; empty: number; totalProducts: number }
  products?: ProductDetail[]
}

export default function DepartmentDetail() {
  const { code } = useParams() as { code?: string }
  const decodedCode = useMemo(() => (code ? decodeURIComponent(code) : ''), [code])
  const router = useRouter()

  const {
    menu,
    loading,
    error,
    department,
    children,
    childrenLoading,
    deptLoading,
    sectionStock,
    sectionProducts,
    sectionProductsLoading,
    pendingOrderLines,
    pendingOrderLinesLoading,
    pendingModalOpen,
    pendingModalProduct,
    pendingModalItems,
    pendingModalLoading,
    openPendingModal,
    refreshPendingForModal,
    fetchSectionProducts,
    fetchPendingOrderLines,
    setPendingModalOpen,
    refreshDepartment,
    setPendingModalItems,
  } = useDepartmentData(decodedCode)

  const { hasPermission } = useAuth()

  // Create section modal state
  const [showCreateSection, setShowCreateSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [newSectionSlug, setNewSectionSlug] = useState('')
  const [creatingSection, setCreatingSection] = useState(false)
  const [createSectionError, setCreateSectionError] = useState<string | null>(null)

  const handleCreateSection = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!newSectionName) {
      setCreateSectionError('Please enter a name')
      return
    }
    if (!department?.id) {
      setCreateSectionError('Department not loaded')
      return
    }

    setCreatingSection(true)
    setCreateSectionError(null)
    try {
      const res = await fetch('/api/admin/department-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSectionName, slug: newSectionSlug || undefined, departmentId: department.id }),
      })
      const j = await res.json()
      if (!res.ok || !j?.success) {
        throw new Error(j?.error || 'Failed to create section')
      }

      setNewSectionName('')
      setNewSectionSlug('')
      setShowCreateSection(false)
      // refresh department data (children/sections)
      try { await (refreshDepartment as any)?.(decodedCode) } catch (e) { /* ignore */ }
    } catch (err: any) {
      console.error('create section error', err)
      setCreateSectionError(err?.message || 'Create failed')
    } finally {
      setCreatingSection(false)
    }
  }

  const [pendingTransfers, setPendingTransfers] = useState<any[] | null>(null)
  const [loadingTransfers, setLoadingTransfers] = useState(false)
  const [incomingModalOpen, setIncomingModalOpen] = useState(false)

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
      const res = await fetch(`/api/departments/${encodeURIComponent(decodedCode)}/transfer/${encodeURIComponent(id)}/approve`, { method: 'POST' })
      const j = await res.json()
      if (!res.ok || !j?.success) return alert(j?.error?.message || 'Receive failed')
      // refresh UI
      await fetchPendingTransfers(decodedCode)
      await fetchSectionProducts(decodedCode)
      alert('Transfer received')
    } catch (e: any) {
      console.error('markReceived error', e)
      alert(e?.message || 'Receive failed')
    }
  }

  const resolveStoreName = (t: any) => {
    // Prefer explicit friendly name returned by the API, fall back to known fields
    return t?.fromDepartmentName || t?.fromDepartmentCode || t?.fromDepartmentId || 'Unknown store'
  }

  const resolveProductName = (it: any) => {
    if (!it) return 'Unknown product'
    if (it.productName) return it.productName
    // try to find in current section products
    const p = sectionProducts?.find((s: any) => s.id === it.productId || s.inventoryId === it.productId)
    if (p && (p.name || p.productName)) return p.name || p.productName
    // try to find in menu
    const m = menu?.find((mm: any) => mm.inventoryId === it.productId || mm.id === it.productId)
    if (m) return m.name
    return it.productId || 'Unknown product'
  }

  

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-muted rounded-md">
            {(() => {
              const key = (department?.type || department?.code || code || '').toString().toLowerCase()
              const Icon = iconForType[key] ?? BookOpen
              return <Icon className="h-6 w-6" />
            })()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{department?.name || code}</h1>
            {department?.description && <div className="text-sm text-muted-foreground">{department.description}</div>}
            {sectionStock && (
              <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                <div className="text-sm font-medium text-blue-900">Stock Summary</div>
                <div className="text-sm text-blue-800 mt-1 grid grid-cols-2 gap-2">
                  <div><span className="font-semibold">Available:</span> {sectionStock.high}</div>
                  <div><span className="font-semibold">Low Stock:</span> {sectionStock.low}</div>
                  <div><span className="font-semibold">Out of Stock:</span> {sectionStock.empty}</div>
                  <div><span className="font-semibold">Total Products:</span> {sectionStock.totalProducts}</div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {decodedCode.includes(':') && (
            <button onClick={() => setIncomingModalOpen(true)} className="px-3 py-1 border rounded text-sm">Incoming{pendingTransfers && pendingTransfers.length > 0 ? ` (${pendingTransfers.length})` : ''}</button>
          )}
          {hasPermission('department_sections.create') && (
            <button onClick={() => setShowCreateSection(true)} className="px-3 py-1 bg-green-600 text-white rounded text-sm inline-flex items-center gap-2 hover:bg-green-700">
              Create Section
            </button>
          )}
          <button onClick={() => router.back()} className="px-3 py-1 border rounded text-sm">Back</button>
          <UpdateStatsButton code={decodedCode} refresh={() => { fetchSectionProducts(decodedCode); fetchPendingOrderLines(decodedCode); /* also refresh department metadata */ (refreshDepartment as any)?.(decodedCode) }} />
        </div>
      </div>
                
      {loading && <div className="text-sm text-muted-foreground">Loading ...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(!decodedCode.includes(':') && children.length === 0) && menu.map((m: MenuItem) => (
          <div key={m.id} className="border rounded p-4 bg-white">
            <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.available ? 'Available' : 'Unavailable'}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{m.price ? <Price amount={Number(m.price)} isMinor={true} /> : '-'}</div>
                </div>
              </div>
          </div>
        ))}
      </div>

      {decodedCode.includes(':') && (
        <>
          {/* Order Stats Card */}
          {department?.metadata?.sectionStats && (
            <div className="p-4 bg-green-50 rounded border border-green-200">
              <div className="text-sm font-medium text-green-900">Order Fulfillment Stats</div>
              <div className="text-sm text-green-800 mt-2 grid grid-cols-2 md:grid-cols-5 gap-3">
                <div><span className="font-semibold">{department.metadata.sectionStats.totalOrders ?? 0}</span> <span className="block text-xs text-green-700">Total Orders</span></div>
                <div><span className="font-semibold">{department.metadata.sectionStats.pendingOrders ?? 0}</span> <span className="block text-xs text-green-700">Pending</span></div>
                <div><span className="font-semibold">{department.metadata.sectionStats.processingOrders ?? 0}</span> <span className="block text-xs text-green-700">Processing</span></div>
                <div><span className="font-semibold">{department.metadata.sectionStats.fulfilledOrders ?? 0}</span> <span className="block text-xs text-green-700">Fulfilled</span></div>
                <div><span className="font-semibold"><Price amount={department.metadata.sectionStats.totalAmount ?? 0} isMinor={true} /></span> <span className="block text-xs text-green-700">Total Revenue</span></div>
              </div>
            </div>
          )}

          {/* Products Table */}
          <div className="mt-6">
            <h2 className="text-xl font-semibold">Products</h2>
            <div className="mt-3">
              {sectionProductsLoading ? (
                <div className="text-sm text-muted-foreground">Loading products...</div>
              ) : (
                <>
                  <SectionProductsTable products={sectionProducts} />

                  
                </>
              )}
            </div>
          </div>
        </>
      )}

      <SectionsList sections={children} loading={childrenLoading} />

      {showCreateSection && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <form onSubmit={handleCreateSection} className="bg-white p-6 rounded shadow w-80">
            <h3 className="text-lg font-semibold mb-2">Create Section</h3>
            {createSectionError && <div className="text-sm text-red-600 mb-2">{createSectionError}</div>}
            <input className="w-full mb-2 p-2 border rounded" placeholder="Name" value={newSectionName} onChange={e => setNewSectionName(e.target.value)} required />
            <input className="w-full mb-2 p-2 border rounded" placeholder="Slug (optional)" value={newSectionSlug} onChange={e => setNewSectionSlug(e.target.value)} />
            <div className="flex gap-2 mt-2">
              <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded" disabled={creatingSection}>{creatingSection ? 'Creating...' : 'Create'}</button>
              <button type="button" className="px-3 py-1 bg-gray-300 rounded" onClick={() => { setShowCreateSection(false); setCreateSectionError(null); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}


      {/* Transfer audit moved to Inventory page */}

      {/* Pending orders panel removed — details available via product Pending column */}
      {/* Incoming transfers modal */}
      {incomingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIncomingModalOpen(false)} />
          <div className="relative bg-white rounded-md w-full md:w-3/4 max-h-[80vh] overflow-auto p-4 z-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Incoming Transfers</h3>
              <button onClick={() => setIncomingModalOpen(false)} className="px-2 py-1 border rounded">Close</button>
            </div>
            {loadingTransfers ? <div className="text-sm">Loading...</div> : (
              <div className="space-y-3">
                {(pendingTransfers && pendingTransfers.length > 0) ? pendingTransfers.map((t: any) => (
                  <div key={t.id} className="p-3 border rounded flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium">From: {resolveStoreName(t)}</div>
                      <div className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</div>
                      <div className="text-sm mt-2">{t.items?.map((it: any) => <div key={it.id}>{resolveProductName(it)} x {it.quantity}</div>)}</div>
                    </div>
                    <div className="ml-4">
                      <button onClick={() => markReceived(t.id)} className="px-3 py-1 bg-green-600 text-white rounded">Accept</button>
                    </div>
                  </div>
                )) : <div className="text-sm text-muted-foreground">No incoming transfers.</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function UpdateStatsButton({ code, refresh }: { code: string; refresh: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (!code) return
    setBusy(true)
    try {
      const res = await fetch(`/api/departments/${encodeURIComponent(code)}/update-stats`, { method: 'POST' })
      
      const j = await res.json()
      if (!res.ok || !j?.success) {
        alert(j?.error?.message || 'Update failed')
        return
      }
      // Refresh local data
      try { await refresh() } catch (e) { console.warn('refresh after update failed', e) }
      alert('Department stats updated')
    } catch (e: any) {
      console.error('Update stats error', e)
      alert(e?.message || 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button onClick={run} className="px-3 py-1 border rounded text-sm" disabled={busy}>
      {busy ? 'Updating…' : 'Update Stats'}
    </button>
  )
}
