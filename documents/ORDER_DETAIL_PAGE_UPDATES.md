# Order Detail Page - Cancel & Refund Implementation

## Updated File
`app/(dashboard)/pos/orders/[id]/page.tsx`

## New Features

### 1. Cancel Order Button
- **Visibility:** Only appears when order status is `pending`
- **Action:** Initiates cancel operation with confirmation dialog
- **Dialog Content:**
  - Warning message about inventory release
  - Confirmation buttons (Keep/Cancel)
  - Error display if cancellation fails
- **Result:** Order status changes to `cancelled`, inventory released

### 2. Refund Order Button
- **Visibility:** Only appears when:
  - Order status is `fulfilled` OR `completed`
  - Payment status is `paid` OR `partial`
- **Action:** Initiates refund operation with confirmation dialog
- **Dialog Content:**
  - Optional refund reason textarea
  - Warning about revenue reversal
  - Error display if refund fails
  - Confirmation buttons (Keep/Refund)
- **Result:** Order status changes to `refunded`, payment status to `refunded`

### 3. Status & Payment Badges
- Added payment status badge next to order status
- Color-coded statuses:
  - `pending` → Yellow
  - `processing` → Blue
  - `fulfilled`/`completed` → Green
  - `cancelled` → Red
  - `refunded` → Orange
- Payment status colors:
  - `unpaid` → Gray
  - `paid` → Green
  - `partial` → Blue
  - `refunded` → Orange

### 4. Action Buttons Layout
- **Header buttons:**
  - Back (outline)
  - Mark All Fulfilled (primary)
  - Cancel Order (destructive - conditional)
  - Refund (outline - conditional)
- Responsive layout with flex-wrap for mobile

### 5. Dialog States
- **Cancel Dialog:**
  - Shows when `cancelDialogOpen` is true
  - Displays error messages if cancel fails
  - Disables inputs during processing
- **Refund Dialog:**
  - Shows when `refundDialogOpen` is true
  - Textarea for optional refund reason
  - Error display capability
  - Disables inputs during processing

## Component State Updates

Added new state variables:
```typescript
const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
const [refundDialogOpen, setRefundDialogOpen] = useState(false);
const [cancelError, setCancelError] = useState<string | null>(null);
const [refundError, setRefundError] = useState<string | null>(null);
const [refundReason, setRefundReason] = useState("");
```

## New Handler Functions

### `handleCancelOrder()`
- Calls DELETE `/api/orders/[id]`
- Handles success: refreshes order data
- Handles errors: displays error message
- Closes dialog on success

### `handleRefundOrder()`
- Calls POST `/api/orders/[id]/refund`
- Sends optional refund reason
- Handles success: refreshes order data
- Handles errors: displays error message
- Closes dialog and clears reason on success

## API Integration

### Cancel Order
```typescript
DELETE /api/orders/[id]
Headers: Content-Type: application/json
```

### Refund Order
```typescript
POST /api/orders/[id]/refund
Headers: Content-Type: application/json
Body: {
  "reason": "string (optional)"
}
```

## Validation Rules

### Cancel Button Shows When:
```typescript
canCancel = order.status === 'pending'
```

### Refund Button Shows When:
```typescript
canRefund = (order.status === 'fulfilled' || order.status === 'completed') && 
           (order.paymentStatus === 'paid' || order.paymentStatus === 'partial')
```

### "Mark All Fulfilled" Disabled When:
```typescript
disabled={isUpdating || order.status === 'cancelled' || order.status === 'refunded'}
```

## User Experience

### Cancel Order Flow
1. User sees order with `pending` status
2. Click "Cancel Order" button
3. Confirmation dialog appears
4. User confirms cancellation
5. Order marked as `cancelled`
6. Page refreshes with updated status
7. Cancel button disappears

### Refund Order Flow
1. User sees order with `fulfilled`/`completed` status and `paid`/`partial` payment
2. Click "Refund" button
3. Refund dialog appears with optional reason field
4. User enters reason (optional) and confirms
5. Order marked as `refunded`
6. Payment status marked as `refunded`
7. Page refreshes with updated status
8. Refund button disappears

### Error Handling
- Network errors show in dialog
- Server errors (validation) show in dialog
- Dialog stays open on error
- User can retry or cancel

## Styling & UI Elements

### Dialog Components
- Uses shadcn Dialog component
- DialogHeader with title and description
- DialogFooter with action buttons
- Error alert box with icon

### Error Display
```tsx
<div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded p-3">
  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
  <p className="text-sm text-red-800">{error}</p>
</div>
```

### Button Variants
- Outline buttons for secondary actions
- Destructive buttons for dangerous actions
- Disabled state during processing
- Loading text state (e.g., "Cancelling...")

## Loading States

During API calls:
- `isUpdating` state is true
- All buttons disabled
- Dialogs remain open
- Text changes to indicate processing:
  - "Cancel Order" → "Cancelling..."
  - "Refund" → "Processing..."

## Integration Points

### Before Order Detail Page
- /api/orders/[id] GET - Fetches order

### During Order Detail Page
- /api/orders/[id]/fulfillment PUT - Updates fulfillment
- /api/orders/[id] DELETE - Cancels order
- /api/orders/[id]/refund POST - Refunds order
- /api/orders/[id] GET - Refreshes after action

## Browser Compatibility
- Uses standard fetch API
- Uses React hooks
- Uses Next.js router
- Responsive design with Tailwind CSS
- Cross-browser compatible dialog component

## Accessibility
- Dialog titles and descriptions
- Buttons with clear labels
- Error messages in aria-compatible containers
- Disabled states properly indicated
- Textarea with proper labeling

