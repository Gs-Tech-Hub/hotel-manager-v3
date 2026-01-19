# POS Terminals - Consolidated Implementation

## Overview
The POS system has been consolidated to use **POS Terminals** as the main concept. Each terminal is bound to a department and displays its available sections. Users select a terminal, expand it to see sections, and click on a section to start a sale.

## Architecture

### Concept
- **Terminal** = A POS device/point-of-sale unit bound to a department
- **Section** = A sales area/section within a department (e.g., "Main", "Patio", "Bar")
- Each terminal shows its department's sections
- Clicking a section opens checkout with that section pre-selected

### No Demo Data
- All data is real from the database
- Terminals must have a valid department binding
- Only active sections are displayed
- Sales summary shows real transaction data

## User Flow

### Starting a Sale

**Option 1: From Terminal Card**
1. Go to `/pos-terminals`
2. Find your terminal card
3. Click the card to expand and see sections
4. Click on a section
5. Checkout opens with that section pre-selected
6. Add items and complete sale

**Option 2: Direct Link**
- `/pos-terminals/checkout?terminal=slug&section=id`
- Terminal and section auto-select from URL params

## API Endpoints

### GET `/api/pos/terminals`
Returns all POS terminals with their sections.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "terminal-1",
      "name": "Terminal 1",
      "slug": "terminal-1",
      "status": "online",
      "departmentCode": "restaurant",
      "departmentName": "Restaurant",
      "sections": [
        {
          "id": "section-1",
          "name": "Main",
          "slug": "main",
          "departmentCode": "restaurant"
        },
        {
          "id": "section-2",
          "name": "Patio",
          "slug": "patio",
          "departmentCode": "restaurant"
        }
      ],
      "today": {
        "count": 5,
        "total": 250000
      }
    }
  ]
}
```

## Components

### POSSectionSelector
- Receives sections array from terminal data
- No API calls needed (data already fetched)
- Simpler, faster, more reliable
- Can be pre-selected from URL params

### POSCheckoutShell
- Loads terminal info on mount
- Extracts sections from terminal
- Passes sections to POSSectionSelector
- Products auto-load based on section's department

## Pages

### `/pos-terminals`
- Shows all terminals in grid
- Click terminal card to expand
- See sections inline
- Click section to open checkout

### `/pos-terminals/checkout`
- Query params: `terminal` and `section`
- Loads terminal info if not in URL
- Section selector shows only that terminal's sections
- Products load from section's department

## No Redundancy

✅ **Single source of truth**: Terminals API returns sections
❌ **Removed**: Separate sections API (not needed)
✅ **Clean data flow**: Terminal → Sections → Checkout

## Data Requirements

For a terminal to be operational:
1. Terminal must exist in database
2. Terminal must be bound to a department (departmentId)
3. Department must have sections created
4. Department must have products/menu items

## Sales Summary

Each terminal shows today's sales:
- Transaction count
- Gross total in dollars
- Automatically calculated from orderHeader table
- Shows department-wide sales (all sections combined)

## Query Parameters

- `/pos-terminals/checkout?terminal=slug` - Pre-select terminal
- `/pos-terminals/checkout?section=id` - Pre-select section
- Both can be combined for direct section access

## Implementation Status

✅ Consolidated terminals and sections
✅ Removed demo/sample data
✅ API returns real section data
✅ Terminal-based organization
✅ Clean component architecture
✅ Build successful
✅ Ready for production

---

**Last Updated**: December 2024
**Status**: Production Ready ✅
