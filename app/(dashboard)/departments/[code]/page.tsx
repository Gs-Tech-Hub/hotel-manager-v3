"use client"
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Utensils, Coffee, Activity, Gamepad, BookOpen } from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'
import useDepartmentData from '../../../../components/departments/useDepartmentData'
import SectionsList from '../../../../components/departments/SectionsList'
import SectionProductsTable from '../../../../components/departments/SectionProductsTable'
import PendingOrdersPanel from '../../../../components/departments/PendingOrdersPanel'
import PendingFulfillModal from '../../../../components/departments/PendingFulfillModal'

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
    setPendingModalItems,
  } = useDepartmentData(decodedCode)

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
              <div className="text-sm text-muted-foreground mt-2">
                <span className="font-medium">Section stock:</span> Low {sectionStock.low} / High {sectionStock.high} / Empty {sectionStock.empty} — Products: {sectionStock.totalProducts}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {decodedCode.includes(':') && (
            <button onClick={() => setIncomingModalOpen(true)} className="px-3 py-1 border rounded text-sm">Incoming{pendingTransfers && pendingTransfers.length > 0 ? ` (${pendingTransfers.length})` : ''}</button>
          )}
          <button onClick={() => router.back()} className="px-3 py-1 border rounded text-sm">Back</button>
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
                <div className="font-medium">{m.price ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(m.price)) : '-'}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {decodedCode.includes(':') && (
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
      )}

      <SectionsList children={children} childrenLoading={childrenLoading} />

      {decodedCode.includes(':') && (
        <PendingOrdersPanel pending={pendingOrderLines} onOpen={(line: any) => openPendingModal?.(line.productName)} />
      )}

      {/* Transfer audit moved to Inventory page */}

      <PendingFulfillModal
        open={pendingModalOpen}
        line={pendingModalItems && pendingModalItems.length > 0 ? pendingModalItems[0] : null}
        onClose={() => setPendingModalOpen(false)}
        onFulfilled={async () => {
          await fetchPendingOrderLines(decodedCode)
          await fetchSectionProducts(decodedCode)
          setPendingModalItems(null)
        }}
      />
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
