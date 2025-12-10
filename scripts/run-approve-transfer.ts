import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function run() {
  const args = process.argv.slice(2)
  const transferId = args[0]
  if (!transferId) {
    console.error('Usage: npx tsx scripts/run-approve-transfer.ts <transferId>')
    process.exit(1)
  }

  console.log('Running approveTransfer for', transferId)

  const transfer = await prisma.departmentTransfer.findUnique({ where: { id: transferId }, include: { items: true } })
  if (!transfer) {
    console.error('Transfer not found:', transferId)
    process.exit(2)
  }

  if (transfer.status !== 'pending' && transfer.status !== 'approved') {
    console.error('Transfer not in a state that can be approved:', transfer.status)
    process.exit(3)
  }

  const fromDept = await prisma.department.findUnique({ where: { id: transfer.fromDepartmentId } })
  const toDept = await prisma.department.findUnique({ where: { id: transfer.toDepartmentId } })
  if (!fromDept || !toDept) {
    console.error('Missing departments')
    process.exit(4)
  }

  try {
    const maxAttempts = 3
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const inventoryItemIds: string[] = []
      const drinkIds: string[] = []
      for (const it of transfer.items) {
        if (it.productType === 'inventoryItem') inventoryItemIds.push(it.productId)
        if (it.productType === 'drink') drinkIds.push(it.productId)
      }

      const [inventoryItems, drinks, deptInventories] = await Promise.all([
        inventoryItemIds.length ? prisma.inventoryItem.findMany({ where: { id: { in: inventoryItemIds } } }) : Promise.resolve([]),
        drinkIds.length ? prisma.drink.findMany({ where: { id: { in: drinkIds } } }) : Promise.resolve([]),
        (inventoryItemIds.length ? prisma.departmentInventory.findMany({ where: { inventoryItemId: { in: inventoryItemIds }, departmentId: { in: [transfer.fromDepartmentId, transfer.toDepartmentId] } } }) : Promise.resolve([])),
      ])

      const invMap = new Map(inventoryItems.map((i: any) => [i.id, i]))
      const drinkMap = new Map(drinks.map((d: any) => [d.id, d]))
      const deptInvMap = new Map<string, any>()
      for (const di of (deptInventories as any[])) {
        deptInvMap.set(`${di.departmentId}::${di.inventoryItemId}`, di)
      }

      let validationError: string | null = null
      for (const it of transfer.items) {
        if (it.productType === 'drink') {
          const drink = drinkMap.get(it.productId)
          if (!drink) {
            validationError = `Drink not found: ${it.productId}`
            break
          }
          let sourceField = 'quantity'
          if (fromDept.referenceType === 'BarAndClub' && fromDept.referenceId && (drink as any).barAndClubId === fromDept.referenceId) sourceField = 'barStock'
          const available = (drink as any)[sourceField] ?? (drink.quantity ?? 0)
          if (available < it.quantity) {
            validationError = `Insufficient stock for ${drink.name}`
            break
          }
        } else if (it.productType === 'inventoryItem') {
          const keyFrom = `${transfer.fromDepartmentId}::${it.productId}`
          const fromRecord = deptInvMap.get(keyFrom)
          if (!fromRecord) {
            const inv = invMap.get(it.productId)
            if (!inv) {
              validationError = `Inventory item not found: ${it.productId}`
              break
            }
            const globalQty = Number(inv.quantity ?? 0)
            if (globalQty < it.quantity) {
              validationError = `No inventory record for department ${transfer.fromDepartmentId} and item ${it.productId}`
              break
            }
          } else {
            if (fromRecord.quantity < it.quantity) {
              validationError = `Insufficient inventory for ${it.productId} in department ${transfer.fromDepartmentId}`
              break
            }
          }
        } else {
          validationError = `Unsupported productType: ${it.productType}`
          break
        }
      }

      if (validationError) {
        console.error('Validation failed:', validationError)
        process.exit(5)
      }

      const opsFns: Array<(tx: any) => Promise<any>> = []
      for (const it of transfer.items) {
        if (it.productType === 'drink') {
          const drink = drinkMap.get(it.productId)
          let sourceField = 'quantity'
          let destField = 'quantity'
          if (fromDept.referenceType === 'BarAndClub' && fromDept.referenceId && (drink as any).barAndClubId === fromDept.referenceId) sourceField = 'barStock'
          if (toDept.referenceType === 'BarAndClub' && toDept.referenceId && (drink as any).barAndClubId === toDept.referenceId) destField = 'barStock'

          opsFns.push(async (tx: any) => {
            const res = await tx.drink.updateMany({ where: { id: it.productId, [sourceField]: { gte: it.quantity } }, data: { [sourceField]: { decrement: it.quantity }, [destField]: { increment: it.quantity } } } as any)
            if ((res as any).count === 0) throw new Error(`Insufficient stock for drink ${it.productId}`)
            return res
          })
        } else {
          const inv = invMap.get(it.productId)
          const keyFrom = `${transfer.fromDepartmentId}::${it.productId}`
          const fromRecord = deptInvMap.get(keyFrom)

          if (fromRecord) {
            opsFns.push(async (tx: any) => {
              const res = await tx.departmentInventory.updateMany({ where: { departmentId: transfer.fromDepartmentId, inventoryItemId: it.productId, quantity: { gte: it.quantity } }, data: { quantity: { decrement: it.quantity } } })
              if ((res as any).count === 0) throw new Error(`Insufficient inventory for ${it.productId} in department ${transfer.fromDepartmentId}`)
              return res
            })
          } else {
            opsFns.push(async (tx: any) => {
              const res = await tx.inventoryItem.updateMany({ where: { id: it.productId, quantity: { gte: it.quantity } }, data: { quantity: { decrement: it.quantity } } })
              if ((res as any).count === 0) throw new Error(`Insufficient global inventory for ${it.productId}`)
              return res
            })
          }

          opsFns.push(async (tx: any) => {
            const existing = await tx.departmentInventory.findFirst({
              where: { departmentId: transfer.toDepartmentId, sectionId: null, inventoryItemId: it.productId },
            })
            if (existing) {
              return tx.departmentInventory.update({
                where: { id: existing.id },
                data: { quantity: { increment: it.quantity } },
              })
            } else {
              return tx.departmentInventory.create({
                data: { departmentId: transfer.toDepartmentId, inventoryItemId: it.productId, quantity: it.quantity, unitPrice: inv?.unitPrice ?? 0 },
              })
            }
          })

          opsFns.push((tx: any) => tx.inventoryMovement.create({ data: { movementType: 'out', quantity: it.quantity, reason: 'transfer-out', reference: transferId, inventoryItemId: it.productId } }))
          opsFns.push((tx: any) => tx.inventoryMovement.create({ data: { movementType: 'in', quantity: it.quantity, reason: 'transfer-in', reference: transferId, inventoryItemId: it.productId } }))
        }
      }

      opsFns.push((tx: any) => tx.departmentTransfer.update({ where: { id: transferId }, data: { status: 'completed', updatedAt: new Date() } }))

      try {
        await prisma.$transaction(async (tx) => {
          for (const fn of opsFns) {
            await fn(tx)
          }
        }, { timeout: 15000 })

        console.log('Transfer executed successfully')
        process.exit(0)
      } catch (txErr: any) {
        const isInsufficient = String(txErr?.message || '').toLowerCase().includes('insufficient') || String(txErr?.message || '').toLowerCase().includes('no inventory')
        if (isInsufficient) {
          console.error('Insufficient inventory:', txErr?.message)
          process.exit(6)
        }

        if (attempt === maxAttempts) {
          console.error('Transaction failed after retries:', txErr)
          process.exit(7)
        }

        console.warn(`Attempt ${attempt} failed, retrying...`, txErr?.message)
        await new Promise((r) => setTimeout(r, 250 * attempt))
        continue
      }
    }

    console.error('Failed to execute transfer after retries')
    process.exit(8)
  } catch (err: any) {
    console.error('Approve transfer runner error', err)
    process.exit(9)
  } finally {
    await prisma.$disconnect()
  }
}

run()
