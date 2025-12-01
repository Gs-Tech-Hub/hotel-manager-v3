import { NextResponse } from "next/server"
import { exchangeRateManager } from "@/lib/currency"
import { extractUserContext, isAdmin } from '@/lib/user-context'
import { setRatePersistent, getRatesForBase } from '@/lib/exchangeRateStore'
import { bootstrapCurrency } from '@/lib/bootstrapCurrency'

// Ensure server-side bootstrap runs once when this API module is loaded
if (typeof window === 'undefined') {
  bootstrapCurrency().catch((e) => console.warn('bootstrapCurrency failed', e));
}

export async function GET(req: Request) {
  try {
    const base = req.nextUrl.searchParams.get("base") || "USD"
    // Prefer persisted rates if present
    const persisted = await getRatesForBase(base)
    const runtimeRates = exchangeRateManager.getRatesForBase(base)
    // Merge persisted with runtime (persisted wins)
    const rates = { ...runtimeRates, ...persisted }
    return NextResponse.json({ base, rates })
  } catch (e) {
    console.error("GET /api/admin/settings/exchange-rates error", e)
    return NextResponse.json({ error: "Failed to read rates" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  // Require admin via existing user-context helper
  const ctx = await extractUserContext(req as any)
  if (!isAdmin(ctx)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const { from, to, rate, source } = body
    if (!from || !to || !rate || typeof rate !== "number") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }
    const fromUp = String(from).toUpperCase()
    const toUp = String(to).toUpperCase()
    exchangeRateManager.setRate(fromUp, toUp, Number(rate), source || 'manual')
    // Persist rate
    try {
      await setRatePersistent(fromUp, toUp, Number(rate), source || 'manual', ctx.userId ?? null)
    } catch (e) {
      console.warn('Failed to persist exchange rate', e)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("PUT /api/admin/settings/exchange-rates error", e)
    return NextResponse.json({ error: "Failed to set rate" }, { status: 500 })
  }
}
