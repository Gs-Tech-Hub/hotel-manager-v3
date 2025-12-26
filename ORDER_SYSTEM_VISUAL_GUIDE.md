# Order Fulfillment & Payment System - Visual Guide

## Order Status Lifecycle

```
┌─────────────┐
│   CREATE    │  (New order, status='pending', paymentStatus='unpaid')
│   ORDER     │
└──────┬──────┘
       │
       ├──────────────────────────────────┐
       │                                  │
       ▼                                  ▼
   ┌─────────┐                    ┌────────────┐
   │ CANCEL  │ (Only Pending)      │  FULFILL   │ 
   │ ORDER   │────────────────┐    │  ORDER     │
   │         │                │    │            │
   └─────────┘                │    └──────┬─────┘
       │                      │           │
       │   Reservation        │    status='fulfilled'
       │   Released           │    paymentStatus='unpaid'
       │   Inventory NOT      │
       │   affected           │    Items NOT counted as SOLD
       │   Nothing SOLD       │    (Waiting for payment)
       │                      │
       ▼                      │
   ┌──────────────┐           │
   │  CANCELLED   │           │
   │  (Final)     │           │
   └──────────────┘           │
                              │
                              ▼
                       ┌──────────────┐
                       │  FULFILLED   │ (No payment yet)
                       │  + UNPAID    │
                       └──────┬───────┘
                              │
                              │ Process Payment
                              │ paymentStatus='paid'
                              │
                              ▼
                       ┌──────────────┐
                       │  FULFILLED   │ ◄── COUNTED AS SOLD
                       │  + PAID      │     Units Sold: YES
                       │  (Mature)    │     Amount Sold: YES
                       └──────┬───────┘     Revenue: YES
                              │
                    ┌─────────┴──────────┐
                    │                    │
                    ▼                    ▼
              ┌──────────┐          ┌─────────┐
              │ COMPLETE │          │ REFUND  │
              │ (Mark as │          │ ORDER   │
              │ completed)          │         │
              └────┬─────┘          └────┬────┘
                   │                     │
                   │                     │
                   ▼                     ▼
              ┌───────────────────────────────┐
              │  REFUNDED (Final)             │
              │  - Removed from SOLD          │
              │  - Revenue REVERSED           │
              │  - Status: refunded           │
              │  - PaymentStatus: refunded    │
              └───────────────────────────────┘
```

---

## Sold Items Calculation Logic

```
┌─────────────────────────────────────────────┐
│         IS THIS ITEM "SOLD"?                │
└──────────────┬──────────────────────────────┘
               │
        ┌──────┴──────────────┐
        │                     │
        ▼                     ▼
    Check 1:              Check 2:
    Order Status          Payment Status
    │                     │
    ├─ pending? ✗          ├─ unpaid? ✗
    ├─ processing? ✗       ├─ paid? ✓
    ├─ fulfilled? ✓        ├─ partial? ✓
    ├─ completed? ✓        └─ refunded? ✗
    ├─ cancelled? ✗
    └─ refunded? ✗                │
                                   │
        ┌──────────────────────────┘
        │
        ▼
    Check 3:
    Line Status
    │
    ├─ pending? ✗
    ├─ processing? ✗
    ├─ fulfilled? ✓ ◄─ YES
    ├─ completed? ✗
    ├─ cancelled? ✗
    └─ refunded? ✗

    ┌─────────────────────────────────────┐
    │ If ALL 3 CHECKS PASS:               │
    │ ✓ Item counted as SOLD              │
    │ ✓ Revenue added to totalAmount      │
    │ ✓ Shows in unitsSold & amountSold   │
    └─────────────────────────────────────┘
```

---

## Data Flow: Creating & Selling an Order

```
STEP 1: CREATE ORDER
┌──────────────────────────────────────┐
│ POST /api/orders                     │
│ {                                    │
│   customerId, items, ...             │
│ }                                    │
└──────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────┐
│ OrderService.createOrder()           │
│ - Validate inventory                 │
│ - Create OrderHeader (pending)       │
│ - Create OrderLines (pending)        │
│ - Create OrderDepartments           │
│ - Reserve inventory                  │
└──────────────────────────────────────┘
          │
          ▼
    Status: pending
    PaymentStatus: unpaid
    ✗ NOT in sold counts
    ✗ NO revenue shown


STEP 2: FULFILL ORDER
┌──────────────────────────────────────┐
│ PUT /api/orders/[id]                 │
│ {                                    │
│   status: "fulfilled"                │
│ }                                    │
└──────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────┐
│ OrderService.updateOrderStatus()     │
│ - Update OrderHeader.status          │
│ - Update OrderLines.status           │
│ - Update OrderDepartments.status     │
│ - Create fulfillment records         │
└──────────────────────────────────────┘
          │
          ▼
    Status: fulfilled
    PaymentStatus: unpaid (still)
    ✗ STILL NOT in sold counts
    ✗ NO revenue (waiting for payment)


STEP 3: PROCESS PAYMENT
┌──────────────────────────────────────┐
│ External Payment System              │
│ Records payment made                 │
└──────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────┐
│ PUT /api/orders/[id]                 │
│ {                                    │
│   paymentStatus: "paid"              │
│ }                                    │
└──────────────────────────────────────┘
          │
          ▼
    Status: fulfilled
    PaymentStatus: paid
    ✓ NOW in sold counts!
    ✓ Revenue NOW shown!
    ✓ Items appear in:
      - unitsSold
      - amountSold
      - totalAmount (stats)


STEP 4: OPTIONAL - REFUND
┌──────────────────────────────────────┐
│ POST /api/orders/[id]/refund         │
│ {                                    │
│   reason: "Customer requested"       │
│ }                                    │
└──────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────┐
│ OrderService.refundOrder()           │
│ - Validate fulfilled + paid          │
│ - Update order to refunded           │
│ - Update payment to refunded         │
│ - Update lines to refunded           │
│ - Recalculate stats                  │
└──────────────────────────────────────┘
          │
          ▼
    Status: refunded
    PaymentStatus: refunded
    ✗ REMOVED from sold counts
    ✗ Revenue REVERSED
    ✓ Audit trail preserved
```

---

## API Endpoint Flow

```
┌────────────────────────────────────────────────┐
│         API REQUEST RECEIVED                   │
└──────────────┬─────────────────────────────────┘
               │
        ┌──────┴──────────────────────────────┐
        │                                     │
    DELETE               POST                PUT
    /[id]           /[id]/refund           /[id]
    │               │                       │
    ▼               ▼                       ▼
  Cancel          Refund                  Update
  Order           Order                   Status
    │               │                       │
    ▼               ▼                       ▼
  Check:          Check:                  Check:
  pending?        fulfilled+paid?        valid status?
    │               │                       │
    ├─YES→         ├─YES→                 ├─YES→
    │  Process      │  Process             │  Process
    │              │                      │
    ├─NO→          ├─NO→                 ├─NO→
    │  Error        │  Error               │  Error


AFTER SUCCESSFUL OPERATION:
┌─────────────────────────────────────────┐
│ Recalculate Section Stats               │
│ - unitsSold                             │
│ - amountSold                            │
│ - fulfillmentRate                       │
│ - pendingQuantity                       │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Rollup Parent Department Stats          │
│ - Aggregate child section stats         │
│ - Update parent metadata                │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Return Success Response                 │
│ with updated order                      │
└─────────────────────────────────────────┘
```

---

## Department Section Details Display

```
┌─────────────────────────────────────────────┐
│  DEPARTMENT SECTION DETAILS                 │
│  (e.g., RESTAURANT:main)                    │
├─────────────────────────────────────────────┤
│                                             │
│  PRODUCTS TABLE:                            │
│  ┌───────────────────────────────────────┐ │
│  │ Item │ Price │ Units │ Units │ Amount│ │
│  │      │       │ Avail │ Sold  │ Sold │ │
│  ├───────────────────────────────────────┤ │
│  │ Steak│$15.99 │  45   │  12   │$191.88│ │
│  │      │       │       │ ◄─────┼─────┘ │
│  │      │       │       │ From fulfilled  │
│  │      │       │       │ + paid orders   │
│  ├───────────────────────────────────────┤ │
│  │Salad │$8.50  │  62   │   8   │$68.00 │ │
│  ├───────────────────────────────────────┤ │
│  │ Soup │$6.50  │  30   │   0   │  $0   │ │
│  │      │       │       │ (No orders paid)│
│  └───────────────────────────────────────┘ │
│                                             │
│  STATS SUMMARY:                             │
│  Total Units Sold: 20                       │
│  Total Amount Sold: $259.88                 │
│  Pending Orders: 5 items                    │
│  ◄──────────────────────────────────────┐  │
│  (Items that can still be cancelled)    │  │
└─────────────────────────────────────────────┘

DATA SOURCE: SectionService.getProducts()
- Filters:
  ✓ Order.status IN ['fulfilled', 'completed']
  ✓ Order.paymentStatus IN ['paid', 'partial']
  ✓ OrderLine.status = 'fulfilled'
- Returns:
  • unitsSold: matching items count
  • amountSold: lineTotal sum
  • pendingQuantity: pending/processing items
```

---

## State Transition Matrix

```
         │ pending │ processing │ fulfilled │ completed │ cancelled │ refunded
─────────┼─────────┼────────────┼───────────┼───────────┼───────────┼─────────
pending  │   -     │     ✓      │     ✓     │     ✓     │     ✓     │    ✗
process  │   ✗     │     -      │     ✓     │     ✓     │     ✓     │    ✗
fulfil.  │   ✗     │     ✗      │     -     │     ✓     │     ✗     │    ✓
complet. │   ✗     │     ✗      │     ✗     │     -     │     ✗     │    ✓
cancel.  │   ✗     │     ✗      │     ✗     │     ✗     │     -     │    ✗
refund.  │   ✗     │     ✗      │     ✗     │     ✗     │     ✗     │    -

✓ = Valid transition
✗ = Invalid transition
- = Current state (no transition)

Special Rules:
• Can CANCEL only from pending
• Can REFUND only from fulfilled/completed (with paid/partial payment)
• Refunded is TERMINAL state (no further transitions)
```

---

## Payment Status Impact on Revenue Recognition

```
┌──────────────────────────────────────────────────────┐
│            REVENUE RECOGNITION                       │
├──────────────────────────────────────────────────────┤
│                                                      │
│ PaymentStatus: unpaid                               │
│ ├─ Revenue: $0  (waiting for payment)               │
│ ├─ Appears in sold counts? NO                       │
│ └─ Can refund? NO                                   │
│                                                      │
│ PaymentStatus: paid                                 │
│ ├─ Revenue: FULL (payment received)                 │
│ ├─ Appears in sold counts? YES                      │
│ └─ Can refund? YES                                  │
│                                                      │
│ PaymentStatus: partial                              │
│ ├─ Revenue: PARTIAL (some payment received)         │
│ ├─ Appears in sold counts? YES (counts as sold)     │
│ └─ Can refund? YES                                  │
│                                                      │
│ PaymentStatus: refunded                             │
│ ├─ Revenue: -FULL (reversed)                        │
│ ├─ Appears in sold counts? NO (removed)             │
│ └─ Can refund? NO (already refunded)                │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Query Flow for Sold Items

```
SECTION SERVICE: getProducts()
│
├─ GET parameters: section=RESTAURANT:main, details=true
│
├─ QUERY 1: Fetch available items
│  └─ SELECT * FROM inventoryItem WHERE category='food'
│
├─ QUERY 2: Get balances (inventory)
│  └─ Uses StockService
│
├─ QUERY 3: GROUP BY productId WHERE SOLD ◄─── KEY QUERY
│  └─ SELECT
│       productId, SUM(quantity), SUM(lineTotal)
│     FROM orderLine
│     WHERE
│       productId IN (...)
│       AND status = 'fulfilled'  ◄─── Must be fulfilled
│       AND orderHeader.status IN ('fulfilled', 'completed')  ◄─── Order fulfilled
│       AND orderHeader.paymentStatus IN ('paid', 'partial')  ◄─── Payment made
│       AND departmentCode = 'RESTAURANT:main'
│     GROUP BY productId
│
├─ QUERY 4: GROUP BY productId WHERE PENDING
│  └─ SELECT
│       productId, SUM(quantity)
│     FROM orderLine
│     WHERE
│       productId IN (...)
│       AND status IN ('pending', 'processing')
│       AND orderHeader.status != 'cancelled'
│     GROUP BY productId
│
└─ RETURN: items with unitsSold, amountSold, pendingQuantity
```

---

## Summary Matrix

```
STATE                │ SOLD? │ REVENUE? │ CANCEL? │ REFUND?
─────────────────────┼───────┼──────────┼─────────┼────────
Pending + Unpaid     │  NO   │   NO     │  YES    │   NO
Fulfiled + Unpaid    │  NO   │   NO     │   NO    │   NO
Fulfilled + Paid     │  YES  │  YES     │   NO    │  YES
Completed + Paid     │  YES  │  YES     │   NO    │  YES
Cancelled            │  NO   │   NO     │   -     │   NO
Refunded             │  NO   │   NO     │   NO    │   -
```

