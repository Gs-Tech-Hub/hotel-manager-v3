````markdown
# Structural Implementation Guide
## Hotel Manager v3 - Admin Dashboard & Landing Page Build

**Document Version**: 1.0.0  
**Created**: November 18, 2025  
**Status**: Ready for Development  
**Target**: Next.js 14 + shadcn/ui + Tailwind CSS

---

## Table of Contents

1. [Overview](#overview)
2. [Current Template Analysis](#current-template-analysis)
3. [Project Structure](#project-structure)
4. [Admin Dashboard Implementation](#admin-dashboard-implementation)
5. [POS Terminal UI System](#pos-terminal-ui-system)
6. [Landing Page Implementation](#landing-page-implementation)
7. [Component Architecture](#component-architecture)
8. [Implementation Timeline](#implementation-timeline)
9. [File Creation Checklist](#file-creation-checklist)

---

## Overview

This guide adapts the comprehensive UI development framework documentation to the **existing Hotel Manager v3 template** which uses:

- **Framework**: Next.js 14 (App Router)
- **UI Library**: shadcn/ui
- **Styling**: Tailwind CSS
- **State Management**: React hooks
- **Icons**: Lucide React
- **Dark Mode**: next-themes

### What This Guide Covers

✅ **Admin Dashboard** - Complete hotel operations interface  
✅ **Landing Page** - Guest-facing website with booking flow  
✅ **Shared Components** - Reusable UI components  
✅ **Design System** - Color, typography, spacing standards  
✅ **Mobile Responsive** - All layouts work on mobile  
✅ **Accessibility** - WCAG 2.1 AA compliance  

---

## Current Template Analysis

### Existing Structure

```
app/
├── (auth)/              ← Authentication routes
│   ├── layout.tsx       ← Auth wrapper (centered layout)
│   ├── login/
│   ├── register/
│   └── ...
├── (dashboard)/         ← Admin dashboard routes
│   ├── layout.tsx       ← Dashboard wrapper (sidebar + topbar)
│   └── dashboard/
├── (public)/            ← Public website (TO BE CREATED)
│   ├── layout.tsx       ← Public wrapper (navbar only)
│   ├── page.tsx         ← Homepage
│   ├── rooms/
│   ├── dining/
│   └── ...
├── globals.css          ← Global styles
├── layout.tsx           ← Root layout with theme provider
└── page.tsx             ← Current root page

components/
├── shared/
│   ├── sidebar.tsx      ← Admin sidebar (existing)
│   ├── topbar.tsx       ← Admin topbar (existing)
│   ├── app-switcher.tsx
│   ├── ErrorPage.tsx
│   ├── loading-dashboard.tsx
│   └── navbar.tsx       ← Public navbar (TO BE CREATED)
├── ui/                  ← shadcn/ui components
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── input.tsx
│   ├── table.tsx
│   └── ... (15+ more)
└── theme-provider.tsx
└── theme-toggle.tsx
```

### Key Strengths of Current Template

1. ✅ **Professional sidebar navigation** - Collapsible, with badges, grouping
2. ✅ **Modern topbar** - Search, notifications, theme toggle, profile menu
3. ✅ **shadcn/ui integration** - 18+ pre-configured components
4. ✅ **Dark mode support** - next-themes configured
5. ✅ **Responsive layout** - Mobile-friendly dashboard
6. ✅ **TypeScript ready** - Full type safety
7. ✅ **Tailwind CSS** - Full utility configuration
8. ✅ **Clean architecture** - Separation of concerns

### What Needs to Be Added

1. 🚀 **Public website layout** - Landing page with navbar (no sidebar)
2. 🚀 **Hotel-specific sidebar** - Departments, operations, revenue modules
3. 🚀 **Hotel-specific pages** - Departments, rooms, bookings, customers, etc.
4. 🚀 **Public pages** - Homepage, rooms showcase, dining, amenities, booking
5. 🚀 **POS Terminal module** - Sales/revenue management
6. 🚀 **Games & Entertainment** - Game management interface
7. 🚀 **Gym Memberships** - Membership management
8. 🚀 **Advanced components** - Tables with sorting/filtering, charts, forms

---

## Project Structure

### Recommended Organization

```
app/
├── (auth)/                          ← Authentication (EXISTING)
│   ├── layout.tsx
│   ├── login/
│   │   └── page.tsx
│   ├── register/
│   │   └── page.tsx
│   └── ...
│
├── (dashboard)/                     ← Admin Dashboard
│   ├── layout.tsx                   ← Sidebar + Topbar
│   ├── dashboard/
│   │   └── page.tsx                 ← Dashboard home with stats & charts
│   ├── departments/
│   │   ├── page.tsx                 ← List view
│   │   ├── [id]/
│   │   │   ├── page.tsx             ← Detail view with tabs
│   │   │   └── edit/
│   │   │       └── page.tsx         ← Edit form
│   ├── rooms/
│   │   ├── page.tsx                 ← Room grid/list
│   │   └── [id]/
│   │       └── page.tsx             ← Room detail
│   ├── bookings/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   ├── customers/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   ├── orders/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   ├── inventory/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   ├── pos-terminals/               ← NEW: Revenue Management
│   │   ├── page.tsx
│   │   └── [id]/
│   │       ├── page.tsx
│   │       ├── transactions/
│   │       │   └── page.tsx
│   │       └── settings/
│   │           └── page.tsx
│   ├── games/                       ← NEW: Games & Entertainment
│   │   ├── page.tsx
│   │   └── [id]/
│   │       ├── page.tsx
│   │       ├── bookings/
│   │       │   └── page.tsx
│   │       └── tournaments/
│   │           └── page.tsx
│   ├── gym-memberships/             ← NEW: Gym Management
│   │   ├── page.tsx
│   │   ├── classes/
│   │   │   └── page.tsx
│   │   ├── trainers/
│   │   │   └── page.tsx
│   │   └── [id]/
│   │       ├── page.tsx
│   │       ├── classes/
│   │       │   └── page.tsx
│   │       └── trainer/
│   │           └── page.tsx
│   ├── settings/
│   │   ├── page.tsx
│   │   ├── general/
│   │   │   └── page.tsx
│   │   ├── users/
│   │   │   └── page.tsx
│   │   ├── roles/
│   │   │   └── page.tsx
│   │   └── system/
│   │       └── page.tsx
│   └── analytics/
│       └── page.tsx
│
├── (public)/                        ← Public Website (NEW)
│   ├── layout.tsx                   ← Navbar only (no sidebar)
│   ├── page.tsx                     ← Homepage with all sections
│   ├── rooms/
│   │   ├── page.tsx                 ← Rooms showcase & search
│   │   └── [id]/
│   │       └── page.tsx             ← Room detail page
│   ├── dining/
│   │   ├── page.tsx                 ← Restaurant & bar info
│   │   └── [id]/
│   │       └── page.tsx             ← Dining venue detail
│   ├── amenities/
│   │   └── page.tsx
│   ├── gallery/
│   │   └── page.tsx
│   ├── contact/
│   │   └── page.tsx
│   ├── booking/
│   │   ├── page.tsx                 ← Booking wizard
│   │   └── confirmation/
│   │       └── page.tsx             ← Booking confirmation
│   └── about/
│       └── page.tsx
│
├── (error)/                         ← Error pages (EXISTING)
│   ├── error/
│   │   └── page.tsx
│   └── ...
│
├── api/                             ← API routes
│   ├── departments/
│   │   ├── route.ts                 ← GET/POST departments
│   │   └── [id]/
│   │       └── route.ts             ← GET/PUT/DELETE specific dept
│   ├── rooms/
│   ├── bookings/
│   ├── orders/
│   ├── customers/
│   ├── pos-terminals/
│   ├── games/
│   ├── gym-memberships/
│   └── ...
│
├── globals.css
├── layout.tsx                       ← Root layout
├── page.tsx
└── not-found.tsx

components/
├── shared/
│   ├── sidebar.tsx                  ← Admin sidebar (REFINE)
│   ├── topbar.tsx                   ← Admin topbar (EXISTING)
│   ├── navbar.tsx                   ← Public navbar (NEW)
│   ├── footer.tsx                   ← Public footer (NEW)
│   ├── app-switcher.tsx
│   ├── ErrorPage.tsx
│   └── loading-dashboard.tsx
│
├── admin/                           ← Admin components
│   ├── sidebar/
│   │   └── admin-sidebar.tsx        ← Enhanced sidebar with hotel modules
│   ├── header/
│   │   ├── admin-header.tsx
│   │   ├── breadcrumbs.tsx
│   │   └── search-bar.tsx
│   ├── dashboard/
│   │   ├── stat-card.tsx
│   │   ├── chart-card.tsx
│   │   └── activity-feed.tsx
│   ├── departments/
│   │   ├── department-form.tsx
│   │   ├── department-list.tsx
│   │   └── department-detail.tsx
│   ├── rooms/
│   │   ├── room-grid.tsx
│   │   ├── room-card.tsx
│   │   ├── room-detail.tsx
│   │   └── room-form.tsx
│   ├── bookings/
│   │   ├── booking-table.tsx
│   │   ├── booking-detail.tsx
│   │   └── booking-form.tsx
│   ├── orders/
│   │   ├── order-table.tsx
│   │   ├── order-status.tsx
│   │   └── order-detail.tsx
│   ├── customers/
│   │   ├── customer-table.tsx
│   │   └── customer-detail.tsx
│   ├── inventory/
│   │   ├── inventory-table.tsx
│   │   └── inventory-form.tsx
│   ├── pos-terminals/               ← NEW
│   │   ├── terminal-list.tsx
│   │   ├── terminal-detail.tsx
│   │   └── terminal-status.tsx
│   ├── games/                       ← NEW
│   │   ├── game-list.tsx
│   │   ├── game-detail.tsx
│   │   └── game-card.tsx
│   ├── gym-memberships/             ← NEW
│   │   ├── membership-list.tsx
│   │   ├── membership-detail.tsx
│   │   ├── member-card.tsx
│   │   └── class-list.tsx
│   ├── settings/
│   │   ├── user-management.tsx
│   │   ├── role-management.tsx
│   │   └── system-settings.tsx
│   └── tables/
│       ├── data-table.tsx           ← Reusable data table
│       └── table-header.tsx
│
├── public/                          ← Public website components (NEW)
│   ├── hero/
│   │   └── hero-section.tsx
│   ├── features/
│   │   └── features-section.tsx
│   ├── rooms/
│   │   ├── room-showcase.tsx
│   │   ├── room-card.tsx
│   │   └── room-detail.tsx
│   ├── dining/
│   │   ├── dining-showcase.tsx
│   │   └── dining-card.tsx
│   ├── testimonials/
│   │   ├── testimonials-section.tsx
│   │   └── testimonial-card.tsx
│   ├── booking/
│   │   ├── booking-widget.tsx
│   │   ├── booking-form.tsx
│   │   └── booking-steps.tsx
│   ├── gallery/
│   │   ├── gallery-grid.tsx
│   │   └── image-lightbox.tsx
│   ├── contact/
│   │   └── contact-form.tsx
│   └── cta/
│       └── cta-section.tsx
│
├── ui/                              ← shadcn/ui components (EXISTING)
│   ├── accordion.tsx
│   ├── avatar.tsx
│   ├── badge.tsx
│   ├── button.tsx
│   ├── card.tsx
│   ├── checkbox.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── form.tsx
│   ├── input.tsx
│   ├── input-otp.tsx
│   ├── label.tsx
│   ├── progress.tsx
│   ├── select.tsx
│   ├── separator.tsx
│   ├── sheet.tsx
│   ├── skeleton.tsx
│   ├── sonner.tsx
│   ├── switch.tsx
│   ├── table.tsx
│   ├── tabs.tsx
│   └── textarea.tsx
│
├── theme-provider.tsx
└── theme-toggle.tsx

lib/
├── utils.ts                         ← cn() utility, helpers
└── api.ts                           ← API client helpers

styles/
└── globals.css                      ← Global styles (EXISTING)

types/
├── index.ts
├── admin.ts                         ← Admin types (departments, rooms, etc.)
├── public.ts                        ← Public types (booking, room info)
└── api.ts                           ← API response types

services/
├── api-client.ts                    ← HTTP client setup
├── departments.ts                   ← Department service
├── rooms.ts
├── bookings.ts
├── customers.ts
├── orders.ts
├── inventory.ts
├── pos-terminals.ts                 ← NEW
├── games.ts                         ← NEW
├── gym-memberships.ts               ← NEW
└── auth.ts
```

---

## Admin Dashboard Implementation

### 1. Admin Sidebar Enhancement

**File**: `components/admin/sidebar/admin-sidebar.tsx`

The existing sidebar in `components/shared/sidebar.tsx` is a great template. We'll create an enhanced version specific to the hotel system.

**Key Features:**
- Hotel-specific menu structure
- Departments section
- Operations section
- Revenue Management section (POS, Games, Gym)
- Settings section
- Collapsible navigation
- Badge notifications

**Menu Structure:**
```typescript
// Configuration for admin sidebar
const adminSidebarMenu = [
  {
    title: 'Dashboard',
    section: 'Main',
    items: [
      { title: 'Overview', href: '/dashboard', icon: LayoutDashboard },
      { title: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    ]
  },
  {
    title: 'Departments',
    section: 'Operations',
    items: [
      { title: 'Rooms', href: '/dashboard/departments/rooms', icon: Home },
      { title: 'Front Desk', href: '/dashboard/departments/frontdesk', icon: Bell },
      { title: 'Housekeeping', href: '/dashboard/departments/housekeeping', icon: Sparkles },
      { title: 'Restaurant & Bar', href: '/dashboard/departments/dining', icon: UtensilsCrossed },
      { title: 'Kitchen', href: '/dashboard/departments/kitchen', icon: ChefHat },
      { title: 'Maintenance', href: '/dashboard/departments/maintenance', icon: Wrench },
      { title: 'Inventory', href: '/dashboard/departments/inventory', icon: Package },
      { title: 'HR', href: '/dashboard/departments/hr', icon: Users },
    ]
  },
  {
    title: 'Revenue Management',
    section: 'Business',
    items: [
      { title: 'POS Terminals', href: '/dashboard/pos-terminals', icon: CreditCard },
      { title: 'Games & Entertainment', href: '/dashboard/games', icon: GamepadIcon },
      { title: 'Gym Memberships', href: '/dashboard/gym-memberships', icon: Dumbbell },
      { title: 'Billing & Payments', href: '/dashboard/billing', icon: DollarSign },
    ]
  },
  {
    title: 'Operations',
    section: 'Management',
    items: [
      { title: 'Rooms Management', href: '/dashboard/rooms', icon: Door },
      { title: 'Bookings', href: '/dashboard/bookings', icon: Calendar },
      { title: 'Customers', href: '/dashboard/customers', icon: Users },
      { title: 'Orders', href: '/dashboard/orders', icon: ShoppingCart },
      { title: 'Inventory', href: '/dashboard/inventory', icon: Package },
      { title: 'Staff', href: '/dashboard/staff', icon: Users },
    ]
  },
  {
    title: 'Administration',
    section: 'Settings',
    items: [
      { title: 'User Management', href: '/dashboard/settings/users', icon: Users },
      { title: 'Roles & Permissions', href: '/dashboard/settings/roles', icon: Shield },
      { title: 'System Settings', href: '/dashboard/settings/system', icon: Settings },
    ]
  }
]
```

### 2. Dashboard Home Page

**File**: `app/(dashboard)/dashboard/page.tsx`

Components needed:
- Stat cards (KPI display)
- Chart cards (Revenue trends, occupancy, etc.)
- Activity feed
- Quick action buttons

**Layout Structure:**
```typescript
export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your overview.</p>
      </div>

      {/* KPI Cards - 4 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Rooms" value="150" change="+5%" trend="up" />
        <StatCard title="Occupancy" value="87%" change="+12%" trend="up" />
        <StatCard title="Revenue" value="$45.2K" change="+15%" trend="up" />
        <StatCard title="Bookings" value="28" change="-3%" trend="down" />
      </div>

      {/* Charts - 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Revenue Trend" type="line" data={revenueData} />
        <ChartCard title="Room Status" type="pie" data={occupancyData} />
      </div>

      {/* Recent Activity - Full width */}
      <ActivityFeed activities={recentActivities} />
    </div>
  )
}
```

### 3. Departments Module

**Files:**
- `app/(dashboard)/departments/page.tsx` - List view
- `app/(dashboard)/departments/[id]/page.tsx` - Detail view
- `app/(dashboard)/departments/[id]/edit/page.tsx` - Edit form
- `components/admin/departments/department-form.tsx` - Form component
- `components/admin/departments/department-table.tsx` - Table with sorting/filtering

**Data Table Features:**
- Sortable columns
- Filterable by status, manager
- Bulk actions (select multiple)
- Export to CSV
- Responsive (card layout on mobile)

### 4. Rooms Management

**Files:**
- `app/(dashboard)/rooms/page.tsx` - Grid/List toggle view
- `app/(dashboard)/rooms/[id]/page.tsx` - Detail page with tabs
- `components/admin/rooms/room-grid.tsx` - Grid layout
- `components/admin/rooms/room-list.tsx` - Table layout
- `components/admin/rooms/room-detail.tsx` - Detail with tabs

**Features:**
- Toggle between grid and list view
- Filter by type, status, department
- Image gallery for room photos
- Amenities list
- Current booking info
- Maintenance history

### 5. Bookings Module

**Files:**
- `app/(dashboard)/bookings/page.tsx` - Booking table
- `app/(dashboard)/bookings/[id]/page.tsx` - Booking detail
- `components/admin/bookings/booking-table.tsx` - Sortable/filterable table
- `components/admin/bookings/booking-detail.tsx` - Full booking information

**Status Flow:**
- Pending → Confirmed → Checked-in → Checked-out
- Option to cancel at any stage
- Payment status tracking

### 6. POS Terminals Module (Revenue)

**Files:**
- `app/(dashboard)/pos-terminals/page.tsx` - Terminal list with status
- `app/(dashboard)/pos-terminals/[id]/page.tsx` - Terminal detail with tabs
- `components/admin/pos-terminals/terminal-list.tsx` - Terminal table
- `components/admin/pos-terminals/terminal-detail.tsx` - Status, transactions, config

**Tabs:**
- Overview (status, health, peripherals)
- Transactions (recent payment history)
- Settings (configuration)
- Maintenance (logs, firmware)

### 7. Games & Entertainment Module (Revenue)

**Files:**
- `app/(dashboard)/games/page.tsx` - Games list with stats
- `app/(dashboard)/games/[id]/page.tsx` - Game detail with tabs
- `components/admin/games/game-list.tsx` - Game table
- `components/admin/games/game-detail.tsx` - Game info with tabs

**Tabs:**
- Overview (info, stats, rating)
- Bookings (upcoming reservations)
- Tournaments (active & past)
- Maintenance (equipment status)
- Revenue (charts & analytics)

### 8. Gym Memberships Module (Revenue)

**Files:**
- `app/(dashboard)/gym-memberships/page.tsx` - Member list
- `app/(dashboard)/gym-memberships/[id]/page.tsx` - Member detail
- `app/(dashboard)/gym-memberships/classes/page.tsx` - Classes schedule
- `app/(dashboard)/gym-memberships/trainers/page.tsx` - Trainers directory
- `components/admin/gym-memberships/membership-list.tsx`
- `components/admin/gym-memberships/membership-detail.tsx`

**Tabs:**
- Overview (membership info, status)
- Classes (enrolled classes)
- Trainer (assigned trainer)
- Check-Ins (attendance calendar)
- Payments (billing history)

---

## POS Terminal UI System

### Overview

**Complete Point-of-Sale (POS) interface** for processing transactions, managing payments, and handling receipts across all departments (Restaurant, Bar, Retail, Room Service).

> **Full Specification**: See [POS_TERMINAL_UI_SPECIFICATION.md](./POS_TERMINAL_UI_SPECIFICATION.md) for comprehensive design details, code examples, and implementation phases.

### Key Features

✅ **Checkout Interface** - Item selection, cart management, real-time calculations  
✅ **Payment Processing** - Multiple payment methods (cash, card, check) with change calculation  
✅ **Discount Application** - Promo codes, employee discounts, manager overrides  
✅ **Refund & Void Operations** - Complete or partial refunds with approval workflow  
✅ **Receipt Generation** - Print or digital receipts with order details  
✅ **Offline Mode** - Queue transactions when connection is lost  
✅ **Terminal Management** - Dashboard for terminal status, configuration, transaction history  
✅ **Cashier Operations** - Shift management, drawer reconciliation, performance tracking  
✅ **Real-time Inventory** - Stock check and reservation during checkout  
✅ **Multi-department Routing** - Items route to appropriate departments automatically  

### Quick File Structure

```
components/admin/pos/
├── pos-checkout.tsx              # Main checkout interface
├── pos-category-selector.tsx      # Product category selection
├── pos-product-grid.tsx           # Item grid with prices
├── pos-cart.tsx                   # Shopping cart with totals
├── pos-payment.tsx                # Payment method selection
├── pos-receipt.tsx                # Receipt display & printing
├── pos-refund.tsx                 # Refund/void operations
├── pos-drawer.tsx                 # Cash drawer management
├── pos-cashier-login.tsx          # Cashier authentication
├── pos-terminal-list.tsx          # Terminal management
├── pos-terminal-detail.tsx        # Terminal detail view
├── pos-transaction-history.tsx    # Transaction lookup
├── pos-reports.tsx                # Sales reports & analytics
└── types.ts                       # TypeScript interfaces

app/(dashboard)/pos-terminals/
├── page.tsx                       # Terminal management hub
├── [id]/
│   ├── checkout/page.tsx         # Live checkout interface
│   ├── transactions/page.tsx      # Transaction history
│   └── configuration/page.tsx     # Terminal settings

api/pos-terminals/
├── route.ts                       # GET/POST terminals
├── [id]/checkout/route.ts         # POST transaction
├── [id]/refund/route.ts           # POST refund
└── login/route.ts                 # POST cashier login
```

### Integration with Existing Systems

The POS Terminal UI integrates with:

- **Orders API** (`/api/orders`) - Create transactions with multi-item support
- **Payments API** (`/api/orders/[id]/payments`) - Record payments
- **Discounts API** (`/api/orders/[id]/discounts`) - Apply promo codes
- **Inventory API** (`/api/inventory`) - Check stock availability
- **Departments API** (`/api/departments`) - Route items to departments

### Implementation Notes

- Checkout interface uses **touch-friendly large buttons** (mobile-first)
- Numeric keypad for price/quantity entry on POS devices
- Real-time totals update as items are added/removed
- Manager approval required for refunds over $50
- Offline transaction queue syncs when connection restored
- Dark mode fully supported

> See **POS_TERMINAL_UI_SPECIFICATION.md** for:
> - Complete checkout flow diagrams
> - Component code examples with full TypeScript
> - Payment processing integration
> - Refund workflow details
> - Terminal management interfaces
> - Reporting & analytics dashboards

---

## Landing Page Implementation

### 1. Public Layout

**File**: `app/(public)/layout.tsx`

```typescript
'use client'

import { Navbar } from '@/components/shared/navbar'
import { Footer } from '@/components/shared/footer'
import { Toaster } from '@/components/ui/sonner'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
      <Toaster />
    </div>
  )
}
```

### 2. Navbar Component

**File**: `components/shared/navbar.tsx`

Features:
- Logo (clickable to home)
- Navigation menu (Home, Rooms, Dining, Amenities, Gallery, Contact)
- "Book Now" CTA button
- "Sign In" link
- Dark mode toggle
- Mobile hamburger menu

```typescript
export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="text-primary">🏨</span>
            Paradise Hotel
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <NavLink href="/">Home</NavLink>
            <NavLink href="/rooms">Rooms</NavLink>
            <NavLink href="/dining">Dining</NavLink>
            <NavLink href="/amenities">Amenities</NavLink>
            <NavLink href="/gallery">Gallery</NavLink>
            <NavLink href="/contact">Contact</NavLink>
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            <Button href="/booking" className="hidden md:flex">
              Book Now
            </Button>
            <Button variant="ghost" href="/login">
              Sign In
            </Button>
            <ThemeToggle />
            <MobileMenu />
          </div>
        </div>
      </div>
    </header>
  )
}
```

### 3. Homepage

**File**: `app/(public)/page.tsx`

Sections:
1. **Hero Section** - Background image, title, CTA, booking widget
2. **Features Section** - 4 key features (WiFi, Spa, Restaurant, Gym)
3. **Room Showcase** - Featured rooms grid
4. **Testimonials** - Guest reviews carousel
5. **Amenities Preview** - Top amenities
6. **CTA Section** - Final call-to-action to book
7. Footer

```typescript
export default function HomePage() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <RoomShowcase />
      <TestimonialsSection />
      <AmenitiesSection />
      <CTASection />
    </>
  )
}
```

### 4. Rooms Page

**File**: `app/(public)/rooms/page.tsx`

Features:
- Grid of room cards
- Filter by type, price, capacity
- Search functionality
- Sort options
- Click card to view details

**Components:**
- `room-grid.tsx` - Grid layout
- `room-card.tsx` - Individual room card
- `room-filter.tsx` - Filter sidebar

### 5. Room Detail Page

**File**: `app/(public)/rooms/[id]/page.tsx`

Features:
- Image carousel/gallery
- Room information (type, capacity, amenities)
- Price and availability
- Booking button (opens booking widget)
- Reviews section
- Similar rooms carousel

### 6. Booking Flow

**Files:**
- `app/(public)/booking/page.tsx` - Multi-step form
- `app/(public)/booking/confirmation/page.tsx` - Booking confirmation
- `components/public/booking/booking-widget.tsx` - Reusable booking form

**Steps:**
1. Select check-in/check-out dates
2. Choose room type and quantity
3. Enter guest information
4. Select amenities/preferences
5. Payment information
6. Confirmation

### 7. Footer Component

**File**: `components/shared/footer.tsx`

Sections:
- About hotel
- Quick links
- Contact information
- Social media links
- Newsletter signup
- Copyright

---

## Component Architecture

### Reusable Admin Components

#### 1. StatCard
```typescript
// components/admin/dashboard/stat-card.tsx
interface StatCardProps {
  title: string
  value: string | number
  icon?: LucideIcon
  change?: string
  trend?: 'up' | 'down'
  color?: 'blue' | 'green' | 'amber' | 'red'
}

export function StatCard({ title, value, icon: Icon, change, trend, color }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <p className={`text-xs ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? '↑' : '↓'} {change}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

#### 2. DataTable
```typescript
// components/admin/tables/data-table.tsx
interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  render?: (row: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  selectable?: boolean
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  onRowClick,
  selectable,
}: DataTableProps<T>) {
  // Implementation with sorting, filtering, pagination
}
```

#### 3. Form Builder
```typescript
// Create consistent forms across admin
interface FormField {
  name: string
  label: string
  type: 'text' | 'email' | 'number' | 'select' | 'textarea' | 'checkbox'
  required?: boolean
  placeholder?: string
  options?: { label: string; value: string }[]
}

// Usage in forms like departments, rooms, bookings, etc.
```

#### 4. Modal/Dialog Pattern
```typescript
// Standard modal for create/edit/delete operations
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Create Department</DialogTitle>
      <DialogDescription>
        Fill in the details below to create a new department
      </DialogDescription>
    </DialogHeader>
    {/* Form content */}
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleSubmit}>Create</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Reusable Public Components

#### 1. HeroSection
```typescript
interface HeroSectionProps {
  backgroundImage?: string
  backgroundVideo?: string
  title: string
  subtitle: string
  cta?: Array<{ label: string; href: string; variant?: 'primary' | 'secondary' }>
  children?: React.ReactNode
}
```

#### 2. FeatureCard
```typescript
interface FeatureCardProps {
  icon: LucideIcon
  title: string
  description: string
  className?: string
}
```

#### 3. RoomCard (Public)
```typescript
interface RoomCardProps {
  id: string
  name: string
  type: string
  image: string
  price: number
  capacity: number
  amenities: string[]
  rating?: number
}
```

#### 4. BookingWidget
```typescript
interface BookingWidgetProps {
  onBooking?: (data: BookingData) => void
  embedded?: boolean
  defaultCheckIn?: Date
  defaultCheckOut?: Date
}
```

#### 5. TestimonialCard
```typescript
interface TestimonialProps {
  text: string
  author: string
  role?: string
  image?: string
  rating: number
}
```

---

## Implementation Timeline

### Phase 1: Admin Dashboard Foundation (Weeks 1-2)

**Week 1:**
- [ ] Create admin sidebar component with hotel menu
- [ ] Create dashboard homepage with stat cards
- [ ] Setup dashboard layout with sidebar + topbar
- [ ] Create reusable StatCard component
- [ ] Create reusable DataTable component

**Week 2:**
- [ ] Build Departments list and detail pages
- [ ] Build Rooms list and detail pages
- [ ] Create Department form component
- [ ] Create Room form component
- [ ] Add sorting/filtering to data tables

### Phase 2: Operations & Transactions (Weeks 3-4)

**Week 3:**
- [ ] Build Bookings module
- [ ] Build Customers module
- [ ] Build Orders module with status tracking
- [ ] Create reusable status badge component

**Week 4:**
- [ ] Build Inventory module
- [ ] Build Staff management
- [ ] Add search and filtering across modules
- [ ] Create export/download functionality

### Phase 3: Revenue Management (Weeks 5-6)

**Week 5:**
- [ ] Build POS Terminals module
- [ ] Create terminal status monitoring
- [ ] Build transaction history view
- [ ] Add terminal health indicators

**Week 6:**
- [ ] Build Games & Entertainment module
- [ ] Create game management interface
- [ ] Build Games bookings/tournaments section
- [ ] Add game revenue analytics

### Phase 4: Gym & Fitness (Week 7)

- [ ] Build Gym Memberships module
- [ ] Create membership management interface
- [ ] Build Classes schedule page
- [ ] Build Trainers directory
- [ ] Add member attendance tracking

### Phase 5: Landing Page (Weeks 8-9)

**Week 8:**
- [ ] Create public layout with navbar & footer
- [ ] Build homepage with hero section
- [ ] Create features section
- [ ] Build room showcase component
- [ ] Create testimonials carousel

**Week 9:**
- [ ] Build rooms page with grid/filter
- [ ] Create room detail page
- [ ] Build dining page
- [ ] Build amenities page
- [ ] Build booking flow

### Phase 6: Polish & Deployment (Week 10)

- [ ] Responsive design testing (mobile, tablet, desktop)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Performance optimization
- [ ] Dark mode testing across all pages
- [ ] User testing and feedback
- [ ] Bug fixes and final polish
- [ ] Deployment

---

## File Creation Checklist

### Admin Dashboard Components

#### Dashboard
- [ ] `components/admin/dashboard/stat-card.tsx`
- [ ] `components/admin/dashboard/chart-card.tsx`
- [ ] `components/admin/dashboard/activity-feed.tsx`
- [ ] `app/(dashboard)/dashboard/page.tsx`

#### Sidebar & Header
- [ ] `components/admin/sidebar/admin-sidebar.tsx`
- [ ] `components/admin/header/admin-header.tsx`
- [ ] `components/admin/header/breadcrumbs.tsx`

#### Departments
- [ ] `components/admin/departments/department-form.tsx`
- [ ] `components/admin/departments/department-table.tsx`
- [ ] `components/admin/departments/department-detail.tsx`
- [ ] `app/(dashboard)/departments/page.tsx`
- [ ] `app/(dashboard)/departments/[id]/page.tsx`
- [ ] `app/(dashboard)/departments/[id]/edit/page.tsx`

#### Rooms
- [ ] `components/admin/rooms/room-grid.tsx`
- [ ] `components/admin/rooms/room-card.tsx`
- [ ] `components/admin/rooms/room-detail.tsx`
- [ ] `components/admin/rooms/room-form.tsx`
- [ ] `app/(dashboard)/rooms/page.tsx`
- [ ] `app/(dashboard)/rooms/[id]/page.tsx`

#### Bookings
- [ ] `components/admin/bookings/booking-table.tsx`
- [ ] `components/admin/bookings/booking-detail.tsx`
- [ ] `components/admin/bookings/booking-status.tsx`
- [ ] `app/(dashboard)/bookings/page.tsx`
- [ ] `app/(dashboard)/bookings/[id]/page.tsx`

#### Orders
- [ ] `components/admin/orders/order-table.tsx`
- [ ] `components/admin/orders/order-detail.tsx`
- [ ] `components/admin/orders/order-status.tsx`
- [ ] `app/(dashboard)/orders/page.tsx`
- [ ] `app/(dashboard)/orders/[id]/page.tsx`

#### Customers
- [ ] `components/admin/customers/customer-table.tsx`
- [ ] `components/admin/customers/customer-detail.tsx`
- [ ] `app/(dashboard)/customers/page.tsx`
- [ ] `app/(dashboard)/customers/[id]/page.tsx`

#### Inventory
- [ ] `components/admin/inventory/inventory-table.tsx`
- [ ] `components/admin/inventory/inventory-form.tsx`
- [ ] `app/(dashboard)/inventory/page.tsx`
- [ ] `app/(dashboard)/inventory/[id]/page.tsx`

#### POS Terminals
- [ ] `components/admin/pos-terminals/terminal-list.tsx`
- [ ] `components/admin/pos-terminals/terminal-detail.tsx`
- [ ] `components/admin/pos-terminals/terminal-status.tsx`
- [ ] `app/(dashboard)/pos-terminals/page.tsx`
- [ ] `app/(dashboard)/pos-terminals/[id]/page.tsx`
- [ ] `app/(dashboard)/pos-terminals/[id]/transactions/page.tsx`

#### Games
- [ ] `components/admin/games/game-list.tsx`
- [ ] `components/admin/games/game-detail.tsx`
- [ ] `components/admin/games/game-card.tsx`
- [ ] `app/(dashboard)/games/page.tsx`
- [ ] `app/(dashboard)/games/[id]/page.tsx`

#### Gym Memberships
- [ ] `components/admin/gym-memberships/membership-list.tsx`
- [ ] `components/admin/gym-memberships/membership-detail.tsx`
- [ ] `components/admin/gym-memberships/member-card.tsx`
- [ ] `components/admin/gym-memberships/class-list.tsx`
- [ ] `components/admin/gym-memberships/trainer-list.tsx`
- [ ] `app/(dashboard)/gym-memberships/page.tsx`
- [ ] `app/(dashboard)/gym-memberships/[id]/page.tsx`
- [ ] `app/(dashboard)/gym-memberships/classes/page.tsx`
- [ ] `app/(dashboard)/gym-memberships/trainers/page.tsx`

#### Shared Admin Components
- [ ] `components/admin/tables/data-table.tsx`
- [ ] `components/admin/tables/table-filters.tsx`
- [ ] `components/admin/modals/create-modal.tsx`
- [ ] `components/admin/modals/delete-dialog.tsx`

#### Settings
- [ ] `components/admin/settings/user-management.tsx`
- [ ] `components/admin/settings/role-management.tsx`
- [ ] `app/(dashboard)/settings/page.tsx`
- [ ] `app/(dashboard)/settings/users/page.tsx`
- [ ] `app/(dashboard)/settings/roles/page.tsx`

### Public Website Components

#### Layout & Navigation
- [ ] `components/shared/navbar.tsx`
- [ ] `components/shared/footer.tsx`
- [ ] `app/(public)/layout.tsx`

#### Homepage Sections
- [ ] `components/public/hero/hero-section.tsx`
- [ ] `components/public/features/features-section.tsx`
- [ ] `components/public/features/feature-card.tsx`
- [ ] `components/public/rooms/room-showcase.tsx`
- [ ] `components/public/testimonials/testimonials-section.tsx`
- [ ] `components/public/testimonials/testimonial-card.tsx`
- [ ] `components/public/cta/cta-section.tsx`
- [ ] `app/(public)/page.tsx`

#### Rooms
- [ ] `components/public/rooms/room-grid.tsx`
- [ ] `components/public/rooms/room-card.tsx`
- [ ] `components/public/rooms/room-detail.tsx`
- [ ] `components/public/rooms/room-filters.tsx`
- [ ] `app/(public)/rooms/page.tsx`
- [ ] `app/(public)/rooms/[id]/page.tsx`

#### Other Pages
- [ ] `components/public/dining/dining-showcase.tsx`
- [ ] `components/public/dining/dining-card.tsx`
- [ ] `components/public/amenities/amenities-grid.tsx`
- [ ] `components/public/gallery/gallery-grid.tsx`
- [ ] `components/public/gallery/image-lightbox.tsx`
- [ ] `components/public/contact/contact-form.tsx`
- [ ] `app/(public)/dining/page.tsx`
- [ ] `app/(public)/amenities/page.tsx`
- [ ] `app/(public)/gallery/page.tsx`
- [ ] `app/(public)/contact/page.tsx`
- [ ] `app/(public)/about/page.tsx`

#### Booking Flow
- [ ] `components/public/booking/booking-widget.tsx`
- [ ] `components/public/booking/booking-form.tsx`
- [ ] `components/public/booking/booking-steps.tsx`
- [ ] `components/public/booking/payment-form.tsx`
- [ ] `app/(public)/booking/page.tsx`
- [ ] `app/(public)/booking/confirmation/page.tsx`

### Type Definitions

- [ ] `types/index.ts`
- [ ] `types/admin.ts` (Department, Room, Booking, etc.)
- [ ] `types/public.ts` (GuestInfo, BookingData, Review, etc.)
- [ ] `types/api.ts` (API response types)

### Services & Utilities

- [ ] `services/api-client.ts`
- [ ] `services/departments.ts`
- [ ] `services/rooms.ts`
- [ ] `services/bookings.ts`
- [ ] `services/customers.ts`
- [ ] `services/orders.ts`
- [ ] `services/pos-terminals.ts`
- [ ] `services/games.ts`
- [ ] `services/gym-memberships.ts`
- [ ] `lib/utils.ts` (update with hotel-specific utilities)
- [ ] `lib/constants.ts` (business rules, status options, etc.)
- [ ] `lib/formatters.ts` (date, currency formatting)

---

## Key Design Decisions

### 1. Color & Theme
Use the existing Tailwind configuration with shadcn/ui theme:
- **Primary**: Sky 500 (#0ea5e9)
- **Secondary**: Slate 800 (#1e293b)
- **Success**: Emerald 500 (#10b981)
- **Warning**: Amber 500 (#f59e0b)
- **Danger**: Red 500 (#ef4444)

### 2. Typography
Follow DESIGN_SYSTEM.md:
- **H1**: 36px, 700 weight
- **H2**: 30px, 600 weight
- **Body**: 16px, 400 weight
- **Small**: 14px, 400 weight

### 3. Spacing
Use Tailwind spacing scale:
- Cards & components: p-6 (24px)
- Sections: gap-6 (24px)
- Page margins: px-4 md:px-6 lg:px-8

### 4. Responsive Design
Mobile-first approach with breakpoints:
- sm: 640px
- md: 768px (hide sidebar, show hamburger)
- lg: 1024px (full dashboard)
- xl: 1280px

### 5. Dark Mode
Enable dark mode throughout:
- Toggle in topbar
- Persist in localStorage
- Use `dark:` prefix for dark variants

### 6. Accessibility
- WCAG 2.1 AA compliance
- Semantic HTML
- ARIA labels where needed
- Keyboard navigation
- 4.5:1 color contrast minimum

---

## Next Steps

1. **Start with Phase 1**: Create the admin sidebar and dashboard foundation
2. **Reference existing code**: Use `components/shared/sidebar.tsx` and `topbar.tsx` as templates
3. **Follow the DESIGN_SYSTEM.md**: For colors, typography, and component patterns
4. **Use shadcn/ui components**: All UI elements should use the pre-configured components
5. **Build incrementally**: Complete each module before moving to the next
6. **Test responsively**: Ensure mobile, tablet, and desktop work correctly
7. **Test accessibility**: Use keyboard navigation, screen readers

---

**Document Status**: ✅ COMPLETE & READY FOR IMPLEMENTATION  
**Version**: 1.0.0  
**Last Updated**: November 18, 2025  

**Ready to start building?** Begin with Phase 1: Admin Dashboard Foundation (Weeks 1-2)

---

**Related Documents:**
- `UI_IMPLEMENTATION_GUIDE.md` - Full implementation guide
- `DESIGN_SYSTEM.md` - Colors, typography, patterns
- `ADMIN_DASHBOARD_SPEC.md` - Detailed admin specs with code examples
- `PUBLIC_SITE_SPEC.md` - Detailed public site specs with code examples
- `UI_DOCUMENTATION_INDEX.md` - Navigation guide
````
