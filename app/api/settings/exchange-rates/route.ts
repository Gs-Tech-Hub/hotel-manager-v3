import { NextResponse } from 'next/server'

/**
 * GET /api/settings/exchange-rates
 * Get current exchange rates
 * Query parameters:
 * - baseCurrency: string (default: USD)
 * - targetCurrencies: string[] (comma-separated)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const baseCurrency = searchParams.get('baseCurrency') || 'USD'
    const targetCurrencies = searchParams.get('targetCurrencies')?.split(',') || ['EUR', 'GBP', 'JPY']

    return NextResponse.json({ 
      success: true, 
      data: {
        baseCurrency,
        rates: {
          EUR: 0.92,
          GBP: 0.79,
          JPY: 149.50
        },
        timestamp: new Date().toISOString(),
        source: 'internal'
      }
    }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch exchange rates' }, { status: 500 })
  }
}

/**
 * POST /api/settings/exchange-rates
 * Update exchange rates
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    return NextResponse.json({ 
      success: true, 
      data: {
        ...body,
        timestamp: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update exchange rates' }, { status: 500 })
  }
}

/**
 * PUT /api/settings/exchange-rates
 * Bulk update exchange rates
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json()
    return NextResponse.json({ 
      success: true, 
      data: body
    }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update exchange rates' }, { status: 500 })
  }
}
