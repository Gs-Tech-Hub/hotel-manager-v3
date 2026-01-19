# Phase 3A: Testing the API Routes

## Quick Testing Guide

### Prerequisites
```bash
# Server must be running
npm run dev

# Or build and start
npm run build
npm start
```

---

## Test Endpoints

### 1. Create Order
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-staff-1" \
  -H "x-user-role: staff" \
  -d '{
    "customerId": "customer-id-123",
    "items": [
      {
        "productId": "prod-burger-001",
        "productType": "food",
        "productName": "Burger",
        "departmentCode": "RESTAURANT",
        "quantity": 2,
        "unitPrice": 150
      },
      {
        "productId": "prod-wine-001",
        "productType": "beverage",
        "productName": "Red Wine",
        "departmentCode": "BAR_CLUB",
        "quantity": 1,
        "unitPrice": 500
      }
    ],
    "notes": "Special instructions here"
  }'
```

**Expected Response** (201):
```json
{
  "success": true,
  "data": {
    "id": "order-123",
    "orderNumber": "ORD-1234567890-ABC123",
    "customerId": "customer-id-123",
    "subtotal": 800,
    "discountTotal": 0,
    "tax": 0,
    "total": 800,
    "status": "pending",
    "notes": "Special instructions here",
    "createdAt": "2025-11-14T10:00:00Z"
  },
  "message": "Order created successfully"
}
```

---

### 2. List Orders
```bash
curl http://localhost:3000/api/orders \
  -H "x-user-id: test-staff-1" \
  -H "x-user-role: staff"
```

**Query Parameters**:
```bash
# With filters
curl "http://localhost:3000/api/orders?page=1&limit=10&status=pending&sortBy=createdAt&sortOrder=desc" \
  -H "x-user-id: test-staff-1" \
  -H "x-user-role: staff"
```

**Expected Response** (200):
```json
{
  "success": true,
  "data": {
    "orders": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3,
      "hasMore": true
    }
  }
}
```

---

### 3. Get Order Details
```bash
curl http://localhost:3000/api/orders/order-123 \
  -H "x-user-id: test-staff-1" \
  -H "x-user-role: staff"
```

**Expected Response** (200):
```json
{
  "success": true,
  "data": {
    "id": "order-123",
    "orderNumber": "ORD-1234567890-ABC123",
    "customer": {...},
    "lines": [...],
    "departments": [...],
    "discounts": [...],
    "payments": [...],
    "fulfillments": [...],
    "subtotal": 800,
    "discountTotal": 0,
    "tax": 0,
    "total": 800,
    "status": "pending"
  }
}
```

---

### 4. Apply Discount
```bash
curl -X POST http://localhost:3000/api/orders/order-123/discounts \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-staff-1" \
  -H "x-user-role: staff" \
  -d '{
    "discountCode": "SUMMER20"
  }'
```

**Expected Response** (200):
```json
{
  "success": true,
  "data": {
    "id": "order-123",
    "subtotal": 800,
    "discountTotal": 160,
    "tax": 0,
    "total": 640,
    "status": "pending"
  },
  "message": "Discount applied successfully"
}
```

---

### 5. Record Payment
```bash
curl -X POST http://localhost:3000/api/orders/order-123/payments \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-staff-1" \
  -H "x-user-role: staff" \
  -d '{
    "amount": 640,
    "paymentTypeId": "pt-credit-card",
    "transactionReference": "TXN-1234567890"
  }'
```

**Expected Response** (201):
```json
{
  "success": true,
  "data": {
    "id": "payment-456",
    "orderHeaderId": "order-123",
    "amount": 640,
    "paymentMethod": "Credit Card",
    "status": "completed",
    "transactionReference": "TXN-1234567890",
    "processedAt": "2025-11-14T10:05:00Z"
  },
  "message": "Payment recorded successfully"
}
```

---

### 6. Get Payment History
```bash
curl http://localhost:3000/api/orders/order-123/payments \
  -H "x-user-id: test-staff-1" \
  -H "x-user-role: staff"
```

**Expected Response** (200):
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "payment-456",
        "amount": 640,
        "paymentType": {...},
        "status": "completed",
        "createdAt": "2025-11-14T10:05:00Z"
      }
    ],
    "summary": {
      "orderTotal": 640,
      "totalPaid": 640,
      "remaining": 0,
      "paymentStatus": "paid"
    }
  }
}
```

---

### 7. Get Fulfillment Status
```bash
curl http://localhost:3000/api/orders/order-123/fulfillment \
  -H "x-user-id: test-staff-1" \
  -H "x-user-role: staff"
```

**Expected Response** (200):
```json
{
  "success": true,
  "data": {
    "order": {...},
    "fulfillmentSummary": {
      "totalLines": 2,
      "fulfilledLines": 0,
      "processingLines": 0,
      "pendingLines": 2,
      "fulfillmentPercentage": 0
    }
  }
}
```

---

### 8. Update Fulfillment
```bash
curl -X PUT http://localhost:3000/api/orders/order-123/fulfillment \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-staff-1" \
  -H "x-user-role: staff" \
  -d '{
    "lineItemId": "line-1",
    "status": "processing",
    "notes": "Preparing in kitchen"
  }'
```

**Expected Response** (200):
```json
{
  "success": true,
  "data": {
    "id": "order-123",
    "lines": [
      {
        "id": "line-1",
        "status": "processing",
        "fulfillments": [...]
      }
    ],
    "fulfillmentSummary": {
      "totalLines": 2,
      "fulfilledLines": 0,
      "processingLines": 1,
      "pendingLines": 1,
      "fulfillmentPercentage": 50
    }
  },
  "message": "Fulfillment status updated successfully"
}
```

---

### 9. Cancel Order
```bash
curl -X DELETE http://localhost:3000/api/orders/order-123 \
  -H "x-user-id: test-manager-1" \
  -H "x-user-role: manager"
```

**Expected Response** (200):
```json
{
  "success": true,
  "data": {
    "id": "order-123",
    "status": "cancelled"
  },
  "message": "Order cancelled successfully"
}
```

---

### 10. Remove Discount
```bash
curl -X DELETE http://localhost:3000/api/orders/order-123/discounts/discount-1 \
  -H "x-user-id: test-staff-1" \
  -H "x-user-role: staff"
```

**Expected Response** (200):
```json
{
  "success": true,
  "data": {
    "id": "order-123",
    "subtotal": 800,
    "discountTotal": 0,
    "total": 800,
    "status": "pending"
  },
  "message": "Discount removed successfully"
}
```

---

## Error Test Cases

### Invalid Customer
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-staff-1" \
  -H "x-user-role: staff" \
  -d '{
    "customerId": "nonexistent-customer",
    "items": [...]
  }'
```

**Expected Response** (404):
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Customer not found"
  }
}
```

---

### Insufficient Permissions
```bash
curl -X DELETE http://localhost:3000/api/orders/order-123 \
  -H "x-user-id: test-customer-1" \
  -H "x-user-role: customer"
```

**Expected Response** (403):
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Only managers/admins can cancel orders"
  }
}
```

---

### Missing Required Field
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-staff-1" \
  -H "x-user-role: staff" \
  -d '{
    "items": [...]
  }'
```

**Expected Response** (400):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "customerId is required"
  }
}
```

---

### Not Authenticated
```bash
curl http://localhost:3000/api/orders
```

**Expected Response** (401):
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Not authenticated"
  }
}
```

---

## Using Postman/Insomnia

### Import Collection

Create a new collection with these requests:

1. **Create Order** - POST /api/orders
2. **List Orders** - GET /api/orders
3. **Get Order** - GET /api/orders/{id}
4. **Update Order** - PUT /api/orders/{id}
5. **Cancel Order** - DELETE /api/orders/{id}
6. **Apply Discount** - POST /api/orders/{id}/discounts
7. **Remove Discount** - DELETE /api/orders/{id}/discounts/{id}
8. **Record Payment** - POST /api/orders/{id}/payments
9. **Get Payments** - GET /api/orders/{id}/payments
10. **Get Fulfillment** - GET /api/orders/{id}/fulfillment
11. **Update Fulfillment** - PUT /api/orders/{id}/fulfillment

### Headers for All Requests
```
Content-Type: application/json
x-user-id: test-staff-1
x-user-role: staff
```

### Different Roles to Test
```
Staff:     x-user-role: staff
Manager:   x-user-role: manager
Admin:     x-user-role: admin
Customer:  x-user-role: customer
```

---

## Complete Order Workflow Test

```bash
# 1. Create order
ORDER_ID=$(curl -s -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "x-user-id: staff-1" \
  -H "x-user-role: staff" \
  -d '{
    "customerId": "cust-1",
    "items": [
      {"productId": "prod-1", "productType": "food", "productName": "Burger", 
       "departmentCode": "RESTAURANT", "quantity": 1, "unitPrice": 300}
    ]
  }' | jq -r '.data.id')

# 2. Apply discount
curl -X POST http://localhost:3000/api/orders/$ORDER_ID/discounts \
  -H "Content-Type: application/json" \
  -H "x-user-id: staff-1" \
  -H "x-user-role: staff" \
  -d '{"discountCode": "SUMMER20"}'

# 3. Record payment
curl -X POST http://localhost:3000/api/orders/$ORDER_ID/payments \
  -H "Content-Type: application/json" \
  -H "x-user-id: staff-1" \
  -H "x-user-role: staff" \
  -d '{
    "amount": 240,
    "paymentTypeId": "pt-cash"
  }'

# 4. Update fulfillment
curl -X PUT http://localhost:3000/api/orders/$ORDER_ID/fulfillment \
  -H "Content-Type: application/json" \
  -H "x-user-id: staff-1" \
  -H "x-user-role: staff" \
  -d '{"lineItemId": "line-1", "status": "fulfilled"}'

# 5. Get final state
curl http://localhost:3000/api/orders/$ORDER_ID \
  -H "x-user-id: staff-1" \
  -H "x-user-role: staff"
```

---

## Expected Results

| Test | Status | Result |
|------|--------|--------|
| Create Order | 201 | Order created with pending status |
| List Orders | 200 | Orders with pagination |
| Get Order | 200 | Complete order with relationships |
| Update Order | 200 | Order metadata updated |
| Apply Discount | 200 | Order total recalculated |
| Record Payment | 201 | Payment recorded, status updated to processing |
| Get Payments | 200 | Payment history with summary |
| Update Fulfillment | 200 | Line status updated, percentage calculated |
| Cancel Order | 200 | Order cancelled, inventory released |
| Remove Discount | 200 | Discount removed, total recalculated |
| Error Cases | 400/401/403/404 | Proper error responses |

---

## Debugging Tips

1. **Check headers** - Ensure x-user-id and x-user-role are set
2. **Check IDs** - Use actual IDs from create responses
3. **Use jq** - Parse JSON responses: `... | jq '.data'`
4. **Check order status** - GET /api/orders/{id} to see current state
5. **Check payments** - GET /api/orders/{id}/payments to verify payments
6. **Check fulfillment** - GET /api/orders/{id}/fulfillment to see progress

---

**All 11 endpoints are ready for testing!** ✅
