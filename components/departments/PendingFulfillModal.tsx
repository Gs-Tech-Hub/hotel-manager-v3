"use client"

export default function PendingFulfillModal({ line, open, onClose, onFulfilled }: any) {
  if (!open) return null
  if (!line) return null

  const fulfill = async () => {
    try {
      const res = await fetch(`/api/orders/${line.orderId}/fulfillment`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lineId: line.id }),
      })
      if (!res.ok) throw new Error('Failed')
      onFulfilled?.(line)
      onClose?.()
    } catch (err) {
      console.error(err)
      alert('Could not fulfill line')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded p-6 w-[420px]">
        <h3 className="font-semibold">Fulfill pending line</h3>
        <div className="mt-2">
          <div className="font-medium">{line.productName}</div>
          <div className="text-sm text-muted-foreground">Qty: {line.quantity}</div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={fulfill}>Mark delivered</button>
        </div>
      </div>
    </div>
  )
}
