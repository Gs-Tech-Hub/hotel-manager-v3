# Phase 3: Deferred Orders - End-to-End Testing Guide

## Quick Start: Testing the Deferred Order Flow

### Prerequisite Check
```bash
# 1. Verify build is clean
npm run build
# ✅ Should complete with only warnings, no errors

# 2. Run Phase 3 verification
npx tsx scripts/verify-phase-3.ts
# ✅ Should show all checks passing
```

---

## Test Scenario 1: Create a Deferred Order

### Step-by-Step

1. **Navigate to POS Terminal**
   - URL: `http://localhost:3000/dashboard/pos/food?terminal=<TERMINAL_ID>`
   - Or select a terminal from POS dashboard

2. **Add Items to Cart**
   - Click on a food item (e.g., "Margherita Pizza")
   - Click "Add" button multiple times (3-5 items)
   - Verify items appear in cart with prices

3. **Proceed to Payment**
   - Click "Proceed to Payment" button
   - Payment modal appears

4. **Select "Pay Later"**
   - Click "Pay Later" tab (amber/orange button)
   - View shows: Order total, notice about deferred payment
   - Click "Create Deferred Order" button

5. **Verify Deferred Receipt**
   - Receipt shows: ⏰ **DEFERRED ORDER** badge
   - Status: **PENDING PAYMENT**
   - Message: "This order will be settled later"
   - Order Number displayed (e.g., ORD-1702869644122-ABC123XYZ)

6. **Expected Result**
   - ✅ Order created successfully
   - ✅ Cart cleared
   - ✅ Receipt shows pending status
   - ✅ No payment recorded yet

---

## Test Scenario 2: View Open Orders Dashboard

### Step-by-Step

1. **Navigate to Open Orders Dashboard**
   - URL: `http://localhost:3000/dashboard/pos/open-orders`
   - Or find link in admin menu

2. **Verify Dashboard Loads**
   - Summary cards visible:
     - Total Pending: Shows count
     - Amount Due: Shows total outstanding
     - Fully Paid: Count of settled orders
     - Total Orders: Overall count

3. **Check Orders Table**
   - New deferred order appears in list
   - Shows: Order #, Customer, Items, Total, Paid (0), Due (full amount)
   - "Settle" button visible and clickable

4. **Filter Tests**
   - Click "All Orders" tab - shows all pending
   - Click "Overdue (24+ hrs)" tab - shows only older orders

5. **Expected Result**
   - ✅ Dashboard displays pending orders
   - ✅ Order amounts calculated correctly
   - ✅ Settle button available
   - ✅ Auto-refreshes every 30 seconds

---

## Test Scenario 3: Settle Full Payment

### Step-by-Step

1. **From Open Orders Dashboard**
   - Click "Settle" button on any pending order

2. **Payment Settlement Modal Appears**
   - Shows: Order number, total, already paid (0), due (full amount)
   - Payment amount field pre-filled with full amount due

3. **Select Payment Method**
   - Choose from: Cash, Card, Check
   - If Check: Check number field appears

4. **Enter Payment Details**
   - Amount: Leave as full due amount (e.g., $50.00)
   - Method: Select "Cash"
   - Notes: (optional) "Payment received at register"

5. **Click "Record Payment"**
   - Modal shows loading state
   - API processes settlement
   - Dashboard refreshes

6. **Verify Settlement**
   - Order row updates in real-time
   - Paid amount shows: Full amount
   - Due amount shows: $0.00
   - "Settle" button changes to "Paid" (disabled)
   - Order status likely moved to "processing"

7. **Expected Result**
   - ✅ Payment recorded successfully
   - ✅ Order moved to "processing" (no longer in pending)
   - ✅ Dashboard auto-refreshed
   - ✅ Confirmation visible in settlement form

---

## Test Scenario 4: Settle Partial Payment

### Step-by-Step

1. **Create New Deferred Order**
   - Create order for $100 or more
   - Select "Pay Later"
   - Receive deferred receipt

2. **View in Dashboard**
   - Verify order appears as pending
   - Total: $100.00, Paid: $0, Due: $100.00

3. **Partial Payment 1**
   - Click "Settle"
   - Change amount from $100 to $50
   - Select payment method: "Card"
   - Click "Record Payment"

4. **Verify Partial State**
   - Order still visible in dashboard
   - Paid: $50.00
   - Due: $50.00
   - "Settle" button still active

5. **Partial Payment 2**
   - Click "Settle" again
   - Amount pre-filled with remaining $50
   - Select method: "Cash"
   - Click "Record Payment"

6. **Verify Full Payment**
   - Payment recorded
   - Order status changed (disappears from pending list)
   - Or status shows as completed

7. **Expected Result**
   - ✅ Partial payments accepted
   - ✅ Running total updated correctly
   - ✅ Final payment moves order to processing
   - ✅ Multiple payment records created

---

## Test Scenario 5: API Testing (Advanced)

### Using curl/Postman

```bash
# 1. Create Deferred Order
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_AUTH_COOKIE" \
  -d '{
    "customerId": "CUSTOMER_ID",
    "items": [{
      "productId": "PRODUCT_ID",
      "productType": "food",
      "productName": "Margherita Pizza",
      "departmentCode": "RESTAURANT",
      "quantity": 2,
      "unitPrice": 25.00
    }],
    "payment": { "isDeferred": true }
  }'

# Response:
# {
#   "success": true,
#   "data": {
#     "id": "order-123",
#     "orderNumber": "ORD-...-ABC",
#     "status": "pending",
#     "total": 5000,
#     "payments": []
#   }
# }

# 2. Get Open Orders
curl http://localhost:3000/api/orders/open \
  -H "Cookie: YOUR_AUTH_COOKIE"

# Response:
# {
#   "success": true,
#   "data": {
#     "orders": [
#       {
#         "id": "...",
#         "orderNumber": "ORD-...",
#         "total": 5000,
#         "totalPaid": 0,
#         "amountDue": 5000,
#         ...
#       }
#     ],
#     "totalCount": 1
#   }
# }

# 3. Settle Payment
curl -X POST http://localhost:3000/api/orders/settle \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_AUTH_COOKIE" \
  -d '{
    "orderId": "order-123",
    "amount": 5000,
    "paymentMethod": "cash"
  }'

# Response:
# {
#   "success": true,
#   "data": {
#     "orderId": "order-123",
#     "orderNumber": "ORD-...",
#     "paymentAmount": 5000,
#     "totalPaid": 5000,
#     "amountDue": 0,
#     "orderStatus": "processing",
#     "isFullyPaid": true
#   }
# }
```

---

## Validation Checklist

### UI/UX Tests
- [ ] "Pay Later" button visible in payment modal
- [ ] "Pay Later" tab is distinct and clear (amber/orange color)
- [ ] Deferred receipt shows clear ⏰ PENDING PAYMENT badge
- [ ] Open Orders Dashboard loads without errors
- [ ] Summary cards calculate correctly
- [ ] Orders table displays all pending orders
- [ ] "Settle" button is interactive and responsive
- [ ] Settlement modal pre-fills amount due
- [ ] Payment method selector works
- [ ] Dashboard auto-refreshes every 30 seconds

### Data Tests
- [ ] Deferred order created with status="pending"
- [ ] NO OrderPayment record created on deferred order
- [ ] Order appears in `/api/orders/open` response
- [ ] Payment amounts calculated in cents (integers)
- [ ] Partial payments tracked correctly
- [ ] Final payment moves order to "processing"
- [ ] Customer balance calculations accurate
- [ ] Daily settlement report includes pending orders

### Permission Tests
- [ ] Staff can create deferred orders
- [ ] Cashier can view open orders
- [ ] Manager can settle payments
- [ ] Admin can do all above
- [ ] Employee cannot settle (permission denied)

### Edge Cases
- [ ] Payment amount > amount due (error message)
- [ ] Settle non-pending order (error message)
- [ ] Zero amount payment (error message)
- [ ] Missing payment method (error message)
- [ ] Network timeout (graceful error)

### Integration Tests
- [ ] Stock validation still works with deferred orders
- [ ] Discounts applied correctly to deferred orders
- [ ] Department routing works for deferred orders
- [ ] Receipt printing works for deferred orders
- [ ] Permissions from Phase 1 still enforced

---

## Common Issues & Troubleshooting

### Issue: "Pay Later" button not visible
**Solution**: 
- Verify POSPayment component was updated
- Check browser console for TypeScript errors
- Reload page (hard refresh: Ctrl+Shift+R)

### Issue: Order created but not in open orders list
**Solution**:
- Verify order status is "pending" (check database)
- Check dashboard filters (might be filtering by department)
- Manually refresh dashboard or wait 30 seconds

### Issue: Settlement shows 403 Forbidden
**Solution**:
- Verify user has "payments.process" permission
- Check user role (must be admin, manager, or cashier)
- Login as different user with proper role

### Issue: Payment amount doesn't match total
**Solution**:
- Verify prices are in cents (multiply by 100)
- Check tax calculation (10% tax applied)
- Verify discount amounts subtracted correctly

### Issue: Open Orders Dashboard blank
**Solution**:
- Check if any pending orders exist (create one first)
- Verify API returns data: `GET /api/orders/open`
- Check browser console for fetch errors
- Verify user permissions (need staff role minimum)

---

## Success Criteria

Phase 3 is **COMPLETE** when:

✅ Deferred orders can be created from POS without immediate payment  
✅ Orders appear in Open Orders Dashboard  
✅ Partial and full payments can be recorded  
✅ Order status updates correctly (pending → processing)  
✅ All calculations are accurate (cents-based)  
✅ Permissions properly enforced  
✅ No breaking changes to existing order flow  
✅ UI clearly indicates deferred status  
✅ Dashboard auto-refreshes  
✅ API endpoints tested and working  

---

## Final Validation

Run verification script:
```bash
npx tsx scripts/verify-phase-3.ts
```

Expected output:
```
===== PHASE 3: DEFERRED ORDERS VERIFICATION =====

1️⃣  Checking OrderHeader schema...
   ✅ OrderHeader has status field

2️⃣  Checking OrderPayment schema...
   ✅ OrderPayment table exists

3️⃣  Scanning for pending orders...
   ✅ Found X pending orders

4️⃣  Testing SettlementService...
   ✅ getOpenOrders(): Found X orders
   ✅ getSettlementSummary(): Total due: $X.XX

5️⃣  Verifying API endpoints...
   ✅ POST /api/orders - Supports deferred payment flag
   ✅ GET /api/orders/open - List pending orders
   ✅ POST /api/orders/settle - Record payment

6️⃣  Verifying UI components...
   ✅ POSPayment component - Has "Pay Later" button
   ✅ OpenOrdersDashboard component - Displays pending orders

7️⃣  Verifying permissions...
   ✅ Found payment-related permissions

===== VERIFICATION SUMMARY =====
✅ Phase 3 Implementation Complete

✨ Phase 3 Verification Complete!
```

---

## Next Steps

1. ✅ Complete all test scenarios above
2. ✅ Verify all success criteria met
3. ✅ Run verification script with passing results
4. ✅ Create test data for production
5. → Ready for staging deployment

All tests passing? → Phase 3 READY FOR PRODUCTION ✨
