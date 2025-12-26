# Quick Reference: Order Fulfillment & Payment Flow

## For Developers

### Key API Endpoints

#### Get Order Details
```bash
GET /api/orders/[id]
```
Returns full order with status and payment information.

#### Cancel Pending Order
```bash
DELETE /api/orders/[id]
```
- Only works if `status === 'pending'`
- Releases inventory reservations
- Returns error if order is already fulfilled

#### Refund Fulfilled Order
```bash
POST /api/orders/[id]/refund
Body: { "reason": "string (optional)" }
```
- Only works if `status: ['fulfilled', 'completed']` AND `paymentStatus: ['paid', 'partial']`
- Updates order status to `refunded`
- Updates payment status to `refunded`
- Removes items from sold counts
- Recalculates department stats

#### Get Products with Sales Info
```bash
GET /api/departments/[code]/products?details=true
```
Returns:
- `unitsSold` - Count of items from fulfilled + paid orders
- `amountSold` - Revenue from fulfilled + paid orders  
- `pendingQuantity` - Items in pending/processing status

#### Update Order Status
```bash
PUT /api/orders/[id]
Body: { "status": "pending|processing|fulfilled|completed|cancelled" }
```
Note: Use DELETE endpoint for cancellation or POST /refund for refunds.

---

## For Managers/Staff

### Order Lifecycle

1. **PENDING** (default)
   - ✅ Can cancel (loses all items)
   - ❌ Does NOT count as sold
   - ❌ No revenue shown

2. **FULFILLED** (items prepared/delivered)
   - ❌ Cannot cancel (use refund instead)
   - ❌ Does NOT count as sold YET (waiting for payment)
   - ❌ No revenue shown

3. **FULFILLED + PAID** (payment received)
   - ❌ Cannot cancel
   - ✅ COUNTS as sold
   - ✅ Revenue shown in reports
   - ✅ Available for refund

4. **REFUNDED** (after refund)
   - ❌ Final state
   - ❌ No longer counts as sold
   - ❌ Revenue removed from totals

### Actions

| Action | Requirements | Result |
|--------|--------------|--------|
| **Cancel** | Order must be `pending` | Order deleted, inventory released, nothing sold |
| **Process Payment** | Order is `fulfilled` | Update paymentStatus to `paid`/`partial` |
| **Refund** | Order is `fulfilled`+`paid` | Mark as refunded, remove from sold totals |

---

## For Managers - Reading Reports

### Department Section Details

**Units Sold** column shows:
- Only items from orders that are BOTH fulfilled AND paid
- Excludes pending orders (not processed yet)
- Excludes unpaid fulfilled orders (waiting for payment)

**Amount Sold** column shows:
- Total revenue from fulfilled + paid orders only
- Excludes refunded items
- In cents (divide by 100 for display)

**Pending** column shows:
- Items currently in pending/processing status
- These can still be cancelled if order is pending

---

## Database Statuses

### OrderHeader.status
- `pending` - Initial state, can be cancelled
- `processing` - Being prepared
- `fulfilled` - Items ready for pickup/delivery
- `completed` - Order finished
- `cancelled` - Cancelled before fulfillment
- `refunded` - Refunded after fulfillment + payment

### OrderHeader.paymentStatus
- `unpaid` - Default, no payment received
- `paid` - Full payment received (counts as sold)
- `partial` - Partial payment (counts as sold)
- `refunded` - Payment returned to customer

---

## Troubleshooting

### "Cannot cancel fulfilled orders"
- Order status is not `pending`
- Solution: Use refund endpoint if payment was made

### "Cannot refund unpaid orders"
- Order is fulfilled but payment status is `unpaid`
- Solution: Record payment first, then refund

### Units Sold not updating
- Check that order status is `fulfilled` or `completed`
- Check that payment status is `paid` or `partial`
- Ensure order line status is `fulfilled`
- Department stats auto-recalculate on order fulfillment/refund

### Amount Sold shows 0
- Order may be unpaid (pending payment)
- Order may not be fulfilled yet
- Order may have been refunded
- Check all three conditions are met: fulfilled status, paid status, fulfilled line status

---

## Validation Rules

```
CANCEL allowed:
- Order.status === 'pending'

REFUND allowed:
- Order.status IN ['fulfilled', 'completed']
- Order.paymentStatus IN ['paid', 'partial']

SOLD counted:
- OrderLine.status === 'fulfilled'
- OrderHeader.status IN ['fulfilled', 'completed']
- OrderHeader.paymentStatus IN ['paid', 'partial']
```

---

## API Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `Cannot cancel {status} orders` | Order not pending | Use refund if fulfilled + paid |
| `Cannot refund {status} orders` | Order not fulfilled/completed | Wait for fulfillment first |
| `Order payment status is {status}` | Payment not made | Process payment before refunding |
| `Order not found` | Invalid order ID | Check order ID |
| `Only managers/admins can...` | Insufficient permissions | Use appropriate user role |

