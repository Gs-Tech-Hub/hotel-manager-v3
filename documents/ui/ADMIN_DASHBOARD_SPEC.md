# Admin Dashboard Specification
## Complete UI/UX Design & Feature Requirements

**Document Version**: 1.0.0  
**Created**: November 15, 2025  
**Target Users**: Hotel Managers, Department Heads, Staff

---

## Dashboard Overview

The admin dashboard is the central command center for all hotel operations. It provides role-based access to manage departments, rooms, bookings, customers, orders, and staff.

```
┌─────────────────────────────────────────────────────────────┐
│                     ADMIN DASHBOARD                         │
├──────────┬───────────────────────────────────────────────────┤
│          │                                                   │
│ SIDEBAR  │              MAIN CONTENT AREA                   │
│ (250px)  │                                                   │
│          │  ┌─────────────────────────────────────────────┐ │
│ • Logo   │  │ Header: Breadcrumbs | Search | Bell | Menu  │ │
│ • Menu   │  ├─────────────────────────────────────────────┤ │
│ • Profile│  │  Dashboard Home / Department / Module Page  │ │
│ • Theme  │  │                                             │ │
│          │  │  • Dynamic content based on route          │ │
│          │  │  • Responsive grid/table layout            │ │
│          │  │  • Forms, modals, actions                  │ │
│          │  │                                             │ │
│          │  └─────────────────────────────────────────────┘ │
└──────────┴───────────────────────────────────────────────────┘
```

---

## Sidebar Navigation

### Structure

```
Admin Panel
├─ Dashboard
│  └─ Home (default)
│  └─ Analytics
│  └─ Reports
│
├─ Departments (Role-based access)
│  ├─ Rooms
│  ├─ Frontdesk
│  ├─ Housekeeping
│  ├─ Restaurant & Bar
│  ├─ Kitchen
│  ├─ Maintenance
│  ├─ Inventory
│  └─ HR
│
├─ Operations
│  ├─ Rooms Management
│  ├─ Bookings
│  ├─ Customers
│  ├─ Orders
│  ├─ Inventory
│  ├─ Staff
│  └─ Schedules
│
├─ Settings (Admin only)
│  ├─ General
│  ├─ Roles & Permissions
│  ├─ User Management
│  ├─ Email Templates
│  └─ System Settings
│
└─ Account
   ├─ Profile
   ├─ Preferences
   └─ Logout
```

### Sidebar Component Specifications

#### Collapsed State (Mobile)
```
- Width: 250px (expanded) / 70px (collapsed)
- Toggle button in header
- Shows only icons when collapsed
- Tooltip on hover over icons
```

#### Navigation Items
```
- Icon + Label format
- Active state: highlight + left border
- Badge for notifications (e.g., "3 new orders")
- Hover effect: background highlight
- Submenu support with chevron indicator
```

#### User Section (Bottom)
```
- Avatar image (40x40px)
- User name & role
- Settings button
- Logout button
- Dark mode toggle
```

### Sidebar Code Example

```typescript
// src/components/admin/sidebar/admin-sidebar.tsx
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, Building, Users, ShoppingCart, 
  Settings, LogOut, Menu, X, Moon, Sun 
} from 'lucide-react'

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/admin' },
  { id: 'departments', label: 'Departments', icon: Building, href: '/admin/departments' },
  { id: 'rooms', label: 'Rooms', icon: Home, href: '/admin/rooms' },
  { id: 'bookings', label: 'Bookings', icon: Calendar, href: '/admin/bookings' },
  { id: 'customers', label: 'Customers', icon: Users, href: '/admin/customers' },
  { id: 'orders', label: 'Orders', icon: ShoppingCart, href: '/admin/orders' },
  { id: 'inventory', label: 'Inventory', icon: Package, href: '/admin/inventory' },
  { id: 'staff', label: 'Staff', icon: Users, href: '/admin/staff' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/admin/settings' },
]

export function AdminSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <aside className={cn(
      'fixed left-0 top-0 h-screen border-r bg-white dark:bg-slate-950 transition-all',
      isCollapsed ? 'w-20' : 'w-64'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className={cn('font-bold text-lg', isCollapsed && 'hidden')}>
          Hotel Admin
        </div>
        <button onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map(item => (
          <SidebarItem 
            key={item.id}
            {...item}
            isCollapsed={isCollapsed}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t space-y-3">
        <ThemeToggle isCollapsed={isCollapsed} />
        <UserMenu isCollapsed={isCollapsed} />
      </div>
    </aside>
  )
}
```

---

## Admin Header

### Header Components

```
┌────────────────────────────────────────────────────────┐
│ ← Breadcrumbs | Search 🔍 | 🔔 Notifications | ⚙️ Menu │
└────────────────────────────────────────────────────────┘
```

#### 1. Breadcrumb Navigation
```
Admin / Departments / Housekeeping / Staff
- Clickable segments
- Shows hierarchy
- "Admin /" always present
```

#### 2. Search Bar
```
┌────────────────────────────────┐
│ 🔍 Search departments, rooms... │
└────────────────────────────────┘
- Global search across all modules
- Debounced real-time results
- Keyboard shortcut: Cmd/Ctrl + K
- Quick filters in dropdown
```

#### 3. Notifications Bell
```
🔔 (badge with count)
- Dropdown with recent notifications
- Unread count badge
- Clear old notifications option
- Link to notification settings

Notification types:
- New bookings
- Payment confirmations
- System alerts
- Staff messages
```

#### 4. User Menu
```
Profile Picture Dropdown:
├─ Profile Settings
├─ Preferences
├─ Help & Feedback
├─ Audit Log
└─ Logout
```

### Header Code Example

```typescript
// src/components/admin/header/admin-header.tsx
'use client'

import { Search, Bell, Settings } from 'lucide-react'
import { Button } from '@/components/shared/button'
import { Input } from '@/components/shared/input'

export function AdminHeader() {
  return (
    <header className="
      sticky top-0 z-40
      border-b bg-white dark:bg-slate-950
      px-6 py-3
      flex items-center justify-between
    ">
      {/* Breadcrumbs */}
      <Breadcrumbs />

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="hidden md:block relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search..."
            className="pl-10 w-64"
          />
        </div>

        {/* Notifications */}
        <NotificationBell />

        {/* User Menu */}
        <UserMenu />
      </div>
    </header>
  )
}
```

---

## Dashboard Home Page

### Page Layout

```
┌──────────────────────────────────────────────────────────┐
│ Dashboard Home                              📈 Date Range│
├──────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Stat 1   │  │ Stat 2   │  │ Stat 3   │  │ Stat 4   │ │
│  │ 150      │  │ 87%      │  │ $45.2K   │  │ 28       │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
├──────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌──────────────────────┐  │
│  │ Revenue Trend           │  │ Room Status          │  │
│  │ (Line Chart)            │  │ (Pie Chart)          │  │
│  │ $45.2K    +15%          │  │ 87% Occupied         │  │
│  └─────────────────────────┘  └──────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│ Recent Activity                                           │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ New booking: Room 101 - John Smith   • 2 min ago    │ │
│ │ Order ready: Table 5 - $45           • 5 min ago    │ │
│ │ Guest checkout: Room 305             • 15 min ago   │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Components

#### 1. KPI Cards (4-Column Grid)
```typescript
<StatCard
  icon={Building}
  title="Total Rooms"
  value="150"
  change={+5}
  period="this month"
  trend="up"
  color="blue"
/>

Card content:
- Icon (top right)
- Title (small, muted text)
- Large value (heading size)
- Change indicator (↑ +5 | green)
- Period (small text)
- Optional: Click to navigate
```

#### 2. Charts Section (2-Column Grid)
```
┌─────────────────────┐  ┌─────────────────────┐
│ Revenue Trend       │  │ Room Status         │
│ (30 days)           │  │                     │
│ Line Chart          │  │ Pie Chart           │
│ $45.2K ↑15%         │  │ 87% | 13%           │
└─────────────────────┘  └─────────────────────┘
```

#### 3. Recent Activity Feed
```
Timeline format:
┌─ 2 min ago
│  New booking: Room 101 - John Smith
│  Status: Confirmed
│
├─ 5 min ago
│  Order ready: Table 5 - $45
│  Status: Ready for pickup
│
└─ 15 min ago
   Guest checkout: Room 305
   Status: Completed
```

---

## Departments Module

### List View (`/admin/departments`)

#### Layout
```
┌─────────────────────────────────────────────────────────┐
│ Departments                    [+ New] [Export] [⋯]     │
├─────────────────────────────────────────────────────────┤
│ Filter: [Status ▼] [Manager ▼]  Search: [____________] │
├─────────────────────────────────────────────────────────┤
│ Columns: Checkbox | Name | Manager | Staff | Status     │
├─────────────────────────────────────────────────────────┤
│ ☐ | Rooms       | Alice Johnson | 12     | Active ✓    │
│ ☐ | Housekeep   | Bob Smith     | 8      | Active ✓    │
│ ☐ | Restaurant  | Carol White   | 15     | Active ✓    │
│ ☐ | Kitchen     | David Brown   | 10     | Active ✓    │
├─────────────────────────────────────────────────────────┤
│ Pagination: << < 1 2 3 > >> | 10 per page ▼            │
└─────────────────────────────────────────────────────────┘
```

#### Features
- Sortable columns (name, staff count, status)
- Filterable by status, manager
- Bulk actions (checkbox selection)
- Export to CSV
- Responsive table with horizontal scroll on mobile

#### Code Example

```typescript
// app/(admin)/departments/page.tsx
'use client'

import { useState } from 'react'
import { DataTable } from '@/components/admin/tables/data-table'
import { Button } from '@/components/shared/button'
import { Plus, Download, MoreVertical } from 'lucide-react'

const columns = [
  {
    key: 'name',
    label: 'Department',
    sortable: true,
    render: (dept) => dept.name,
  },
  {
    key: 'manager',
    label: 'Manager',
    sortable: true,
    render: (dept) => dept.manager?.name,
  },
  {
    key: 'staffCount',
    label: 'Staff',
    sortable: true,
    render: (dept) => dept.staff?.length || 0,
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (dept) => (
      <Badge variant={dept.isActive ? 'success' : 'warning'}>
        {dept.isActive ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  {
    key: 'actions',
    label: 'Actions',
    render: (dept) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => navigateTo(`/admin/departments/${dept.id}`)}>
            View
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openEditModal(dept)}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem className="text-red-600" onClick={() => openDeleteDialog(dept)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Departments</h1>
        <div className="flex gap-3">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Department
          </Button>
        </div>
      </div>

      <DataTable columns={columns} data={departments} />

      <CreateDepartmentModal open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  )
}
```

### Detail View (`/admin/departments/[id]`)

#### Layout
```
┌─────────────────────────────────────────────────────────┐
│ Departments > Housekeeping          [Edit] [Delete]     │
├─────────────────────────────────────────────────────────┤
│ ┌────────────────────────┐  ┌────────────────────────┐  │
│ │ Housekeeping Dept      │  │ Stats                  │  │
│ │ Manager: Bob Smith     │  │ Staff: 8               │  │
│ │ Status: Active         │  │ Budget: $45,000/month  │  │
│ │ Description: ...       │  │ Utilization: 92%       │  │
│ └────────────────────────┘  └────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│ Tabs: [Overview] [Staff] [Inventory] [Analytics]        │
├─────────────────────────────────────────────────────────┤
│ Tab Content (dynamic based on active tab)                │
└─────────────────────────────────────────────────────────┘
```

#### Tabs

**Overview Tab:**
- Department information card
- Key metrics
- Quick actions

**Staff Tab:**
- Staff list table
- Add/remove staff
- View individual profiles

**Inventory Tab:**
- Department inventory
- Stock levels
- Low stock warnings

**Analytics Tab:**
- Performance metrics
- Expense tracking
- Efficiency charts

### Edit View (`/admin/departments/[id]/edit`)

#### Form Layout
```
┌─────────────────────────────────────────────────────────┐
│ Edit Department                                          │
├─────────────────────────────────────────────────────────┤
│ Department Code                                          │
│ [HOUSEKEEPING] (read-only)                             │
│                                                         │
│ Department Name *                                       │
│ [Housekeeping Services            ]                    │
│                                                         │
│ Manager *                                               │
│ [Select Manager            ▼]                          │
│                                                         │
│ Monthly Budget                                          │
│ [$45,000                   ]                           │
│                                                         │
│ Description                                             │
│ [Long text input...                ]                   │
│                                                         │
│ Status                                                  │
│ ○ Active  ● Inactive                                    │
│                                                         │
│ [Cancel]  [Save Changes]                               │
└─────────────────────────────────────────────────────────┘
```

---

## Rooms Management

### Room Grid View (Default)

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ [Room Image]     │  │ [Room Image]     │  │ [Room Image]     │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ Room 101         │  │ Room 102         │  │ Room 103         │
│ Suite            │  │ Deluxe           │  │ Standard         │
│ 4 Guests         │  │ 2 Guests         │  │ 2 Guests         │
│ $199/night       │  │ $99/night        │  │ $79/night        │
│ ✓ Available      │  │ ◉ Occupied       │  │ ✓ Available      │
│ ⋯ Menu           │  │ ⋯ Menu           │  │ ⋯ Menu           │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

#### Features
- Toggle between grid and list view
- Filter by: type, status, price range, department
- Sort by: name, price, status, capacity
- Bulk assign to departments
- Bulk update status

### Room List View

```
| Room | Type    | Status    | Capacity | Price | Dept         | Actions |
|------|---------|-----------|----------|-------|--------------|---------|
| 101  | Suite   | Available | 4        | $199  | Rooms        | ⋯       |
| 102  | Deluxe  | Occupied  | 2        | $99   | Rooms        | ⋯       |
| 103  | Std     | Available | 2        | $79   | Rooms        | ⋯       |
```

### Room Detail View

```
┌─────────────────────────────────────────────────────────┐
│ Room 101 - Suite                 [Edit] [Status] [...]  │
├─────────────────────────────────────────────────────────┤
│ [Room Gallery Carousel/Lightbox]                        │
├─────────────────────────────────────────────────────────┤
│ Information                                             │
│ • Type: Suite                                           │
│ • Capacity: 4 guests                                    │
│ • Price: $199/night                                     │
│ • Status: Available                                     │
│ • Department: Rooms                                     │
│                                                         │
│ Amenities                                               │
│ • WiFi  • Air Conditioning  • Mini Bar  • TV            │
│ • Shower  • Bathrobe  • Slippers                        │
│                                                         │
│ Current Booking (if occupied)                           │
│ • Guest: John Smith                                     │
│ • Check-in: 2024-11-15  •  Check-out: 2024-11-18       │
│ • Status: Checked in                                    │
│                                                         │
│ Maintenance History                                     │
│ • 2024-11-10: Cleaned - Bob Smith                       │
│ • 2024-11-08: Maintenance - AC repair                   │
└─────────────────────────────────────────────────────────┘
```

---

## Bookings & Orders Management

### Bookings Table

```
| Booking ID | Guest      | Room | Check-in   | Check-out  | Status    | Total  | Actions |
|-----------|------------|------|-----------|-----------|-----------|--------|---------|
| BK-12345  | John Smith | 101  | 2024-11-15| 2024-11-18| Confirmed | $597   | ⋯       |
| BK-12346  | Jane Doe   | 202  | 2024-11-16| 2024-11-17| Pending   | $199   | ⋯       |
```

#### Status Badges
- `Pending` (amber) - Awaiting confirmation
- `Confirmed` (blue) - Booking confirmed
- `Checked-in` (green) - Guest checked in
- `Checked-out` (slate) - Guest checked out
- `Cancelled` (red) - Cancelled booking

### Orders Status Flow

```
NEW → PREPARING → READY → PICKED UP → COMPLETED
      ↓
    CANCELLED

Status indicators:
🟡 NEW        - Order received
🟠 PREPARING  - Being prepared
🟢 READY      - Ready for pickup
✓ COMPLETED   - Order fulfilled
✗ CANCELLED   - Cancelled by customer
```

---

## Settings & Admin Panel

### User Management

```
┌─────────────────────────────────────────────────────────┐
│ User Management                      [+ Add User]       │
├─────────────────────────────────────────────────────────┤
│ | Name      | Email          | Role    | Status | Actions|
│ |------------|----------------|---------|--------|--------|
│ | Alice      | alice@hotel.com| Admin   | Active | ⋯      |
│ | Bob        | bob@hotel.com  | Manager | Active | ⋯      |
│ | Carol      | carol@hotel.com| Staff   | Active | ⋯      |
└─────────────────────────────────────────────────────────┘
```

### Role Management

```
┌─────────────────────────────────────────────────────────┐
│ Roles & Permissions               [+ Create Role]       │
├─────────────────────────────────────────────────────────┤
│ Role            | Users | Permissions | Actions          │
│ Admin           | 1     | All         | Edit / Delete    │
│ Manager         | 3     | Limited     | Edit / Delete    │
│ Staff           | 12    | Restricted  | Edit / Delete    │
│ Customer        | 500   | View Only   | Edit / Delete    │
└─────────────────────────────────────────────────────────┘
```

---

## Mobile Responsive Design

### Mobile Layout (< 768px)

```
Header:
┌─────────────────────────────────┐
│ ☰ | 🔍 | 🔔 | ⚙️                │
│ Hotel Admin                      │
└─────────────────────────────────┘

Sidebar becomes:
- Hamburger menu toggle
- Overlay/drawer style
- Full width when open

Content:
┌─────────────────────────────────┐
│ Page Title      [+ Action]       │
├─────────────────────────────────┤
│ Responsive grid/list (single col)│
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Card / Table Row            │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Card / Table Row            │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

---

## POS Terminal Module

### Overview
Point of Sale (POS) terminal management for processing payments, managing transactions, and handling receipts for hotel services, dining, and retail.

### Route: `/admin/pos-terminals`

### List View

```
┌─────────────────────────────────────────────────────────────┐
│ POS Terminals                        [+ New] [Offline] [⋯]  │
├─────────────────────────────────────────────────────────────┤
│ Filter: [Status ▼] [Location ▼] [Type ▼]                  │
│ Search: [________________________]                           │
├─────────────────────────────────────────────────────────────┤
│ Terminal ID | Location | Status | Balance | Last Trans | ⋯  │
├─────────────────────────────────────────────────────────────┤
│ POS-001     | Front Desk | 🟢 Online | $0.00 | 2 min ago   │
│ POS-002     | Restaurant | 🟢 Online | $0.00 | 5 min ago   │
│ POS-003     | Bar       | 🟠 Offline | $0.00 | 1h ago     │
│ POS-004     | Retail    | 🟢 Online | $0.00 | 30 sec ago  │
└─────────────────────────────────────────────────────────────┘
```

#### Features
- Real-time terminal status monitoring (Online/Offline/Error)
- Filter by location, type (register, tablet, kiosk)
- Search by terminal ID
- Quick actions: View Details, Configuration, Diagnostics
- Bulk status management
- Last transaction timestamp
- Current drawer balance

#### Code Example

```typescript
// app/(admin)/pos-terminals/page.tsx
'use client'

import { useState } from 'react'
import { Activity, AlertCircle, CheckCircle } from 'lucide-react'
import { DataTable } from '@/components/admin/tables/data-table'
import { Button } from '@/components/shared/button'
import { Badge } from '@/components/shared/badge'

const columns = [
  {
    key: 'terminalId',
    label: 'Terminal ID',
    sortable: true,
    render: (terminal) => (
      <span className="font-mono font-semibold">{terminal.id}</span>
    ),
  },
  {
    key: 'location',
    label: 'Location',
    sortable: true,
    render: (terminal) => terminal.location,
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (terminal) => (
      <div className="flex items-center gap-2">
        {terminal.isOnline ? (
          <>
            <CheckCircle className="h-4 w-4 text-green-500" />
            <Badge variant="success">Online</Badge>
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4 text-red-500" />
            <Badge variant="danger">Offline</Badge>
          </>
        )}
      </div>
    ),
  },
  {
    key: 'balance',
    label: 'Drawer Balance',
    render: (terminal) => `$${terminal.drawerBalance.toFixed(2)}`,
  },
  {
    key: 'lastTransaction',
    label: 'Last Transaction',
    render: (terminal) => formatTimeAgo(terminal.lastTransactionTime),
  },
]

export default function POSTerminalsPage() {
  const [terminals, setTerminals] = useState([])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">POS Terminals</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Configure Terminal
        </Button>
      </div>

      <DataTable columns={columns} data={terminals} />
    </div>
  )
}
```

### Detail View: `/admin/pos-terminals/[id]`

```
┌─────────────────────────────────────────────────────────────┐
│ POS-001 - Front Desk              [Edit Config] [Restart]   │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────┐  ┌──────────────────────────────┐  │
│ │ Status              │  │ Transaction History          │  │
│ │ 🟢 Online           │  │ • Payment: $150 - 2 min ago  │  │
│ │ Model: NCR 7197     │  │ • Refund: $20 - 15 min ago   │  │
│ │ IP: 192.168.1.10    │  │ • Payment: $75 - 45 min ago  │  │
│ │ Connected: 2h 15min │  │                              │  │
│ │ Drawer Balance: $0  │  │ [View All Transactions]      │  │
│ │                     │  │                              │  │
│ │ [Diagnostics]       │  │                              │  │
│ │ [Health Check]      │  │                              │  │
│ └─────────────────────┘  └──────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│ Tabs: [Overview] [Transactions] [Settings] [Maintenance]    │
└─────────────────────────────────────────────────────────────┘
```

#### Tabs

**Overview Tab:**
- Terminal status & health
- Connected peripherals (printer, scanner, drawer)
- Network connectivity
- System information
- Quick diagnostics button

**Transactions Tab:**
- Recent transactions table
- Filter by date range, type (payment/refund)
- View receipt details
- Void/refund options

**Settings Tab:**
- Terminal configuration
- Printer settings
- Tax rates
- Timeout settings
- Display brightness

**Maintenance Tab:**
- Restart options
- System logs
- Firmware version
- Update availability

---

## Games Management Module

### Overview
Manage hotel amenity games, tournaments, and arcade/entertainment systems including booking, scheduling, and revenue tracking.

### Route: `/admin/games`

### List View

```
┌─────────────────────────────────────────────────────────────┐
│ Games & Entertainment              [+ New Game] [Events]    │
├─────────────────────────────────────────────────────────────┤
│ Filter: [Type ▼] [Status ▼] [Location ▼]                  │
│ Search: [________________________]                           │
├─────────────────────────────────────────────────────────────┤
│ Name | Type | Location | Players | Status | Revenue | ⋯     │
├─────────────────────────────────────────────────────────────┤
│ Billiards | Table Game | Game Room | 2-4 | Active | $2.5K   │
│ Bowling | Alley | Recreation | 4-6 | Active | $8.2K        │
│ Chess | Board Game | Lounge | 2 | Active | $0.5K           │
│ VR Station | Digital | Tech Lounge | 2-4 | Active | $15K    │
│ Ping Pong | Table | Game Room | 2 | Active | $1.2K         │
└─────────────────────────────────────────────────────────────┘
```

#### Features
- Game inventory with status tracking
- Revenue tracking per game
- Player booking/reservations
- Tournament management
- Equipment maintenance logs
- Player ratings & reviews
- Active tournaments display

#### Code Example

```typescript
// app/(admin)/games/page.tsx
'use client'

import { GamepadIcon, Trophy, Users, DollarSign } from 'lucide-react'
import { DataTable } from '@/components/admin/tables/data-table'
import { Button } from '@/components/shared/button'
import { Badge } from '@/components/shared/badge'
import { StatCard } from '@/components/admin/dashboard/stat-card'

const columns = [
  {
    key: 'name',
    label: 'Game Name',
    sortable: true,
    render: (game) => (
      <div className="flex items-center gap-2">
        <GamepadIcon className="h-4 w-4 text-sky-500" />
        {game.name}
      </div>
    ),
  },
  {
    key: 'type',
    label: 'Type',
    sortable: true,
    render: (game) => <Badge>{game.type}</Badge>,
  },
  {
    key: 'location',
    label: 'Location',
    sortable: true,
    render: (game) => game.location,
  },
  {
    key: 'players',
    label: 'Max Players',
    render: (game) => `${game.minPlayers}-${game.maxPlayers}`,
  },
  {
    key: 'status',
    label: 'Status',
    render: (game) => (
      <Badge variant={game.isAvailable ? 'success' : 'warning'}>
        {game.isAvailable ? 'Available' : 'In Use'}
      </Badge>
    ),
  },
  {
    key: 'revenue',
    label: 'Monthly Revenue',
    sortable: true,
    render: (game) => (
      <span className="font-semibold text-green-600">
        ${game.monthlyRevenue.toLocaleString()}
      </span>
    ),
  },
]

export default function GamesPage() {
  const [games, setGames] = useState([])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Games & Entertainment</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Game
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Games"
          value={games.length}
          icon={GamepadIcon}
          color="blue"
        />
        <StatCard
          title="Tournaments"
          value={activeTournaments}
          icon={Trophy}
          color="purple"
        />
        <StatCard
          title="Players Today"
          value={activePlayers}
          icon={Users}
          color="green"
        />
        <StatCard
          title="Monthly Revenue"
          value={`$${totalRevenue}`}
          icon={DollarSign}
          color="emerald"
        />
      </div>

      <DataTable columns={columns} data={games} />
    </div>
  )
}
```

### Detail View: `/admin/games/[id]`

```
┌─────────────────────────────────────────────────────────────┐
│ Bowling Alley                        [Edit] [Maintenance]   │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐  ┌──────────────────────────────┐     │
│ │ Game Info        │  │ Quick Stats                  │     │
│ │ • Type: Alley    │  │ • Players Today: 12          │     │
│ │ • Location: Rec  │  │ • Sessions: 8                │     │
│ │ • Players: 4-6   │  │ • Revenue Today: $480        │     │
│ │ • Rate: $15/hr   │  │ • Avg Session: 45 min        │     │
│ │ • Status: Active │  │                              │     │
│ │ • Rating: ⭐⭐⭐⭐   │  │ [Book Now] [Schedule]        │     │
│ │                  │  │                              │     │
│ │ Equipment:       │  │                              │     │
│ │ • Bowling Lanes  │  │ [Create Tournament]          │     │
│ │ • Pin Machines   │  │                              │     │
│ └──────────────────┘  └──────────────────────────────┘     │
├─────────────────────────────────────────────────────────────┤
│ Tabs: [Overview] [Bookings] [Tournaments] [Maintenance]     │
│       [Reviews] [Revenue]                                   │
└─────────────────────────────────────────────────────────────┘
```

#### Tabs

**Bookings Tab:**
- Upcoming reservations calendar
- Current session details
- Guest information
- Session history

**Tournaments Tab:**
- Active & past tournaments
- Leaderboards
- Create new tournament
- Tournament brackets

**Maintenance Tab:**
- Equipment status
- Maintenance history
- Schedule maintenance
- Service records

**Revenue Tab:**
- Revenue charts (daily, weekly, monthly)
- Booking patterns
- Player statistics
- Pricing analysis

---

## Gym & Sports Center Membership Module

### Overview
Comprehensive gym and sports center membership management including memberships, classes, trainers, equipment tracking, and member engagement.

### Route: `/admin/gym-memberships`

### List View

```
┌─────────────────────────────────────────────────────────────┐
│ Gym Memberships                [+ New Member] [Classes]     │
├─────────────────────────────────────────────────────────────┤
│ Filter: [Status ▼] [Type ▼] [Expiry ▼]  Search: [_______]  │
├─────────────────────────────────────────────────────────────┤
│ ID | Member Name | Type | Exp Date | Status | Check-In | ⋯  │
├─────────────────────────────────────────────────────────────┤
│ M001 | John Smith | Annual | 2025-11-30 | Active | Today     │
│ M002 | Jane Doe | Monthly | 2025-12-15 | Active | 2d ago     │
│ M003 | Bob Wilson | 3-Month | 2025-09-20 | Expired | -       │
│ M004 | Carol White | Annual | 2026-03-10 | Active | 1w ago   │
│ M005 | David Brown | Day Pass | 2025-11-15 | Expired | 1d ago│
└─────────────────────────────────────────────────────────────┘
```

#### Features
- Member directory with search/filter
- Membership type tracking (annual, monthly, day pass)
- Auto-renewal management
- Check-in tracking
- Class attendance
- Trainer assignments
- Payment history

#### Code Example

```typescript
// app/(admin)/gym-memberships/page.tsx
'use client'

import { useState } from 'react'
import { Users, TrendingUp, Zap, Calendar } from 'lucide-react'
import { DataTable } from '@/components/admin/tables/data-table'
import { Button } from '@/components/shared/button'
import { Badge } from '@/components/shared/badge'
import { StatCard } from '@/components/admin/dashboard/stat-card'

const membershipTypes = {
  'Day Pass': { price: '$15', color: 'blue' },
  '1-Month': { price: '$45', color: 'sky' },
  '3-Month': { price: '$120', color: 'purple' },
  'Annual': { price: '$400', color: 'emerald' },
}

const columns = [
  {
    key: 'memberId',
    label: 'Member ID',
    sortable: true,
    render: (member) => <span className="font-mono font-semibold">{member.id}</span>,
  },
  {
    key: 'name',
    label: 'Member Name',
    sortable: true,
    render: (member) => (
      <div>
        <p className="font-medium">{member.name}</p>
        <p className="text-xs text-slate-500">{member.email}</p>
      </div>
    ),
  },
  {
    key: 'type',
    label: 'Membership Type',
    sortable: true,
    render: (member) => (
      <Badge variant="outline">{member.membershipType}</Badge>
    ),
  },
  {
    key: 'expiryDate',
    label: 'Expiry Date',
    sortable: true,
    render: (member) => {
      const isExpired = new Date(member.expiryDate) < new Date()
      return (
        <span className={isExpired ? 'text-red-600' : 'text-green-600'}>
          {formatDate(member.expiryDate)}
        </span>
      )
    },
  },
  {
    key: 'status',
    label: 'Status',
    render: (member) => {
      const isExpired = new Date(member.expiryDate) < new Date()
      return (
        <Badge variant={isExpired ? 'danger' : 'success'}>
          {isExpired ? 'Expired' : 'Active'}
        </Badge>
      )
    },
  },
  {
    key: 'lastCheckIn',
    label: 'Last Check-In',
    render: (member) => formatTimeAgo(member.lastCheckInDate),
  },
]

export default function GymMembershipsPage() {
  const [members, setMembers] = useState([])
  const [stats, setStats] = useState({})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Gym Memberships</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Member
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Members"
          value={stats.activeMembers || 0}
          icon={Users}
          color="blue"
          trend="+12%"
        />
        <StatCard
          title="Check-Ins Today"
          value={stats.checkInsToday || 0}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Expiring Soon"
          value={stats.expiringSoon || 0}
          icon={Calendar}
          color="amber"
        />
        <StatCard
          title="Monthly Revenue"
          value={`$${stats.monthlyRevenue || 0}`}
          icon={Zap}
          color="emerald"
        />
      </div>

      <DataTable columns={columns} data={members} />
    </div>
  )
}
```

### Detail View: `/admin/gym-memberships/[id]`

```
┌─────────────────────────────────────────────────────────────┐
│ M001 - John Smith                    [Edit] [Renew] [...]    │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────┐  ┌──────────────────────────────┐   │
│ │ Member Info         │  │ Membership Status            │   │
│ │ • ID: M001          │  │ • Type: Annual               │   │
│ │ • Email: john@...   │  │ • Start: 2024-11-30          │   │
│ │ • Phone: 555-0123   │  │ • Expires: 2025-11-30        │   │
│ │ • Join Date: 1y ago │  │ • Status: ✓ Active (14d left)│   │
│ │ • Age: 32           │  │ • Auto-Renew: Yes            │   │
│ │                     │  │ • Payment: Monthly ($33.33)  │   │
│ │ Trainer: Mike J.    │  │                              │   │
│ │ Package: Premium    │  │ [Renew] [Pause] [Cancel]     │   │
│ │ Rating: ⭐⭐⭐⭐⭐   │  │                              │   │
│ └─────────────────────┘  └──────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│ Tabs: [Overview] [Classes] [Trainer] [Check-Ins] [Payments] │
└─────────────────────────────────────────────────────────────┘
```

#### Tabs

**Classes Tab:**
- Enrolled classes list
- Class schedule
- Attendance history
- Upcoming sessions
- Cancel/reschedule options

**Trainer Tab:**
- Assigned trainer info
- Session history
- Upcoming appointments
- Request trainer change
- Trainer ratings & notes

**Check-Ins Tab:**
- Monthly check-in calendar
- Check-in frequency chart
- Peak hours analysis
- Access log

**Payments Tab:**
- Payment history
- Invoice details
- Billing schedule
- Payment method
- Renewal options

### Classes Management: `/admin/gym-memberships/classes`

```
┌─────────────────────────────────────────────────────────────┐
│ Gym Classes                          [+ New Class] [Schedule]│
├─────────────────────────────────────────────────────────────┤
│ Filter: [Type ▼] [Trainer ▼] [Time ▼]                      │
├─────────────────────────────────────────────────────────────┤
│ Mon-Wed-Fri                                                 │
│ 06:00 | Yoga | Room A | Capacity: 20/20 ✓ Full | John      │
│ 07:00 | Spin | Room B | Capacity: 15/15 ✓ Full | Sarah     │
│ 08:00 | HIIT | Room A | Capacity: 18/25 | Mike             │
│                                                             │
│ Tue-Thu                                                     │
│ 18:00 | Zumba | Studio | Capacity: 25/30 | Lisa            │
│ 19:00 | Boxing | Ring | Capacity: 12/20 | David            │
└─────────────────────────────────────────────────────────────┘
```

#### Features
- Class schedule management
- Capacity tracking
- Trainer assignments
- Member enrollment
- Class cancellation
- Rescheduling
- Attendance tracking

### Trainers Management: `/admin/gym-memberships/trainers`

```
┌─────────────────────────────────────────────────────────────┐
│ Trainers                        [+ Add Trainer] [Schedule]   │
├─────────────────────────────────────────────────────────────┤
│ Name | Certification | Classes | Clients | Rating | Status  │
├─────────────────────────────────────────────────────────────┤
│ John Smith | NASM-CPT | 4 | 12 | ⭐⭐⭐⭐⭐ (4.9) | Active   │
│ Sarah Jones | ACE | 3 | 8 | ⭐⭐⭐⭐⭐ (4.8) | Active        │
│ Mike Chen | ISSA | 2 | 5 | ⭐⭐⭐⭐ (4.6) | Active          │
│ Lisa Brown | NCSF | 5 | 15 | ⭐⭐⭐⭐⭐ (4.9) | Active       │
└─────────────────────────────────────────────────────────────┘
```

#### Features
- Trainer directory
- Certification tracking
- Client management
- Class assignments
- Performance ratings
- Availability calendar
- Commission tracking

---

## Updated Sidebar Navigation

```
Admin Panel
├─ Dashboard
│  └─ Home (default)
│  └─ Analytics
│  └─ Reports
│
├─ Departments (Role-based access)
│  ├─ Rooms
│  ├─ Frontdesk
│  ├─ Housekeeping
│  ├─ Restaurant & Bar
│  ├─ Kitchen
│  ├─ Maintenance
│  ├─ Inventory
│  └─ HR
│
├─ Operations
│  ├─ Rooms Management
│  ├─ Bookings
│  ├─ Customers
│  ├─ Orders
│  ├─ Inventory
│  ├─ Staff
│  └─ Schedules
│
├─ Revenue Management  ⭐ NEW SECTION
│  ├─ POS Terminals
│  ├─ Games & Entertainment
│  ├─ Gym Memberships
│  └─ Billing & Payments
│
├─ Settings (Admin only)
│  ├─ General
│  ├─ Roles & Permissions
│  ├─ User Management
│  ├─ Email Templates
│  └─ System Settings
│
└─ Account
   ├─ Profile
   ├─ Preferences
   └─ Logout
```

---

## Accessibility Requirements

### WCAG 2.1 Level AA Compliance

- **Keyboard Navigation**: All interactive elements accessible via Tab/Shift+Tab
- **Focus Management**: Clear focus indicators on all interactive elements
- **Color Contrast**: Minimum 4.5:1 for text on background
- **Screen Reader**: Proper ARIA labels and semantic HTML
- **Mobile**: Touch targets minimum 44x44px
- **Responsive**: All functionality available on mobile
- **Images**: Alt text for all meaningful images

### Code Example

```typescript
// Accessible form input
<div className="space-y-2">
  <label 
    htmlFor="department-select"
    className="block text-sm font-medium"
  >
    Select Department
    <span className="text-red-500" aria-label="required">*</span>
  </label>
  
  <select
    id="department-select"
    aria-required="true"
    aria-describedby="dept-error"
    aria-invalid={hasError}
  >
    {options}
  </select>
  
  {hasError && (
    <p id="dept-error" className="text-sm text-red-600" role="alert">
      {errorMessage}
    </p>
  )}
</div>
```

---

## Performance Targets

- **First Contentful Paint (FCP)**: < 1.5s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Cumulative Layout Shift (CLS)**: < 0.1
- **Time to Interactive (TTI)**: < 3.5s
- **Page Load**: < 2s
- **API Response**: < 500ms average

---

## Security Considerations

- ✅ Role-based access control (RBAC)
- ✅ Protected API endpoints
- ✅ Input validation on all forms
- ✅ CSRF protection on state-changing operations
- ✅ Audit logging for sensitive actions
- ✅ Session timeout (15 minutes)
- ✅ Secure headers (CSP, X-Frame-Options, etc.)

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile: iOS 14+, Android 10+

---

**Dashboard Specification Status**: ✅ COMPLETE (Extended)  
**Version**: 1.1.0  
**Last Updated**: November 15, 2025

### New Modules Added (v1.1.0)
- ✅ POS Terminal Management
- ✅ Games & Entertainment Management
- ✅ Gym & Sports Center Memberships
- ✅ Updated Sidebar Navigation with new "Revenue Management" section
