# Discount Management Quick Reference

## Quick Start

### 1. Seed Test Discounts
```bash
npx ts-node scripts/seed-discounts.ts
```

### 2. Create a Discount (Admin)
```bash
curl -X POST http://localhost:3000/api/discounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "code": "SUMMER2025",
    "name": "Summer Special",
    "type": "percentage",
    "value": 15,
    "minOrderAmount": 1000,
    "maxUsagePerCustomer": 5,
    "applicableDepts": ["RESTAURANT"],
    "startDate": "2025-06-01T00:00:00Z",
    "endDate": "2025-08-31T23:59:59Z"
  }'
```

### 3. Validate Discount Code (Before Checkout)
```bash
curl -X POST http://localhost:3000/api/discounts/validate \
  -H "Content-Type: application/json" \
  -d '{
    "code": "SUMMER2025",
    "orderTotal": 5000,
    "customerId": "cust123",
    "departmentCode": "RESTAURANT"
  }'
```

### 4. Create Order with Discounts
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "customerId": "cust123",
    "items": [
      {
        "productId": "prod123",
        "productType": "food",
        "productName": "Burger",
        "departmentCode": "RESTAURANT",
        "quantity": 2,
        "unitPrice": 1500
      }
    ],
    "discounts": ["SUMMER2025"]
  }'
```

### 5. Discover Available Discounts

**Get all active discounts:**
```bash
curl http://localhost:3000/api/discounts/active
```

**Get discounts for a department:**
```bash
curl http://localhost:3000/api/discounts/by-department/RESTAURANT
```

**Get upcoming promotions:**
```bash
curl http://localhost:3000/api/discounts/upcoming?daysAhead=30
```

## Endpoint Map

### Management (Admin/Manager)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/discounts` | Create discount |
| GET | `/api/discounts` | List all discounts |
| GET | `/api/discounts/[id]` | Get single discount |
| PUT | `/api/discounts/[id]` | Update discount |
| DELETE | `/api/discounts/[id]` | Deactivate discount |

### Discovery (Public)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/discounts/active` | Get active discounts |
| GET | `/api/discounts/by-department/[dept]` | Discounts for department |
| GET | `/api/discounts/by-type/[type]` | Discounts of type |
| GET | `/api/discounts/upcoming` | Upcoming promotions |
| POST | `/api/discounts/validate` | Validate code |

### Order Integration
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/orders` | Create with discounts |
| POST | `/api/orders/[id]/apply-discount` | Apply discount later |
| GET | `/api/orders/[id]/discounts` | Get order's discounts |

## Common Query Examples

### List active percentage discounts
```
GET /api/discounts?isActive=true&type=percentage&limit=50
```

### Get restaurant discounts expiring soon
```
GET /api/discounts/by-department/RESTAURANT?includeInactive=false
```

### Find all bulk discounts
```
GET /api/discounts/by-type/bulk
```

### Get next 14 days of promotions
```
GET /api/discounts/upcoming?daysAhead=14
```

## Discount Types

| Type | Value Format | Example | Use Case |
|------|--------------|---------|----------|
| **percentage** | 0-100 | 15% off | Seasonal sales, loyalty |
| **fixed** | Cents | $5 off | Round amount discounts |
| **tiered** | Percentage | Volume-based | Large orders |
| **employee** | 0-100 | Staff discount | Employee meals |
| **bulk** | Cents/% | Bulk orders | Minimum purchase deals |

## Validation Checklist

When applying a discount, the system validates:

- ✅ Code exists and is active
- ✅ Within time window (startDate ≤ now ≤ endDate)
- ✅ Order meets minimum amount
- ✅ Customer hasn't exceeded per-use limit
- ✅ Global usage limit not exceeded
- ✅ Applicable to department
- ✅ Discount doesn't exceed order subtotal

## Price Examples

All prices stored/calculated in **cents** (integers).

```
Order Subtotal: 5000 cents ($50.00)
Discount: SUMMER2025 (15%)
  Discount Amount = 5000 × (15/100) = 750 cents ($7.50)
  
Discounted Subtotal: 5000 - 750 = 4250 cents ($42.50)
Tax (10%): 4250 × (10/100) = 425 cents ($4.25)

Final Total: 4250 + 425 = 4675 cents ($46.75)
```

## Response Format

All endpoints return consistent JSON:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

Or on error:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Discount code not found"
  }
}
```

## Database Fields

### DiscountRule
- `code` - Unique code (indexed, case-insensitive internally)
- `type` - percentage | fixed | tiered | employee | bulk
- `value` - Decimal(10,2) for percentage (0-100) or cents
- `isActive` - Boolean to soft-delete
- `startDate` - NULL means always available
- `endDate` - NULL means no expiration
- `minOrderAmount` - NULL means no minimum
- `maxUsagePerCustomer` - NULL means unlimited
- `maxTotalUsage` - NULL means unlimited
- `currentUsage` - Incremented on each application
- `applicableDepts` - JSON array of department codes ([] = all)

### OrderDiscount
- Links OrderHeader to DiscountRule
- Stores actual discount amount applied
- Tracks when discount was applied
- Stores rule snapshot for audit trail

## File Locations

- **Routes**: `/app/api/discounts/`
- **Service**: `/src/services/discount.service.ts`
- **Types**: `/src/types/entities.ts`
- **Schema**: `/prisma/schema.prisma` (DiscountRule, OrderDiscount)
- **Docs**: `/docs/DISCOUNT_MANAGEMENT.md`
- **Seed Script**: `/scripts/seed-discounts.ts`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Code not found | Verify code exists and is active |
| Won't apply | Check time window, minimum amount, limits |
| Wrong amount | Verify type/value, check cents vs dollars |
| Stacking issues | Validate total doesn't exceed subtotal |

## Next Steps

1. Run seed script: `npx ts-node scripts/seed-discounts.ts`
2. Test validation: `POST /api/discounts/validate`
3. Test creation: `POST /api/discounts`
4. Test order integration: `POST /api/orders` with discounts
5. Test discovery: `GET /api/discounts/active`
