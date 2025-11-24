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
      await prisma.$transaction(async (tx) => {
        for (const it of transfer.items) {
          if (it.productType === 'drink') {
            const drink = await tx.drink.findUnique({ where: { id: it.productId } })
            if (!drink) throw new Error(`Drink not found: ${it.productId}`)

            // Determine fields (drinks only have barStock; no restaurant-specific link in schema).
            let sourceField = 'quantity'
            let destField = 'quantity'
            if (fromDept.referenceType === 'BarAndClub' && fromDept.referenceId && (drink as any).barAndClubId === fromDept.referenceId) sourceField = 'barStock'
            if (toDept.referenceType === 'BarAndClub' && toDept.referenceId && (drink as any).barAndClubId === toDept.referenceId) destField = 'barStock'

            const available = (drink as any)[sourceField] ?? (drink.quantity ?? 0)
            if (available < it.quantity) throw new Error(`Insufficient stock for ${drink.name}`)

            const updateData: any = {}
            updateData[sourceField] = { decrement: it.quantity }
            updateData[destField] = { increment: it.quantity }

            await (tx as any).drink.update({ where: { id: it.productId }, data: updateData })
          } else {
            // For generic inventory items (inventoryItem) adjust per-department balances via DepartmentInventory
            if (it.productType === 'inventoryItem') {
              // source department inventory record
              const fromRecord = await (tx as any).departmentInventory.findUnique({ where: { departmentId_inventoryItemId: { departmentId: transfer.fromDepartmentId, inventoryItemId: it.productId } } })
              if (!fromRecord) {
                // Fallback: if no per-department record exists for the source, try to use global InventoryItem.quantity
                const invItem = await (tx as any).inventoryItem.findUnique({ where: { id: it.productId } })
                if (!invItem) throw new Error(`Inventory item not found: ${it.productId}`)
                const globalQty = Number(invItem.quantity ?? 0)
                if (globalQty < it.quantity) throw new Error(`No inventory record for department ${transfer.fromDepartmentId} and item ${it.productId}`)

                // decrement global inventory quantity
                await (tx as any).inventoryItem.update({ where: { id: it.productId }, data: { quantity: { decrement: it.quantity } } })

                // increment destination (create if missing)
                const toRecord = await (tx as any).departmentInventory.findUnique({ where: { departmentId_inventoryItemId: { departmentId: transfer.toDepartmentId, inventoryItemId: it.productId } } })
                if (toRecord) {
                  await (tx as any).departmentInventory.update({ where: { departmentId_inventoryItemId: { departmentId: transfer.toDepartmentId, inventoryItemId: it.productId } }, data: { quantity: { increment: it.quantity } } })
                } else {
                  await (tx as any).departmentInventory.create({ data: { departmentId: transfer.toDepartmentId, inventoryItemId: it.productId, quantity: it.quantity } })
                }

                // record global movement out and department movement in
                await tx.inventoryMovement.create({ data: { movementType: 'out', quantity: it.quantity, reason: 'transfer-out', reference: transferId, inventoryItemId: it.productId } })
                await tx.inventoryMovement.create({ data: { movementType: 'in', quantity: it.quantity, reason: 'transfer-in', reference: transferId, inventoryItemId: it.productId } })
              } else {
                if (fromRecord.quantity < it.quantity) throw new Error(`Insufficient inventory for ${fromRecord.id}`)

                // decrement source
                await (tx as any).departmentInventory.update({ where: { departmentId_inventoryItemId: { departmentId: transfer.fromDepartmentId, inventoryItemId: it.productId } }, data: { quantity: { decrement: it.quantity } } })

                // increment destination (create if missing)
                const toRecord = await (tx as any).departmentInventory.findUnique({ where: { departmentId_inventoryItemId: { departmentId: transfer.toDepartmentId, inventoryItemId: it.productId } } })
                if (toRecord) {
                  await (tx as any).departmentInventory.update({ where: { departmentId_inventoryItemId: { departmentId: transfer.toDepartmentId, inventoryItemId: it.productId } }, data: { quantity: { increment: it.quantity } } })
                } else {
                  await (tx as any).departmentInventory.create({ data: { departmentId: transfer.toDepartmentId, inventoryItemId: it.productId, quantity: it.quantity } })
                }

                // record movements for the inventory item
                await tx.inventoryMovement.create({ data: { movementType: 'out', quantity: it.quantity, reason: 'transfer-out', reference: transferId, inventoryItemId: it.productId } })
                await tx.inventoryMovement.create({ data: { movementType: 'in', quantity: it.quantity, reason: 'transfer-in', reference: transferId, inventoryItemId: it.productId } })
              }
            } else {
              throw new Error(`Unsupported productType: ${it.productType}`)
            }
          }
        }

        // Mark transfer completed
  await (tx as any).departmentTransfer.update({ where: { id: transferId }, data: { status: 'completed', updatedAt: new Date() } })
      })

      return { success: true, message: 'Transfer executed' }
    } catch (err: any) {
      console.error('approveTransfer error', err)
      return { success: false, message: err?.message || 'Execution failed' }
    }
  }
}

export const transferService = new TransferService()
