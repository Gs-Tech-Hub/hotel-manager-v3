# POS Sections - Quick Start Guide

## Overview
The POS terminal system now displays sections (sales areas) and allows quick initiation of sales on them. Sections are typically restaurant areas, bars, lounges, etc.

## Quick Access Routes

| Route | Purpose |
|-------|---------|
| `/pos-terminals` | POS Management Hub (Terminals & Sections) |
| `/pos-terminals/[id]/checkout` | Open specific terminal |
| `/pos-terminals/checkout?section=...` | Start sale on specific section |

## Step-by-Step: Starting a Sale

### Method 1: Via Terminals Tab
1. Navigate to `/pos-terminals`
2. Go to **Terminals** tab (default)
3. Find your terminal and click **"Open Terminal"**
4. Section selector will open
5. Select your section from dropdown
6. Products load automatically → Add items → Checkout

### Method 2: Via Sections Tab (Fastest)
1. Navigate to `/pos-terminals`
2. Click **"Sections"** tab
3. Find your section
4. Click **"Start Sale"** button
5. Redirected to checkout with section pre-selected
6. Add items → Checkout

### Method 3: Direct Bookmark/Link
- Bookmark: `/pos-terminals/checkout?section=your-section-id`
- One-click access to specific section

## Features at a Glance

### Section Selector Dropdown
- Shows all available sections
- Displays today's transaction count
- Displays today's total sales
- Auto-selects first section by default
- Dropdown closes after selection

### Sections Dashboard
- **Terminals Tab**: View all configured POS terminals
  - See associated sections
  - View today's sales per terminal
  - Quick "Open Terminal" button
  
- **Sections Tab**: View all sales areas
  - See today's transaction count
  - See today's gross total
  - Quick "Start Sale" button per section

### Sales Summary
- Always shows selected section's name
- Displays today's transaction count
- Displays today's gross total
- Refresh button to update in real-time

## What Gets Loaded

When you select a section:
1. ✅ Department products/menu loads automatically
2. ✅ Category filter applies to section's items
3. ✅ Today's sales summary updates
4. ✅ Cart resets for new transaction
5. ✅ Discount codes can be applied

## Keyboard Shortcuts (for POS Terminal)

- **Tab** - Navigate between elements
- **Enter** - Select section or confirm
- **Esc** - Close dropdown
- **+** - Add quantity
- **-** - Reduce quantity

## Troubleshooting

### Sections Not Loading
- Check network connection
- Verify sections are marked as "Active" in department settings
- Refresh page (F5)

### No Products Available
- Ensure department has products assigned
- Check product "Available" status
- Verify product prices are set

### Sales Summary Not Updating
- Click "Refresh" button in sales summary card
- Wait 5 seconds for data to load

## Pro Tips

💡 **Bookmark your section**: Add `/pos-terminals/checkout?section=section-id` to bookmarks for instant access

💡 **Check performance**: Use Sections tab to see top-performing sections

💡 **Fast switching**: Section selector keeps dropdown visible - select new section without reloading

💡 **Mobile-friendly**: All buttons are touch-optimized for POS terminal screens

💡 **Dark mode**: Automatically respects system dark mode preference

## Data Displayed

### Per Section
- Section name
- Department name
- Today's transaction count
- Today's gross total (in dollars)
- Active status indicator

### Per Terminal
- Terminal name
- Department name
- Status (online/offline/maintenance)
- Associated sections
- Today's sales summary

## Common Workflows

### Opening Your Terminal
```
/pos-terminals 
  → Click "Open Terminal" 
  → Section dropdown appears 
  → Select section 
  → Products load
```

### Quick Section Access
```
/pos-terminals 
  → Sections tab 
  → Click "Start Sale" 
  → Checkout opens with section pre-selected
```

### Checking Performance
```
/pos-terminals 
  → Sections tab 
  → Review today's sales per section
  → Identify top performers
```

## API Integration (For Developers)

### Get All Sections
```bash
GET /api/pos/sections
```

### Get All Terminals
```bash
GET /api/pos/terminals
```

### Create Order (On Sale Complete)
```bash
POST /api/orders
Body: { items: [...], payment: {...}, discounts: [...] }
```

---

**Last Updated**: December 2024
**Status**: Production Ready ✅
