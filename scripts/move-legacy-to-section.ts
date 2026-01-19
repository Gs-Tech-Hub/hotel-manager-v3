#!/usr/bin/env tsx
/*
  Move legacy order lines that reference a parent department code to a specific section code.
  Usage: npx tsx scripts/move-legacy-to-section.ts --parent=restaurant --section=restaurant:main
*/
import dotenv from 'dotenv'
dotenv.config()
import { prisma } from '@/lib/auth/prisma';
import { departmentService } from '@/services/department.service'

async function main() {
  const args = process.argv.slice(2)
  const parentArg = args.find((a) => a.startsWith('--parent='))
  const sectionArg = args.find((a) => a.startsWith('--section='))
  const parentCode = parentArg ? parentArg.split('=')[1] : 'restaurant'
  const sectionCode = sectionArg ? sectionArg.split('=')[1] : 'restaurant:main'

  console.log(`Moving order lines from ${parentCode} -> ${sectionCode}`)

  const parent = await prisma.department.findUnique({ where: { code: parentCode } })
  const section = await prisma.department.findUnique({ where: { code: sectionCode } })
  if (!parent) throw new Error(`Parent department not found: ${parentCode}`)
  if (!section) throw new Error(`Section department not found: ${sectionCode}`)

  // Find all order lines that reference the parent code
  const lines = await prisma.orderLine.findMany({ where: { departmentCode: parentCode }, select: { id: true, orderHeaderId: true, status: true } })
  if (!lines || lines.length === 0) {
    console.log('No order lines found for parent code. Nothing to do.')
    await prisma.$disconnect()
    return
  }

  // Collect unique orderHeaderIds impacted
  const headerSet = new Set<string>()
  for (const l of lines) headerSet.add(l.orderHeaderId)
  const orderHeaderIds = Array.from(headerSet)

  console.log(`Found ${lines.length} order lines across ${orderHeaderIds.length} orders.`)

  // Perform bulk update of order lines (do this outside of a long-running transaction)
  const updated = await prisma.orderLine.updateMany({ where: { departmentCode: parentCode }, data: { departmentCode: sectionCode } })
  console.log(`Updated ${updated.count} orderLine rows to departmentCode=${sectionCode}`)

  // Compute per-order status counts for the newly moved lines in one grouped query
  const grouped = await prisma.orderLine.groupBy({
    by: ['orderHeaderId', 'status'],
    where: { orderHeaderId: { in: orderHeaderIds }, departmentCode: sectionCode },
    _count: { _all: true },
  })

  // Build derived status map per order
  const statusMap = new Map<string, { pending: number; processing: number; fulfilled: number }>()
  for (const g of grouped) {
    const oid = g.orderHeaderId as string
    if (!statusMap.has(oid)) statusMap.set(oid, { pending: 0, processing: 0, fulfilled: 0 })
    const m = statusMap.get(oid)!
    const cnt = Number((g as any)._count?._all || 0)
    if (g.status === 'pending') m.pending += cnt
    else if (g.status === 'processing') m.processing += cnt
    else if (g.status === 'fulfilled') m.fulfilled += cnt
  }

  // Find existing orderDepartment rows for the section to avoid duplicates
  const existingSectionOrders = await prisma.orderDepartment.findMany({ where: { orderHeaderId: { in: orderHeaderIds }, departmentId: section.id }, select: { orderHeaderId: true } })
  const existingSet = new Set(existingSectionOrders.map((r: any) => r.orderHeaderId))

  const toCreate: Array<any> = []
  for (const oid of orderHeaderIds) {
    if (existingSet.has(oid)) continue
    const counts = statusMap.get(oid) || { pending: 0, processing: 0, fulfilled: 0 }
    let derivedStatus = 'pending'
    if (counts.pending > 0) derivedStatus = 'pending'
    else if (counts.processing > 0) derivedStatus = 'processing'
    else if (counts.fulfilled > 0) derivedStatus = 'fulfilled'
    toCreate.push({ orderHeaderId: oid, departmentId: section.id, status: derivedStatus })
  }

  // Perform createMany and deleteMany in a single transaction (small and fast)
  await prisma.$transaction([
    toCreate.length > 0 ? prisma.orderDepartment.createMany({ data: toCreate, skipDuplicates: true }) : prisma.$executeRaw`SELECT 1`,
    prisma.orderDepartment.deleteMany({ where: { orderHeaderId: { in: orderHeaderIds }, departmentId: parent.id } }),
  ])

  console.log(`Created ${toCreate.length} orderDepartment rows for section ${sectionCode} and removed parent orderDepartment rows where applicable.`)

  console.log('Transaction committed. Recalculating stats for parent and section...')
  await departmentService.recalculateSectionStats(parentCode)
  await departmentService.recalculateSectionStats(sectionCode)

  console.log('Done.');
  await prisma.$disconnect()
}

main().catch((err) => { console.error(err); process.exit(1) })
