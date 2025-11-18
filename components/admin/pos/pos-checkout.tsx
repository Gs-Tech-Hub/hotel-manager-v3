"use client"

import { useEffect, useState } from "react"
import { POSCategorySelector } from "@/components/admin/pos/pos-category-selector"
import { POSProductGrid, POSProduct } from "@/components/admin/pos/pos-product-grid"
import { POSCart, CartLine } from "@/components/admin/pos/pos-cart"
import { POSPayment } from "@/components/admin/pos/pos-payment"
import { POSReceipt } from "@/components/admin/pos/pos-receipt"

export default function POSCheckoutShell({ terminalId }: { terminalId?: string }) {
  const [category, setCategory] = useState<string | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [showPayment, setShowPayment] = useState(false)
  const [receipt, setReceipt] = useState<any | null>(null)
  const [products, setProducts] = useState<POSProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(terminalId ?? null)
  const [terminalError, setTerminalError] = useState<string | null>(null)

  const categories = [
    { id: 'foods', name: 'Foods' },
    { id: 'drinks', name: 'Drinks' },
    { id: 'retail', name: 'Retail' },
  ]

  const sampleProducts: POSProduct[] = [
    // kept as fallback only
    { id: 'p1', name: 'Espresso', price: 4.5, available: true },
    { id: 'p2', name: 'Croissant', price: 3.0, available: true },
    { id: 'p3', name: 'Bottled Water', price: 2.25, available: true },
  ]

  const handleAdd = (p: POSProduct) => {
    const existing = cart.find((c) => c.productId === p.id)
    if (existing) {
      setCart((s) => s.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l)))
      return
    }
    setCart((s) => [
      ...s,
      { lineId: Math.random().toString(36).slice(2), productId: p.id, productName: p.name, quantity: 1, unitPrice: p.price },
    ])
  }

  const handleRemove = (lineId: string) => setCart((s) => s.filter((l) => l.lineId !== lineId))
  const handleQty = (lineId: string, qty: number) => setCart((s) => s.map((l) => (l.lineId === lineId ? { ...l, quantity: Math.max(1, qty) } : l)))

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0)
  const tax = subtotal * 0.1
  const total = subtotal + tax

  const handlePaymentComplete = (payment: any) => {
    // Post to mock orders endpoint (in production this should point to /api/orders)
    ;(async () => {
      try {
        const payload = {
          terminalId: selectedTerminal ?? terminalId ?? null,
          items: cart,
          subtotal,
          tax,
          total,
          payment,
        }

        const res = await fetch('/api/mock/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const json = await res.json()
        if (res.ok && json && json.success) {
          setReceipt(json.data)
          setCart([])
        } else {
          // fallback to local receipt if mock server fails
          const receipt = {
            orderNumber: `T-${Date.now()}`,
            items: cart,
            subtotal,
            tax,
            total,
            payment,
          }
          setReceipt(receipt)
        }
      } catch (err) {
        console.error('Error posting to mock orders:', err)
        const receipt = {
          orderNumber: `T-${Date.now()}`,
          items: cart,
          subtotal,
          tax,
          total,
          payment,
        }
        setReceipt(receipt)
      } finally {
        setShowPayment(false)
      }
    })()
  }

  // Sample terminals (in real app fetch terminals / assigned department)
  const terminals = [
    { id: 'term-1', name: 'Front Desk - Restaurant', departmentCode: 'restaurant' },
    { id: 'term-2', name: 'Bar - Main Bar', departmentCode: 'bar' },
    { id: 'term-3', name: 'Poolside - Cafe', departmentCode: 'pool' },
  ]

  useEffect(() => {
    // If a terminal is selected, fetch its department menu
    const code = terminals.find((t) => t.id === (selectedTerminal ?? terminalId))?.departmentCode
    if (!code) {
      // no terminal selected; clear products
      setProducts([])
      return
    }

    let mounted = true
    setLoadingProducts(true)
    setTerminalError(null)

    fetch(`/api/mock/departments/${code}/menu`)
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return
        if (json && json.success && Array.isArray(json.data)) {
          const mapped: POSProduct[] = json.data.map((m: any) => ({ id: m.id, name: m.name, price: Number(m.price || 0), available: !!m.available }))
          setProducts(mapped)
        } else {
          setTerminalError('Failed to load department menu')
          setProducts(sampleProducts)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch mock department menu', err)
        if (!mounted) return
        setTerminalError('Failed to load department menu (network)')
        setProducts(sampleProducts)
      })
      .finally(() => mounted && setLoadingProducts(false))

    return () => {
      mounted = false
    }
  }, [selectedTerminal, terminalId])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Terminal:</label>
            <select
              value={selectedTerminal ?? ''}
              onChange={(e) => setSelectedTerminal(e.target.value || null)}
              className="border rounded px-2 py-1"
            >
              <option value="">-- Select Terminal --</option>
              {terminals.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {loadingProducts && <div className="text-sm text-muted-foreground">Loading menu...</div>}
            {terminalError && <div className="text-sm text-red-600">{terminalError}</div>}
          </div>

          <POSCategorySelector categories={categories} selectedId={category ?? undefined} onSelect={(id) => setCategory(id)} />

          <POSProductGrid products={loadingProducts ? sampleProducts : (products.length ? products : sampleProducts)} onAdd={handleAdd} />
        </div>

        <div>
          <POSCart items={cart} onRemove={handleRemove} onQty={handleQty} />
          <div className="mt-4">
            <button onClick={() => setShowPayment(true)} disabled={cart.length === 0} className="w-full py-2 bg-emerald-600 text-white rounded">Proceed to Payment</button>
          </div>
        </div>
      </div>

      {showPayment && <POSPayment total={total} onComplete={handlePaymentComplete} onCancel={() => setShowPayment(false)} />}
      {receipt && <POSReceipt receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  )
}
