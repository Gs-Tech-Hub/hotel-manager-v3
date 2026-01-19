# Extras Feature - Quick Reference

## What are Extras?

Extras are supplementary items with units for restaurant orders. Examples:
- Extra sauce container
- Extra portion
- Topping
- Side dish

## Quick Setup

### 1. Create an Extra
```bash
curl -X POST http://localhost:3000/api/extras \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Extra BBQ Sauce",
    "unit": "container",
    "price": 150,
    "departmentId": "dept_restaurant"
  }'
```

### 2. List Available Extras
```bash
curl http://localhost:3000/api/extras?departmentId=dept_restaurant
```

### 3. Add Extras to an Order
```bash
curl -X POST http://localhost:3000/api/extras/order-lines \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "orderHeaderId": "order_123",
    "orderLineId": "line_456",
    "extras": [
      { "extraId": "extra_789", "quantity": 2 }
    ]
  }'
```

### 4. View Order Extras
```bash
curl http://localhost:3000/api/orders/order_123/extras \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## API Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | /api/extras | List extras | Any |
| POST | /api/extras | Create extra | admin, manager |
| GET | /api/extras/[id] | Get extra | Any |
| PATCH | /api/extras/[id] | Update extra | admin, manager |
| DELETE | /api/extras/[id] | Delete extra | admin, manager |
| POST | /api/extras/order-lines | Add extras to order | admin, manager, staff |
| GET | /api/orders/[id]/extras | View order extras | admin, manager, staff |

## Key Models

### Extra
- `id`: Unique identifier
- `name`: Display name
- `unit`: Measurement unit (portion, container, piece, pump)
- `price`: Price in cents
- `departmentId`: (Optional) Department scope
- `isActive`: Active/inactive status

### OrderExtra
- `id`: Unique identifier
- `orderHeaderId`: Parent order
- `orderLineId`: (Optional) Parent order line
- `extraId`: Reference to Extra
- `quantity`: Number of units
- `unitPrice`: Price snapshot (in cents)
- `lineTotal`: Total cost (quantity × unitPrice)
- `status`: pending, processing, fulfilled, cancelled

## Pricing
All prices are in **cents** (integers):
- $2.50 → 250
- $1.25 → 125
- $0.50 → 50

## Database
Tables created by migration `20251230141239_add_extras_to_orders`:
- `extras` - Extra definitions
- `order_extras` - Extras added to orders

## Service Layer

Use `ExtrasService` from `src/services/extras.service.ts`:

```typescript
import { extrasService } from '@/src/services/extras.service';

// Create extra
const extra = await extrasService.createExtra({
  name: 'Extra Sauce',
  unit: 'container',
  price: 150,
  departmentId: 'dept_123'
});

// Get extras for department
const extras = await extrasService.getExtrasForDepartment('dept_123');

// Add extras to order
const orderExtras = await extrasService.addExtrasToOrderLine({
  orderHeaderId: 'order_123',
  orderLineId: 'line_456',
  extras: [
    { extraId: 'extra_789', quantity: 2 }
  ]
});

// Get order extras
const extras = await extrasService.getOrderExtras('order_123');

// Calculate total cost of extras
const total = await extrasService.calculateExtrasTotal('order_123');

// Get stats
const stats = await extrasService.getExtrasStats('dept_123');
```

## Restaurant Terminal Integration

### Adding Extras - User Flow

1. Staff selects item for order
2. Order line created
3. Staff clicks "Add Extras" button
4. Modal shows available extras
5. Staff selects quantity for each extra
6. Confirms → extras added to order line
7. Extra cost added to order total

### Kitchen Display System (KDS)

Extras should display alongside order items:
```
Main Item: Grilled Chicken
  └─ Extra: BBQ Sauce (1 container)
  └─ Extra: Extra Portion (1 piece)
```

## Status Flow

```
pending ─→ processing ─→ fulfilled
    ↓ (if needed)
cancelled
```

## Common Tasks

### Check extras for an order
```bash
GET /api/orders/order_123/extras
```

### Update extra price
```bash
PATCH /api/extras/extra_789 \
  -d '{ "price": 200 }'
```

### Add multiple extras at once
```bash
POST /api/extras/order-lines
{
  "orderHeaderId": "order_123",
  "orderLineId": "line_456",
  "extras": [
    { "extraId": "sauce_1", "quantity": 1 },
    { "extraId": "sauce_2", "quantity": 1 },
    { "extraId": "sides_1", "quantity": 2 }
  ]
}
```

### Deactivate an extra
```bash
DELETE /api/extras/extra_789
```

## Access Control

- **View Extras**: Any authenticated user
- **Create/Update/Delete Extras**: admin, manager only
- **Add Extras to Orders**: admin, manager, staff
- **View Order Extras**: admin, manager, staff

## Files Created/Modified

### New Files
- `src/services/extras.service.ts` - Service layer
- `app/api/extras/route.ts` - Main extras endpoint
- `app/api/extras/[id]/route.ts` - Single extra endpoint
- `app/api/extras/order-lines/route.ts` - Add extras endpoint
- `app/api/orders/[id]/extras/route.ts` - Order extras endpoint
- `docs/EXTRAS_FEATURE_GUIDE.md` - Full documentation

### Modified Files
- `prisma/schema.prisma` - Added Extra & OrderExtra models
- `prisma/migrations/` - Migration SQL

## Troubleshooting

### Extras not showing
- Check `isActive` flag is true
- Verify departmentId matches (if filtered)
- Ensure user has auth token

### Order total not updated
- Ensure extras are included in subtotal calculation
- Check status is not 'cancelled'

### Permission denied
- Verify user role (admin, manager, or staff)
- Check auth token in header

---

**For detailed documentation, see:** `docs/EXTRAS_FEATURE_GUIDE.md`
