"use client"

import { useState } from "react"
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

  const categories = [
    { id: 'foods', name: 'Foods' },
    { id: 'drinks', name: 'Drinks' },
    { id: 'retail', name: 'Retail' },
  ]

  const sampleProducts: POSProduct[] = [
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
    // Minimal receipt creation - real app should POST to /api/orders
    const receipt = {
      orderNumber: `T-${Date.now()}`,
      items: cart,
      subtotal,
      tax,
      total,
      payment,
    }
    setReceipt(receipt)
    setCart([])
    setShowPayment(false)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <POSCategorySelector categories={categories} selectedId={category ?? undefined} onSelect={(id) => setCategory(id)} />
          <POSProductGrid products={sampleProducts} onAdd={handleAdd} />
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
