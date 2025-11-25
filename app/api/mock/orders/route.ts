import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { terminalId, departmentCode, sectionId, items, subtotal, tax, total, payment } = body

    // Very small mock validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No items in order' }, { status: 400 })
    }

    const orderNumber = `MOCK-${Date.now()}`

    const receipt = {
      id: Math.random().toString(36).slice(2),
      orderNumber,
      terminalId: terminalId ?? null,
      departmentCode: departmentCode ?? null,
      sectionId: sectionId ?? null,
      items,
      subtotal,
      tax,
      total,
      payment,
      createdAt: new Date().toISOString(),
      status: 'created',
    }

    // Simulate slight processing delay
    await new Promise((res) => setTimeout(res, 150))

    return NextResponse.json({ success: true, data: receipt }, { status: 201 })
  } catch (err) {
    console.error('Mock POST /api/mock/orders error', err)
    return NextResponse.json({ success: false, error: 'Mock server error' }, { status: 500 })
  }
}

export async function GET() {
  // Simple ping endpoint
  return NextResponse.json({ success: true, message: 'Mock orders endpoint running' })
}
