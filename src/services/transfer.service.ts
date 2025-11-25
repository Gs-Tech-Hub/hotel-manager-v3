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
        // Preflight: fetch all referenced records to validate availability and prepare batched payloads.
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
          return { success: false, message: validationError }
        }

        // Build minimal write payloads to run in the interactive transaction.
        const sourceDecrements: Array<{ departmentId?: string; inventoryItemId?: string; drinkId?: string; amount: number; sourceField?: string; destField?: string }> = []
        const destCreates: Array<{ departmentId: string; inventoryItemId: string; quantity: number; unitPrice: any }> = []
        const destIncrements: Array<{ departmentId: string; inventoryItemId: string; amount: number }> = []
        const movementRows: Array<any> = []

        // Prepare payloads for drinks and inventory items
        for (const it of transfer.items) {
          if (it.productType === 'drink') {
            const drink = drinkMap.get(it.productId)
            let sourceField = 'quantity'
            let destField = 'quantity'
            if (fromDept.referenceType === 'BarAndClub' && fromDept.referenceId && (drink as any).barAndClubId === fromDept.referenceId) sourceField = 'barStock'
            if (toDept.referenceType === 'BarAndClub' && toDept.referenceId && (drink as any).barAndClubId === toDept.referenceId) destField = 'barStock'

            sourceDecrements.push({ drinkId: it.productId, amount: it.quantity, sourceField, destField })
          } else {
            const inv = invMap.get(it.productId)
            // we validated that department inventory exists and is sufficient
            sourceDecrements.push({ departmentId: transfer.fromDepartmentId, inventoryItemId: it.productId, amount: it.quantity })

            const keyTo = `${transfer.toDepartmentId}::${it.productId}`
            const toRecord = deptInvMap.get(keyTo)
            if (toRecord) {
              destIncrements.push({ departmentId: transfer.toDepartmentId, inventoryItemId: it.productId, amount: it.quantity })
            } else {
              destCreates.push({ departmentId: transfer.toDepartmentId, inventoryItemId: it.productId, quantity: it.quantity, unitPrice: inv?.unitPrice ?? 0 })
            }

            movementRows.push({ movementType: 'out', quantity: it.quantity, reason: 'transfer-out', reference: transferId, inventoryItemId: it.productId })
            movementRows.push({ movementType: 'in', quantity: it.quantity, reason: 'transfer-in', reference: transferId, inventoryItemId: it.productId })
          }
        }

        // Execute minimal writes inside a short interactive transaction
        try {
          const start = Date.now()
          await prisma.$transaction(async (tx) => {
            // 1) decrement drink stocks (parallelized)
            const drinkOps = sourceDecrements.filter((s) => s.drinkId).map((d) =>
              tx.drink.updateMany({ where: { id: d.drinkId, [d.sourceField!]: { gte: d.amount } }, data: { [d.sourceField!]: { decrement: d.amount }, [d.destField!]: { increment: d.amount } } } as any)
            )
            const drinkResults = await Promise.all(drinkOps)
            for (const r of drinkResults) {
              if ((r as any).count === 0) throw new Error(`Insufficient drink stock during transfer`)
            }

            // 2) decrement source department inventory for inventoryItems (parallelized)
            const srcInvOps = sourceDecrements.filter((s) => s.inventoryItemId).map((s) =>
              tx.departmentInventory.updateMany({ where: { departmentId: s.departmentId, inventoryItemId: s.inventoryItemId, quantity: { gte: s.amount } }, data: { quantity: { decrement: s.amount } } })
            )
            const srcInvResults = await Promise.all(srcInvOps)
            for (let i = 0; i < srcInvResults.length; i++) {
              const res = srcInvResults[i] as any
              const s = sourceDecrements.filter((s) => s.inventoryItemId)[i]
              if (res.count === 0) throw new Error(`Insufficient inventory for ${s.inventoryItemId} in department ${s.departmentId}`)
            }

            // 3) create missing destination department inventories in one call if any
            if (destCreates.length) {
              await tx.departmentInventory.createMany({ data: destCreates, skipDuplicates: true })
            }

            // 4) increment existing destination department inventories (parallelized)
            const destIncOps = destIncrements.map((u) =>
              tx.departmentInventory.updateMany({ where: { departmentId: u.departmentId, inventoryItemId: u.inventoryItemId }, data: { quantity: { increment: u.amount } } })
            )
            if (destIncOps.length) await Promise.all(destIncOps)

            // 5) create inventory movements in bulk
            if (movementRows.length) {
              await tx.inventoryMovement.createMany({ data: movementRows })
            }

            // 6) mark transfer completed
            await tx.departmentTransfer.update({ where: { id: transferId }, data: { status: 'completed', updatedAt: new Date() } })
          }, { timeout: 15000 })

          const took = Date.now() - start
          // success
          return { success: true, message: `Transfer executed in ${took}ms` }
        } catch (txErr: any) {
          const isInsufficient = String(txErr?.message || '').toLowerCase().includes('insufficient') || String(txErr?.message || '').toLowerCase().includes('no inventory')
          if (isInsufficient) {
            return { success: false, message: txErr?.message || 'Insufficient inventory' }
          }

          if (attempt === maxAttempts) {
            throw txErr
          }

          // Concurrency / transient error: wait and retry preflight
          console.warn(`approveTransfer attempt ${attempt} failed, retrying...`, txErr?.message)
          await new Promise((r) => setTimeout(r, 250 * attempt))
          continue
        }
      }
      return { success: false, message: 'Transfer execution failed after retries' }
    } catch (err: any) {
      console.error('approveTransfer error', err)
      return { success: false, message: err?.message || 'Execution failed' }
    }
  }
}

export const transferService = new TransferService()
