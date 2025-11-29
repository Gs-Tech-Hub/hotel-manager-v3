import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function inspectLine(lineItemId: string) {
  try {
    console.log('Inspecting lineItemId=', lineItemId)

    const line = await prisma.orderLine.findUnique({
      where: { id: lineItemId },
      include: {
        orderHeader: true,
      },
    })

    if (!line) {
      console.log('OrderLine not found')
      return
    }

    console.log('\n-- OrderLine --')
    console.log({ id: line.id, productId: line.productId, quantity: line.quantity, status: line.status, departmentCode: line.departmentCode, orderHeaderId: line.orderHeaderId })

    if (line.orderHeaderId) {
      const header = await prisma.orderHeader.findUnique({ where: { id: line.orderHeaderId } })
      console.log('\n-- OrderHeader --')
      console.log({ id: header?.id, status: header?.status, total: header?.total, createdAt: header?.createdAt })

      const orderDepartments = await prisma.orderDepartment.findMany({ where: { orderHeaderId: line.orderHeaderId } })
      console.log('\n-- OrderDepartment rows for header --')
        console.log(orderDepartments.map((od) => ({ id: od.id, departmentId: od.departmentId, status: od.status })))

      // reservations for this header
      const reservations = await prisma.inventoryReservation.findMany({ where: { orderHeaderId: line.orderHeaderId } })
      console.log('\n-- InventoryReservations for header --')
      console.log(reservations.map((r) => ({ id: r.id, inventoryItemId: r.inventoryItemId, quantity: r.quantity, status: r.status })))
    }

    // department record for the departmentCode on the line
    if (line.departmentCode) {
      const dept = await prisma.department.findUnique({ where: { code: line.departmentCode } })
      console.log('\n-- Department --')
      if (dept) console.log({ id: dept.id, code: dept.code, metadata: dept.metadata })
      else console.log('Department not found for code', line.departmentCode)
    }

    // Related lines for same header
    if (line.orderHeaderId) {
      const lines = await prisma.orderLine.findMany({ where: { orderHeaderId: line.orderHeaderId } })
      console.log('\n-- All lines for header --')
      console.log(lines.map((l) => ({ id: l.id, productId: l.productId, quantity: l.quantity, status: l.status, departmentCode: l.departmentCode })))
    }
  } catch (err) {
    console.error('inspectLine error', err)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  const args = process.argv.slice(2)
  const id = args[0]
  if (!id) {
    console.error('Usage: tsx scripts/inspect-order.ts <lineItemId>')
    process.exit(2)
  }
  inspectLine(id)
}

export { inspectLine }
