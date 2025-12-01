import { NextResponse } from 'next/server'
import { convertCurrency, formatCurrencyAmount } from '@/lib/currency'
import { bootstrapCurrency } from '@/lib/bootstrapCurrency'

export async function POST(req: Request) {
  try {
    await bootstrapCurrency()
    const body = await req.json()
    const { amount, from, to } = body
    if (typeof amount !== 'number' || !from || !to) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const converted = convertCurrency(Math.round(amount), String(from).toUpperCase(), String(to).toUpperCase())
    const formatted = formatCurrencyAmount(converted, String(to).toUpperCase())
    return NextResponse.json({ minorUnits: converted, formatted })
  } catch (e) {
    console.error('POST /api/convert error', e)
    return NextResponse.json({ error: 'Conversion failed' }, { status: 500 })
  }
}
