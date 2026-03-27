import { prisma } from '@/lib/auth/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export interface SalaryCalculationInput {
  employeeId: string;
  salaryDueDate?: Date;
  payEarly?: boolean; // If true, pay up to current date instead of next due date
  upToDate?: Date; // For early termination, calculate up to specific date
  daysWorked?: number; // Days worked in the period (for per-day salary calculation)
}

export interface SalaryCalculationResult {
  userId: string;
  grossSalary: Decimal;
  totalDeductions: Decimal;
  totalChargesDeductions: Decimal;
  netSalary: Decimal;
  chargeDetails: {
    pendingCharges: Decimal;
    paidCharges: Decimal;
    totalCharges: Decimal;
  };
  salaryDueDate: Date;
  payEarly: boolean;
  calculatedAt: Date;
}

/**
 * Calculate next salary due date based on frequency
 */
function calculateNextSalaryDueDate(
  employmentDate: Date,
  salaryFrequency: string
): Date {
  const today = new Date();
  const dueDate = new Date(employmentDate);

  switch (salaryFrequency) {
    case 'weekly':
      dueDate.setDate(dueDate.getDate() + 7);
      break;
    case 'bi-weekly':
      dueDate.setDate(dueDate.getDate() + 14);
      break;
    case 'monthly':
    default:
      dueDate.setMonth(dueDate.getMonth() + 1);
      break;
  }

  // If due date is in past, calculate next cycle
  while (dueDate < today) {
    switch (salaryFrequency) {
      case 'weekly':
        dueDate.setDate(dueDate.getDate() + 7);
        break;
      case 'bi-weekly':
        dueDate.setDate(dueDate.getDate() + 14);
        break;
      case 'monthly':
      default:
        dueDate.setMonth(dueDate.getMonth() + 1);
        break;
    }
  }

  return dueDate;
}

/**
 * Calculate total pending charges for an employee
 */
async function calculateEmployeeCharges(
  employmentDataId: string
): Promise<{ pending: Decimal; paid: Decimal; total: Decimal }> {
  const charges = await prisma.employeeCharge.findMany({
    where: { employmentDataId },
  });

  let pending = new Decimal(0);
  let paid = new Decimal(0);

  for (const charge of charges) {
    if (charge.status === 'pending' || charge.status === 'partially_paid') {
      // Add unpaid amount
      const unpaid = charge.amount.sub(charge.paidAmount);
      pending = pending.add(unpaid);
    }
    paid = paid.add(charge.paidAmount);
  }

  return {
    pending,
    paid,
    total: pending.add(paid),
  };
}

/**
 * Calculate salary for an employee using DEFAULT/FALLBACK method
 * This is a fallback when days-worked data is unavailable.
 * Uses full monthly salary if payment is due, zero otherwise.
 * 
 * NOTE: This should rarely be used - calculateEmployeeSalaryByDays is preferred.
 * IMPORTANT: No early payout allowed - only pay on due date.
 */
export async function calculateEmployeeSalary(
  input: SalaryCalculationInput
): Promise<SalaryCalculationResult> {
  // Get employment data
  const employmentData = await prisma.employmentData.findUnique({
    where: { userId: input.employeeId },
    include: {
      charges: true,
    },
  });

  if (!employmentData) {
    throw new Error(`Employee not found: ${input.employeeId}`);
  }

  // Check employment status
  if (
    employmentData.employmentStatus === 'inactive' ||
    employmentData.employmentStatus === 'terminated'
  ) {
    throw new Error('Cannot calculate salary for inactive or terminated employee');
  }

  // Calculate salary due date
  const salaryDueDate =
    input.salaryDueDate ||
    calculateNextSalaryDueDate(employmentData.employmentDate, employmentData.salaryFrequency);

  // CRITICAL: Check if payment is due TODAY
  // Early payout is NOT ALLOWED - only pay on or after due date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(salaryDueDate);
  dueDate.setHours(0, 0, 0, 0);
  const isPaymentDue = today >= dueDate;

  // Get baseSalary - but only pay if due
  let baseSalary = employmentData.salary;
  if (!isPaymentDue) {
    baseSalary = new Decimal(0); // Not due yet, return zero
  }

  // Calculate charges
  const charges = await calculateEmployeeCharges(employmentData.id);

  // Calculate deductions - only apply if payment is due
  let chargeDeductions = new Decimal(0);
  if (isPaymentDue) {
    chargeDeductions = charges.pending;
  }
  const totalDeductions = chargeDeductions;

  // Calculate net salary
  const netSalaryValue = baseSalary.sub(totalDeductions);
  const netSalary = Decimal.max(netSalaryValue, new Decimal(0)); // Cannot be negative

  return {
    userId: input.employeeId,
    grossSalary: baseSalary,
    totalDeductions,
    totalChargesDeductions: chargeDeductions,
    netSalary,
    chargeDetails: {
      pendingCharges: charges.pending,
      paidCharges: charges.paid,
      totalCharges: charges.total,
    },
    salaryDueDate,
    payEarly: false, // Never allow early payout
    calculatedAt: new Date(),
  };
}

/**
 * Calculate salary for an employee based on days worked
 * Primary calculation method: per-day rate = monthly salary / 30 days
 * Days are counted from completed check-in/check-out cycles
 * 
 * IMPORTANT: 
 * - Always calculates salary amount based on days worked
 * - Returns payEarly=true if date is before due date (UI disables payment button)
 * - Payment is only processed on or after due date (backend validation)
 */
export async function calculateEmployeeSalaryByDays(
  employeeId: string,
  daysWorked: number,
  upToDate?: Date
): Promise<SalaryCalculationResult> {
  // Get employment data
  const employmentData = await prisma.employmentData.findUnique({
    where: { userId: employeeId },
  });

  if (!employmentData) {
    throw new Error(`Employee not found: ${employeeId}`);
  }

  // Check employment status
  if (
    employmentData.employmentStatus === 'inactive' ||
    employmentData.employmentStatus === 'terminated'
  ) {
    throw new Error('Cannot calculate salary for inactive or terminated employee');
  }

  // Calculate salary due date - THIS IS WHEN PAYMENT IS ALLOWED
  const salaryDueDate = calculateNextSalaryDueDate(
    employmentData.employmentDate,
    employmentData.salaryFrequency
  );

  // Check if payment is due today or later
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(salaryDueDate);
  dueDate.setHours(0, 0, 0, 0);

  // Check if this is early payout attempt (before due date)
  const isPaymentDue = today >= dueDate;

  // Get base salary (monthly rate)
  const baseSalaryMonthly = employmentData.salary;
  
  // Calculate per-day rate: monthly salary / 30 days
  const perDayRate = baseSalaryMonthly.div(30);
  
  // ALWAYS calculate gross salary based on days worked (never return 0 for calculation)
  // The payEarly flag will indicate if payment can actually be processed
  const grossSalary = perDayRate.mul(new Decimal(daysWorked));

  // Get employee summary for charges
  const employeeSummary = await prisma.employeeSummary.findUnique({
    where: { userId: employeeId },
  });

  // Get recent charges from consolidated view
  const charges = await prisma.employeeCharge.findMany({
    where: { employmentDataId: employmentData.id },
  });

  let pending = new Decimal(0);
  let paid = new Decimal(0);

  for (const charge of charges) {
    if (charge.status === 'pending' || charge.status === 'partially_paid') {
      const unpaid = charge.amount.sub(charge.paidAmount);
      pending = pending.add(unpaid);
    }
    paid = paid.add(charge.paidAmount);
  }

  // Calculate deductions - only apply if payment is due
  let chargeDeductions = new Decimal(0);
  if (isPaymentDue) {
    chargeDeductions = pending;
  }
  const totalDeductions = chargeDeductions;

  // Calculate net salary
  const netSalaryValue = grossSalary.sub(totalDeductions);
  const netSalary = Decimal.max(netSalaryValue, new Decimal(0)); // Cannot be negative

  return {
    userId: employeeId,
    grossSalary,
    totalDeductions,
    totalChargesDeductions: chargeDeductions,
    netSalary,
    chargeDetails: {
      pendingCharges: pending,
      paidCharges: paid,
      totalCharges: pending.add(paid),
    },
    salaryDueDate,
    payEarly: !isPaymentDue, // True if trying to pay before due date (UI shows warning, button disabled)
    calculatedAt: new Date(),
  };
}

/**
 * Get total days worked for an employee in a period
 * Each completed check-in/check-out cycle = 1 day, regardless of actual hours
 */
export async function getEmployeeDaysWorked(
  employeeId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<number> {
  // Get employee summary
  const employeeSummary = await prisma.employeeSummary.findUnique({
    where: { userId: employeeId },
  });

  if (!employeeSummary) {
    return 0;
  }

  const whereFilter: any = {
    employeeSummaryId: employeeSummary.id,
    checkOutTime: { not: null }, // Only completed check-in/check-out cycles
  };

  if (fromDate || toDate) {
    whereFilter.checkOutTime = whereFilter.checkOutTime || {};
    if (fromDate) {
      whereFilter.checkOutTime.gte = fromDate;
    }
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      whereFilter.checkOutTime.lte = endDate;
    }
  }

  const records = await prisma.checkIn.findMany({
    where: whereFilter,
  });

  // Count completed cycles as days
  // Each completed check-in/check-out = 1 day
  return records.length;
}

/**
 * Get salary payment summary for an employee
 * Shows all salary payments with early payment indicator
 */
export async function getEmployeeSalaryHistory(
  employeeId: string,
  fromDate?: Date,
  toDate?: Date
) {
  const whereFilter: any = { userId: employeeId };

  if (fromDate || toDate) {
    whereFilter.paymentDate = {};
    if (fromDate) {
      whereFilter.paymentDate.gte = fromDate;
    }
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      whereFilter.paymentDate.lte = endDate;
    }
  }

  const payments = await prisma.salaryPayment.findMany({
    where: whereFilter,
    orderBy: {
      paymentDate: 'desc',
    },
  });

  // Determine if early payment by comparing paymentDate to salaryDueDate
  return payments.map((payment) => ({
    ...payment,
    payEarly: payment.salaryDueDate
      ? payment.paymentDate < payment.salaryDueDate
      : false,
  }));
}

/**
 * Get outstanding salary for an employee
 * Used for early termination payout
 */
export async function getOutstandingSalary(
  employeeId: string,
  upToDate?: Date
) {
  const employmentData = await prisma.employmentData.findUnique({
    where: { userId: employeeId },
  });

  if (!employmentData) {
    throw new Error(`Employee not found: ${employeeId}`);
  }

  // Get the last paid salary
  const lastPayment = await prisma.salaryPayment.findFirst({
    where: {
      userId: employeeId,
      status: 'completed',
    },
    orderBy: {
      paymentDate: 'desc',
    },
  });

  const calculationDate = upToDate || new Date();
  const periodStart = lastPayment ? new Date(lastPayment.paymentDate) : employmentData.employmentDate;

  // Calculate how many full periods have passed
  const periodEnd = calculationDate;
  const dueDateStart = lastPayment
    ? calculateNextSalaryDueDate(lastPayment.paymentDate, employmentData.salaryFrequency)
    : employmentData.employmentDate;

  // Check if there's an outstanding payment due
  if (periodEnd >= dueDateStart) {
    const outstandingSalary = await calculateEmployeeSalary({
      employeeId,
      salaryDueDate: dueDateStart,
    });

    return {
      outstanding: outstandingSalary.netSalary,
      isDue: true,
      dueDate: dueDateStart,
      details: outstandingSalary,
    };
  }

  return {
    outstanding: new Decimal(0),
    isDue: false,
    dueDate: dueDateStart,
    details: null,
  };
}
