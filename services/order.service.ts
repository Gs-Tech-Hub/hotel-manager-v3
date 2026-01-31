/**
 * Enhanced Order Service
 * Comprehensive order management with multi-department support, discounts, and inventory
 * 
 * PRICE CONSISTENCY:
 * - All prices stored as integers in cents
 * - Calculations use cents throughout
 * - Database fields: subtotal, discountTotal, tax, total are all INT (cents)
 * - OrderLine.unitPrice and lineTotal are INT (cents)
 * - Discounts applied as cents, not percentages
 * - Tax calculated as percentage of subtotal (cents)
 */

import { BaseService } from './base.service';
import type { IOrderHeader } from '@/types/entities';
import { prisma } from '@/lib/auth/prisma';
import { normalizeError } from '@/lib/errors';
import { 
  normalizeToCents, 
  calculateDiscount, 
  calculateTax, 
  calculateTotal,
  validatePrice,
  sumPrices 
} from '@/lib/price';
import { UserContext, requireRoleOrOwner, requireRole } from '@/lib/auth/authorization';
import { departmentService } from './department.service';
import { StockService } from './stock.service';
import { errorResponse, ErrorCodes } from '@/lib/api-response';

export class OrderService extends BaseService<IOrderHeader> {
  constructor() {
    super('orderHeader');
  }

  /**
   * Create comprehensive order with validation
   * Handles: inventory allocation, discount application, department routing
   * 
   * All prices normalized to cents (integers) for consistency
   */
  async createOrder(data: {
    customerId: string;
    items: Array<{
      productId: string;
      productType: string;
      productName: string;
      departmentCode: string;
      departmentSectionId?: string;
      quantity: number;
      unitPrice: number;
    }>;
    discounts?: string[]; // Promo codes/rule IDs
    notes?: string;
    departmentSectionId?: string;
  }, _ctx?: UserContext) {
    try {
      // Validate customer exists
      const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
      if (!customer) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Customer not found');
      }

      // Generate unique order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Extract parent department codes from items (handle section codes like "RESTAURANT:main")
      const departmentCodes = Array.from(new Set(data.items.map(i => {
        const code = i.departmentCode || '';
        // If this is a section code (contains ':'), extract parent code
        return code.includes(':') ? code.split(':')[0] : code;
      })));
      const deptRecords = await prisma.department.findMany({ where: { code: { in: departmentCodes } } });
      const deptMap: Record<string, string> = {};
      for (const d of deptRecords) {
        deptMap[d.code] = (d as any).id;
      }

      // Calculate subtotal and validate inventory (all prices normalized to cents)
      let subtotal = 0;
      const departments = new Set<string>();
      const stockService = new StockService();

      for (const item of data.items) {
        // Normalize unit price to cents (integer)
        const normalizedUnit = normalizeToCents(item.unitPrice);
        validatePrice(normalizedUnit, `Item ${item.productName} unitPrice`);
        
        // attach normalized value back for later use
        ;(item as any)._normalizedUnitPrice = normalizedUnit;
        subtotal += item.quantity * normalizedUnit;
        departments.add(item.departmentCode);

        // Check inventory availability using StockService (unified source of truth)
        const deptId = deptMap[item.departmentCode];
        if (deptId && ['RESTAURANT', 'BAR_CLUB', 'food', 'drink'].some(t => 
          item.departmentCode.toUpperCase().includes(t.toUpperCase()) || 
          item.productType === t)) {
          
          const availability = await stockService.checkAvailability(
            item.productType || 'inventoryItem',
            item.productId,
            deptId,
            item.quantity
          );
          
          if (!availability.hasStock) {
            return errorResponse(
              ErrorCodes.VALIDATION_ERROR, 
              `Insufficient stock for ${item.productName}: have ${availability.available}, need ${item.quantity}`
            );
          }
        }
      }

      // Validate subtotal
      validatePrice(subtotal, 'subtotal');

      // Create order header first (keep this operation minimal and fast)
      const header = await prisma.orderHeader.create({
        data: {
          orderNumber,
          customerId: data.customerId,
          subtotal,
          discountTotal: 0,
          tax: 0,
          total: subtotal,
          status: 'pending',
          paymentStatus: 'unpaid', // Initialize as unpaid
          notes: data.notes,
          createdBy: _ctx?.userId, // Preserve audit trail of who created the order
        } as any,
      });

      // Extract department codes for later routing
      const deptCodes = Array.from(departments);

      // Helper: chunk array into batches
      const chunk = (arr: any[], size = 50) => {
        const out: any[][] = []
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
        return out
      }

      // Map department codes to their sections for order discovery
      // Prioritize:
      // 1. departmentSectionId passed per-item from POS terminal
      // 2. departmentSectionId passed at order level (fallback for whole order)
      // 3. First section of department (legacy default)
      // Note: departmentCode might be a full section code like "RESTAURANT:main" now
      const deptCodeToSectionId: { [key: string]: string } = {};
      for (const code of deptCodes) {
        // If this is a section code, resolve it to the section ID
        if (code.includes(':')) {
          const parts = code.split(':');
          const parentCode = parts[0];
          const sectionSlugOrId = parts.slice(1).join(':');
          
          const parentDept = await prisma.department.findUnique({ where: { code: parentCode } });
          if (parentDept) {
            const section = await prisma.departmentSection.findFirst({
              where: {
                departmentId: parentDept.id,
                OR: [
                  { slug: sectionSlugOrId },
                  { id: sectionSlugOrId }
                ]
              }
            });
            if (section) {
              deptCodeToSectionId[parentCode] = section.id;
            }
          }
        } else {
          // Regular parent code - use first section if available
          const dept = await prisma.department.findUnique({
            where: { code },
            include: { sections: { take: 1, orderBy: { createdAt: 'asc' } } }
          });
          if (dept?.sections?.[0]) {
            deptCodeToSectionId[code] = dept.sections[0].id;
          }
        }
      }
      
      // If a departmentSectionId was provided at the order level, use it for all items of its department
      if (data.departmentSectionId) {
        const deptForSection = await prisma.departmentSection.findUnique({
          where: { id: data.departmentSectionId },
          include: { department: true }
        });
        if (deptForSection?.department?.code) {
          deptCodeToSectionId[deptForSection.department.code] = data.departmentSectionId;
        }
      }

      // Prepare order lines and reservation rows
      const linesData = data.items.map((item: any, idx: number) => {
        const unitPriceCents = (item as any)._normalizedUnitPrice ?? normalizeToCents(item.unitPrice);
        const lineTotalCents = item.quantity * unitPriceCents;
        validatePrice(lineTotalCents, `Line ${idx + 1} total`);
        
        // Extract parent code if departmentCode is a section code
        const parentCode = item.departmentCode?.includes(':') ? item.departmentCode.split(':')[0] : item.departmentCode;
        
        // Use per-item departmentSectionId if provided, otherwise use the dept code mapping
        const sectionId = item.departmentSectionId || deptCodeToSectionId[parentCode] || null;
        
        return {
          lineNumber: idx + 1,
          orderHeaderId: header.id,
          departmentCode: item.departmentCode,
          departmentSectionId: sectionId,
          productId: item.productId,
          productType: item.productType,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: unitPriceCents,
          unitDiscount: 0,
          lineTotal: lineTotalCents,
          status: 'pending',
        };
      });

      const reservationRows = data.items
        .filter((it: any) => {
          const deptCode = it.departmentCode || '';
          const parentCode = deptCode.includes(':') ? deptCode.split(':')[0] : deptCode;
          return ['RESTAURANT', 'BAR_CLUB'].includes(parentCode);
        })
        .map((it: any) => ({
          inventoryItemId: it.productId,
          orderHeaderId: header.id,
          quantity: it.quantity,
          status: 'reserved',
        }));

      const orderDepartmentRows: any[] = [];
      for (const code of deptCodes) {
        // If this is a section code, extract parent code for department lookup
        const parentCode = code.includes(':') ? code.split(':')[0] : code;
        const deptId = deptMap[parentCode];
        if (deptId) orderDepartmentRows.push({ orderHeaderId: header.id, departmentId: deptId, status: 'pending' });
      }

      // Insert lines/reservations/departments in chunks to avoid long-running single queries
      const lineBatches = chunk(linesData, 100)
      for (const b of lineBatches) {
        if (b.length) await prisma.orderLine.createMany({ data: b })
      }

      const resBatches = chunk(reservationRows, 100)
      for (const b of resBatches) {
        if (b.length) await prisma.inventoryReservation.createMany({ data: b })
      }

      const deptBatches = chunk(orderDepartmentRows, 50)
      for (const b of deptBatches) {
        if (b.length) await prisma.orderDepartment.createMany({ data: b })
      }

      const order = header

      // Recalculate and persist section stats for involved department sections
      try {
        for (const code of deptCodes) {
          if (!code) continue;
          await departmentService.recalculateSectionStats(code);
          // Also roll up to parent if this is a section code
          await departmentService.rollupParentStats(code);
        }
      } catch (e) {
        try { const logger = await import('@/lib/logger'); logger.error(e, { context: 'recalculateSectionStats.createOrder' }); } catch {}
      }

      // If discounts were provided at creation time, attempt to apply them now
      if (data.discounts && Array.isArray(data.discounts) && data.discounts.length > 0) {
        // Loop through discount IDs and attempt to create OrderDiscounts (reuse same validations as applyDiscount)
        let accumulatedDiscount = 0;
        
        for (const discountId of data.discounts) {
          if (!discountId) continue;
          // Try to fetch by ID first (new system), then by code (backwards compatibility)
          let rule = await prisma.discountRule.findUnique({ where: { id: discountId } });
          if (!rule) {
            // Fallback to code lookup for backwards compatibility
            rule = await prisma.discountRule.findUnique({ where: { code: discountId } });
          }
          if (!rule) {
            return errorResponse(ErrorCodes.VALIDATION_ERROR, `Discount not found: ${discountId}`);
          }

          if (!rule.isActive) {
            return errorResponse(ErrorCodes.VALIDATION_ERROR, `Discount inactive: ${rule.code}`);
          }

          if (rule.minOrderAmount && subtotal < rule.minOrderAmount) {
            return errorResponse(ErrorCodes.VALIDATION_ERROR, `Minimum order amount of ${rule.minOrderAmount} required for discount ${rule.code}`);
          }

          // Calculate discount amount using utility function (handles percentage and fixed)
          const discountAmount = calculateDiscount(
            subtotal,
            Number(rule.value),
            rule.type as 'percentage' | 'fixed'
          );
          
          validatePrice(discountAmount, `Discount ${rule.code}`);

          // Prevent discount exceeding subtotal
          if (accumulatedDiscount + discountAmount > subtotal) {
            return errorResponse(ErrorCodes.VALIDATION_ERROR, `Discounts exceed subtotal for code: ${rule.code}`);
          }

          // Persist order discount (all in cents)
          await prisma.orderDiscount.create({
            data: {
              orderHeaderId: header.id,
              discountRuleId: rule.id,
              discountType: rule.type as any,
              discountCode: rule.code,
              discountAmount,
            },
          });

          accumulatedDiscount += discountAmount;
        }

        // Update order totals to account for applied discounts
        // Note: tax is 10% of (subtotal - discounts) 
        const taxAmount = calculateTax(subtotal - accumulatedDiscount, 10);
        const totalAmount = calculateTotal(subtotal, accumulatedDiscount, taxAmount);
        
        validatePrice(accumulatedDiscount, 'discountTotal');
        validatePrice(taxAmount, 'tax');
        validatePrice(totalAmount, 'total');

        await prisma.orderHeader.update({
          where: { id: header.id },
          data: {
            discountTotal: accumulatedDiscount,
            tax: taxAmount,
            total: totalAmount,
          },
        });
      }

      // Return complete order with all relations (for receipt display)
      const completeOrder = await (prisma as any).orderHeader.findUnique({
        where: { id: header.id },
        include: {
          customer: true,
          lines: true,
          departments: { include: { department: true } },
          discounts: { include: { discountRule: true } },
          payments: { include: { paymentType: true } },
          fulfillments: true,
          reservations: true,
        },
      });

      return completeOrder || order;
    } catch (error: unknown) {
      // Log raw error and stack to help diagnose failures during order creation
      try {
        // write structured error to log file
        const logger = await import('@/lib/logger')
        logger.error(error, { context: 'createOrder' })
      } catch (logErr) {
        try { console.error('Error creating order (raw):', error); if (error instanceof Error) console.error(error.stack) } catch {}
      }

      const e = normalizeError(error);
      try { const logger = await import('@/lib/logger'); logger.error(e, { context: 'createOrder.normalized' }) } catch {}
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to create order');
    }
  }

  /**
   * Apply discount to order (handles multiple discount types)
   * All calculations in cents
   */
  async applyDiscount(orderId: string, discountData: {
    discountCode: string;
    discountType: 'percentage' | 'fixed' | 'employee' | 'bulk';
    discountAmount?: number; // For fixed discounts or manual entry (in cents)
  }, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager', 'staff']);
      if (forbidden) return forbidden;

      // Get order
      const order = await (prisma as any).orderHeader.findUnique({
        where: { id: orderId },
        include: { lines: true, discounts: true },
      });

      if (!order) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order not found');
      }

      // Validate discount code exists (if applicable)
      let discountAmount = discountData.discountAmount || 0;

      if (discountData.discountType === 'percentage' || discountData.discountType === 'bulk') {
        const rule = await (prisma as any).discountRule.findUnique({ where: { code: discountData.discountCode } });
        if (!rule) {
          return errorResponse(ErrorCodes.NOT_FOUND, 'Discount code not found');
        }

        if (!rule.isActive) {
          return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Discount code is inactive');
        }

        // Check usage limits
        if (rule.maxUsagePerCustomer) {
          const usageCount = await (prisma as any).orderDiscount.count({
            where: {
              discountRuleId: rule.id,
              orderHeader: { customerId: order.customerId },
            },
          });
          if (usageCount >= rule.maxUsagePerCustomer) {
            return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Discount code usage limit exceeded');
          }
        }

        // Check minimum order amount
        if (rule.minOrderAmount && order.subtotal < rule.minOrderAmount) {
          return errorResponse(ErrorCodes.VALIDATION_ERROR, `Minimum order amount of ${rule.minOrderAmount} required`);
        }

        // Calculate discount amount
        if (rule.type === 'percentage') {
          discountAmount = Math.round(order.subtotal * (Number(rule.value) / 100));
        } else {
          // fixed amount in rule.value is Decimal (dollars); convert to cents
          discountAmount = normalizeToCents(Number(rule.value));
        }
      }

      // Validate discount won't result in negative total
      const allCurrentDiscounts = await (prisma as any).orderDiscount.findMany({ where: { orderHeaderId: orderId } });
      const currentTotalDiscount = allCurrentDiscounts.reduce((sum: number, d: any) => sum + d.discountAmount, 0);
      const proposedTotalDiscount = currentTotalDiscount + discountAmount;

      if (proposedTotalDiscount > order.subtotal) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          `Total discount (${proposedTotalDiscount}) cannot exceed subtotal (${order.subtotal})`
        );
      }

      // Create OrderDiscount record
      const discount = await (prisma as any).orderDiscount.create({
        data: {
          orderHeaderId: orderId,
          discountRuleId: discountData.discountType === 'percentage' || discountData.discountType === 'bulk'
            ? (await (prisma as any).discountRule.findUnique({ where: { code: discountData.discountCode } }))?.id
            : undefined,
          discountType: discountData.discountType,
          discountCode: discountData.discountCode,
          discountAmount,
        },
      });

      // Update order totals - DISCOUNT IS NOW ACCOUNTED FOR
      const updatedOrder = await (prisma as any).orderHeader.update({
        where: { id: orderId },
        data: {
          discountTotal: proposedTotalDiscount,
          total: Math.max(0, order.subtotal - proposedTotalDiscount + order.tax),
        },
      });

      return { discount, updatedOrder };
    } catch (error: unknown) {
      const e = normalizeError(error);
      console.error('Error applying discount:', e);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to apply discount');
    }
  }

  /**
   * Add line item to existing order
   */
  async addLineItem(orderId: string, item: {
    productId: string;
    productType: string;
    productName: string;
    departmentCode: string;
    quantity: number;
    unitPrice: number;
  }, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager', 'staff']);
      if (forbidden) return forbidden;

      const order = await (prisma as any).orderHeader.findUnique({
        where: { id: orderId },
        include: { lines: true },
      });

      if (!order) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order not found');
      }

      if (order.status !== 'pending') {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Cannot add items to non-pending order');
      }

      // Get next line number
  const maxLineNumber = Math.max(...order.lines.map((l: any) => l.lineNumber), 0);
      const lineNumber = maxLineNumber + 1;

  const lineItem = await prisma.$transaction(async (tx: any) => {
        // Create line item
        const line = await tx.orderLine.create({
          data: {
            lineNumber,
            orderHeaderId: orderId,
            departmentCode: item.departmentCode,
            productId: item.productId,
            productType: item.productType,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.quantity * item.unitPrice,
            status: 'pending',
          },
        });

        // Reserve inventory if applicable
        if (['RESTAURANT', 'BAR_CLUB'].includes(item.departmentCode)) {
          await tx.inventoryReservation.create({
            data: {
              inventoryItemId: item.productId,
              orderHeaderId: orderId,
              quantity: item.quantity,
              status: 'reserved',
            },
          });
        }

        // Add department if new
        const dept = await tx.department.findUnique({ where: { code: item.departmentCode } });
        if (dept) {
          await tx.orderDepartment.upsert({
            where: { orderHeaderId_departmentId: { orderHeaderId: orderId, departmentId: dept.id } },
            update: {},
            create: {
              orderHeaderId: orderId,
              departmentId: dept.id,
              status: 'pending',
            },
          });
        }

        return line;
      });

      // Update order subtotal
      const allLines = await (prisma as any).orderLine.findMany({ where: { orderHeaderId: orderId } });
  const newSubtotal = allLines.reduce((sum: number, l: any) => sum + l.lineTotal, 0);

      await (prisma as any).orderHeader.update({
        where: { id: orderId },
        data: { subtotal: newSubtotal, total: newSubtotal - order.discountTotal + order.tax },
      });

      // Recalculate section stats for the affected department
      try {
        if (item.departmentCode) await departmentService.recalculateSectionStats(item.departmentCode as string);
      } catch (e) {
        try { const logger = await import('@/lib/logger'); logger.error(e, { context: 'recalculateSectionStats.addLineItem' }); } catch {}
      }

      return lineItem;
    } catch (error) {
      console.error('Error adding line item:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to add line item');
    }
  }

  /**
   * Remove line item from order
   */
  async removeLineItem(orderId: string, lineItemId: string, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager', 'staff']);
      if (forbidden) return forbidden;

      const order = await (prisma as any).orderHeader.findUnique({ where: { id: orderId } });
      if (!order) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order not found');
      }

      if (order.status !== 'pending') {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Cannot remove items from non-pending order');
      }

  await prisma.$transaction(async (tx: any) => {
        // Delete line item
        await tx.orderLine.delete({ where: { id: lineItemId } });

        // Release inventory reservations
        await tx.inventoryReservation.deleteMany({
          where: { orderHeaderId: orderId },
        });
      });

      // Update order totals
      const allLines = await (prisma as any).orderLine.findMany({ where: { orderHeaderId: orderId } });
  const newSubtotal = allLines.reduce((sum: number, l: any) => sum + l.lineTotal, 0);

      await (prisma as any).orderHeader.update({
        where: { id: orderId },
        data: { subtotal: newSubtotal, total: newSubtotal - order.discountTotal + order.tax },
      });

      // Recalculate section stats for all remaining department codes on this order
      try {
        const deptCodes = Array.from(new Set(allLines.map((l: any) => l.departmentCode)));
        for (const code of deptCodes) {
          if (!code) continue;
          await departmentService.recalculateSectionStats(code as string);
        }
      } catch (e) {
        try { const logger = await import('@/lib/logger'); logger.error(e, { context: 'recalculateSectionStats.removeLineItem' }); } catch {}
      }

      return { success: true, message: 'Line item removed' };
    } catch (error) {
      console.error('Error removing line item:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to remove line item');
    }
  }

  /**
   * Record payment for order (supports multiple payments)
   */
  async recordPayment(orderId: string, paymentData: {
    amount: number;
    paymentMethod: string;
    paymentTypeId?: string;
    transactionReference?: string;
  }, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager', 'staff']);
      if (forbidden) return forbidden;

      const order = await (prisma as any).orderHeader.findUnique({
        where: { id: orderId },
        include: { payments: true },
      });

      if (!order) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order not found');
      }

      // Normalize incoming amount to cents to keep DB consistent
  const amount = normalizeToCents(paymentData.amount);

      // Check if payment exceeds order total
  const totalPaid = order.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
      if (totalPaid + amount > order.total) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Payment amount exceeds order total');
      }

      const payment = await (prisma as any).orderPayment.create({
        data: {
          orderHeaderId: orderId,
          amount,
          paymentMethod: paymentData.paymentMethod,
          paymentStatus: 'completed',
          paymentTypeId: paymentData.paymentTypeId,
          transactionReference: paymentData.transactionReference,
          processedAt: new Date(),
        },
      });

      // Update order status if fully paid
      const allPayments = await (prisma as any).orderPayment.findMany({ where: { orderHeaderId: orderId } });
  const totalPayments = allPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

      // Determine payment status based on total paid vs order total
      let paymentStatus = 'unpaid';
      if (totalPayments >= order.total) {
        paymentStatus = 'paid'; // Fully paid
      } else if (totalPayments > 0) {
        paymentStatus = 'partial'; // Partially paid
      }

      if (totalPayments >= order.total) {
        // Fully paid: move to processing and consume reserved inventory for inventory-based departments
        await prisma.$transaction(async (tx: any) => {
          // Update order status and payment status, sync department rows atomically
          await tx.orderHeader.update({ 
            where: { id: orderId }, 
            data: { 
              status: 'processing',
              paymentStatus: 'paid', // Explicitly mark as paid
            } 
          });
          await tx.orderDepartment.updateMany({ where: { orderHeaderId: orderId }, data: { status: 'processing' } });


          // Find order lines that require inventory consumption
          const lines = await tx.orderLine.findMany({ where: { orderHeaderId: orderId } });

          // Update department section metadata for departments that initiated this transaction
          try {
            const involvedDeptCodes = Array.from(new Set(lines.map((l: any) => l.departmentCode)));
            for (const deptCode of involvedDeptCodes) {
              if (!deptCode) continue;
              const dept = await tx.department.findUnique({ where: { code: deptCode } });
              if (!dept) continue;

              const existingMeta = (dept.metadata as any) || {};
              const mergedMeta = {
                ...existingMeta,
                lastTransaction: {
                  orderId: orderId,
                  paymentId: payment.id,
                  amount: amount,
                  initiatedBy: (ctx as any)?.userId || null,
                  at: new Date(),
                },
              };

              await tx.department.update({ where: { id: dept.id }, data: { metadata: mergedMeta } });
            }
          } catch (metaErr) {
            // Do not fail the whole payment processing if metadata update fails; log and continue
            try { const logger = await import('@/lib/logger'); logger.error(metaErr, { context: 'updateDepartmentMetadata' }); } catch {}
          }

          const movementRows: any[] = [];

          for (const line of lines) {
            if (['RESTAURANT', 'BAR_CLUB'].includes(line.departmentCode)) {
              // find department
              const dept = await tx.department.findUnique({ where: { code: line.departmentCode } });
              if (!dept) {
                throw new Error(`Department not found for code ${line.departmentCode}`);
              }

              // attempt to decrement department inventory (must have sufficient quantity)
              const res = await tx.departmentInventory.updateMany({
                where: { departmentId: dept.id, inventoryItemId: line.productId, quantity: { gte: line.quantity } },
                data: { quantity: { decrement: line.quantity } },
              });

              if (res.count === 0) {
                throw new Error(`Insufficient inventory for product ${line.productId} in department ${dept.code}`);
              }

              movementRows.push({ movementType: 'out', quantity: line.quantity, reason: 'sale', reference: orderId, inventoryItemId: line.productId });
            }
          }

          // create inventory movement records
          if (movementRows.length) {
            await tx.inventoryMovement.createMany({ data: movementRows });
          }

          // mark reservations as consumed
          await tx.inventoryReservation.updateMany({ where: { orderHeaderId: orderId, status: 'reserved' }, data: { status: 'consumed', consumedAt: new Date() } });

          // Recalculate section stats for involved departments using the same transaction client
          try {
            const involvedDeptCodes = Array.from(new Set(lines.map((l: any) => l.departmentCode)));
            for (const code of involvedDeptCodes) {
              if (!code) continue;
              await departmentService.recalculateSectionStats(code as string, tx);
            }
          } catch (e) {
            try { const logger = await import('@/lib/logger'); logger.error(e, { context: 'recalculateSectionStats.recordPayment' }); } catch {}
          }
        });

        // After transaction completes, roll up parent stats (outside of transaction)
        try {
          const involvedDeptCodes = Array.from(new Set((await prisma.orderLine.findMany({ where: { orderHeaderId: orderId } })).map((l: any) => l.departmentCode)));
          for (const code of involvedDeptCodes) {
            if (!code) continue;
            await departmentService.rollupParentStats(code);
          }
        } catch (e) {
          try { const logger = await import('@/lib/logger'); logger.error(e, { context: 'rollupParentStats.recordPayment' }); } catch {}
        }
      } else if (totalPayments > 0) {
        // Partially paid: update payment status to 'partial'
        await prisma.orderHeader.update({
          where: { id: orderId },
          data: { 
            paymentStatus: 'partial' 
          } as any,
        });
      }

      return payment;
    } catch (error) {
      console.error('Error recording payment:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to record payment');
    }
  }

  /**
   * Get order with all related data
   */
  async getOrderById(id: string, ctx?: UserContext) {
    try {
      const order = await prisma.orderHeader.findUnique({
        where: { id },
        include: {
          customer: true,
          lines: true,
          departments: { include: { department: true } },
          discounts: { include: { discountRule: true } },
          payments: { include: { paymentType: true } },
          fulfillments: true,
          reservations: true,
        },
      });

      if (!order) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order not found');
      }

      // Check authorization (customer views own, staff views all)
      const forbidden = requireRoleOrOwner(ctx, ['admin', 'manager', 'staff'], order.customerId);
      if (forbidden) return forbidden;

      return order;
    } catch (error) {
      console.error('Error fetching order:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch order');
    }
  }

  /**
   * List orders with filtering
   */
  async listOrders(filters: {
    customerId?: string;
    status?: string;
    departmentCode?: string;
    page?: number;
    limit?: number;
  }, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager', 'staff']);
      if (forbidden) return forbidden;

      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (filters.customerId) where.customerId = filters.customerId;
      if (filters.status) where.status = filters.status;
      if (filters.departmentCode) where.departmentCode = filters.departmentCode;

      const [orders, total] = await Promise.all([
        (prisma as any).orderHeader.findMany({
          where,
          include: { customer: true, lines: true, payments: true },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        (prisma as any).orderHeader.count({ where }),
      ]);

      return {
        items: orders,
        meta: { page, limit, total, pages: Math.ceil(total / limit) },
      };
    } catch (error) {
      console.error('Error listing orders:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to list orders');
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(id: string, newStatus: string, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager']);
      if (forbidden) return forbidden;

      // Ensure header and related orderDepartment rows are updated atomically
      const result = await prisma.$transaction(async (tx: any) => {
        const updated = await tx.orderHeader.update({ where: { id }, data: { status: newStatus } });
        await tx.orderDepartment.updateMany({ where: { orderHeaderId: id }, data: { status: newStatus } });
        return updated;
      });

      return result;
    } catch (error) {
      console.error('Error updating order status:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to update order status');
    }
  }

  /**
   * Cancel order and release reservations
   * Only pending orders can be cancelled.
   * For fulfilled orders with payment, use refundOrder() instead.
   */
  async cancelOrder(id: string, reason?: string, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager']);
      if (forbidden) return forbidden;

      const order = await (prisma as any).orderHeader.findUnique({ 
        where: { id },
        include: { payments: true }
      });
      if (!order) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order not found');
      }

      // Only allow cancellation of pending orders
      if (order.status !== 'pending') {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, `Cannot cancel ${order.status} orders. Use refund for fulfilled orders with payment.`);
      }

      await prisma.$transaction(async (tx: any) => {
        // Mark order as cancelled and propagate to department rows
        await tx.orderHeader.update({
          where: { id },
          data: { 
            status: 'cancelled',
            // If there are payments, mark them as refunded (auto-refund on cancellation)
            paymentStatus: (order.payments && order.payments.length > 0) ? 'refunded' : order.paymentStatus
          },
        });
        await tx.orderDepartment.updateMany({ where: { orderHeaderId: id }, data: { status: 'cancelled' } });

        // Release inventory reservations
        await tx.inventoryReservation.updateMany({
          where: { orderHeaderId: id, status: 'reserved' },
          data: { status: 'released', releasedAt: new Date() },
        });

        // Mark fulfillments as cancelled
        await tx.orderFulfillment.updateMany({
          where: { orderHeaderId: id, status: { not: 'fulfilled' } },
          data: { status: 'cancelled' },
        });

        // Mark order lines as cancelled
        await tx.orderLine.updateMany({
          where: { orderHeaderId: id, status: { not: 'fulfilled' } },
          data: { status: 'cancelled' },
        });

        // If there are any payments, mark them as refunded (auto-refund on cancel)
        if (order.payments && order.payments.length > 0) {
          await tx.orderPayment.updateMany({
            where: { orderHeaderId: id },
            data: { status: 'refunded' },
          });
        }
      });

      // Recalculate section stats for departments involved in the order
      try {
        const lines = await prisma.orderLine.findMany({ where: { orderHeaderId: id } });
        const deptCodes = Array.from(new Set(lines.map((l: any) => l.departmentCode)));
        for (const code of deptCodes) {
          if (!code) continue;
          await departmentService.recalculateSectionStats(code as string);
          // Also roll up to parent
          await departmentService.rollupParentStats(code);
        }
      } catch (e) {
        try { const logger = await import('@/lib/logger'); logger.error(e, { context: 'recalculateSectionStats.cancelOrder' }); } catch {}
      }

      return { success: true, message: 'Order cancelled and any payments refunded' };
    } catch (error) {
      console.error('Error cancelling order:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to cancel order');
    }
  }

  /**
   * Refund a pending order with payment
   * Only pending orders with paid/partial payment can be refunded.
   * Sets order status to 'refunded' and payment status to 'refunded'.
   */
  async refundOrder(id: string, reason?: string, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager']);
      if (forbidden) return forbidden;

      const order = await (prisma as any).orderHeader.findUnique({ 
        where: { id },
        include: { payments: true }
      });
      if (!order) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order not found');
      }

      // Only allow refunds for pending orders
      if (order.status !== 'pending') {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, `Cannot refund ${order.status} orders. Only pending orders can be refunded.`);
      }

      if (!['paid', 'partial'].includes(order.paymentStatus)) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, `Order payment status is ${order.paymentStatus}. Only paid/partial orders can be refunded.`);
      }

      await prisma.$transaction(async (tx: any) => {
        // Mark order as refunded
        await tx.orderHeader.update({
          where: { id },
          data: { 
            status: 'refunded',
            paymentStatus: 'refunded'
          },
        });

        // Update all order lines to refunded
        await tx.orderLine.updateMany({
          where: { orderHeaderId: id },
          data: { status: 'refunded' },
        });

        // Update department statuses to refunded
        await tx.orderDepartment.updateMany({ 
          where: { orderHeaderId: id }, 
          data: { status: 'refunded' } 
        });

        // Mark fulfillments as refunded
        await tx.orderFulfillment.updateMany({
          where: { orderHeaderId: id },
          data: { status: 'refunded' },
        });

        // Update any associated payments to refunded
        if (order.payments && order.payments.length > 0) {
          await tx.orderPayment.updateMany({
            where: { orderHeaderId: id },
            data: { status: 'refunded' },
          });
        }
      });

      // Recalculate section stats - refunded items should no longer count as sold
      try {
        const lines = await prisma.orderLine.findMany({ where: { orderHeaderId: id } });
        const deptCodes = Array.from(new Set(lines.map((l: any) => l.departmentCode)));
        for (const code of deptCodes) {
          if (!code) continue;
          await departmentService.recalculateSectionStats(code as string);
          // Also roll up to parent
          await departmentService.rollupParentStats(code);
        }
      } catch (e) {
        try { const logger = await import('@/lib/logger'); logger.error(e, { context: 'recalculateSectionStats.refundOrder' }); } catch {}
      }

      return { success: true, message: 'Order refunded successfully' };
    } catch (error) {
      console.error('Error refunding order:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to refund order');
    }
  }

  /**
   * Get order statistics
   */
  async getOrderStats(ctx?: UserContext) {
    try {
      // Check if user has permission to view stats (optional - allow unauthenticated for dashboard)
      // if (ctx && ctx.userId) {
      //   const forbidden = requireRole(ctx, ['admin', 'manager']);
      //   if (forbidden) return forbidden;
      // }

      const [totalOrders, activeOrders, completedOrders, cancelledOrders, totalRevenue] = await Promise.all([
        (prisma as any).orderHeader.count(),
        (prisma as any).orderHeader.count({ where: { status: { in: ['pending', 'processing'] } } }),
        (prisma as any).orderHeader.count({ where: { status: 'completed' } }),
        (prisma as any).orderHeader.count({ where: { status: 'cancelled' } }),
        (prisma as any).orderHeader.aggregate({
          _sum: { total: true },
          where: { status: 'completed' },
        }),
      ]);

      return {
        totalOrders,
        activeOrders,
        completedOrders,
        cancelledOrders,
        totalRevenue: totalRevenue._sum.total || 0,
      };
    } catch (error) {
      console.error('Error fetching order stats:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch order stats');
    }
  }
}

export const orderService = new OrderService();
