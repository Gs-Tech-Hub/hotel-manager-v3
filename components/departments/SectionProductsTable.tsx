"use client"

import Link from 'next/link'
import Price from '@/components/ui/Price'

export default function SectionProductsTable({ products }: any) {
  if (!products || products.length === 0) return <div className="text-sm text-muted-foreground">No items in this section</div>

  return (
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
                {p.unitPrice ? <Price amount={p.unitPrice} isMinor={true} /> : '—'}
              </td>
              <td className="text-right py-2 px-2 font-medium">{p.available ?? 0}</td>
              <td className="text-right py-2 px-2">{p.unitsSold ?? 0}</td>
              <td className="text-right py-2 px-2">
                {p.amountSold ? <Price amount={p.amountSold} isMinor={true} /> : <Price amount={0} isMinor={true} />}
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
  )
}
