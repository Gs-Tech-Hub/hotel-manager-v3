import { prisma } from '@/lib/auth/prisma'
import { stockService } from './stock.service'
import { DepartmentExtrasService } from './department-extras.service'

/**
 * Transfer Service
 * Handles creation and approval/execution of department-to-department transfers.
 * Supports drinks, inventory items, and extras - all following the same approval workflow.
 * 
 * KEY PRINCIPLE: Always use stockService for ALL stock validation and balance queries.
 * Never query Drink.barStock, InventoryItem.quantity directly - use DepartmentInventory through stockService.
 */
export class TransferService {
  constructor() {}

  /**
   * Create a transfer request (status = pending)
   * 
   * @param fromDepartmentId - Source department ID
   * @param toDepartmentId - Destination department or section ID
   * @param items - Items to transfer
   * @param createdBy - User ID who created the transfer
   * @param codes - Optional object with source and destination codes (may be section codes like "DEPT:section")
   */
  async createTransfer(fromDepartmentId: string, toDepartmentId: string, items: Array<{ productType: string; productId: string; quantity: number }>, createdBy?: string, codes?: { from?: string; to?: string } | string) {
    // Handle backward compatibility: if codes is a string, treat it as the destination code
    let notesData: any = null
    if (typeof codes === 'string') {
      notesData = { toDepartmentCode: codes }
    } else if (codes) {
      notesData = {}
      if (codes.from) notesData.fromDepartmentCode = codes.from
      if (codes.to) notesData.toDepartmentCode = codes.to
    }

    const transfer = await (prisma as any).departmentTransfer.create({
      data: {
        fromDepartmentId,
        toDepartmentId,
        status: 'pending',
        createdBy,
        notes: notesData ? JSON.stringify(notesData) : null,
        items: { create: items.map((it) => ({ productType: it.productType, productId: it.productId, quantity: it.quantity })) },
      },
      include: { items: true },
    })

    return transfer
  }

  /**
   * Approve and execute the transfer: perform transactional stock movement and mark transfer completed.
   * Currently supports productType = 'drink' (updates Drink.barStock / restaurantStock / quantity fields).
   * SOURCE is always a DEPARTMENT (sectionId = null)
   * DESTINATION can be either a DEPARTMENT or a SECTION (sectionId = section.id)
   */
  async approveTransfer(transferId: string, actor?: string) {
    const transfer = await (prisma as any).departmentTransfer.findUnique({ where: { id: transferId }, include: { items: true } })
    if (!transfer) return { success: false, message: 'Transfer not found' }
    if (transfer.status !== 'pending' && transfer.status !== 'approved') return { success: false, message: `Transfer is already ${transfer.status}` }

    // SOURCE is always a department
    const fromDept = await prisma.department.findUnique({ where: { id: transfer.fromDepartmentId } })
    
    // Handle DESTINATION: could be a department or a section
    let toDept: any = null
    let toCode: string | null = null
    
    // Try to parse the destination code from notes
    try {
      if (transfer.notes) {
        const parsed = JSON.parse(transfer.notes)
        toCode = parsed.toDepartmentCode
      }
    } catch (e) {
      // notes might not be JSON, continue without toCode
    }
    
    if (toCode && toCode.includes(':')) {
      // Destination is a section - look it up in departmentSection table
      const parts = toCode.split(':')
      const parentCode = parts[0]
      const sectionSlugOrId = parts.slice(1).join(':')
      
      const parentDept = await prisma.department.findUnique({ where: { code: parentCode } })
      if (!parentDept) return { success: false, message: 'Parent department for section not found' }
      
      const section = await prisma.departmentSection.findFirst({
        where: {
          departmentId: parentDept.id,
          isActive: true,
          OR: [
            { slug: sectionSlugOrId },
            { id: sectionSlugOrId }
          ]
        }
      })
      
      if (!section) return { success: false, message: 'Destination section not found' }
      
      // For sections: use both parent dept and section ID for inventory routing
      toDept = {
        id: section.id,
        code: toCode,
        isSection: true,
        parentId: parentDept.id,
        parentDeptId: parentDept.id,
        referenceType: parentDept.referenceType,
        referenceId: parentDept.referenceId
      }
    } else {
      // Destination is a department
      toDept = await prisma.department.findUnique({ where: { id: transfer.toDepartmentId } })
    }
    
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

        const allProductIds = [...inventoryItemIds, ...drinkIds]
        const [inventoryItems, drinks, deptInventories] = await Promise.all([
          inventoryItemIds.length ? prisma.inventoryItem.findMany({ where: { id: { in: inventoryItemIds } } }) : Promise.resolve([]),
          drinkIds.length ? prisma.drink.findMany({ where: { id: { in: drinkIds } } }) : Promise.resolve([]),
          // Fetch all department inventories for the products being transferred, from source and destination departments
          allProductIds.length ? prisma.departmentInventory.findMany({ 
            where: { 
              inventoryItemId: { in: allProductIds },
              departmentId: { in: [transfer.fromDepartmentId, transfer.toDepartmentId] }
            } 
          }) : Promise.resolve([]),
        ])

        const invMap = new Map(inventoryItems.map((i: any) => [i.id, i]))
        const drinkMap = new Map(drinks.map((d: any) => [d.id, d]))
        const deptInvMap = new Map<string, any>()
        for (const di of (deptInventories as any[])) {
          const key = `${di.departmentId}::${di.sectionId ? di.sectionId + '::' : ''}${di.inventoryItemId}`
          deptInvMap.set(key, di)
        }

        // Validate availability outside the transaction to fail fast for obvious errors.
        // Use stockService for all balance checks - this ensures consistency between display and validation
        // For extras, validate directly from DepartmentExtras table
        let validationError: string | null = null
        for (const it of transfer.items) {
          if (it.productType === 'extra') {
            // For extras, check DepartmentExtras allocation at department level (sectionId = null)
            const deptExtra = await prisma.departmentExtra.findFirst({
              where: {
                departmentId: transfer.fromDepartmentId,
                extraId: it.productId,
                sectionId: null, // Check department-level allocation
              },
              include: { extra: true },
            })
            if (!deptExtra) {
              validationError = `Extra not allocated in source department`
              break
            }
            // For tracked extras, validate quantity; for non-tracked, just ensure it's available
            const availableQty = deptExtra.extra.trackInventory ? deptExtra.quantity : 1
            if (availableQty < it.quantity) {
              validationError = `Insufficient quantity for extra "${deptExtra.extra.name}": have ${availableQty}, need ${it.quantity}`
              break
            }
          } else {
            // For drinks and inventory, use stockService (which properly checks department-level stock)
            const check = await stockService.checkAvailability(it.productType, it.productId, transfer.fromDepartmentId, it.quantity)

            if (!check.hasStock) {
              validationError = check.message || `Insufficient stock for product ${it.productId}`
              break
            }
          }
        }

        if (validationError) {
          return { success: false, message: validationError }
        }

        // Build minimal write payloads to run in the interactive transaction.
        // CRITICAL: We must update DepartmentInventory ONLY, not Drink or InventoryItem tables
        const sourceDecrements: Array<{ departmentId: string; sectionId?: string | null; inventoryItemId: string; amount: number }> = []
        const destCreates: Array<{ departmentId: string; sectionId?: string | null; inventoryItemId: string; quantity: number; unitPrice: any }> = []
        const destIncrements: Array<{ departmentId: string; sectionId?: string | null; inventoryItemId: string; amount: number }> = []
        const movementRows: Array<any> = []

        // Prepare payloads for drinks, inventory items, and extras
        const extrasToTransfer: Array<{ departmentId: string; extraId: string; sourceSectionId: string | null; destinationSectionId: string | null; quantity: number }> = []

        for (const it of transfer.items) {
          if (it.productType === 'extra') {
            // Queue extras for transfer in the transaction callback
            const toSectionId = (toDept as any).isSection ? (toDept as any).id : null
            extrasToTransfer.push({
              departmentId: transfer.fromDepartmentId,
              extraId: it.productId,
              sourceSectionId: null, // Source is always department-level
              destinationSectionId: toSectionId,
              quantity: it.quantity,
            })
          } else if (it.productType === 'drink') {
            const drink = drinkMap.get(it.productId)
            // For drinks: update DepartmentInventory, not Drink table
            // SOURCE is always a DEPARTMENT (sectionId = null)
            sourceDecrements.push({ departmentId: transfer.fromDepartmentId, sectionId: null, inventoryItemId: it.productId, amount: it.quantity })

            const toSectionId = (toDept as any).isSection ? (toDept as any).id : null
            const keyTo = `${transfer.toDepartmentId}::${toSectionId ? toSectionId + '::' : ''}${it.productId}`
            const toRecord = deptInvMap.get(keyTo)
            if (toRecord) {
              destIncrements.push({ departmentId: transfer.toDepartmentId, sectionId: toSectionId, inventoryItemId: it.productId, amount: it.quantity })
            } else {
              destCreates.push({ departmentId: transfer.toDepartmentId, sectionId: toSectionId, inventoryItemId: it.productId, quantity: it.quantity, unitPrice: drink?.price ?? 0 })
            }

            movementRows.push({ movementType: 'out', quantity: it.quantity, reason: 'transfer-out', reference: transferId, inventoryItemId: it.productId })
            movementRows.push({ movementType: 'in', quantity: it.quantity, reason: 'transfer-in', reference: transferId, inventoryItemId: it.productId })
          } else {
            const inv = invMap.get(it.productId)
            // SOURCE is always a DEPARTMENT (sectionId = null)
            sourceDecrements.push({ departmentId: transfer.fromDepartmentId, sectionId: null, inventoryItemId: it.productId, amount: it.quantity })

            const toSectionId = (toDept as any).isSection ? (toDept as any).id : null
            const keyTo = `${transfer.toDepartmentId}::${toSectionId ? toSectionId + '::' : ''}${it.productId}`
            const toRecord = deptInvMap.get(keyTo)
            if (toRecord) {
              destIncrements.push({ departmentId: transfer.toDepartmentId, sectionId: toSectionId, inventoryItemId: it.productId, amount: it.quantity })
            } else {
              destCreates.push({ departmentId: transfer.toDepartmentId, sectionId: toSectionId, inventoryItemId: it.productId, quantity: it.quantity, unitPrice: inv?.unitPrice ?? 0 })
            }

            movementRows.push({ movementType: 'out', quantity: it.quantity, reason: 'transfer-out', reference: transferId, inventoryItemId: it.productId })
            movementRows.push({ movementType: 'in', quantity: it.quantity, reason: 'transfer-in', reference: transferId, inventoryItemId: it.productId })
          }
        }

        // Execute minimal writes inside a short interactive transaction
        try {
          const start = Date.now()
          await prisma.$transaction(async (tx) => {
            // 1) decrement source department inventory for ALL items (parallelized)
            // This includes drinks and inventory items - both stored in DepartmentInventory
            const srcInvOps = sourceDecrements.map((s) => {
              const where: any = {
                departmentId: s.departmentId,
                inventoryItemId: s.inventoryItemId,
                quantity: { gte: s.amount }
              }
              // sectionId is null for department-level stock
              if (s.sectionId === null) {
                where.sectionId = null
              } else if (s.sectionId) {
                where.sectionId = s.sectionId
              }
              return tx.departmentInventory.updateMany({ where, data: { quantity: { decrement: s.amount } } })
            })
            const srcInvResults = await Promise.all(srcInvOps)
            for (let i = 0; i < srcInvResults.length; i++) {
              const res = srcInvResults[i] as any
              const s = sourceDecrements[i]
              if (res.count === 0) throw new Error(`Insufficient inventory for ${s.inventoryItemId} in department ${s.departmentId}`)
            }

            // 2) create missing destination inventories in one call if any
            if (destCreates.length) {
              await tx.departmentInventory.createMany({ data: destCreates, skipDuplicates: true })
            }

            // 3) increment existing destination inventories (parallelized)
            const destIncOps = destIncrements.map((u) => {
              const where: any = { 
                departmentId: u.departmentId, 
                inventoryItemId: u.inventoryItemId 
              }
              // sectionId is null for department-level stock
              if (u.sectionId === null) {
                where.sectionId = null
              } else if (u.sectionId) {
                where.sectionId = u.sectionId
              }
              return tx.departmentInventory.updateMany({ 
                where, 
                data: { quantity: { increment: u.amount } } 
              })
            })
            if (destIncOps.length) await Promise.all(destIncOps)

            // 4) create inventory movements in bulk
            if (movementRows.length) {
              await tx.inventoryMovement.createMany({ data: movementRows })
            }

            // 5) transfer extras (must be outside of transaction since DepartmentExtrasService handles its own DB calls)
            // We'll do extras after the main transaction completes

            // 6) mark transfer completed
            await tx.departmentTransfer.update({ where: { id: transferId }, data: { status: 'completed', updatedAt: new Date() } })
          }, { timeout: 15000 })

          // After main transaction succeeds, transfer extras
          // (Each extra transfer may have its own internal transaction)
          for (const extra of extrasToTransfer) {
            try {
              await DepartmentExtrasService.transferExtra(
                extra.departmentId,
                extra.extraId,
                extra.sourceSectionId,
                extra.destinationSectionId,
                extra.quantity
              )
            } catch (e: any) {
              // Log the error but continue - we don't want one extra failure to block the whole transfer
              console.warn(`Failed to transfer extra ${extra.extraId}: ${e?.message}`)
            }
          }

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
