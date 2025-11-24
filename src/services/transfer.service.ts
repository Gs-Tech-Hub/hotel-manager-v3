import { prisma } from '@/lib/prisma'

/**
 * Transfer Service
 * Handles creation and approval/execution of department-to-department transfers.
 */
export class TransferService {
  constructor() {}

  /**
   * Create a transfer request (status = pending)
   */
  async createTransfer(fromDepartmentId: string, toDepartmentId: string, items: Array<{ productType: string; productId: string; quantity: number }>, createdBy?: string) {
  const transfer = await (prisma as any).departmentTransfer.create({
      data: {
        fromDepartmentId,
        toDepartmentId,
        status: 'pending',
        createdBy,
        items: { create: items.map((it) => ({ productType: it.productType, productId: it.productId, quantity: it.quantity })) },
      },
      include: { items: true },
    })

    return transfer
  }

  /**
   * Approve and execute the transfer: perform transactional stock movement and mark transfer completed.
   * Currently supports productType = 'drink' (updates Drink.barStock / restaurantStock / quantity fields).
   */
  async approveTransfer(transferId: string, actor?: string) {
  const transfer = await (prisma as any).departmentTransfer.findUnique({ where: { id: transferId }, include: { items: true } })
    if (!transfer) return { success: false, message: 'Transfer not found' }
    if (transfer.status !== 'pending' && transfer.status !== 'approved') return { success: false, message: `Transfer is already ${transfer.status}` }

    const fromDept = await prisma.department.findUnique({ where: { id: transfer.fromDepartmentId } })
    const toDept = await prisma.department.findUnique({ where: { id: transfer.toDepartmentId } })
    if (!fromDept || !toDept) return { success: false, message: 'Departments missing' }

    try {
      const maxAttempts = 3
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Preflight: fetch all referenced records to validate availability and prepare batched operations.
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

        // Validate availability outside the transaction to fail fast for obvious errors.
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
                // Require department-scoped inventory to exist for transfers. Encourage running the seed/normalize script.
                validationError = `Missing DepartmentInventory for department ${transfer.fromDepartmentId} and item ${it.productId}`
                break
              }
              if (fromRecord.quantity < it.quantity) {
                validationError = `Insufficient inventory for ${it.productId} in department ${transfer.fromDepartmentId}`
                break
              }
          } else {
            validationError = `Unsupported productType: ${it.productType}`
            break
          }
        }

        if (validationError) {
          // If validation failed, return immediately (no retry). This is a hard business rule failure.
          return { success: false, message: validationError }
        }

        // Build batched operation functions (use tx.* inside the transaction callback)
        const opsFns: Array<(tx: any) => Promise<any>> = []

        for (const it of transfer.items) {
          if (it.productType === 'drink') {
            const drink = drinkMap.get(it.productId)
            let sourceField = 'quantity'
            let destField = 'quantity'
            if (fromDept.referenceType === 'BarAndClub' && fromDept.referenceId && (drink as any).barAndClubId === fromDept.referenceId) sourceField = 'barStock'
            if (toDept.referenceType === 'BarAndClub' && toDept.referenceId && (drink as any).barAndClubId === toDept.referenceId) destField = 'barStock'

            // Use updateMany to ensure atomicity: only decrement if enough stock remains
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

            // upsert destination department inventory (create or increment)
            opsFns.push((tx: any) => tx.departmentInventory.upsert({
              where: { departmentId_inventoryItemId: { departmentId: transfer.toDepartmentId, inventoryItemId: it.productId } },
              create: { departmentId: transfer.toDepartmentId, inventoryItemId: it.productId, quantity: it.quantity, unitPrice: inv?.unitPrice ?? 0 },
              update: { quantity: { increment: it.quantity } },
            }))

            // record movements
            opsFns.push((tx: any) => tx.inventoryMovement.create({ data: { movementType: 'out', quantity: it.quantity, reason: 'transfer-out', reference: transferId, inventoryItemId: it.productId } }))
            opsFns.push((tx: any) => tx.inventoryMovement.create({ data: { movementType: 'in', quantity: it.quantity, reason: 'transfer-in', reference: transferId, inventoryItemId: it.productId } }))
          }
        }

        // Mark transfer completed
        opsFns.push((tx: any) => tx.departmentTransfer.update({ where: { id: transferId }, data: { status: 'completed', updatedAt: new Date() } }))

        // Execute batched operations in a single interactive transaction within the allowed timeout.
        try {
          await prisma.$transaction(async (tx) => {
            for (const fn of opsFns) {
              await fn(tx)
            }
          }, { timeout: 15000 })

          // success
          return { success: true, message: 'Transfer executed' }
        } catch (txErr: any) {
          // If this was the last attempt, propagate error
          const isInsufficient = String(txErr?.message || '').toLowerCase().includes('insufficient') || String(txErr?.message || '').toLowerCase().includes('no inventory')
          if (isInsufficient) {
            return { success: false, message: txErr?.message || 'Insufficient inventory' }
          }

          if (attempt === maxAttempts) {
            throw txErr
          }

          // Otherwise, log and retry (concurrent modification likely). Small delay before retry.
          console.warn(`approveTransfer attempt ${attempt} failed, retrying...`, txErr?.message)
          await new Promise((r) => setTimeout(r, 250 * attempt))
          continue
        }
      }
      // if loop exits unexpectedly
      return { success: false, message: 'Transfer execution failed after retries' }
    } catch (err: any) {
      console.error('approveTransfer error', err)
      return { success: false, message: err?.message || 'Execution failed' }
    }
  }
}

export const transferService = new TransferService()
