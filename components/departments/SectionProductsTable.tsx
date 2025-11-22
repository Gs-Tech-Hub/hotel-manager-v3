"use client"

import Link from 'next/link'

export default function SectionProductsTable({ products }: any) {
  if (!products || products.length === 0) return <div className="text-sm text-muted-foreground">No items in this section</div>

  return (
    <div className="mt-6 overflow-auto">
      <table className="w-full table-fixed">
        <thead>
          <tr>
            <th className="text-left">Item</th>
            <th className="text-right">Available</th>
            <th className="text-right">Units Sold</th>
            <th className="text-right">Amount Sold</th>
            <th className="text-right">Pending</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p: any) => (
            <tr key={p.id} className="border-t">
              <td>
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-muted-foreground">{p.sku ?? ''}</div>
              </td>
              <td className="text-right">{p.available ?? 0}</td>
              <td className="text-right">{p.unitsSold ?? 0}</td>
              <td className="text-right">{p.amountSold ? `$${(p.amountSold/100).toFixed(2)}` : '$0.00'}</td>
              <td className="text-right">{p.pendingQuantity ?? 0}</td>
              <td className="text-right">
                <Link href={p.posLink || `/inventory/${p.inventoryId || p.id}`} prefetch={false} className="text-sky-600 text-sm">Open</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
