"use client"

import { useEffect, useState, useCallback } from 'react'

export default function useDepartmentData(decodedCode: string | undefined) {
  const [menu, setMenu] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [department, setDepartment] = useState<any | null>(null)
  const [children, setChildren] = useState<any[]>([])
  const [childrenLoading, setChildrenLoading] = useState(false)
  const [deptLoading, setDeptLoading] = useState(false)
  const [sectionStock, setSectionStock] = useState<any | null>(null)
  const [sectionProducts, setSectionProducts] = useState<any[] | null>(null)
  const [sectionProductsLoading, setSectionProductsLoading] = useState(false)
  const [pendingOrderLines, setPendingOrderLines] = useState<any[] | null>(null)
  const [pendingOrderLinesLoading, setPendingOrderLinesLoading] = useState(false)

  const [pendingModalOpen, setPendingModalOpen] = useState(false)
  const [pendingModalProduct, setPendingModalProduct] = useState<string | null>(null)
  const [pendingModalItems, setPendingModalItems] = useState<any[] | null>(null)
  const [pendingModalLoading, setPendingModalLoading] = useState(false)

  const fetchMenu = useCallback(async (code?: string) => {
    setLoading(true)
    setError(null)
    try {
      if (!code) throw new Error('Missing department code')
      if (code.includes(':')) {
        setMenu([])
        return
      }
      const res = await fetch(`/api/departments/${encodeURIComponent(code)}/menu`)
      if (!res.ok) throw new Error(`Failed to fetch menu (${res.status})`)
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || 'Invalid response')
      setMenu(json.data || [])
    } catch (err: any) {
      console.error('Failed to load department menu', err)
      setError(err?.message || 'Failed to load department menu')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSectionProducts = useCallback(async (sectionCode: string) => {
    setSectionProductsLoading(true)
    setSectionProducts(null)
    try {
      let parent = sectionCode
      if (sectionCode.includes(':')) {
        const parts = sectionCode.split(':')
        if (parts.length >= 2) parent = parts.slice(0, 2).join(':')
      }

      let url = `/api/departments/${encodeURIComponent(parent)}/products?details=true&section=${encodeURIComponent(sectionCode)}&pageSize=100`
      let res = await fetch(url)
      if (!res.ok) {
        url = `/api/departments/${encodeURIComponent(sectionCode)}/products?details=true&pageSize=100`
        res = await fetch(url)
      }

      if (!res.ok) {
        setSectionProducts([])
        return
      }
      const j = await res.json()
      const items = (j.data?.items || j.items || []) as any[]
      const products = items.map((it) => ({
        id: it.id,
        name: it.name,
        type: it.type,
        available: it.available,
        unitPrice: it.unitPrice,
        unitsSold: it.unitsSold || 0,
        amountSold: it.amountSold || 0,
        pendingQuantity: it.pendingQuantity || 0,
        reservedQuantity: it.reservedQuantity || 0,
      }))
      setSectionProducts(products)
    } catch (e) {
      console.error('fetchSectionProducts error', e)
      setSectionProducts([])
    } finally {
      setSectionProductsLoading(false)
    }
  }, [])

  const fetchPendingOrderLines = useCallback(async (sectionCode: string) => {
    setPendingOrderLinesLoading(true)
    setPendingOrderLines(null)
    try {
      const res = await fetch(`/api/departments/${encodeURIComponent(sectionCode)}/orders?status=pending&limit=200`)
      if (!res.ok) {
        setPendingOrderLines([])
        return
      }
      const j = await res.json()
      const orders = j.data?.orders || j.orders || []
      const lines: any[] = []
      for (const o of orders) {
        const hdr = o.orderHeader || o.order || o
        const lns = o.lines || []
        for (const l of lns) {
          lines.push({
            id: l.id,
            productName: l.productName || l.name,
            quantity: l.quantity,
            orderHeaderId: hdr?.id,
            orderId: hdr?.id,
            orderNumber: hdr?.orderNumber,
            customerName: hdr?.customer?.name || hdr?.customerName || null,
            status: l.status || 'pending'
          })
        }
      }
      setPendingOrderLines(lines)
    } catch (e) {
      console.error('fetchPendingOrderLines error', e)
      setPendingOrderLines([])
    } finally {
      setPendingOrderLinesLoading(false)
    }
  }, [])

  const loadChildrenForDepartment = useCallback(async (dept: any) => {
    setChildrenLoading(true)
    try {
      // Fetch child departments and admin sections in a single request to
      // reduce round-trips (previously the client called /departments?parentCode
      // and /api/departments/sections separately).
      const res = await fetch(`/api/departments/${encodeURIComponent(dept.code)}/children`)
      if (!res.ok) throw new Error('Failed to fetch children')
      const json = await res.json()
      const deps = json?.data?.departments || []
      const secs = json?.data?.sections || []

      const deptMapped = (deps as any[]).map((d) => {
        const stats = (d && d.metadata && d.metadata.sectionStats) ? d.metadata.sectionStats : null
        return ({
          code: d.code,
          name: d.name,
          description: d.description,
          type: d.type,
          icon: d.icon,
          sectionStats: stats,
          totalOrders: stats?.totalOrders ?? d.totalOrders ?? 0,
          pendingOrders: stats?.pendingOrders ?? d.pendingOrders ?? 0,
          processingOrders: stats?.processingOrders ?? d.processingOrders ?? 0,
          fulfilledOrders: stats?.fulfilledOrders ?? d.fulfilledOrders ?? 0,
        })
      })

      const secsMapped = (secs as any[]).map((s) => ({
        code: `${dept.code}:${s.slug || s.id}`,
        name: s.name,
        description: s.metadata?.description || s.metadata?.note || null,
        type: dept.type,
        icon: dept.icon,
        sectionStats: s.metadata?.sectionStats || null,
        totalOrders: s.metadata?.sectionStats?.totalOrders ?? 0,
        pendingOrders: s.metadata?.sectionStats?.pendingOrders ?? 0,
        processingOrders: s.metadata?.sectionStats?.processingOrders ?? 0,
        fulfilledOrders: s.metadata?.sectionStats?.fulfilledOrders ?? 0,
      }))

      const merged = [...deptMapped, ...secsMapped]
      setChildren(merged)
      return merged
    } catch (e) {
      console.error('Failed to load children', e)
      return []
    } finally {
      setChildrenLoading(false)
    }
  }, [setChildrenLoading])

  // Fetch department_sections (separate table) for a given department and map
  // them into the same shape used by `children` so UI can render them alongside
  // child departments (which are stored in the departments table).
  const fetchSectionsForDepartment = useCallback(async (dept: any) => {
    try {
      if (!dept || !dept.id) return []
      // Request a limited number of sections and avoid fetching heavy metadata
      const res = await fetch(`/api/departments/sections?departmentId=${encodeURIComponent(dept.id)}&limit=50`)
      if (!res.ok) return []
      const j = await res.json()
      const rows = j.data || []
      const mapped = (rows as any[]).map((s) => ({
        code: `${dept.code}:${s.slug || s.id}`,
        name: s.name,
        description: s.metadata?.description || s.metadata?.note || null,
        type: dept.type,
        icon: dept.icon,
        // Section-level stats may live in metadata
        sectionStats: s.metadata?.sectionStats || null,
        totalOrders: s.metadata?.sectionStats?.totalOrders ?? 0,
        pendingOrders: s.metadata?.sectionStats?.pendingOrders ?? 0,
        processingOrders: s.metadata?.sectionStats?.processingOrders ?? 0,
        fulfilledOrders: s.metadata?.sectionStats?.fulfilledOrders ?? 0,
      }))
      return mapped
    } catch (e) {
      console.error('fetchSectionsForDepartment error', e)
      return []
    }
  }, [])

  const refreshPendingForModal = useCallback(async (productName: string | null, code?: string) => {
    if (!productName || !code) return
    setPendingModalLoading(true)
    setPendingModalItems(null)
    try {
      const res = await fetch(`/api/departments/${encodeURIComponent(code)}/orders?status=pending&limit=200`)
      if (!res.ok) throw new Error('Failed to load pending orders')
      const j = await res.json()
      const orders = j.data?.orders || j.orders || []
      const matches: any[] = []
      for (const o of orders) {
        const hdr = o.orderHeader || o.order || o
        const lines = o.lines || []
        for (const l of lines) {
          if ((l.productName || l.name || '').toString().toLowerCase() === productName.toString().toLowerCase()) {
            matches.push({
              id: l.id,
              productName: l.productName || l.name,
              quantity: l.quantity,
              orderHeader: hdr,
              customerName: hdr?.customer?.name || hdr?.customerName || null,
            })
          }
        }
      }
      setPendingModalItems(matches)
    } catch (e) {
      console.error('refreshPendingForModal error', e)
      setPendingModalItems([])
    } finally {
      setPendingModalLoading(false)
    }
  }, [])

  const openPendingModal = useCallback(async (productName: string, code?: string) => {
    setPendingModalProduct(productName)
    setPendingModalOpen(true)
    await refreshPendingForModal(productName, code)
  }, [refreshPendingForModal])

  // NOTE: Removed a previous "defensive" window.fetch interceptor which
  // returned empty product lists for some department/product requests.
  // That interception caused section product fetches to return no items.
  // Let all requests go through to the API so section products and
  // inventory transfers behave correctly.

  // Fetch department and children sequencing
  useEffect(() => {
    const fetchDepartment = async () => {
      setDeptLoading(true)
      try {
        if (!decodedCode) return
        
        // For sections (code includes ':'), use consolidated /section endpoint
        if (decodedCode.includes(':')) {
          const sectionRes = await fetch(`/api/departments/${encodeURIComponent(decodedCode)}/section`)
          if (!sectionRes.ok) throw new Error('Failed to fetch section')
          const sectionJson = await sectionRes.json()
          const sectionData = sectionJson.data || {}
          
          // Map stats to metadata for UI compatibility
          const deptWithStats = {
            ...(sectionData.department || {}),
            metadata: {
              ...(sectionData.department?.metadata || {}),
              sectionStats: sectionData.stats || {},
            }
          }
          
          setDepartment(deptWithStats)
          setSectionStock(sectionData.stock || null)
          
          const products = sectionData.products?.items || []
          setSectionProducts(products.map((it: any) => ({
            id: it.id,
            name: it.name,
            type: it.type,
            available: it.available,
            unitPrice: it.unitPrice,
            unitsSold: it.unitsSold || 0,
            amountSold: it.amountSold || 0,
            pendingQuantity: it.pendingQuantity || 0,
            reservedQuantity: it.reservedQuantity || 0,
          })))
          
          await fetchPendingOrderLines(decodedCode)
        } else {
          // For parent departments, get basic info then load children
          const res = await fetch(`/api/departments/${encodeURIComponent(decodedCode)}`)
          if (!res.ok) throw new Error('Failed to fetch')
          const json = await res.json()
          const d = json.data || json
          setDepartment(d || null)

          if (d) {
            const found = await loadChildrenForDepartment(d)
            const secs = await fetchSectionsForDepartment(d)
            const merged = [...found, ...secs]
            if (!merged || merged.length === 0) {
              await fetchMenu(decodedCode)
            } else {
              setMenu([])
            }
            setChildren(merged)
          }
        }
      } catch (e) {
        console.error(e)
      } finally {
        setDeptLoading(false)
      }
    }

    fetchDepartment()
  }, [decodedCode, fetchMenu, fetchPendingOrderLines, loadChildrenForDepartment])

  // Expose a refresh function so callers can re-fetch department + section data on demand
  const refreshDepartment = async (code?: string) => {
    const useCode = code ?? decodedCode
    if (!useCode) return
    setDeptLoading(true)
    try {
      // For sections (code includes ':'), use consolidated /section endpoint
      if (useCode.includes(':')) {
        const sectionRes = await fetch(`/api/departments/${encodeURIComponent(useCode)}/section`)
        if (!sectionRes.ok) throw new Error('Failed to fetch section')
        const sectionJson = await sectionRes.json()
        const sectionData = sectionJson.data || {}
        
        // Map stats to metadata for UI compatibility
        const deptWithStats = {
          ...(sectionData.department || {}),
          metadata: {
            ...(sectionData.department?.metadata || {}),
            sectionStats: sectionData.stats || {},
          }
        }
        
        setDepartment(deptWithStats)
        setSectionStock(sectionData.stock || null)
        
        const products = sectionData.products?.items || []
        setSectionProducts(products.map((it: any) => ({
          id: it.id,
          name: it.name,
          type: it.type,
          available: it.available,
          unitPrice: it.unitPrice,
          unitsSold: it.unitsSold || 0,
          amountSold: it.amountSold || 0,
          pendingQuantity: it.pendingQuantity || 0,
          reservedQuantity: it.reservedQuantity || 0,
        })))
        
        await fetchPendingOrderLines(useCode)
      } else {
        const res = await fetch(`/api/departments/${encodeURIComponent(useCode)}`)
        if (!res.ok) throw new Error('Failed to fetch')
        const json = await res.json()
        const d = json.data || json
        setDepartment(d || null)

        if (d) {
          const found = await loadChildrenForDepartment(d)
          const secs = await fetchSectionsForDepartment(d)
          const merged = [...found, ...secs]
          if (!merged || merged.length === 0) {
            await fetchMenu(useCode)
          } else {
            setMenu([])
          }
          setChildren(merged)
        }
      }
    } catch (e) {
      console.error('refreshDepartment error', e)
    } finally {
      setDeptLoading(false)
    }
  }

  return {
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
    refreshDepartment,
    setPendingModalOpen,
    setPendingModalItems,
  }
}
