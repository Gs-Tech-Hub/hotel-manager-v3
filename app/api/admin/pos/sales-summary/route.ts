import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl
    const terminalId = url.searchParams.get('terminalId') || ''

    if (!terminalId) {
      return NextResponse.json({ success: false, error: 'terminalId query param required' }, { status: 400 })
    }

    // Mocked summaries (replace with real query to transactions store)
    const summaries: Record<string, { count: number; total: number }> = {
      'term-1': { count: 24, total: 342.5 },
      'term-2': { count: 13, total: 198.75 },
      'term-3': { count: 7, total: 62.0 },
    }

    const data = summaries[terminalId] ?? { count: 0, total: 0 }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('Mock GET /api/admin/pos/sales-summary error', err)
    return NextResponse.json({ success: false, error: 'Mock server error' }, { status: 500 })
  }
}
