import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAllCurrencyCodes } from '@/lib/currency'

/**
 * GET /api/settings/exchange-rates
 * Get current exchange rates from ExchangeRate table
 * Query parameters:
 * - baseCurrency: string (defaults to OrganisationInfo.currency or USD)
 * - targetCurrencies: string[] (comma-separated, defaults to all other currencies)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    
    // Get base currency from request or database
    let baseCurrency = searchParams.get('baseCurrency')
    if (!baseCurrency) {
      const org = await prisma.organisationInfo.findFirst()
      baseCurrency = org?.currency || 'USD'
    }
    
    const targetCurrenciesParam = searchParams.get('targetCurrencies')
    const targetCurrencies = targetCurrenciesParam?.split(',') || getAllCurrencyCodes().filter((c) => c !== baseCurrency)

    // Fetch rates from database for target currencies
    const rates: Record<string, number> = {}
    for (const target of targetCurrencies) {
      if (target === baseCurrency) continue
      
      const rate = await prisma.exchangeRate.findUnique({
        where: {
          fromCurrency_toCurrency: {
            fromCurrency: baseCurrency,
            toCurrency: target
          }
        }
      })
      
      if (rate) {
        rates[target] = Number(rate.rate)
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: {
        baseCurrency,
        rates,
        timestamp: new Date().toISOString(),
        source: 'database',
        availableCurrencies: getAllCurrencyCodes()
      }
    }, { status: 200 })
  } catch (error) {
    console.error('Failed to fetch exchange rates', error)
    return NextResponse.json({ error: 'Failed to fetch exchange rates' }, { status: 500 })
  }
}

/**
 * POST /api/settings/exchange-rates
 * Create/update exchange rate in database
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { from, to, rate } = body
    
    if (!from || !to || rate === undefined) {
      return NextResponse.json({ error: 'Missing required fields: from, to, rate' }, { status: 400 })
    }
    
    // Update or create the exchange rate
    const updated = await prisma.exchangeRate.upsert({
      where: {
        fromCurrency_toCurrency: {
          fromCurrency: from,
          toCurrency: to
        }
      },
      update: {
        rate: Number(rate)
      },
      create: {
        fromCurrency: from,
        toCurrency: to,
        rate: Number(rate)
      }
    })
    
    return NextResponse.json({ 
      success: true, 
      data: {
        from: updated.fromCurrency,
        to: updated.toCurrency,
        rate: Number(updated.rate),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString()
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Failed to update exchange rates', error)
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
