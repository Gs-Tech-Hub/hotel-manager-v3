# Revenue Management Modules
## POS Terminal, Games Management & Gym Memberships

**Document Version**: 1.0.0  
**Created**: November 15, 2025  
**Status**: ✅ Complete Specification

---

## Overview

This document outlines three new revenue-generating modules for the Hotel Manager v2 admin dashboard:

1. **POS Terminal Management** - Payment processing and transaction management
2. **Games & Entertainment** - Arcade, billiards, bowling, and VR game management
3. **Gym & Sports Center Memberships** - Fitness center membership and class management

These modules integrate into the new **Revenue Management** section of the admin sidebar, providing centralized control over hotel amenity revenue streams.

---

## Architecture Overview

```
Revenue Management Section
├─ POS Terminals
│  ├─ List View (monitoring)
│  ├─ Detail View (status, transactions)
│  ├─ Configuration Panel
│  └─ Transaction History
│
├─ Games & Entertainment
│  ├─ Game Inventory
│  ├─ Tournament Management
│  ├─ Booking System
│  └─ Revenue Analytics
│
└─ Gym Memberships
   ├─ Member Directory
   ├─ Class Management
   ├─ Trainer Management
   ├─ Check-In Tracking
   └─ Revenue & Analytics
```

---

## 1. POS Terminal Management

### Core Features
✅ **Sell Items** - Physical products with inventory tracking  
✅ **Sell Services** - Hotel services and intangible offerings  
✅ **Department Products** - Department-specific item catalog  
✅ **Track Orders** - Complete order lifecycle management  
✅ **Offer Discounts** - Coupon codes + manager-applied discounts  
✅ **Payment Processing** - Multiple payment methods  

### Database Requirements

```prisma
// ===== PRODUCTS & SERVICES =====

model POSCategory {
  id          String   @id @default(cuid())
  name        String   // "Food", "Beverages", "Retail", "Services"
  description String?
  
  terminal    POSTerminal? @relation(fields: [terminalId], references: [id])
  terminalId  String?      // Optional: restrict to specific terminals
  
  products    POSProduct[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model POSProduct {
  id          String   @id @default(cuid())
  sku         String   @unique
  name        String
  description String?
  
  // Classification
  type        String   // "item", "service", "package"
  category    POSCategory @relation(fields: [categoryId], references: [id])
  categoryId  String
  
  // Department Association
  department  Department? @relation(fields: [departmentId], references: [id])
  departmentId String?
  
  // Pricing
  price       Float
  cost        Float?   // For margin calculations
  
  // Service-specific
  isService   Boolean  @default(false)
  isRecurring Boolean  @default(false)  // For subscription services
  duration    Int?     // Duration in minutes for services
  
  // Inventory for physical items
  trackInventory Boolean @default(false)
  quantity    Int      @default(0)
  reorderLevel Int     @default(10)
  
  // Status
  isActive    Boolean  @default(true)
  imageUrl    String?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Relations
  lineItems   POSTransactionLineItem[]
  discounts   POSDiscount[]  @relation("DiscountableProducts")
}

model DepartmentProduct {
  id          String   @id @default(cuid())
  department  Department @relation(fields: [departmentId], references: [id])
  departmentId String
  
  product     POSProduct @relation(fields: [productId], references: [id])
  productId   String
  
  // Department-specific pricing override
  departmentPrice Float?
  
  // Availability
  isAvailable Boolean @default(true)
  
  createdAt   DateTime @default(now())
  
  @@unique([departmentId, productId])
}

// ===== DISCOUNTS =====

model POSDiscount {
  id          String   @id @default(cuid())
  code        String   @unique  // "SAVE10", "MEMBER20"
  description String?
  
  // Discount Type
  type        String   // "percentage", "fixed_amount", "buy_x_get_y"
  value       Float    // e.g., 10 for 10% or $10 off
  
  // Application Rules
  applicableTo String  // "all_items", "specific_products", "category"
  products    POSProduct[] @relation("DiscountableProducts")
  
  // Validity
  isActive    Boolean  @default(true)
  startDate   DateTime
  endDate     DateTime
  
  // Restrictions
  minAmount   Float?   // Minimum transaction amount
  maxUses     Int?     // Total uses limit
  currentUses Int      @default(0)
  maxPerCustomer Int?  // Uses per customer
  
  // Usage Tracking
  usageLog    POSDiscountUsage[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model POSDiscountUsage {
  id          String   @id @default(cuid())
  discount    POSDiscount @relation(fields: [discountId], references: [id])
  discountId  String
  
  transaction POSTransaction @relation(fields: [transactionId], references: [id])
  transactionId String
  
  discountAmount Float
  
  createdAt   DateTime @default(now())
}

model POSManualDiscount {
  id          String   @id @default(cuid())
  transaction POSTransaction @relation(fields: [transactionId], references: [id])
  transactionId String
  
  type        String   // "percentage", "fixed_amount"
  value       Float
  reason      String?  // "Employee", "Damaged item", "Courtesy"
  
  appliedBy   String   // Staff member ID
  approvedBy  String?  // Manager approval
  
  createdAt   DateTime @default(now())
}

// ===== ORDERS & TRANSACTIONS =====

model POSTerminal {
  id              String   @id @default(cuid())
  terminalId      String   @unique
  location        String   // Front Desk, Restaurant, Bar, Retail
  type            String   // register, tablet, kiosk
  
  // Status & Health
  isOnline        Boolean  @default(false)
  lastHeartbeat   DateTime?
  status          String   // "online", "offline", "error"
  errorMessage    String?
  
  // Hardware Info
  model           String?  // NCR 7197, etc.
  ipAddress       String?
  
  // Financial
  drawerBalance   Float    @default(0)
  lastTransactionTime DateTime?
  
  // Configuration
  taxRate         Float    @default(0.08)
  printerEnabled  Boolean  @default(true)
  drawerEnabled   Boolean  @default(true)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relations
  transactions    POSTransaction[]
  orders          POSOrder[]
  department      Department?  @relation(fields: [departmentId], references: [id])
  departmentId    String?
}

model POSOrder {
  id            String   @id @default(cuid())
  orderId       String   @unique  // "ORD-001"
  
  // Terminal & Session
  terminal      POSTerminal @relation(fields: [terminalId], references: [id])
  terminalId    String
  
  operator      String   // Staff member ID
  approver      String?  // Manager for approvals
  
  // Customer
  customer      Guest?   @relation(fields: [guestId], references: [id])
  guestId       String?
  
  // Room Charge (if applicable)
  room          Room?    @relation(fields: [roomId], references: [id])
  roomId        String?  // For room charges/mini-bar, room service
  
  // Order Items
  lineItems     POSTransactionLineItem[]
  
  // Pricing Breakdown
  subtotal      Float
  taxAmount     Float
  discountAmount Float @default(0)
  totalAmount   Float
  
  // Tax Details
  taxRate       Float   // Applied tax rate
  
  // Discount Application
  discount      POSDiscount? @relation(fields: [discountId], references: [id])
  discountId    String?
  
  manualDiscounts POSManualDiscount[]
  
  // Payment Info
  status        String   // "open", "paid", "pending", "cancelled", "refunded"
  paymentMethod String?  // "cash", "card", "mobile", "room_charge"
  cardLast4     String?
  
  receiptNumber String?
  receiptUrl    String?  // PDF receipt storage
  
  // Notes
  notes         String?
  
  // Timestamps
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  paidAt        DateTime?
  
  // Relations
  transactions  POSTransaction[]
}

model POSTransactionLineItem {
  id            String   @id @default(cuid())
  
  order         POSOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderId       String
  
  product       POSProduct @relation(fields: [productId], references: [id])
  productId     String
  
  // Quantity & Pricing
  quantity      Int
  unitPrice     Float   // Price at time of transaction
  lineTotal     Float   // quantity * unitPrice
  
  // Item-specific discount
  itemDiscount  Float?  // Individual item discount
  
  // Modifiers (for services)
  modifiers     String? // JSON: [{ name, price }]
  
  // Status
  status        String  // "pending", "ready", "completed", "cancelled"
  notes         String?
  
  createdAt     DateTime @default(now())
}

model POSTransaction {
  id            String   @id @default(cuid())
  transactionId String   @unique
  
  // References
  terminal      POSTerminal @relation(fields: [terminalId], references: [id])
  terminalId    String
  
  order         POSOrder @relation(fields: [orderId], references: [id])
  orderId       String
  
  // Operator
  operator      String?  // Staff member ID
  
  // Transaction Type
  type          String   // "payment", "refund", "void", "adjustment"
  status        String   // "completed", "pending", "failed", "reversed"
  
  // Financial Details
  amount        Float
  
  // Payment Details
  paymentMethod String   // "cash", "card", "mobile", "room_charge"
  cardLast4     String?
  transactionRef String?  // From payment processor
  
  // Receipt
  receiptNumber String?
  
  // Error Handling
  errorMessage  String?
  errorCode     String?
  
  // Reversals
  reversedBy    String?  // Transaction ID that reversed this
  voidReason    String?
  
  // Discounts Applied
  discounts     POSDiscountUsage[]
  manualDiscounts POSManualDiscount[]
  
  createdAt     DateTime @default(now())
  completedAt   DateTime?
}
```

### API Endpoints

```typescript
// ===== PRODUCTS & SERVICES =====
GET    /api/admin/pos/products              // List all products
POST   /api/admin/pos/products              // Create product
GET    /api/admin/pos/products/[id]         // Get product details
PUT    /api/admin/pos/products/[id]         // Update product
DELETE /api/admin/pos/products/[id]         // Disable product

GET    /api/admin/pos/categories            // List product categories
POST   /api/admin/pos/categories            // Create category

GET    /api/admin/pos/departments/[id]/products  // Department products
POST   /api/admin/pos/departments/[id]/products  // Assign product to dept

// ===== INVENTORY =====
GET    /api/admin/pos/products/[id]/stock   // Check stock level
PUT    /api/admin/pos/products/[id]/stock   // Update inventory
POST   /api/admin/pos/products/[id]/restock // Add stock

// ===== DISCOUNTS =====
GET    /api/admin/pos/discounts             // List discounts
POST   /api/admin/pos/discounts             // Create discount
PUT    /api/admin/pos/discounts/[code]      // Update discount
DELETE /api/admin/pos/discounts/[code]      // Deactivate discount

POST   /api/admin/pos/discounts/validate    // Validate discount code
GET    /api/admin/pos/discounts/[code]/usage // Discount usage stats

// ===== ORDERS =====
GET    /api/admin/pos/orders                // List orders
POST   /api/admin/pos/orders                // Create order
GET    /api/admin/pos/orders/[id]           // Get order details
PUT    /api/admin/pos/orders/[id]           // Update order (add items, etc)

// ===== ORDER ITEMS =====
POST   /api/admin/pos/orders/[id]/items     // Add line item
PUT    /api/admin/pos/orders/[id]/items/[lineId] // Update line item
DELETE /api/admin/pos/orders/[id]/items/[lineId] // Remove line item

// ===== PAYMENTS & TRANSACTIONS =====
POST   /api/admin/pos/orders/[id]/checkout  // Process payment
POST   /api/admin/pos/orders/[id]/refund    // Refund transaction
POST   /api/admin/pos/orders/[id]/void      // Void transaction

GET    /api/admin/pos/transactions          // Transaction history
GET    /api/admin/pos/transactions/[id]     // Transaction details

// ===== RECEIPTS =====
GET    /api/admin/pos/orders/[id]/receipt   // Get receipt (PDF)
POST   /api/admin/pos/orders/[id]/reprint   // Reprint receipt
POST   /api/admin/pos/orders/[id]/email     // Email receipt

// ===== TERMINALS =====
GET    /api/admin/pos-terminals
POST   /api/admin/pos-terminals
GET    /api/admin/pos-terminals/[id]
PUT    /api/admin/pos-terminals/[id]
DELETE /api/admin/pos-terminals/[id]
GET    /api/admin/pos-terminals/[id]/transactions
GET    /api/admin/pos-terminals/[id]/diagnostics
POST   /api/admin/pos-terminals/[id]/restart

// ===== ANALYTICS =====
GET    /api/admin/pos/reports/sales         // Daily sales report
GET    /api/admin/pos/reports/items         // Item sales breakdown
GET    /api/admin/pos/reports/discounts     // Discount usage report
GET    /api/admin/pos/reports/revenue       // Revenue by department
```

### Key Features

✅ **Complete Order Management**
- Create orders with multiple line items
- Add/remove items with real-time updates
- Track order status (open, paid, pending, cancelled, refunded)

✅ **Product & Service Catalog**
- Physical products with inventory tracking
- Services with duration and pricing
- Product categories and organization
- Department-specific product assignment
- Pricing overrides per department

✅ **Discount System**
- Coupon codes with usage limits
- Percentage and fixed-amount discounts
- Discount validity periods
- Minimum purchase requirements
- Manager-approved manual discounts
- Discount usage tracking

✅ **Inventory Management**
- Track stock levels for physical items
- Low stock alerts and reorder levels
- Automatic inventory updates
- Multiple locations/terminals

✅ **Complete Payment Processing**
- Multiple payment methods (cash, card, mobile, room charge)
- Tax calculation and application
- PCI-compliant card handling
- Receipt generation and printing
- Email receipt capability

✅ **Transaction Management**
- Full transaction history
- Refund and void operations
- Detailed receipt records
- Payment error handling
- Transaction reversal tracking

✅ **Department Integration**
- Assign products to departments
- Department-specific pricing
- Track sales by department
- Room service integration

✅ **Real-time Monitoring**
- Terminal status (online/offline)
- Transaction processing
- Payment verification
- System diagnostics

✅ **Advanced Features**
- Room mini-bar charging
- Guest bill integration
- Bulk operations
- Shift management
- Manager approval workflows

### POS Terminal Checkout Flow

```
┌─────────────────────────────────────────────────────────────┐
│              POS TERMINAL CHECKOUT FLOW                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. START ORDER                                             │
│     └─ Create new POSOrder                                 │
│                                                              │
│  2. ADD ITEMS/SERVICES                                      │
│     ├─ Search & select POSProduct                          │
│     ├─ Add to POSTransactionLineItem                        │
│     ├─ Adjust quantity                                      │
│     └─ Repeat until order complete                         │
│                                                              │
│  3. APPLY DISCOUNTS (Optional)                              │
│     ├─ Scan coupon code → Validate                         │
│     ├─ Or manually apply manager discount                  │
│     └─ Apply POSDiscount                                    │
│                                                              │
│  4. CALCULATE TOTALS                                        │
│     ├─ Sum line items (subtotal)                           │
│     ├─ Apply discount                                       │
│     ├─ Calculate tax                                        │
│     └─ Generate final total                                │
│                                                              │
│  5. SELECT PAYMENT METHOD                                   │
│     ├─ Cash                                                 │
│     ├─ Card (Visa, MC, Amex)                               │
│     ├─ Mobile (Apple Pay, Google Pay)                      │
│     └─ Room charge (mini-bar, room service)                │
│                                                              │
│  6. PROCESS PAYMENT                                         │
│     ├─ Connect to payment processor                        │
│     ├─ Authorize & capture                                 │
│     └─ Create POSTransaction record                        │
│                                                              │
│  7. COMPLETE ORDER                                          │
│     ├─ Generate receipt                                     │
│     ├─ Print/email receipt                                 │
│     ├─ Update inventory                                     │
│     ├─ Record discount usage                               │
│     └─ Update guest bill (if room charge)                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### UI Components

```typescript
// src/components/admin/pos-terminals/

terminal-status-card.tsx      // Status indicator badge
terminal-list.tsx              // Terminal grid/table view
terminal-detail.tsx            // Full terminal dashboard
terminal-config-form.tsx       // Configuration form
transaction-list.tsx           // Transaction history table
diagnostics-panel.tsx          // System diagnostics
terminal-status-monitor.tsx    // Real-time status updates
```

---

## 2. Games & Entertainment Management

### Database Requirements

```prisma
model Game {
  id              String   @id @default(cuid())
  name            String
  type            String   // "billiards", "bowling", "arcade", "vr", etc.
  location        String
  
  // Player Info
  minPlayers      Int      @default(1)
  maxPlayers      Int      @default(2)
  
  // Pricing & Revenue
  pricePerHour    Float
  monthlyRevenue  Float    @default(0)
  
  // Status
  isAvailable     Boolean  @default(true)
  maintenanceNeeded Boolean @default(false)
  
  // Rating
  averageRating   Float    @default(5)
  totalReviews    Int      @default(0)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relations
  bookings        GameBooking[]
  tournaments     Tournament[]
  maintenance     MaintenanceLog[]
  equipment       GameEquipment[]
}

model GameBooking {
  id          String   @id @default(cuid())
  game        Game     @relation(fields: [gameId], references: [id])
  gameId      String
  
  guestName   String
  guestEmail  String
  guestPhone  String
  
  startTime   DateTime
  endTime     DateTime
  
  players     Int
  totalPrice  Float
  
  status      String   // "confirmed", "completed", "cancelled"
  notes       String?
  
  createdAt   DateTime @default(now())
}

model Tournament {
  id          String   @id @default(cuid())
  name        String
  game        Game     @relation(fields: [gameId], references: [id])
  gameId      String
  
  startDate   DateTime
  endDate     DateTime
  
  maxParticipants Int
  participants    String  // JSON array of participant IDs
  
  prizePool   Float
  
  status      String   // "upcoming", "ongoing", "completed"
  
  createdAt   DateTime @default(now())
}

model MaintenanceLog {
  id          String   @id @default(cuid())
  game        Game     @relation(fields: [gameId], references: [id])
  gameId      String
  
  type        String   // "preventive", "corrective", "inspection"
  description String
  
  startDate   DateTime
  completedDate DateTime?
  
  cost        Float
  notes       String?
  
  createdAt   DateTime @default(now())
}

model GameEquipment {
  id          String   @id @default(cuid())
  game        Game     @relation(fields: [gameId], references: [id])
  gameId      String
  
  name        String   // "Bowling Lane 1", "Arcade Cabinet #5"
  type        String
  serialNumber String?
  
  status      String   // "operational", "maintenance", "retired"
  warranty    DateTime?
  
  createdAt   DateTime @default(now())
}
```

### API Endpoints

```typescript
// GET /api/admin/games
// List all games with filtering

// POST /api/admin/games
// Create new game

// GET /api/admin/games/[id]
// Get game details

// PUT /api/admin/games/[id]
// Update game info

// DELETE /api/admin/games/[id]
// Archive/delete game

// GET /api/admin/games/[id]/bookings
// Get game bookings

// POST /api/admin/games/[id]/bookings
// Create new booking

// GET /api/admin/games/[id]/tournaments
// Get tournaments

// POST /api/admin/games/[id]/tournaments
// Create new tournament

// GET /api/admin/games/[id]/maintenance
// Get maintenance history

// POST /api/admin/games/[id]/maintenance
// Log maintenance

// GET /api/admin/games/revenue
// Revenue analytics
```

### Key Features

✅ **Game Inventory Management**
- Track all games and equipment
- Maintenance scheduling
- Equipment status tracking

✅ **Booking System**
- Guest reservations
- Availability calendar
- Automated confirmation

✅ **Tournament Management**
- Create and manage tournaments
- Leaderboards
- Prize pool tracking
- Participant management

✅ **Revenue Analytics**
- Daily/weekly/monthly revenue
- Booking patterns
- Player statistics
- Equipment ROI analysis

### UI Components

```typescript
// src/components/admin/games/

game-card.tsx                // Game info card
game-list.tsx                // Games grid/table
game-detail.tsx              // Full game dashboard
game-form.tsx                // Game creation/edit form
booking-calendar.tsx         // Booking visualization
tournament-manager.tsx       // Tournament CRUD
maintenance-tracker.tsx      // Maintenance log
revenue-chart.tsx            // Revenue analytics
leaderboard.tsx              // Tournament leaderboards
```

---

## 3. Gym & Sports Center Memberships

### Database Requirements

```prisma
model GymMembership {
  id            String   @id @default(cuid())
  memberId      String   @unique
  
  // Member Info
  member        Guest    @relation(fields: [guestId], references: [id])
  guestId       String
  
  // Membership Details
  type          String   // "day_pass", "1_month", "3_month", "annual"
  startDate     DateTime
  expiryDate    DateTime
  
  // Auto-renewal
  autoRenew     Boolean  @default(true)
  nextRenewalDate DateTime?
  
  // Payment
  paymentMethod String   // "card", "cash", "bank_transfer"
  monthlyRate   Float
  
  // Trainer Assignment
  trainer       Staff?   @relation(fields: [trainerId], references: [id])
  trainerId     String?
  
  // Status
  status        String   // "active", "expired", "paused", "cancelled"
  
  // Tracking
  lastCheckInDate DateTime?
  totalCheckIns  Int      @default(0)
  
  // Pricing Package
  package       String   // "basic", "premium", "vip"
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  // Relations
  classes       ClassEnrollment[]
  checkIns      GymCheckIn[]
  payments      MembershipPayment[]
}

model GymClass {
  id            String   @id @default(cuid())
  name          String   // "Yoga", "Spin", "HIIT"
  classType     String   // "group", "individual"
  
  // Schedule
  dayOfWeek     String   // "Monday", "Tuesday"
  startTime     String   // "06:00"
  endTime       String   // "07:00"
  
  // Capacity
  capacity      Int
  currentEnrollment Int @default(0)
  
  // Trainer
  trainer       Staff    @relation(fields: [trainerId], references: [id])
  trainerId     String
  
  // Location
  location      String   // "Studio A", "Gym Floor"
  
  status        String   // "active", "cancelled"
  
  createdAt     DateTime @default(now())
  
  // Relations
  enrollments   ClassEnrollment[]
  attendance    ClassAttendance[]
}

model ClassEnrollment {
  id          String   @id @default(cuid())
  membership  GymMembership @relation(fields: [membershipId], references: [id])
  membershipId String
  
  class       GymClass @relation(fields: [classId], references: [id])
  classId     String
  
  enrolledDate DateTime @default(now())
  status      String   // "enrolled", "completed", "dropped"
  
  @@unique([membershipId, classId])
}

model GymCheckIn {
  id          String   @id @default(cuid())
  membership  GymMembership @relation(fields: [membershipId], references: [id])
  membershipId String
  
  checkInTime DateTime
  checkOutTime DateTime?
  
  purpose     String?  // "general", "training", "class"
  
  createdAt   DateTime @default(now())
}

model MembershipPayment {
  id          String   @id @default(cuid())
  membership  GymMembership @relation(fields: [membershipId], references: [id])
  membershipId String
  
  amount      Float
  status      String   // "pending", "completed", "failed", "refunded"
  
  paymentMethod String
  transactionId String?
  
  invoiceNumber String?
  
  createdAt   DateTime @default(now())
}

model TrainerSession {
  id          String   @id @default(cuid())
  trainer     Staff    @relation(fields: [trainerId], references: [id])
  trainerId   String
  
  member      Guest    @relation(fields: [guestId], references: [id])
  guestId     String
  
  scheduledDate DateTime
  sessionType   String  // "strength", "cardio", "flexibility"
  
  notes       String?
  completed   Boolean  @default(false)
  
  createdAt   DateTime @default(now())
}
```

### API Endpoints

```typescript
// GET /api/admin/gym-memberships
// List memberships with filters

// POST /api/admin/gym-memberships
// Create new membership

// GET /api/admin/gym-memberships/[id]
// Get member details

// PUT /api/admin/gym-memberships/[id]
// Update membership

// POST /api/admin/gym-memberships/[id]/renew
// Renew membership

// POST /api/admin/gym-memberships/[id]/cancel
// Cancel membership

// GET /api/admin/gym-memberships/[id]/check-ins
// Get check-in history

// POST /api/admin/gym-memberships/[id]/check-in
// Record check-in

// GET /api/admin/gym-classes
// List all classes

// POST /api/admin/gym-classes
// Create new class

// GET /api/admin/gym-classes/[id]/attendance
// Get attendance records

// GET /api/admin/gym-trainers
// List trainers

// POST /api/admin/gym-trainers/[id]/sessions
// Schedule trainer session

// GET /api/admin/gym-memberships/analytics
// Analytics & reporting
```

### Key Features

✅ **Membership Management**
- Multiple membership types
- Auto-renewal capability
- Flexible billing options
- Status tracking

✅ **Class Management**
- Schedule management
- Capacity tracking
- Enrollment system
- Attendance tracking

✅ **Trainer System**
- Trainer directory
- Session scheduling
- Performance ratings
- Commission tracking

✅ **Member Analytics**
- Check-in frequency
- Class attendance
- Progress tracking
- Engagement metrics

### UI Components

```typescript
// src/components/admin/gym-memberships/

membership-card.tsx         // Member info card
membership-list.tsx         // Members directory
membership-detail.tsx       // Full member profile
member-form.tsx            // Membership creation/edit
class-scheduler.tsx        // Class schedule management
class-enrollment.tsx       // Manage enrollments
trainer-directory.tsx      // Trainers list
trainer-form.tsx          // Trainer management
check-in-log.tsx          // Check-in history
payment-history.tsx       // Payment records
analytics-dashboard.tsx   // Revenue & engagement analytics
class-attendance.tsx      // Attendance tracking
```

---

## Integration Points

### Authentication & Authorization

All three modules require **Admin** or **Manager** role access:

```typescript
// Middleware protection
const protectedRoutes = [
  '/admin/pos-terminals',
  '/admin/games',
  '/admin/gym-memberships'
]

// Role requirements
posTerminals: ['admin', 'manager']
games: ['admin', 'manager', 'games-manager']
gymMemberships: ['admin', 'manager', 'gym-manager']
```

### Data Relationships

```
Guest / Member
├─ GymMembership
│  ├─ ClassEnrollment → GymClass → Trainer
│  ├─ GymCheckIn
│  ├─ TrainerSession
│  └─ MembershipPayment
│
├─ GameBooking → Game
│
└─ POSTransaction → POSTerminal
```

### Real-time Updates

Implement WebSocket connections for:
- POS terminal status updates
- Game availability changes
- Gym member check-ins
- Transaction confirmations

### Reporting & Analytics

```typescript
// Revenue Dashboard Integration
revenue_managers_dashboard = {
  pos_terminals: {
    total_transactions: aggregate(),
    total_volume: sum(transaction.amount),
    active_terminals: count(isOnline),
  },
  games: {
    total_bookings: count(),
    total_revenue: sum(booking.totalPrice),
    popular_games: top(n),
  },
  gym: {
    active_members: count(status === 'active'),
    monthly_recurring_revenue: sum(monthlyRate),
    class_utilization: avg(enrollment/capacity),
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- Database schema implementation
- API endpoint scaffolding
- Basic CRUD operations

### Phase 2: Core Features (Week 3-4)
- Admin UI for all three modules
- Data table implementations
- Form components

### Phase 3: Advanced Features (Week 5-6)
- Analytics dashboards
- Real-time monitoring (POS)
- Booking/reservation systems

### Phase 4: Polish & Integration (Week 7-8)
- Testing & bug fixes
- Performance optimization
- Integration with main dashboard

---

## Sidebar Navigation Update

```
Admin Panel
├─ Dashboard
│  ├─ Home
│  ├─ Analytics
│  └─ Reports
│
├─ Operations
│  ├─ Departments
│  ├─ Rooms
│  ├─ Bookings
│  ├─ Customers
│  ├─ Orders
│  ├─ Inventory
│  └─ Staff
│
├─ Revenue Management  ⭐ NEW SECTION
│  ├─ POS Terminals    ⭐ NEW
│  │  └─ 🟢 Online: 4 | 🔴 Offline: 1
│  ├─ Games            ⭐ NEW
│  │  └─ 📊 Revenue: $5.2K this week
│  ├─ Gym              ⭐ NEW
│  │  └─ 👥 Active: 247 | 📈 +12%
│  └─ Reports
│     └─ Revenue Analytics
│
├─ Settings
│  ├─ General
│  ├─ Roles & Permissions
│  ├─ Users
│  └─ System Settings
│
└─ Account
   ├─ Profile
   ├─ Preferences
   └─ Logout
```

---

## Performance Targets

- **POS Transactions**: < 100ms response time
- **Terminal Status Checks**: Real-time (WebSocket)
- **Game Availability**: Real-time updates
- **Membership Lookups**: < 50ms
- **Report Generation**: < 2s for monthly data

---

## Security Considerations

✅ Role-based access control (RBAC)  
✅ Audit logging for transactions  
✅ PCI compliance for payment data  
✅ Encryption for sensitive data  
✅ Rate limiting on payment endpoints  
✅ Session timeout (15 minutes)  

---

## Browser & Device Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- iOS 14+ (responsive mobile)
- Android 10+ (responsive mobile)

---

**Revenue Management Modules**: ✅ COMPLETE SPECIFICATION  
**Version**: 1.0.0  
**Last Updated**: November 15, 2025  
**Status**: Ready for Development
