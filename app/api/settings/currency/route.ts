import { NextResponse } from 'next/server'

/**
 * GET /api/settings/currency
 * Get currency settings
 */
export async function GET(req: Request) {
  try {
    return NextResponse.json({ 
      success: true, 
      data: {
        baseCurrency: 'USD',
        displayCurrency: 'USD',
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'JPY']
      }
    }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch currency settings' }, { status: 500 })
  }
}

/**
 * PUT /api/settings/currency
 * Update currency settings
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json()
    return NextResponse.json({ 
      success: true, 
      data: body
    }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update currency settings' }, { status: 500 })
  }
}
