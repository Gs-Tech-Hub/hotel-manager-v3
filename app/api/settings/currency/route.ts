import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAllCurrencyCodes } from '@/lib/currency'

/**
 * GET /api/settings/currency
 * Get currency settings from OrganisationInfo
 */
export async function GET(req: Request) {
  try {
    const org = await prisma.organisationInfo.findFirst()
    const baseCurrency = org?.currency || 'USD'
    
    return NextResponse.json({ 
      success: true, 
      data: {
        baseCurrency,
        displayCurrency: baseCurrency,
        supportedCurrencies: getAllCurrencyCodes()
      }
    }, { status: 200 })
  } catch (error) {
    console.error('Failed to fetch currency settings', error)
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
