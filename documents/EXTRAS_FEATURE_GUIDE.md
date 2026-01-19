# Extras Feature Implementation

## Overview

The **Extras** feature adds support for supplementary items in restaurant orders. Extras are items with units (portions, containers, pieces, etc.) that can be added to order lines at the terminal.

**Purpose:** Allows restaurant staff to quickly add additional items like side dishes, sauces, extra portions, toppings, etc., to existing orders.

## Data Structure

### Extra Model
```typescript
model Extra {
  id           String          // Unique ID
  name         String          // Display name (e.g., "Extra Sauce", "Extra Portion")
  description  String?         // Optional description
  unit         String          // Unit type (e.g., "portion", "container", "piece", "pump")
  price        Int             // Price in cents (for consistency with system)
  isActive     Boolean         // Active/inactive status
  departmentId String?         // Optional: scope to specific department
  
  // Relations
  department   Department?     // Associated department (optional)
  orderExtras  OrderExtra[]    // Order extras using this extra
  
  createdAt    DateTime
  updatedAt    DateTime
}
```

### OrderExtra Model
```typescript
model OrderExtra {
  id           String          // Unique ID
  orderHeaderId String         // Link to parent order
  orderHeader  OrderHeader     // Parent order reference
  
  orderLineId String?          // Optional: link to specific order line
  orderLine    OrderLine?      // Optional: order line this extra belongs to
  
  extraId      String          // Reference to Extra
  extra        Extra           // Extra details
  
  quantity     Int             // Number of units
  unitPrice    Int             // Price per unit in cents (snapshot at order time)
  lineTotal    Int             // quantity * unitPrice (in cents)
  
  status       String          // pending, processing, fulfilled, cancelled
  notes        String?         // Optional notes
  
  createdAt    DateTime
  updatedAt    DateTime
}
```

## API Endpoints

### Extras Management

#### GET /api/extras
List all extras optionally filtered by department.

**Query Parameters:**
- `departmentId` (optional): Filter by specific department
- `includeInactive` (optional): Include inactive extras (default: false)

**Response:**
```json
{
  "success": true,
  "data": {
    "extras": [
      {
        "id": "extra_123",
        "name": "Extra Sauce",
        "unit": "container",
        "price": 250,
        "isActive": true,
        "departmentId": "dept_456",
        "department": {
          "id": "dept_456",
          "code": "RESTAURANT",
          "name": "Restaurant"
        }
      }
    ]
  }
}
```

#### POST /api/extras
Create a new extra (admin/manager only).

**Required Fields:**
- `name` (string): Extra name
- `unit` (string): Unit type

**Optional Fields:**
- `description` (string): Description
- `price` (number): Price in cents (default: 0)
- `departmentId` (string): Department ID
- `isActive` (boolean): Active status (default: true)

**Response:** Returns created extra object

#### GET /api/extras/[id]
Get a specific extra by ID.

**Response:** Returns single extra object

#### PATCH /api/extras/[id]
Update an extra (admin/manager only).

**Updates:** Any of the fields from POST request

**Response:** Returns updated extra object

#### DELETE /api/extras/[id]
Delete an extra (soft delete via isActive=false) (admin/manager only).

**Response:** Returns updated extra object with isActive=false

### Order Extras

#### POST /api/extras/order-lines
Add extras to an order line.

**Request Body:**
```json
{
  "orderHeaderId": "order_123",
  "orderLineId": "line_456",
  "extras": [
    { "extraId": "extra_789", "quantity": 2 },
    { "extraId": "extra_790", "quantity": 1 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderExtras": [
      {
        "id": "orderextra_123",
        "orderHeaderId": "order_123",
        "orderLineId": "line_456",
        "extraId": "extra_789",
        "quantity": 2,
        "unitPrice": 250,
        "lineTotal": 500,
        "status": "pending",
        "extra": {
          "id": "extra_789",
          "name": "Extra Sauce",
          "unit": "container",
          "price": 250
        }
      }
    ]
  }
}
```

#### GET /api/orders/[id]/extras
Get all extras for a specific order.

**Response:** Returns array of order extras with full details

## Service Layer (ExtrasService)

Located at: `src/services/extras.service.ts`

### Key Methods

#### createExtra(data, ctx)
Create a new extra with validation.
- Validates price normalization to cents
- Verifies department exists if provided
- Returns created extra

#### getExtrasForDepartment(departmentId, includeInactive)
Get all extras for a specific department.

#### getAllExtras(includeInactive)
Get all extras across all departments.

#### getExtra(extraId)
Get a single extra by ID.

#### updateExtra(extraId, data)
Update an extra with price validation.

#### deleteExtra(extraId)
Soft delete an extra (sets isActive=false).

#### addExtrasToOrderLine(data)
Add extras to a specific order line.
- Validates order header and line exist
- Validates extra records exist
- Calculates line totals (quantity * unitPrice)
- Returns array of created OrderExtra records

#### getOrderExtras(orderHeaderId)
Get all extras for an order with complete details.

#### getLineExtras(orderLineId)
Get all extras for a specific order line.

#### updateOrderExtraStatus(orderExtraId, status)
Update the status of an order extra.
- Valid statuses: pending, processing, fulfilled, cancelled

#### calculateExtrasTotal(orderHeaderId)
Calculate total cost of all extras for an order (excluding cancelled items).

#### getExtrasStats(departmentId?)
Get usage statistics for extras.
- Total extras sold
- Most popular extras
- Revenue breakdown

## Usage Examples

### Adding Extras to an Order

1. **Create extras first (if not already created):**
```typescript
// POST /api/extras
{
  "name": "Extra BBQ Sauce",
  "unit": "container",
  "price": 150,
  "departmentId": "dept_restaurant"
}
```

2. **Add extras to an order line:**
```typescript
// POST /api/extras/order-lines
{
  "orderHeaderId": "order_123",
  "orderLineId": "line_456",
  "extras": [
    { "extraId": "extra_sauce", "quantity": 1 }
  ]
}
```

3. **Retrieve order with extras:**
```typescript
// GET /api/orders/order_123/extras
// Returns all extras added to this order
```

### Restaurant Terminal Workflow

1. Staff selects an item (main dish)
2. Item is added to order line
3. Staff can now add extras (sauce, portions, toppings) to the line
4. Each extra has:
   - Name (displayed to customer)
   - Unit (how it's measured)
   - Price (cost added to order total)
   - Status tracking (pending → processing → fulfilled)

## Price Handling

**Important:** All prices follow the system-wide price consistency standard:
- Stored as integers (cents)
- No decimal points in database
- All calculations use integer arithmetic
- Display formatting handled at UI layer

Example:
- $2.50 → 250 (cents)
- $1.25 → 125 (cents)

## Database Changes

### Migration: `20251230141239_add_extras_to_orders`

**Tables Created:**
1. `extras` - Stores extra item definitions
2. `order_extras` - Stores extras added to orders

**Relations Added:**
- Department → Extra (one-to-many)
- OrderHeader → OrderExtra (one-to-many)
- OrderLine → OrderExtra (one-to-many)

## Access Control

### Permissions

| Endpoint | Method | Required Role | Description |
|----------|--------|---------------|-------------|
| /api/extras | GET | Any authenticated | View available extras |
| /api/extras | POST | admin, manager | Create new extra |
| /api/extras/[id] | GET | Any authenticated | View single extra |
| /api/extras/[id] | PATCH | admin, manager | Update extra |
| /api/extras/[id] | DELETE | admin, manager | Delete extra |
| /api/extras/order-lines | POST | admin, manager, staff | Add extras to order |
| /api/orders/[id]/extras | GET | admin, manager, staff | View order extras |

## Status Flow

Order extras follow the same status flow as regular order lines:

```
pending → processing → fulfilled → (complete)
                    ↓
                 cancelled
```

## Integration with Order System

### Order Total Calculation

When calculating order totals, include extras:

```typescript
// Subtotal = sum of order lines + sum of order extras
const subtotal = orderLines.reduce((sum, line) => sum + line.lineTotal, 0)
                + orderExtras.reduce((sum, extra) => sum + extra.lineTotal, 0);
```

### Inventory Integration

Extras can be linked to inventory if needed:
- Track extras as consumed inventory
- Manage extras stock separately per department
- Optional: Set up stock reservations for extras

### Fulfillment Integration

Extras status should be updated alongside their parent order line:
- When line status changes, update extras accordingly
- Kitchen display system can show extras alongside main items
- Fulfillment tracking per extra (if needed)

## UI Implementation Notes

### Display Extras in Order Detail Page

```tsx
// Show extras grouped by order line
<div>
  {orderLines.map(line => (
    <div key={line.id}>
      <h4>{line.productName}</h4>
      
      {/* Extras for this line */}
      {extras.filter(e => e.orderLineId === line.id).map(extra => (
        <div key={extra.id}>
          <span>{extra.extra.name} ({extra.quantity} {extra.extra.unit})</span>
          <span>${(extra.lineTotal / 100).toFixed(2)}</span>
        </div>
      ))}
    </div>
  ))}
</div>
```

### Terminal UI for Adding Extras

```tsx
// Quick access to extras when editing order line
<dialog>
  <h3>Add Extras to {orderLine.productName}</h3>
  {availableExtras.map(extra => (
    <div key={extra.id}>
      <label>
        <input
          type="number"
          min="0"
          placeholder="Qty"
          onChange={(e) => setQuantity(extra.id, e.target.value)}
        />
        {extra.name} - ${(extra.price / 100).toFixed(2)} each
      </label>
    </div>
  ))}
  <button onClick={addExtras}>Add Selected Extras</button>
</dialog>
```

## Testing Checklist

- [ ] Create extra via POST /api/extras
- [ ] List extras via GET /api/extras
- [ ] Filter extras by department
- [ ] Update extra via PATCH /api/extras/[id]
- [ ] Delete extra via DELETE /api/extras/[id]
- [ ] Add extras to order line via POST /api/extras/order-lines
- [ ] Retrieve order extras via GET /api/orders/[id]/extras
- [ ] Verify price calculations (cents)
- [ ] Verify status tracking
- [ ] Verify RBAC (auth checks)
- [ ] Verify order total includes extras
- [ ] Test with multiple extras per line
- [ ] Test with multiple extras per order

## Future Enhancements

1. **Extras Categories** - Group extras by type (sauces, sides, toppings)
2. **Extras Modifiers** - Apply extras to specific items only
3. **Stock Tracking** - Track extras inventory per department
4. **Preset Extras Sets** - Pre-configured extras for quick ordering
5. **Nutrition Info** - Store nutritional data with extras
6. **Allergen Info** - Track allergens in extras
7. **Images** - Add visual display of extras
8. **Printing** - Include extras on receipt/kitchen tickets

---

**Last Updated:** December 30, 2025
