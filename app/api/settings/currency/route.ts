import { NextResponse } from 'next/server'
import { prisma } from '@/lib/auth/prisma'
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
    const { currency } = body
    
    if (!currency) {
      return NextResponse.json({ error: 'Currency is required' }, { status: 400 })
    }
    
    // Update organisation currency
    const org = await prisma.organisationInfo.update({
      where: { id: '1' }, // Assuming single org with ID '1'
      data: { currency },
    })
    
    return NextResponse.json({ 
      success: true, 
      data: { currency: org.currency }
    }, { status: 200 })
  } catch (error) {
    console.error('Failed to update currency settings', error)
    return NextResponse.json({ error: 'Failed to update currency settings' }, { status: 500 })
  }
}

