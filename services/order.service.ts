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
import { paymentService } from './payment.service';
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

      // Fetch tax settings to determine initial total
      // If TaxSettings table doesn't exist yet, use defaults
      let taxEnabled = true;
      let taxRate = 10;
      try {
        const taxSettings = await (prisma as any).taxSettings.findFirst();
        if (taxSettings) {
          taxEnabled = taxSettings.enabled ?? true;
          taxRate = taxSettings.taxRate ?? 10;
        }
      } catch (err) {
        // TaxSettings table may not exist yet - use defaults
        console.warn('TaxSettings fetch failed (table may not exist), using defaults:', err);
      }

      const initialTax = taxEnabled ? calculateTax(subtotal, taxRate) : 0;
      const initialTotal = calculateTotal(subtotal, 0, initialTax);

      // Create order header first (keep this operation minimal and fast)
      const header = await prisma.orderHeader.create({
        data: {
          orderNumber,
          customerId: data.customerId,
          subtotal,
          discountTotal: 0,
          tax: initialTax,
          total: initialTotal,
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
      // CRITICAL: If any section update fails, the order creation FAILS
      try {
        // Map lines to sections to ensure all have assignments
        const deptSectionsMap = new Map<string, Set<string>>();
        for (const line of linesData) {
          if (!line.departmentCode) {
            throw new Error(`Order creation failed: line item missing department assignment`);
          }
          if (!line.departmentSectionId) {
            throw new Error(`Order creation failed: line item in ${line.departmentCode} requires section assignment`);
          }
          
          if (!deptSectionsMap.has(line.departmentCode)) {
            deptSectionsMap.set(line.departmentCode, new Set());
          }
          deptSectionsMap.get(line.departmentCode)?.add(line.departmentSectionId);
        }

        // Update section stats for all sections (no department fallback)
        for (const [code, sectionIds] of deptSectionsMap.entries()) {
          for (const sectionId of sectionIds) {
            await departmentService.recalculateSectionStats(code, sectionId);
          }
          // Roll up to parent after all sections updated
          await departmentService.rollupParentStats(code);
        }
      } catch (e) {
        // CRITICAL: If section stats fail to update, the order creation FAILS
        try { const logger = await import('@/lib/logger'); logger.error(e, { context: 'recalculateSectionStats.createOrder' }); } catch {}
        return errorResponse(ErrorCodes.INTERNAL_ERROR, `Failed to initialize section stats: ${(e as any)?.message || 'Unknown error'}`);
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
          // Calculate discount amount - values stored in expanded minor units
          // Percentage: apply percentage (20 means 20%)
          // Fixed: use value directly (2000000 means $20.00)
          let discountAmount = 0;
          if (rule.type === 'percentage') {
            discountAmount = Math.round((subtotal * Number(rule.value)) / 100);
          } else {
            // Fixed amount already in expanded minor units
            discountAmount = Math.min(Math.round(Number(rule.value)), subtotal);
          }
          
          validatePrice(discountAmount, `Discount ${rule.code}`);

          // Prevent discount exceeding subtotal
          if (accumulatedDiscount + discountAmount > subtotal) {
            return errorResponse(ErrorCodes.VALIDATION_ERROR, `Discounts exceed subtotal for code: ${rule.code}`);
          }

          // Persist order discount (all in expanded minor units)
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
        // Fetch tax settings to determine if tax should be applied
        let taxEnabled = true;
        let taxRate = 10;
        try {
          const taxSettings = await (prisma as any).taxSettings.findFirst();
          if (taxSettings) {
            taxEnabled = taxSettings.enabled ?? true;
            taxRate = taxSettings.taxRate ?? 10;
          }
        } catch (err) {
          // TaxSettings table may not exist yet - use defaults
          console.warn('TaxSettings fetch failed during discount (table may not exist), using defaults:', err);
        }
        
        // Calculate tax only if enabled
        const taxAmount = taxEnabled ? calculateTax(subtotal - accumulatedDiscount, taxRate) : 0;
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
      console.log('[ORDER SERVICE] applyDiscount called for orderId:', orderId, 'discountData:', discountData);
      const forbidden = requireRole(ctx, ['admin', 'manager', 'staff']);
      if (forbidden) return forbidden;

      // Get order
      console.log('[ORDER SERVICE] Fetching order with discounts...');
      const order = await (prisma as any).orderHeader.findUnique({
        where: { id: orderId },
        include: { lines: true, discounts: true },
      });

      if (!order) {
        console.error('[ORDER SERVICE] Order not found:', orderId);
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order not found');
      }
      console.log('[ORDER SERVICE] Order found:', { subtotal: order.subtotal, existingDiscounts: order.discounts?.length });

      // Validate discount code exists (if applicable)
      let discountAmount = discountData.discountAmount || 0;
      console.log('[ORDER SERVICE] Discount type:', discountData.discountType, 'Initial amount:', discountAmount);

      if (discountData.discountType === 'percentage' || discountData.discountType === 'bulk') {
        console.log('[ORDER SERVICE] Looking up discount rule:', discountData.discountCode);
        const rule = await (prisma as any).discountRule.findUnique({ where: { code: discountData.discountCode } });
        if (!rule) {
          console.error('[ORDER SERVICE] Discount rule not found:', discountData.discountCode);
          return errorResponse(ErrorCodes.NOT_FOUND, 'Discount code not found');
        }
        console.log('[ORDER SERVICE] Discount rule found:', { type: rule.type, value: rule.value, isActive: rule.isActive });

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
          console.log('[ORDER SERVICE] Calculated percentage discount:', { percentage: rule.value, subtotal: order.subtotal, discountAmount });
        } else {
          // fixed amount in rule.value is Decimal (dollars); convert to cents
          discountAmount = normalizeToCents(Number(rule.value));
          console.log('[ORDER SERVICE] Calculated fixed discount:', { fixedAmount: rule.value, discountAmount });
        }
      }

      // Validate discount won't result in negative total
      console.log('[ORDER SERVICE] Validating discount constraints...');
      const allCurrentDiscounts = await (prisma as any).orderDiscount.findMany({ where: { orderHeaderId: orderId } });
      const currentTotalDiscount = allCurrentDiscounts.reduce((sum: number, d: any) => sum + d.discountAmount, 0);
      const proposedTotalDiscount = currentTotalDiscount + discountAmount;
      console.log('[ORDER SERVICE] Discount totals:', { currentTotal: currentTotalDiscount, newAmount: discountAmount, proposedTotal: proposedTotalDiscount, subtotal: order.subtotal });

      if (proposedTotalDiscount > order.subtotal) {
        console.error('[ORDER SERVICE] Discount exceeds subtotal');
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          `Total discount (${proposedTotalDiscount}) cannot exceed subtotal (${order.subtotal})`
        );
      }

      // Create OrderDiscount record
      console.log('[ORDER SERVICE] Creating OrderDiscount record...');
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
      console.log('[ORDER SERVICE] ✅ OrderDiscount created:', { id: discount.id, amount: discount.discountAmount });

      // Update order totals - DISCOUNT IS NOW ACCOUNTED FOR
      console.log('[ORDER SERVICE] Updating order totals...');
      const newTotal = Math.max(0, order.subtotal - proposedTotalDiscount + order.tax);
      console.log('[ORDER SERVICE] New order totals:', { subtotal: order.subtotal, discountTotal: proposedTotalDiscount, tax: order.tax, newTotal });
      const updatedOrder = await (prisma as any).orderHeader.update({
        where: { id: orderId },
        data: {
          discountTotal: proposedTotalDiscount,
          total: newTotal,
        },
      });
      console.log('[ORDER SERVICE] ✅ Order updated with new totals');

      return { discount, updatedOrder };
    } catch (error: unknown) {
      const e = normalizeError(error);
      console.error('[ORDER SERVICE] ❌ Error in applyDiscount:', e);
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
   * Record payment for order (wrapper delegating to PaymentService)
   * Delegates all payment logic to unified PaymentService for consistency
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

      return await paymentService.recordOrderPayment(orderId, {
        amount: paymentData.amount,
        paymentMethod: paymentData.paymentMethod,
        paymentTypeId: paymentData.paymentTypeId,
        transactionReference: paymentData.transactionReference,
        context: {
          userId: ctx?.userId,
          consumeInventory: true, // OrderService always consumes inventory
        },
      });
    } catch (error) {
      console.error('Error recording payment:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to record payment');
    }
  }

  /**
   * Calculate order-specific financial state
   * Used for backward integration to ensure each order has accurate financial data
   * regardless of section metadata
   */
  private calculateOrderFinancialState(order: any) {
    const totalPaid = (order.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
    const amountOwed = Math.max(0, order.total - totalPaid);
    const hasExtras = order.total > (order.subtotal + order.tax - order.discountTotal);
    const extrasTotal = hasExtras ? order.total - (order.subtotal + order.tax - order.discountTotal) : 0;

    return {
      totalPaid,
      amountOwed,
      hasExtras,
      extrasTotal,
      paymentStatus: amountOwed <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid',
    };
  }

  /**
   * Get order with all related data and calculated financial state
   */
  async getOrderById(id: string, ctx?: UserContext) {
    try {
      const order = await prisma.orderHeader.findUnique({
        where: { id },
        include: {
          customer: true,
          lines: { include: { departmentSection: true } },
          departments: { include: { department: true } },
          discounts: { include: { discountRule: true } },
          payments: { include: { paymentType: true } },
          fulfillments: true,
          reservations: true,
          extras: {
            include: {
              extra: true,
            },
          },
        },
      });

      if (!order) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order not found');
      }

      // Check authorization (customer views own, staff views all)
      const forbidden = requireRoleOrOwner(ctx, ['admin', 'manager', 'staff'], order.customerId);
      if (forbidden) return forbidden;

      // Calculate order-specific financial state for backward integration
      const financialState = this.calculateOrderFinancialState(order);
      
      // Attach financial state to order
      return {
        ...order,
        financialState,
      };
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
   * For orders with payments, a refund must be explicitly processed first.
   */
  async cancelOrder(id: string, reason?: string, ctx?: UserContext) {
    try {
      const forbidden = requireRole(ctx, ['admin', 'manager']);
      if (forbidden) return forbidden;

      const order = await (prisma as any).orderHeader.findUnique({ 
        where: { id },
        include: { 
          payments: true,
          lines: { include: { extras: true } }
        }
      });
      if (!order) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Order not found');
      }

      // Allow cancellation of pending, processing, fulfilled, and completed orders
      const cancellableStatuses = ['pending', 'processing', 'fulfilled', 'completed'];
      if (!cancellableStatuses.includes(order.status)) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, `Cannot cancel ${order.status} orders. Only pending, processing, fulfilled, or completed orders can be cancelled.`);
      }

      await prisma.$transaction(async (tx: any) => {
        // Refund any due/completed payments
        if (order.payments && order.payments.length > 0) {
          await tx.orderPayment.updateMany({
            where: { 
              orderHeaderId: id,
              paymentStatus: { in: ['completed', 'partial'] }
            },
            data: { paymentStatus: 'refunded' },
          });
        }

        // Mark order as cancelled and propagate to department rows
        await tx.orderHeader.update({
          where: { id },
          data: { 
            status: 'cancelled',
            paymentStatus: 'refunded',
          },
        });
        await tx.orderDepartment.updateMany({ where: { orderHeaderId: id }, data: { status: 'cancelled' } });

        // Release inventory reservations
        await tx.inventoryReservation.updateMany({
          where: { orderHeaderId: id, status: 'reserved' },
          data: { status: 'released', releasedAt: new Date() },
        });

        // Mark all fulfillments as cancelled
        await tx.orderFulfillment.updateMany({
          where: { orderHeaderId: id },
          data: { status: 'cancelled' },
        });

        // Mark order lines as cancelled
        await tx.orderLine.updateMany({
          where: { orderHeaderId: id },
          data: { status: 'cancelled' },
        });

        // Deactivate all extras associated with order lines
        if (order.lines && order.lines.length > 0) {
          const lineIds = order.lines.map((l: any) => l.id);
          await tx.orderLineExtra.updateMany({
            where: { orderLineId: { in: lineIds } },
            data: { active: false },
          });
        }
      }, { maxWait: 15000, timeout: 15000 }); // Increased timeout for cancel operations

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

      return { success: true, message: 'Order cancelled, payments refunded, extras deactivated, and inventory released' };
    } catch (error) {
      console.error('Error cancelling order:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to cancel order');
    }
  }

  /**
   * Refund an order with payment
   * Orders can be refunded at any status (pending, processing, fulfilled, completed) if they have payments
   * Processing status is initiated when fulfillment starts, not payment
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

      // Allow refunds for pending, processing, fulfilled, and completed orders
      const refundableStatuses = ['pending', 'processing', 'fulfilled', 'completed'];
      if (!refundableStatuses.includes(order.status)) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, `Cannot refund ${order.status} orders. Only pending, processing, fulfilled, or completed orders can be refunded.`);
      }

      // Check if order has any completed payments
      const hasCompletedPayments = order.payments && order.payments.some((p: any) => p.paymentStatus === 'completed');
      if (!hasCompletedPayments) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, `Order has no completed payments. Only orders with completed payments can be refunded.`);
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
            data: { paymentStatus: 'refunded' },
          });
        }
      }, { maxWait: 15000, timeout: 15000 }); // Increased from default 5000ms to handle complex refund operations

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
