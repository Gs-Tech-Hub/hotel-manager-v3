import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { CURRENCY_CATALOG } from "@/lib/currency"
import { extractUserContext, isAdmin } from '@/lib/user-context'

export async function GET() {
  try {
    const org = await prisma.organisationInfo.findFirst()
    return NextResponse.json(org)
  } catch (e) {
    console.error("GET /api/admin/settings/organisation error", e)
    return NextResponse.json({ error: "Failed to read organisation info" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const ctx = await extractUserContext(req as any)
  if (!isAdmin(ctx)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const data: any = {}
    if (body.name) data.name = String(body.name)
    if (body.address !== undefined) data.address = body.address
    if (body.email !== undefined) data.email = body.email
    if (body.phone !== undefined) data.phone = body.phone
    if (body.website !== undefined) data.website = body.website
    if (body.logoDark !== undefined) data.logoDark = body.logoDark
    if (body.logoLight !== undefined) data.logoLight = body.logoLight
    if (body.currency !== undefined) {
      const currency = String(body.currency).toUpperCase()
      if (!CURRENCY_CATALOG[currency]) {
        return NextResponse.json({ error: "Invalid currency code" }, { status: 400 })
      }
      data.currency = currency
    }

    const org = await prisma.organisationInfo.findFirst()
    if (!org) {
      // Must create: name is required in schema, so ensure a name exists
      if (!data.name) {
        return NextResponse.json({ error: "Organisation info not found. Provide `name` to create." }, { status: 400 })
      }
      const created = await prisma.organisationInfo.create({ data })
      return NextResponse.json(created)
    }

    const updated = await prisma.organisationInfo.update({ where: { id: org.id }, data })
    return NextResponse.json(updated)
  } catch (e) {
    console.error("PUT /api/admin/settings/organisation error", e)
    return NextResponse.json({ error: "Failed to update organisation info" }, { status: 500 })
  }
}
