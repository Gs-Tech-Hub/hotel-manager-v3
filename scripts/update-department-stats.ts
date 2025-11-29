import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateDepartmentStats(includeProductDetails = true, departmentCode?: string) {
  try {
    let departments = [] as any[]
    if (departmentCode) {
      const d = await prisma.department.findUnique({ where: { code: departmentCode } })
      if (!d) throw new Error(`Department not found: ${departmentCode}`)
      departments = [d]
    } else {
      departments = await prisma.department.findMany({ where: { isActive: true } })
    }

    for (const dept of departments) {
      console.log(`Processing department ${dept.code}`)

      // Aggregate order counts for this department.
      // Use the orderHeader.status when available (authoritative for the full order).
      // For section/sub-departments (codes containing ':'), derive counts from orderLine.departmentCode
      // so section-level stats reflect actual lines. For top-level departments, fall back to orderDepartment rows.
      const stats: any = { total: 0, pending: 0, processing: 0, fulfilled: 0, completed: 0, cancelled: 0 }

      try {
        const codeStr = (dept.code || '').toString()
        if (codeStr.includes(':')) {
          // find distinct orderHeaderIds that have lines for this section
          const headerRows = await prisma.orderLine.findMany({
            where: { departmentCode: dept.code },
            distinct: ['orderHeaderId'],
            select: { orderHeaderId: true },
          })
          const headerIds = (headerRows || []).map((h: any) => h.orderHeaderId).filter(Boolean)
          if (headerIds.length) {
            const hdrCounts = await (prisma as any).orderHeader.groupBy({ by: ['status'], where: { id: { in: headerIds } }, _count: { _all: true } })
            for (const r of hdrCounts) {
              const cnt = (r as any)._count?._all || 0
              stats.total += cnt
              if (r.status === 'pending') stats.pending += cnt
              else if (r.status === 'processing') stats.processing += cnt
              else if (r.status === 'fulfilled') stats.fulfilled += cnt
              else if (r.status === 'completed') stats.completed += cnt
              else if (r.status === 'cancelled') stats.cancelled += cnt
            }
          }
        } else {
          // fallback for top-level departments: use orderDepartment rows (includes departmentId relation)
          const orderDeptRows = await prisma.orderDepartment.findMany({ where: { departmentId: dept.id }, include: { orderHeader: { select: { status: true } } } })
          for (const od of orderDeptRows) {
            stats.total += 1
            const s = (od as any).orderHeader?.status ?? (od as any).status
            if (s === 'pending') stats.pending += 1
            else if (s === 'processing') stats.processing += 1
            else if (s === 'fulfilled') stats.fulfilled += 1
            else if (s === 'completed') stats.completed += 1
            else if (s === 'cancelled') stats.cancelled += 1
          }
        }
      } catch (e) {
        console.warn('Failed to compute counts for department', dept.code, e)
      }

      let productStats: any[] = []

      if (includeProductDetails) {
        // collect distinct productIds referenced by order lines for this department
        const prodRows = await prisma.orderLine.findMany({
          where: { departmentCode: dept.code },
          distinct: ['productId'],
          select: { productId: true },
        })

        const productIds = prodRows.map((p) => p.productId)

        if (productIds.length) {
          // Units sold & amount sold (completed order headers OR fulfilled lines)
          const soldGroups = await (prisma as any).orderLine.groupBy({
            by: ['productId'],
            where: {
              productId: { in: productIds },
              OR: [ { orderHeader: { status: 'completed' } }, { status: 'fulfilled' } ],
              departmentCode: dept.code,
            },
            _sum: { quantity: true, lineTotal: true },
          })

          // Pending / processing quantities
          const pendingGroups = await (prisma as any).orderLine.groupBy({
            by: ['productId'],
            where: {
              productId: { in: productIds },
              status: { in: ['pending', 'processing'] },
              orderHeader: { status: { not: 'cancelled' } },
              departmentCode: dept.code,
            },
            _sum: { quantity: true },
          })

          // reservations: find orderHeaderIds that have lines for this department
          const headerRows = await prisma.orderLine.findMany({
            where: { departmentCode: dept.code },
            distinct: ['orderHeaderId'],
            select: { orderHeaderId: true },
          })
          const headerIds = headerRows.map((h) => h.orderHeaderId)

          let reservations: any[] = []
          if (headerIds.length) {
            try {
              reservations = await (prisma as any).inventoryReservation.groupBy({
                by: ['inventoryItemId'],
                where: { inventoryItemId: { in: productIds }, orderHeaderId: { in: headerIds }, status: { in: ['reserved', 'confirmed'] } },
                _sum: { quantity: true },
              })
            } catch (e) {
              console.warn('reservations.groupBy failed, skipping reserved quantities', e)
              reservations = []
            }
          }

          const soldMap = new Map(soldGroups.map((g: any) => [g.productId, g._sum]))
          const pendingMap = new Map(pendingGroups.map((g: any) => [g.productId, g._sum]))
          const resMap = new Map(reservations.map((r: any) => [r.inventoryItemId, r._sum]))

          productStats = productIds.map((id) => ({
            productId: id,
            unitsSold: (soldMap.get(id) as any)?.quantity || 0,
            amountSold: (soldMap.get(id) as any)?.lineTotal || 0,
            pendingQuantity: (pendingMap.get(id) as any)?.quantity || 0,
            reservedQuantity: (resMap.get(id) as any)?.quantity || 0,
          }))
        }
      }

      // Persist into department.metadata under `stats` and `productStats`
      const existingMeta = (dept.metadata || {}) as any
      existingMeta.stats = stats
      if (includeProductDetails) existingMeta.productStats = productStats

      await prisma.department.update({ where: { id: dept.id }, data: { metadata: existingMeta } })
      console.log(`Updated department ${dept.code} — totalOrders=${stats.total} pending=${stats.pending}`)
    }

    console.log('All departments processed')
  } catch (err) {
    console.error('updateDepartmentStats error', err)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  // CLI: support --no-products and --code=<DEPT_CODE> or -c <DEPT_CODE>
  const args = process.argv.slice(2)
  const includeProducts = !args.includes('--no-products')
  let deptCode: string | undefined = undefined

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--code=')) {
      deptCode = a.split('=')[1]
    } else if (a === '--code' || a === '-c') {
      deptCode = args[i + 1]
      i += 1
    }
  }

  updateDepartmentStats(includeProducts, deptCode).catch((e) => { console.error(e); process.exit(1) })
}

export { updateDepartmentStats }
