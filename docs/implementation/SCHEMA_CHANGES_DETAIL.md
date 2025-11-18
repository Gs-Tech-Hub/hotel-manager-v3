# Schema Changes Detail - Phase 1

## New Models Added (9 Total)

### 1. Department
```prisma
model Department {
  id                   String      @id @default(cuid())
  code                 String      @unique
  name                 String
  description          String?
  isActive             Boolean     @default(true)
  
  orderDepartments     OrderDepartment[]
  
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt
  
  @@map("departments")
}
```

**Seed Data (8 departments)**:
```sql
INSERT INTO departments (code, name, description, "isActive", "createdAt", "updatedAt") VALUES
('HOTEL_BOOKING', 'Hotel Bookings', 'Room reservations and check-in/check-out', true, NOW(), NOW()),
('RESTAURANT', 'Restaurant', 'Food items and menu management', true, NOW(), NOW()),
('BAR_CLUB', 'Bar & Club', 'Drinks and beverages', true, NOW(), NOW()),
('GYM_MEMBERSHIP', 'Gym Membership', 'Gym memberships and sessions', true, NOW(), NOW()),
('SPORT_MEMBERSHIP', 'Sport Membership', 'Sport/fitness memberships', true, NOW(), NOW()),
('HOTEL_SERVICE', 'Hotel Services', 'Laundry, room service, amenities, spa', true, NOW(), NOW()),
('GAMES_ENTERTAINMENT', 'Games & Entertainment', 'Game credits and entertainment packages', true, NOW(), NOW()),
('EMPLOYEE_ORDER', 'Employee Orders', 'Employee purchases with discounts and debt tracking', true, NOW(), NOW());
```

---

### 2. DiscountRule
```prisma
model DiscountRule {
  id                   String      @id @default(cuid())
  code                 String      @unique
  name                 String
  description          String?
  type                 String      @default("percentage") // percentage, fixed, tiered
  value                Decimal     @db.Decimal(10, 2)
  maxUsagePerCustomer  Int?
  maxTotalUsage        Int?
  currentUsage         Int         @default(0)
  minOrderAmount       Int?
  applicableDepts      String      @default("[]")         // JSON array
  isActive             Boolean     @default(true)
  startDate            DateTime?
  endDate              DateTime?
  
  orderDiscounts       OrderDiscount[]
  
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt
  
  @@map("discount_rules")
}
```

**Example Discount Rules**:
```json
{
  "code": "SUMMER20",
  "name": "Summer 20% Off",
  "type": "percentage",
  "value": 20,
  "maxUsagePerCustomer": 1,
  "maxTotalUsage": 100,
  "applicableDepts": ["RESTAURANT", "BAR_CLUB"],
  "startDate": "2025-06-01",
  "endDate": "2025-08-31"
}

{
  "code": "EMP-DISCOUNT",
  "name": "Employee 15% Discount",
  "type": "percentage",
  "value": 15,
  "applicableDepts": ["*"],  // All departments
  "isActive": true
}

{
  "code": "BULK-5",
  "name": "Bulk Order 5% Off",
  "type": "tiered",
  "minOrderAmount": 5000,
  "value": 5,
  "applicableDepts": ["RESTAURANT"]
}
```

---

### 3. OrderHeader
```prisma
model OrderHeader {
  id                   String      @id @default(cuid())
  orderNumber          String      @unique
  customerId           String
  customer             Customer    @relation(fields: [customerId], references: [id], onDelete: Cascade)
  
  departmentCode       String?
  status               String      @default("pending")
  
  subtotal             Int         @default(0)
  discountTotal        Int         @default(0)
  tax                  Int         @default(0)
  total                Int         @default(0)
  
  notes                String?
  
  lines                OrderLine[]
  departments          OrderDepartment[]
  discounts            OrderDiscount[]
  payments             OrderPayment[]
  fulfillments         OrderFulfillment[]
  reservations         InventoryReservation[]
  legacyOrders         Order[]
  
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt
  
  @@index([customerId])
  @@index([status])
  @@index([createdAt])
  @@map("order_headers")
}
```

**Status Values**:
- `pending`: Order created, not yet processed
- `processing`: Order being prepared
- `fulfilled`: All items fulfilled
- `completed`: Order completed and payment settled
- `cancelled`: Order cancelled by customer/staff

**Example Record**:
```json
{
  "orderNumber": "ORD-2025-11-001",
  "customerId": "cust_xyz",
  "departmentCode": "RESTAURANT",
  "status": "processing",
  "subtotal": 5000,
  "discountTotal": 500,
  "tax": 450,
  "total": 4950,
  "notes": "No onions, extra sauce"
}
```

---

### 4. OrderLine
```prisma
model OrderLine {
  id                   String      @id @default(cuid())
  lineNumber           Int
  
  orderHeaderId        String
  orderHeader          OrderHeader @relation(fields: [orderHeaderId], references: [id], onDelete: Cascade)
  
  departmentCode       String
  productId            String
  productType          String     // food, drink, service, membership, game, etc.
  productName          String
  
  quantity             Int
  unitPrice            Int
  unitDiscount         Int         @default(0)
  lineTotal            Int
  
  status               String      @default("pending")
  
  fulfillments         OrderFulfillment[]
  
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt
  
  @@index([orderHeaderId])
  @@index([departmentCode])
  @@map("order_lines")
}
```

**Example Records**:
```json
[
  {
    "lineNumber": 1,
    "orderHeaderId": "ord_header_1",
    "departmentCode": "RESTAURANT",
    "productId": "food_1",
    "productType": "food",
    "productName": "Grilled Salmon",
    "quantity": 2,
    "unitPrice": 1500,
    "unitDiscount": 0,
    "lineTotal": 3000,
    "status": "fulfilled"
  },
  {
    "lineNumber": 2,
    "orderHeaderId": "ord_header_1",
    "departmentCode": "BAR_CLUB",
    "productId": "drink_5",
    "productType": "drink",
    "productName": "Red Wine",
    "quantity": 1,
    "unitPrice": 800,
    "unitDiscount": 100,
    "lineTotal": 700,
    "status": "fulfilled"
  }
]
```

---

### 5. OrderDepartment
```prisma
model OrderDepartment {
  id                   String      @id @default(cuid())
  
  orderHeaderId        String
  orderHeader          OrderHeader @relation(fields: [orderHeaderId], references: [id], onDelete: Cascade)
  
  departmentId         String
  department           Department  @relation(fields: [departmentId], references: [id])
  
  status               String      @default("pending")
  departmentNotes      String?
  
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt
  
  @@unique([orderHeaderId, departmentId])
  @@index([departmentId])
  @@map("order_departments")
}
```

**Use Case**: Multi-department order
```json
{
  "orderHeaderId": "ord_header_1",
  "entries": [
    { "departmentId": "dept_restaurant", "status": "fulfilled" },
    { "departmentId": "dept_bar", "status": "in_progress" }
  ]
}
```

---

### 6. OrderDiscount
```prisma
model OrderDiscount {
  id                   String      @id @default(cuid())
  
  orderHeaderId        String
  orderHeader          OrderHeader @relation(fields: [orderHeaderId], references: [id], onDelete: Cascade)
  
  discountRuleId       String?
  discountRule         DiscountRule? @relation(fields: [discountRuleId], references: [id])
  
  discountType         String      // percentage, fixed, employee, bulk
  discountCode         String?
  description          String?
  discountAmount       Int
  appliedAt            DateTime    @default(now())
  
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt
  
  @@index([orderHeaderId])
  @@map("order_discounts")
}
```

**Example Records**:
```json
[
  {
    "orderHeaderId": "ord_header_1",
    "discountRuleId": "rule_summer20",
    "discountType": "percentage",
    "discountCode": "SUMMER20",
    "description": "Summer 20% promotion",
    "discountAmount": 500
  },
  {
    "orderHeaderId": "ord_header_1",
    "discountType": "employee",
    "discountCode": "EMP-001",
    "description": "Employee discount",
    "discountAmount": 200
  }
]
```

---

### 7. OrderPayment
```prisma
model OrderPayment {
  id                   String      @id @default(cuid())
  
  orderHeaderId        String
  orderHeader          OrderHeader @relation(fields: [orderHeaderId], references: [id], onDelete: Cascade)
  
  amount               Int
  paymentMethod        String      // cash, card, bank_transfer, mobile_payment
  paymentStatus        String      @default("pending")
  transactionReference String?
  
  paymentTypeId        String?
  paymentType          PaymentType? @relation(fields: [paymentTypeId], references: [id])
  
  processedAt          DateTime?
  
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt
  
  @@index([orderHeaderId])
  @@index([paymentStatus])
  @@map("order_payments")
}
```

**Partial Payment Example**:
```json
[
  {
    "orderHeaderId": "ord_1",
    "amount": 2000,
    "paymentMethod": "card",
    "paymentStatus": "completed",
    "transactionReference": "TXN-001",
    "processedAt": "2025-11-14T10:30:00Z"
  },
  {
    "orderHeaderId": "ord_1",
    "amount": 2950,
    "paymentMethod": "cash",
    "paymentStatus": "completed",
    "transactionReference": "CASH-001",
    "processedAt": "2025-11-14T10:35:00Z"
  }
]
```

---

### 8. OrderFulfillment
```prisma
model OrderFulfillment {
  id                   String      @id @default(cuid())
  
  orderHeaderId        String
  orderHeader          OrderHeader @relation(fields: [orderHeaderId], references: [id], onDelete: Cascade)
  
  orderLineId          String?
  orderLine            OrderLine?  @relation(fields: [orderLineId], references: [id], onDelete: SetNull)
  
  status               String
  fulfilledQuantity    Int         @default(0)
  
  fulfilledAt          DateTime?
  notes                String?
  
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt
  
  @@index([orderHeaderId])
  @@index([status])
  @@map("order_fulfillments")
}
```

**Status Flow**:
```
pending → in_progress → fulfilled ✓
                    ↓
                cancelled ✗
```

**Example**:
```json
{
  "orderHeaderId": "ord_1",
  "orderLineId": "line_1",
  "status": "fulfilled",
  "fulfilledQuantity": 2,
  "fulfilledAt": "2025-11-14T11:00:00Z",
  "notes": "Prepared by Chef John"
}
```

---

### 9. InventoryReservation
```prisma
model InventoryReservation {
  id                   String      @id @default(cuid())
  
  inventoryItemId      String
  inventoryItem        InventoryItem @relation(fields: [inventoryItemId], references: [id], onDelete: Cascade)
  
  orderHeaderId        String
  orderHeader          OrderHeader? @relation(fields: [orderHeaderId], references: [id], onDelete: Cascade)
  
  quantity             Int
  status               String      @default("reserved")
  
  reservedAt           DateTime    @default(now())
  confirmedAt          DateTime?
  releasedAt           DateTime?
  
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt
  
  @@index([inventoryItemId])
  @@index([orderHeaderId])
  @@map("inventory_reservations")
}
```

**Reservation Lifecycle**:
```
1. reserved (quantity locked)
2. confirmed (order processing)
3. consumed (order fulfilled) OR released (order cancelled)
```

---

## Enhanced Models (5 Total)

### 1. Order (Added Relation)
```prisma
// Added:
orderHeaderId        String?
orderHeader          OrderHeader? @relation(fields: [orderHeaderId], references: [id])
```

### 2. Customer (Added Collection)
```prisma
// Added:
orderHeaders         OrderHeader[]
```

### 3. PaymentType (Added Collection)
```prisma
// Added:
orderPayments        OrderPayment[]
```

### 4. InventoryItem (Added Collection)
```prisma
// Added:
reservations         InventoryReservation[]
```

### 5. OrderHeader (Added Back-References)
```prisma
// Added:
reservations         InventoryReservation[]
legacyOrders         Order[]
```

---

## Migration Strategy

### SQL Execution Order:

1. **Create Department table** - Department codes needed for routing
2. **Create DiscountRule table** - Discount codes needed for orders
3. **Create OrderHeader table** - Master order table
4. **Create OrderLine table** - Line items
5. **Create OrderDepartment table** - Department routing
6. **Create OrderDiscount table** - Applied discounts
7. **Create OrderPayment table** - Payment tracking
8. **Create OrderFulfillment table** - Fulfillment tracking
9. **Create InventoryReservation table** - Inventory control
10. **Alter Order table** - Add orderHeaderId FK
11. **Alter Customer table** - Add OrderHeader relation
12. **Alter PaymentType table** - Add OrderPayment relation
13. **Alter InventoryItem table** - Add InventoryReservation relation

### Key Considerations:

- All new tables use CUID for IDs (consistent with existing schema)
- Timestamps use `createdAt` and `updatedAt` (consistent)
- Cascade deletes on parent-child relationships
- Strategic indexes on frequently queried columns
- Unique constraints on natural keys (orderNumber, codes)
- Foreign key constraints for referential integrity

---

## Testing Checklist

Before Phase 2, verify:

- [ ] All tables created successfully
- [ ] All foreign keys established
- [ ] All indexes created
- [ ] Triggers/constraints working
- [ ] Seed data inserted (8 departments)
- [ ] Prisma client regenerated
- [ ] TypeScript compilation succeeds
- [ ] No type conflicts with existing code

---

**Schema Version**: 1.0.0  
**Database**: PostgreSQL 12+  
**Prisma**: 6.0+  
**Status**: ✅ READY FOR MIGRATION
