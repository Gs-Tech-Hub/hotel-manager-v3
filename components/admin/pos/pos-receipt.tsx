"use client"

import { useRef } from "react"
import Price from '@/components/ui/Price'

export function POSReceipt({ receipt, onClose }: { receipt: any; onClose?: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null)

  const handlePrint = () => {
    if (!ref.current) return
    const w = window.open('', '', 'width=600,height=600')
    if (!w) return
    w.document.write('<html><body>' + ref.current.innerHTML + '</body></html>')
    w.document.close()
    w.print()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 w-80 shadow-lg max-h-[80vh] overflow-auto">
        <div ref={ref} className="font-mono text-sm">
          <div className="text-center font-bold">Paradise Hotel</div>
          <div className="text-center">Receipt</div>
          <div className="mt-2">Order#: {receipt?.orderNumber ?? 'N/A'}</div>
          <div className="mt-2">
            {(receipt?.items ?? []).map((it: any) => (
              <div key={it.lineId} className="flex justify-between">
                <span>{it.productName} x{it.quantity}</span>
                <span><Price amount={it.unitPrice * it.quantity} isMinor={true} /></span>
              </div>
            ))}
          </div>
          <div className="border-t mt-2 pt-2 flex justify-between font-bold"> <span>Total</span> <span><Price amount={receipt?.total ?? 0} isMinor={true} /></span> </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={handlePrint} className="flex-1 px-3 py-2 bg-sky-600 text-white rounded">Print</button>
          <button onClick={onClose} className="flex-1 px-3 py-2 border rounded">Close</button>
        </div>
      </div>
    </div>
  )
}
