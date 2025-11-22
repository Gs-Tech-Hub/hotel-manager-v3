"use client"

import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Utensils, Coffee, Activity, Gamepad, BookOpen } from 'lucide-react'
import { useMemo } from 'react'
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
        <div>
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
              <SectionProductsTable products={sectionProducts} />
            )}
          </div>
        </div>
      )}

      <SectionsList children={children} childrenLoading={childrenLoading} />

      {decodedCode.includes(':') && (
        <PendingOrdersPanel pending={pendingOrderLines} onOpen={(line: any) => openPendingModal?.(line.productName)} />
      )}

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
    </div>
  )
}
