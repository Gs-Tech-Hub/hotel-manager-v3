import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.pathname.split('/').slice(-3)[0] || 'unknown'

    // Return a simple mock menu for the department code
    const menu = [
      { id: 'm1', inventoryId: 'f1', name: 'Mock Espresso', price: 4.5, type: 'food', available: true },
      { id: 'm2', inventoryId: 'f2', name: 'Mock Croissant', price: 3.0, type: 'food', available: true },
      { id: 'm3', inventoryId: 'd1', name: 'Mock Bottled Water', price: 2.25, type: 'drink', available: true },
    ]

    return NextResponse.json({ success: true, department: code, data: menu })
  } catch (err) {
    console.error('Mock GET /api/mock/departments/[code]/menu error', err)
    return NextResponse.json({ success: false, error: 'Mock server error' }, { status: 500 })
  }
}
