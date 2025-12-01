/**
 * Entity Type Definitions
 * All domain model types derived from Strapi schema
 */

import { Decimal } from '@prisma/client/runtime/library';

// ==================== ADMIN & AUTH ====================

export interface IAdminUser {
  id: string;
  email: string;
  username?: string;
  firstname?: string;
  lastname?: string;
  preferedLanguage?: string;
  blocked: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAdminRole {
  id: string;
  code: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAdminPermission {
  id: string;
  action: string;
  subject?: string;
  actionParameters: Record<string, any>;
  conditions: any[];
  properties: Record<string, any>;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IApiToken {
  id: string;
  name: string;
  description: string;
  accessKey: string;
  type: 'read-only' | 'full-access' | 'custom';
  expiresAt?: Date;
  lastUsedAt?: Date;
  lifespan?: bigint;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITransferToken {
  id: string;
  name: string;
  description: string;
  accessKey: string;
  expiresAt?: Date;
  lastUsedAt?: Date;
  lifespan?: bigint;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== HOTEL MANAGEMENT ====================

export interface IRoom {
  id: string;
  name: string;
  description?: string;
  roomNumber: string;
  status: 'available' | 'occupied' | 'maintenance';
  price: number;
  capacity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAmenity {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBed {
  id: string;
  type: string;
  bedSize: string;
  size: number;
  roomId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFloorPlan {
  id: string;
  floorNumber: number;
  numberOfRooms: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== CUSTOMERS & BOOKINGS ====================

export interface ICustomer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBooking {
  id: string;
  bookingId: string;
  customerId: string;
  roomId: string;
  checkin: Date;
  checkout: Date;
  timeIn?: string;
  timeOut?: string;
  nights: number;
  guests: number;
  isShortRest: boolean;
  totalPrice: number;
  bookingStatus: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  paymentId?: string;
  restaurantId?: string;
  barAndClubId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBookingItem {
  id: string;
  name: string;
  quantity: number;
  amountPaid: number;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  bookingId: string;
  drinkTypeId?: string;
  foodTypeId?: string;
  menuCategoryId?: string;
  paymentTypeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICheckIn {
  id: string;
  checkInTime: Date;
  checkOutTime?: Date;
  employeeSummaryId?: string;
  gymMembershipId?: string;
  sportMembershipId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== RESTAURANT & BAR ====================

export interface IRestaurant {
  id: string;
  name: string;
  location: string;
  description?: string;
  openTime?: string;
  closeTime?: string;
  activeOrders: number;
  completedOrders: number;
  amountSold: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBarAndClub {
  id: string;
  name: string;
  location: string;
  description?: string;
  openTime?: string;
  closeTime?: string;
  happyHours?: string;
  entryFees?: number;
  activeOrders: number;
  completedOrders: number;
  amountSold: number;
  debt: number;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== INVENTORY MANAGEMENT ====================

export interface IInventoryType {
  id: string;
  typeName: string;
  description?: string | null;
  category?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface IInventoryItem {
  id: string;
  name: string;
  description?: string | null;
  sku: string;
  category: string;
  itemType?: string | null; // drink, supply, equipment, linens, etc.
  quantity: number;
  reorderLevel: number;
  maxQuantity?: number | null;
  unitPrice: number | string | Decimal; // Decimal from Prisma
  location?: string | null; // storage location
  supplier?: string | null;
  lastRestocked?: Date | null;
  expiry?: Date | null;
  inventoryTypeId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInventoryMovement {
  id: string;
  movementType: 'in' | 'out' | 'adjustment' | 'loss' | string;
  quantity: number;
  reason?: string | null;
  reference?: string | null;
  inventoryItemId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFoodItem {
  id: string;
  name: string;
  description?: string | null;
  image?: string | null;
  price: number | string | Decimal; // Decimal from Prisma
  availability: boolean;
  foodTypeId: string;
  menuCategoryId: string;
  bookingId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMenuCategory {
  id: string;
  categoryName: string;
  description?: string;
  restaurantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDrinkType {
  id: string;
  typeName: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDrink {
  id: string;
  name: string;
  description?: string | null;
  image?: string | null;
  price: number | Decimal;
  type?: string;
  availability: boolean;
  quantity: number;
  barStock: number;
  restaurantStock: number;
  sold: number;
  supplied: number;
  threshold: number;
  drinkTypeId: string;
  bookingId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== ORDERS & PAYMENTS ====================

export interface IOrder {
  id: string;
  customerId: string;
  paymentTypeId: string;
  paymentId?: string;
  total: number;
  orderStatus: 'Active' | 'Completed';
  createdAt: Date;
  updatedAt: Date;
}

export interface IPayment {
  id: string;
  transactionID: string;
  paymentMethod: string;
  paymentStatus: 'pending' | 'completed' | 'failed';
  totalPrice: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPaymentType {
  id: string;
  type: 'cash' | 'card' | 'bank_transfer' | 'mobile_payment';
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPaymentDetail {
  id: string;
  paymentID: string;
  bankName?: string;
  bankAccount?: bigint;
  customerId: string;
  createdAt: Date;
  updatedAt: Date;
}

  // ==================== ENHANCED ORDER SYSTEM ====================

  export interface IDepartment {
    id: string;
    code: string;
    name: string;
    description?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface IDiscountRule {
    id: string;
    code: string;
    name: string;
    description?: string;
    type: 'percentage' | 'fixed' | 'tiered';
    value: number | string; // Decimal from Prisma
    maxUsagePerCustomer?: number;
    maxTotalUsage?: number;
    currentUsage: number;
    minOrderAmount?: number;
    applicableDepts: string; // JSON array
    isActive: boolean;
    startDate?: Date;
    endDate?: Date;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface IOrderHeader {
    id: string;
    orderNumber: string;
    customerId: string;
    departmentCode?: string;
    status: 'pending' | 'processing' | 'fulfilled' | 'completed' | 'cancelled';
    subtotal: number;
    discountTotal: number;
    tax: number;
    total: number;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface IOrderLine {
    id: string;
    lineNumber: number;
    orderHeaderId: string;
    departmentCode: string;
    productId: string;
    productType: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    unitDiscount: number;
    lineTotal: number;
    status: 'pending' | 'processing' | 'fulfilled' | 'cancelled';
    createdAt: Date;
    updatedAt: Date;
  }

  export interface IOrderDepartment {
    id: string;
    orderHeaderId: string;
    departmentId: string;
    status: 'pending' | 'processing' | 'fulfilled' | 'completed';
    departmentNotes?: string;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface IOrderDiscount {
    id: string;
    orderHeaderId: string;
    discountRuleId?: string;
    discountType: string;
    discountCode?: string;
    description?: string;
    discountAmount: number;
    appliedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface IOrderPayment {
    id: string;
    orderHeaderId: string;
    amount: number;
    paymentMethod: string;
    paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
    transactionReference?: string;
    paymentTypeId?: string;
    processedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface IOrderFulfillment {
    id: string;
    orderHeaderId: string;
    orderLineId?: string;
    status: 'pending' | 'in_progress' | 'fulfilled' | 'cancelled';
    fulfilledQuantity: number;
    fulfilledAt?: Date;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface IInventoryReservation {
    id: string;
    inventoryItemId: string;
    orderHeaderId?: string;
    quantity: number;
    status: 'reserved' | 'confirmed' | 'released' | 'consumed';
    reservedAt: Date;
    confirmedAt?: Date;
    releasedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
  }

// ==================== GAMES & ENTERTAINMENT ====================

export interface IGame {
  id: string;
  count: number;
  amountPaid: number;
  amountOwed: number;
  gameStatus: string;
  customerId: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== GYM & SPORTS ====================

export interface IGymAndSport {
  id: string;
  name: string;
  description?: string;
  openTime?: string;
  closeTime?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGymAndSportSession {
  id: string;
  sessionName: string;
  sessionTime: Date;
  sessionFee: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGymMembership {
  id: string;
  joinedDate: Date;
  expiryDate: Date;
  emergencyContact?: string;
  isActive: boolean;
  profilePhoto?: string;
  customerId: string;
  paymentTypeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISportMembership {
  id: string;
  joinedDate: Date;
  expiryDate: Date;
  emergencyContact?: string;
  isActive: boolean;
  customerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMembershipPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  durationMonths: number;
  maxCheckinsPerMonth?: number;
  discountAmount?: number;
  accessToClasses?: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== EMPLOYEE & MANAGEMENT ====================

export interface IPluginUsersPermissionsUser {
  id: string;
  username: string;
  email: string;
  firstname?: string;
  lastname?: string;
  blocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEmployeeOrder {
  id: string;
  dateIssued: Date;
  total: number;
  discountAmount: number;
  amountPaid: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEmployeeRecord {
  id: string;
  date: Date;
  debts: number;
  fines: number;
  shortage: number;
  salaryAdvance: number;
  description?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEmployeeSummary {
  id: string;
  position?: string;
  employmentDate?: Date;
  salary: number;
  debtShortage: number | string; // Decimal from Prisma
  finesDebits: number | string; // Decimal from Prisma
  orderDiscountTotal: number | string; // Decimal from Prisma
  salaryAdvanced: number | string; // Decimal from Prisma
  salaryAdvancedStatus: 'pending' | 'approved' | 'rejected' | 'settled';
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== PROJECTS & EXPENSES ====================

export interface IProject {
  id: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  budget: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IExpense {
  id: string;
  name: string;
  date: Date;
  amount: number;
  receipts?: string;
  paymentTypeId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVendor {
  id: string;
  name: string;
  address?: string;
  email?: string;
  phone?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== UTILITIES & MISCELLANEOUS ====================

export interface IHotelService {
  id: string;
  name: string;
  serviceDescription?: string;
  price: number;
  bookingId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductCount {
  id: string;
  name: string;
  productCount: number;
  totalAmount: number;
  bookingId?: string;
  drinkId?: string;
  foodItemId?: string;
  gameId?: string;
  hotelServiceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISchedule {
  id: string;
  sessionId: string;
  sessionDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPromoCoupon {
  id: string;
  couponCode: string;
  description?: string;
  discountPercentage?: number;
  maxUsage?: number;
  currentUsage: number;
  expiryDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IJobApplication {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  dob?: Date;
  gender?: string;
  position: string;
  otherPosition?: string;
  address?: string;
  skills?: string;
  resume?: string;
  coverLetter?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IArticle {
  id: string;
  title: string;
  slug: string;
  description?: string;
  cover?: string;
  blocks?: Record<string, any>;
  authorId: string;
  categoryId: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

export interface IAuthor {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISlider {
  id: string;
  title: string;
  image?: string;
  link?: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICarousel {
  id: string;
  title: string;
  sliders?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAbout {
  id: string;
  title: string;
  blocks?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IService {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  blocks?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGlobal {
  id: string;
  siteName: string;
  siteDescription: string;
  favicon?: string;
  isVatActive: boolean;
  defaultSeo?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrganisationInfo {
  id: string;
  name: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  logoDark?: string;
  logoLight?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youTube?: string;
  currency?: string; // ISO 4217 code (e.g. USD)
  createdAt: Date;
  updatedAt: Date;
}

export interface ISpecialInfo {
  id: string;
  title: string;
  content?: string;
  type?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Note: Decimal type from Prisma is imported via @prisma/client
