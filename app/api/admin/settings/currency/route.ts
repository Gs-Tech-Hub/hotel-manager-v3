import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { CURRENCY_CATALOG } from "@/lib/currency"
import { extractUserContext, isAdmin } from '@/lib/user-context'

export async function GET() {
  try {
    const org = await prisma.organisationInfo.findFirst()
    return NextResponse.json({ currency: org?.currency ?? null })
  } catch (e) {
    console.error("GET /api/admin/settings/currency error", e)
    return NextResponse.json({ error: "Failed to read organisation info" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const ctx = await extractUserContext(req as any)
  if (!isAdmin(ctx)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json()
    const currency = String(body?.currency || "").toUpperCase()
    if (!currency || !CURRENCY_CATALOG[currency]) {
      return NextResponse.json({ error: "Invalid currency code" }, { status: 400 })
    }

    const org = await prisma.organisationInfo.findFirst()
    if (!org) {
      return NextResponse.json({ error: "Organisation info not found. Create organisation info first." }, { status: 404 })
    }

    const updated = await prisma.organisationInfo.update({ where: { id: org.id }, data: { currency } })
    return NextResponse.json({ currency: updated.currency })
  } catch (e) {
    console.error("PUT /api/admin/settings/currency error", e)
    return NextResponse.json({ error: "Failed to update currency" }, { status: 500 })
  }
}
