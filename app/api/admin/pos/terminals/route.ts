import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Mock terminal list with inline today's summary (count + total)
    const terminals = [
      { id: 'term-1', name: 'Front Desk - Restaurant', departmentCode: 'restaurant', status: 'online', today: { count: 24, total: 342.5 } },
      { id: 'term-2', name: 'Bar - Main Bar', departmentCode: 'bar', status: 'online', today: { count: 13, total: 198.75 } },
      { id: 'term-3', name: 'Poolside - Cafe', departmentCode: 'pool', status: 'offline', today: { count: 7, total: 62.0 } },
    ]

    return NextResponse.json({ success: true, data: terminals })
  } catch (err) {
    console.error('Mock GET /api/admin/pos/terminals error', err)
    return NextResponse.json({ success: false, error: 'Mock server error' }, { status: 500 })
  }
}
