"use client"

import Link from 'next/link'
import { formatTablePrice } from '@/lib/formatters'
import { getDisplayUnit, formatQuantityWithUnit } from '@/lib/unit-mapper'
import { useEffect, useState } from 'react'

type Props = {
  products?: any[] | null
  departmentCode?: string
  sectionCode?: string
  pageSize?: number
  onDateChange?: (fromDate: string | null, toDate: string | null) => void
  dateFromFilter?: string | null
  dateToFilter?: string | null
}

export default function SectionProductsTable({ products: initialProducts, departmentCode, sectionCode, pageSize = 20, onDateChange, dateFromFilter, dateToFilter }: Props) {
  const [products, setProducts] = useState<any[] | null>(initialProducts ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState<number>(1)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [pageSizeState, setPageSizeState] = useState<number>(pageSize)
  
  // Helper to get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }
  
  // Default to today if no dates provided
  const [fromDate, setFromDate] = useState<string | null>(dateFromFilter ?? getTodayDate())
  const [toDate, setToDate] = useState<string | null>(dateToFilter ?? getTodayDate())

  // Sync parent date changes to internal state
  useEffect(() => {
    setFromDate(dateFromFilter ?? getTodayDate())
    setToDate(dateToFilter ?? getTodayDate())
    setPage(1) // Reset to first page when dates change
  }, [dateFromFilter, dateToFilter])

  // If caller provided products, use them initially; but when dates change, fetch fresh data
  useEffect(() => {
    let mounted = true
    const MAX_PAGE_SIZE = 100
    const ps = Math.min(MAX_PAGE_SIZE, Math.max(5, pageSizeState || 20))

    const fetchProducts = async () => {
      // If we have initial products AND no date filtering, use them
      if (initialProducts && !fromDate && !toDate) {
        setProducts(initialProducts)
        setTotalCount(initialProducts.length)
        setTotalPages(Math.max(1, Math.ceil(initialProducts.length / ps)))
        return
      }
      
      // Otherwise, fetch from consolidated /section endpoint
      if (!sectionCode) {
        setProducts([])
        return
      }
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          pageSize: String(ps),
        })
        
        if (fromDate) params.append('fromDate', fromDate)
        if (toDate) params.append('toDate', toDate)
        
        // Use consolidated /section endpoint instead of /products
        const url = `/api/departments/${encodeURIComponent(sectionCode)}/section${params.toString() ? '?' + params.toString() : ''}`
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to load section products')
        const j = await res.json()
        
        if (!j?.success) {
          throw new Error(j?.error?.message || 'Failed to load section products')
        }
        
        const sectionData = j.data || {}
        const items = (sectionData.products?.items || []) as any[]
        const total = Number(sectionData.products?.total ?? items.length)
        
        if (mounted) {
          setTotalCount(total)
          setTotalPages(Math.max(1, Math.ceil(total / ps)))
        }
        if (mounted) setProducts(items)
      } catch (e: any) {
        console.error('fetchSectionProducts error', e)
        if (mounted) {
          setError(e?.message || 'Failed to load products')
          setProducts([])
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchProducts()
    return () => { mounted = false }
  }, [initialProducts, sectionCode, pageSizeState, page, fromDate, toDate])

  // Debug: log prices
  useEffect(() => {
    if (products && products.length > 0) {
      console.log('[SectionProductsTable] Sample prices:', {
        first: {
          name: products[0].name,
          unitPrice: products[0].unitPrice,
          amountSold: products[0].amountSold,
        }
      })
    }
  }, [products])

  if (loading) return <div className="text-sm text-muted-foreground">Loading products...</div>
  if (error) return <div className="text-sm text-red-600">{error}</div>
  if (!products || products.length === 0) return <div className="text-sm text-muted-foreground">No items in this section</div>

  return (
    <div>
      <div className="mt-6 overflow-auto">
        <table className="w-full text-sm">
        <thead className="border-b">
          <tr>
            <th className="text-left py-2 px-2">Item</th>
            <th className="text-right py-2 px-2">Unit Price</th>
            <th className="text-right py-2 px-2">Available</th>
            <th className="text-right py-2 px-2">Units Sold</th>
            <th className="text-right py-2 px-2">Amount Sold</th>
            <th className="text-right py-2 px-2">Pending</th>
            <th className="text-right py-2 px-2"></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p: any) => (
            <tr key={p.id} className="border-t hover:bg-muted/50">
              <td className="py-2 px-2">
                <div className="font-medium">{p.name}</div>
                {p.sku && <div className="text-xs text-muted-foreground">{p.sku}</div>}
              </td>
              <td className="text-right py-2 px-2 text-muted-foreground">
                {p.unitPrice ? formatTablePrice(p.unitPrice) : '—'}
              </td>
              <td className="text-right py-2 px-2 font-medium">
                {formatQuantityWithUnit(p.available ?? 0, getDisplayUnit(p.category, p.itemType))}
              </td>
              <td className="text-right py-2 px-2">{p.unitsSold ?? 0}</td>
              <td className="text-right py-2 px-2">
                {p.amountSold ? formatTablePrice(p.amountSold) : formatTablePrice(0)}

              </td>
              <td className="text-right py-2 px-2">{p.pendingQuantity ?? 0}</td>
              <td className="text-right py-2 px-2">
                <Link href={p.posLink || `/inventory/${p.inventoryId || p.id}`} prefetch={false} className="text-sky-600 hover:text-sky-700 text-xs">View</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="text-sm text-muted-foreground">{totalCount} items</div>
        <div className="flex items-center gap-2">
          <label className="text-sm">Per page:</label>
          <select value={pageSizeState} onChange={(e) => { const v = Number(e.target.value); setPage(1); setPageSizeState(v); }} className="border rounded px-2 py-1">
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="px-2 py-1 border rounded">Prev</button>
          <div className="px-2">Page {page} / {totalPages}</div>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="px-2 py-1 border rounded">Next</button>
        </div>
      </div>
        </div>
      )
}
