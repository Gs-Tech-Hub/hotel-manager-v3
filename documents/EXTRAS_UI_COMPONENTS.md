# UI Components - Extras Feature Implementation

## Overview
Complete React component suite for the extras feature, enabling restaurant terminal staff to add and display supplementary items on orders.

## Components Created

### 1. OrderExtrasDialog
**File:** `components/pos/orders/OrderExtrasDialog.tsx`

**Purpose:** Modal dialog for staff to add extras to order lines

**Key Features:**
- Fetches available extras from `/api/extras` endpoint
- Real-time quantity input with validation (0-999)
- Live price calculation as quantities change
- Department-scoped extras filtering (optional)
- Shows extra description and unit type
- Validates at least one extra selected before submit
- Posts to `/api/extras/order-lines` endpoint
- Toast notifications for success/error feedback
- Calls onSuccess callback to trigger parent refresh

**Props:**
```typescript
interface OrderExtrasDialogProps {
  open: boolean;                    // Dialog visibility
  onOpenChange: (open: boolean) => void;  // Close handler
  orderHeaderId: string;             // Parent order ID
  orderLineId: string;               // Which line gets extras
  departmentCode?: string;           // Optional filtering
  onSuccess?: () => void;            // Refresh callback
}
```

**Usage Example:**
```tsx
const [dialogOpen, setDialogOpen] = useState(false);

<OrderExtrasDialog
  open={dialogOpen}
  onOpenChange={setDialogOpen}
  orderHeaderId="order-123"
  orderLineId="line-456"
  departmentCode="kitchen"
  onSuccess={() => refetchOrderDetails()}
/>
```

**Key Implementation Details:**
- State: `selectedExtras` (Map), `loading`, `submitting`
- Fetches extras on dialog open via useEffect
- Quantity input validation: 1-999 range
- Disabled submit button until extras selected
- Error handling with toast notifications
- Uses shadcn/ui components: Dialog, Button, Input, ScrollArea, Badge

### 2. OrderLineExtras
**File:** `components/pos/orders/OrderLineExtras.tsx`

**Purpose:** Display extras already added to an order line

**Key Features:**
- Automatically fetches extras for specific order line
- Shows extras in collapsible card format
- Displays: name, unit, quantity, unit price, total price
- Shows status badge (pending, processing, fulfilled, cancelled)
- One-click removal with confirmation dialog
- Calculates and displays extras subtotal
- Hides automatically if no active extras
- Real-time updates with onExtrasChanged callback
- Loading state with spinner

**Props:**
```typescript
interface OrderLineExtrasProps {
  orderLineId: string;           // Which line to display
  orderHeaderId: string;         // Parent order ID
  onExtrasChanged?: () => void;  // Refresh callback when extras change
}
```

**Usage Example:**
```tsx
<OrderLineExtras
  orderLineId="line-456"
  orderHeaderId="order-123"
  onExtrasChanged={() => refetchOrderDetails()}
/>
```

**Key Implementation Details:**
- State: `extras`, `loading`, `removing`, `deleteDialogOpen`
- Fetches extras on mount and when orderLineId changes
- Filters out cancelled extras from display
- DELETE action sets status to 'cancelled' (soft delete)
- Calculates active extras count for badge
- Uses AlertDialog for removal confirmation
- Shows status-based color coding

**Status Color Coding:**
- **Pending:** Yellow badge (not yet started)
- **Processing:** Blue badge (in progress)
- **Fulfilled:** Green badge (completed)
- **Cancelled:** Gray badge (removed/voided)

## Integration Points

### Order Detail Page
**File:** `app/(dashboard)/pos/orders/[id]/page.tsx`

**Required Changes:**
```typescript
// 1. Import components
import { OrderExtrasDialog } from '@/components/pos/orders/OrderExtrasDialog';
import { OrderLineExtras } from '@/components/pos/orders/OrderLineExtras';

// 2. Add state for dialog control
const [extrasDialogOpen, setExtrasDialogOpen] = useState(false);
const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

// 3. For each OrderLine item, add:
<OrderLineExtras
  orderLineId={line.id}
  orderHeaderId={order.id}
  onExtrasChanged={() => refetchOrder()}
/>

// 4. Add "Add Extras" button per line:
<Button
  variant="outline"
  size="sm"
  onClick={() => {
    setSelectedLineId(line.id);
    setExtrasDialogOpen(true);
  }}
>
  + Add Extras
</Button>

// 5. Render dialog at page level:
<OrderExtrasDialog
  open={extrasDialogOpen}
  onOpenChange={setExtrasDialogOpen}
  orderHeaderId={order.id}
  orderLineId={selectedLineId || ''}
  onSuccess={() => refetchOrder()}
/>
```

## API Integration

### Fetch Available Extras
**Endpoint:** `GET /api/extras`

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "id": "extra-1",
      "name": "Extra Sauce",
      "unit": "pump",
      "price": 150,
      "departmentId": "dept-1",
      "description": "Additional sauce serving",
      "isActive": true
    }
  ]
}
```

### Add Extras to Order Line
**Endpoint:** `POST /api/extras/order-lines`

**Request Body:**
```json
{
  "orderHeaderId": "order-123",
  "orderLineId": "line-456",
  "extras": [
    {
      "extraId": "extra-1",
      "quantity": 2
    },
    {
      "extraId": "extra-3",
      "quantity": 1
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "orderextra-1",
      "orderHeaderId": "order-123",
      "orderLineId": "line-456",
      "extraId": "extra-1",
      "quantity": 2,
      "unitPrice": 150,
      "lineTotal": 300,
      "status": "pending"
    }
  ]
}
```

### Fetch Order Extras
**Endpoint:** `GET /api/orders/[id]/extras`

**Query Parameters:**
- `orderLineId` (optional) - Filter by specific line

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "orderextra-1",
      "orderHeaderId": "order-123",
      "orderLineId": "line-456",
      "extraId": "extra-1",
      "quantity": 2,
      "unitPrice": 150,
      "lineTotal": 300,
      "status": "pending",
      "extra": {
        "id": "extra-1",
        "name": "Extra Sauce",
        "unit": "pump",
        "price": 150
      }
    }
  ]
}
```

### Cancel Extra
**Endpoint:** `PATCH /api/orders/[id]/extras/[extraId]`

**Request Body:**
```json
{
  "status": "cancelled"
}
```

## Data Flow

### Adding Extras
```
1. Staff clicks "Add Extras" button on order line
   ↓
2. OrderExtrasDialog opens
   ↓
3. Component fetches available extras (GET /api/extras)
   ↓
4. Staff selects quantities for desired extras
   ↓
5. Real-time calculation updates price
   ↓
6. Staff submits (POST /api/extras/order-lines)
   ↓
7. Dialog closes on success
   ↓
8. onSuccess callback triggers parent refresh
   ↓
9. OrderLineExtras component re-fetches and displays new extras
```

### Displaying Extras
```
1. Order detail page renders
   ↓
2. For each OrderLine, OrderLineExtras component mounts
   ↓
3. Component fetches extras (GET /api/orders/[id]/extras?orderLineId=...)
   ↓
4. Displays active extras in card format
   ↓
5. Shows status badges, quantities, prices
   ↓
6. Calculates and shows extras subtotal
```

### Removing Extras
```
1. Staff clicks trash icon on extra
   ↓
2. Confirmation dialog appears
   ↓
3. Staff confirms removal
   ↓
4. Component POSTs status change (PATCH /api/orders/[id]/extras/[id])
   ↓
5. Extra marked as 'cancelled' (soft delete)
   ↓
6. Local state updates, extra hidden from display
   ↓
7. onExtrasChanged callback triggers parent refresh
```

## Price Handling

**Important:** All prices stored as integers in cents

**Conversion:**
- Database: 150 (cents) = $1.50
- Display: `formatPrice(150 / 100)` = "$1.50"
- Calculation: `quantity * unitPrice` = quantity * cents

**Example:**
```typescript
// Extra: 2 units of $1.50 pump
const unitPrice = 150;  // cents
const quantity = 2;
const lineTotal = quantity * unitPrice;  // 300 cents = $3.00
formatPrice(lineTotal / 100)  // "$3.00"
```

## Error Handling

### Component Error States
- **Fetch Failure:** Toast: "Failed to load extras for this line"
- **Add Failure:** Toast: "Failed to add extras to order"
- **Remove Failure:** Toast: "Failed to remove extra"
- **Invalid Input:** Toast: "Please select at least one extra"

### API Error Responses
- **400 Bad Request:** Invalid extras array or quantities
- **404 Not Found:** Order/line/extra not found
- **401 Unauthorized:** User not authenticated
- **403 Forbidden:** User lacks permission

## Testing Checklist

- [ ] OrderExtrasDialog opens/closes correctly
- [ ] Available extras fetch and display
- [ ] Quantity inputs validate (1-999 range)
- [ ] Price calculation updates in real-time
- [ ] Submit disabled until extras selected
- [ ] Extras POST successfully to API
- [ ] OrderLineExtras fetches on mount
- [ ] Extras display with all details
- [ ] Remove button triggers confirmation dialog
- [ ] Extra removal updates local state
- [ ] onSuccess/onExtrasChanged callbacks fire
- [ ] Loading states show spinners
- [ ] Error states show toast notifications
- [ ] Cancelled extras don't display
- [ ] Subtotal calculates correctly
- [ ] Status badges show correct colors

## Future Enhancements

1. **Batch Operations:** Add extras to multiple lines at once
2. **Quick Add:** Preset combinations of common extras
3. **Edit Quantity:** Modify quantity of already-added extras in-place
4. **Popular Extras:** Show top 3-5 most-used extras first
5. **Favorites:** Staff can mark frequently-used extras as favorites
6. **Department Filters:** Pre-filter based on order line's department
7. **Bulk Remove:** Remove all extras from a line in one action
8. **Analytics:** Dashboard showing most-ordered extras per department

---

**Last Updated:** December 30, 2025
