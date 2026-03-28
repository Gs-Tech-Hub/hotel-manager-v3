"use client"

import { useRef, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import Price from '@/components/ui/Price'

interface ReservationData {
  id: string
  confirmationNo: string
  unit?: { roomNumber: string | null }
  guest?: { firstName: string; lastName: string; email: string; phone: string }
  checkInDate: string
  checkOutDate: string
  totalPriceCents: number
  status: string
  createdAt: string
}

interface HotelInfo {
  name?: string
  address?: string
  email?: string
  phone?: string
  website?: string
}

export function BookingReceipt({ reservation, onClose }: { reservation: ReservationData; onClose?: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [hotelInfo, setHotelInfo] = useState<HotelInfo | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch hotel information from server
  useEffect(() => {
    let mounted = true
    setLoading(true)

    fetch('/api/settings/organisation', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (mounted) {
          setHotelInfo({
            name: data?.name || 'Hotel',
            address: data?.address,
            email: data?.email,
            phone: data?.phone,
            website: data?.website,
          })
        }
      })
      .catch((err) => {
        console.error('Failed to fetch hotel information:', err)
        if (mounted) {
          setHotelInfo({ name: 'Hotel' })
        }
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const handlePrint = () => {
    if (!ref.current) return
    const w = window.open('', '', 'width=600,height=600')
    if (!w) return
    // 80mm thermal printer paper = 226px at 96dpi
    const thermalPaperWidthMm = '80mm'
    const thermalPaperWidthPx = '226px'
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            /* Reset all defaults */
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            /* Document setup for 80mm thermal paper */
            @page {
              size: ${thermalPaperWidthMm} auto;
              margin: 0;
              padding: 0;
              orphans: 0;
              widows: 0;
            }
            
            html {
              width: ${thermalPaperWidthPx};
              margin: 0;
              padding: 0;
            }
            
            body {
              width: ${thermalPaperWidthPx};
              height: auto;
              margin: 0;
              padding: 2px;
              font-family: 'Courier New', 'Courier', monospace;
              font-size: 10px;
              line-height: 1.2;
              color: #000;
              background: white;
              overflow: hidden;
            }
            
            .receipt-container {
              width: 100%;
              max-width: ${thermalPaperWidthPx};
              padding: 2px;
              overflow: hidden;
              word-wrap: break-word;
              white-space: normal;
            }
            
            /* Tailwind utility classes adapted for thermal printer */
            .font-mono { font-family: 'Courier New', 'Courier', monospace; }
            .text-sm { font-size: 10px; }
            .text-xs { font-size: 9px; }
            .text-lg { font-size: 11px; }
            .text-3xl { font-size: 14px; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .font-semibold { font-weight: 600; }
            .border-b { border-bottom: 1px solid #000; }
            .border-b-2 { border-bottom: 2px solid #000; }
            .border-t { border-top: 1px solid #000; }
            .border-t-2 { border-top: 2px solid #000; }
            .border { border: 1px solid #000; }
            .border-2 { border: 2px solid #000; }
            .border-gray-800 { border-color: #000; }
            .border-gray-300 { border-color: #ccc; }
            .border-blue-200 { border-color: #bfdbfe; }
            .px-2 { padding-left: 2px; padding-right: 2px; }
            .px-3 { padding-left: 3px; padding-right: 3px; }
            .py-1 { padding-top: 1px; padding-bottom: 1px; }
            .py-2 { padding-top: 2px; padding-bottom: 2px; }
            .p-2 { padding: 2px; }
            .p-3 { padding: 3px; }
            .pb-2 { padding-bottom: 2px; }
            .pt-2 { padding-top: 2px; }
            .pt-1 { padding-top: 1px; }
            .mt-1 { margin-top: 1px; }
            .mb-1 { margin-bottom: 1px; }
            .my-2 { margin-top: 2px; margin-bottom: 2px; }
            .space-y-1 > * + * { margin-top: 1px; }
            .space-y-2 > * + * { margin-top: 2px; }
            .space-y-3 > * + * { margin-top: 3px; }
            .rounded { border-radius: 0; }
            .inline-block { display: inline-block; }
            
            /* Flex for horizontal alignment - critical for thermal printer */
            .flex {
              display: flex !important;
              flex-direction: row;
              flex-wrap: nowrap;
              width: 100%;
            }
            .justify-between {
              justify-content: space-between;
              width: 100%;
            }
            .justify-center {
              justify-content: center;
            }
            .items-center {
              align-items: center;
            }
            .gap-1 { gap: 1px; }
            .gap-2 { gap: 2px; }
            
            /* Color classes */
            .bg-gray-100 { background-color: #f3f4f6; }
            .bg-blue-50 { background-color: #eff6ff; }
            .bg-green-100 { background-color: #dcfce7; }
            .bg-blue-100 { background-color: #dbeafe; }
            .bg-yellow-100 { background-color: #fef3c7; }
            .text-gray-600 { color: #4b5563; }
            .text-gray-700 { color: #374151; }
            .text-gray-800 { color: #1f2937; }
            .text-gray-900 { color: #111827; }
            .text-blue-600 { color: #2563eb; }
            .text-green-900 { color: #166534; }
            .text-blue-900 { color: #1e3a8a; }
            .text-yellow-900 { color: #78350f; }
            .text-muted-foreground { color: #6b7280; }
            .font-sans { font-family: system-ui, -apple-system, sans-serif; }
            
            /* Print styles - enforce thermal printer format */
            @media print {
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              
              html, body {
                width: ${thermalPaperWidthPx};
                max-width: ${thermalPaperWidthPx};
                height: auto;
                margin: 0;
                padding: 2px;
                overflow: visible;
              }
              
              @page {
                size: ${thermalPaperWidthMm} auto;
                margin: 0;
                padding: 0;
              }
              
              .receipt-container {
                width: 100%;
                max-width: ${thermalPaperWidthPx};
                padding: 2px;
                overflow: visible;
              }
              
              /* Ensure flex maintains horizontal arrangement */
              .flex {
                display: flex !important;
                flex-direction: row;
                flex-wrap: nowrap !important;
                width: 100%;
              }
              
              .justify-between {
                justify-content: space-between !important;
                width: 100%;
              }
              
              /* Prevent page breaks within receipt lines */
              .space-y-1 > *, 
              .space-y-2 > *,
              .space-y-3 > * {
                page-break-inside: avoid;
              }
              
              /* Hide non-print elements */
              .no-print {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container font-mono">
            ${ref.current.innerHTML}
          </div>
        </body>
      </html>
    `
    w.document.write(html)
    w.onload = () => {
      setTimeout(() => {
        w.print()
      }, 200)
    }
  }

  const handleDownloadPDF = async () => {
    try {
      if (!ref.current) return
      const receiptWidthPx = '226px' // 80mm at 96dpi
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              html, body {
                width: ${receiptWidthPx};
                margin: 0 auto;
                padding: 0;
                background: white;
              }
              
              body {
                font-family: 'Courier New', monospace;
                font-size: 10px;
                line-height: 1.3;
                width: ${receiptWidthPx};
                color: #000;
              }
              
              .receipt-container {
                width: 100%;
                padding: 4px;
              }
              
              /* Tailwind utility classes */
              .font-mono { font-family: 'Courier New', monospace; }
              .text-sm { font-size: 10px; }
              .text-xs { font-size: 8px; }
              .text-lg { font-size: 12px; }
              .text-3xl { font-size: 16px; }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .font-bold { font-weight: bold; }
              .font-semibold { font-weight: 600; }
              .border-b { border-bottom: 1px solid #000; }
              .border-b-2 { border-bottom: 2px solid #000; }
              .border-t { border-top: 1px solid #000; }
              .border-t-2 { border-top: 2px solid #000; }
              .border { border: 1px solid #000; }
              .border-2 { border: 2px solid #000; }
              .px-2 { padding-left: 2px; padding-right: 2px; }
              .px-3 { padding-left: 3px; padding-right: 3px; }
              .py-1 { padding-top: 1px; padding-bottom: 1px; }
              .py-2 { padding-top: 2px; padding-bottom: 2px; }
              .p-2 { padding: 2px; }
              .p-3 { padding: 3px; }
              .pb-2 { padding-bottom: 2px; }
              .pt-2 { padding-top: 2px; }
              .pt-1 { padding-top: 1px; }
              .mt-1 { margin-top: 1px; }
              .mb-1 { margin-bottom: 1px; }
              .my-2 { margin-top: 2px; margin-bottom: 2px; }
              .space-y-1 > * + * { margin-top: 1px; }
              .space-y-2 > * + * { margin-top: 2px; }
              .space-y-3 > * + * { margin-top: 3px; }
              .rounded { border-radius: 2px; }
              .inline-block { display: inline-block; }
              .flex { display: flex !important; flex-wrap: nowrap !important; }
              .justify-between { justify-content: space-between !important; width: 100% !important; }
              .justify-center { justify-content: center !important; }
              .items-center { align-items: center !important; }
              .gap-1 { gap: 2px; }
              .gap-2 { gap: 4px; }
              .w-full { width: 100%; }
              .bg-gray-100 { background-color: #f3f4f6; }
              .bg-blue-50 { background-color: #eff6ff; }
              .bg-green-100 { background-color: #dcfce7; }
              .bg-blue-100 { background-color: #dbeafe; }
              .bg-gray-100 { background-color: #f3f4f6; }
              .bg-yellow-100 { background-color: #fef3c7; }
              .text-gray-600 { color: #4b5563; }
              .text-gray-700 { color: #374151; }
              .text-gray-800 { color: #1f2937; }
              .text-gray-900 { color: #111827; }
              .text-blue-600 { color: #2563eb; }
              .text-green-900 { color: #166534; }
              .text-blue-900 { color: #1e3a8a; }
              .text-yellow-900 { color: #78350f; }
              .text-muted-foreground { color: #6b7280; }
              .font-sans { font-family: system-ui, -apple-system, sans-serif; }
              
              /* Print-specific styles */
              @media print {
                * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  color-adjust: exact !important;
                }
                
                html, body {
                  width: ${receiptWidthPx};
                  height: auto;
                  margin: 0;
                  padding: 0;
                }
                
                @page {
                  size: 80mm auto;
                  margin: 0;
                  padding: 0;
                }
                
                .receipt-container {
                  padding: 2px;
                  width: 100%;
                }
                
                body {
                  font-size: 10px;
                  line-height: 1.3;
                }
                
                /* Ensure flex stays horizontal */
                .flex {
                  display: flex !important;
                  flex-wrap: nowrap !important;
                  word-wrap: normal;
                }
                
                .justify-between {
                  justify-content: space-between !important;
                  width: 100% !important;
                }
                
                .no-print {
                  display: none !important;
                }
              }
            </style>
          </head>
          <body>
            <div class="receipt-container font-mono">
              ${ref.current.innerHTML}
            </div>
          </body>
        </html>
      `
      const printWindow = window.open('', '', 'width=600,height=600')
      if (!printWindow) return
      
      printWindow.document.write(html)
      printWindow.document.close()
      
      // Show save dialog with 250ms delay for rendering
      setTimeout(() => {
        printWindow.print()
      }, 250)
    } catch (error) {
      console.error('Failed to download PDF:', error)
    }
  }

  const checkInDate = new Date(reservation.checkInDate).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const checkOutDate = new Date(reservation.checkOutDate).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const totalPrice = (reservation.totalPriceCents / 100).toFixed(2)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 w-96 shadow-lg max-h-[90vh] overflow-auto">
        <div ref={ref} className="font-mono text-sm space-y-3">
          {/* Header: Receipt Title */}
          <div className="text-center border-b-2 border-gray-800 pb-2">
            <div className="text-lg font-bold">{hotelInfo?.name || 'Hotel Manager'}</div>
            <div className="text-xs mt-1">BOOKING RECEIPT</div>
          </div>

          {/* Confirmation Number - Center Prominence */}
          <div className="text-center bg-blue-50 border border-blue-200 rounded p-2">
            <div className="text-xs text-gray-700">Confirmation #</div>
            <div className="text-lg font-bold font-sans text-blue-600">{reservation.confirmationNo}</div>
          </div>

          {/* Status Badge */}
          <div className="text-center">
            <span className={`inline-block px-3 py-1 rounded text-xs font-bold ${
              reservation.status === 'CONFIRMED' ? 'bg-green-100 text-green-900' :
              reservation.status === 'CHECKED_IN' ? 'bg-blue-100 text-blue-900' :
              reservation.status === 'COMPLETED' ? 'bg-gray-100 text-gray-900' :
              'bg-yellow-100 text-yellow-900'
            }`}>
              {reservation.status}
            </span>
          </div>

          {/* Guest Information Section */}
          <div className="space-y-1 text-xs border-t border-b border-gray-300 py-2">
            <div className="font-bold text-gray-800 mb-1">GUEST INFORMATION</div>
            <div className="flex justify-between">
              <span className="font-semibold">Name:</span>
              <span>{reservation.guest?.firstName} {reservation.guest?.lastName}</span>
            </div>
            {reservation.guest?.email && (
              <div className="flex justify-between">
                <span className="font-semibold">Email:</span>
                <span className="text-right">{reservation.guest.email}</span>
              </div>
            )}
            {reservation.guest?.phone && (
              <div className="flex justify-between">
                <span className="font-semibold">Phone:</span>
                <span>{reservation.guest.phone}</span>
              </div>
            )}
          </div>

          {/* Booking Details Section */}
          <div className="space-y-1 text-xs border-b border-gray-300 pb-2">
            <div className="font-bold text-gray-800 mb-1">BOOKING DETAILS</div>
            <div className="flex justify-between">
              <span className="font-semibold">Room:</span>
              <span>{reservation.unit?.roomNumber || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Check-in:</span>
              <span>{checkInDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Check-out:</span>
              <span>{checkOutDate}</span>
            </div>
          </div>

          {/* Total Amount - CLEARLY SEPARATED */}
          <div className="bg-gray-100 border-2 border-gray-800 rounded p-3 my-2 text-center">
            <div className="text-xs text-gray-600 mb-1">TOTAL AMOUNT DUE</div>
            <div className="text-3xl font-bold text-blue-600">${totalPrice}</div>
          </div>

          {/* Organization Footer */}
          <div className="border-t-2 border-gray-800 pt-2 text-center text-xs space-y-1 text-gray-600">
            {hotelInfo?.address && <div>{hotelInfo.address}</div>}
            {hotelInfo?.phone && <div>Tel: {hotelInfo.phone}</div>}
            {hotelInfo?.email && <div>{hotelInfo.email}</div>}
            {hotelInfo?.website && <div>{hotelInfo.website}</div>}
            <div className="text-gray-500 pt-1">Generated: {new Date().toLocaleString()}</div>
            <div className="text-gray-500">Thank you for your booking!</div>
            <div className="text-gray-500">Please keep this receipt for your records</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex gap-2">
          <Button
            onClick={handlePrint}
            variant="outline"
            className="flex-1"
            disabled={loading}
          >
            Print
          </Button>
          <Button
            onClick={handleDownloadPDF}
            variant="outline"
            className="flex-1"
            disabled={loading}
          >
            Download
          </Button>
          <Button
            onClick={onClose}
            className="flex-1"
            disabled={loading}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
