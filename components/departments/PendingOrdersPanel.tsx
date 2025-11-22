"use client"

export default function PendingOrdersPanel({ pending, onOpen }: any) {
  if (!pending || pending.length === 0) return null

  return (
    <div className="mt-6 border rounded p-4 bg-card">
      <h3 className="font-semibold">Pending Orders</h3>
      <div className="mt-2 space-y-2">
        {pending.map((line: any) => (
          <div key={line.id} className="flex items-center justify-between">
            <div>
              <div className="font-medium">{line.productName}</div>
              <div className="text-sm text-muted-foreground">Qty: {line.quantity} — Order: {line.orderId}</div>
            </div>
            <div>
              <button className="btn btn-sm" onClick={() => onOpen(line)}>Fulfill</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
