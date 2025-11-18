````markdown
# Component Implementation Roadmap
## Hotel Manager v3 - Build Order & Dependencies

**Document Version**: 1.0.0  
**Created**: November 18, 2025  
**Purpose**: Optimal build sequence with minimal dependencies

---

## Overview

This document outlines the **optimal order** to build components, ensuring each component has all dependencies available before implementation.

### Key Principles

1. **Bottom-up**: Build base/shared components first
2. **Reusable**: Common components used by multiple modules
3. **Dependencies**: Components that depend on others come later
4. **Testing**: Each component can be tested independently

---

## Phase 0: Foundation Components (Prerequisite)

These components already exist in the template. Update/enhance as needed.

### ✅ Existing Components to Enhance

```
components/shared/
├── sidebar.tsx          → Enhance for hotel menu
├── topbar.tsx           → Keep as-is
├── navbar.tsx           → Create for public site
└── footer.tsx           → Create for public site

components/ui/          → All existing shadcn/ui components
├── button.tsx
├── card.tsx
├── input.tsx
├── dialog.tsx
├── table.tsx
├── tabs.tsx
├── badge.tsx
├── avatar.tsx
├── dropdown-menu.tsx
├── select.tsx
├── textarea.tsx
├── label.tsx
└── ... (15+ more)

components/
├── theme-provider.tsx
└── theme-toggle.tsx

lib/
└── utils.ts             → cn() utility already available
```

**Status**: ✅ READY (use as-is for development)

---

## Phase 1: Shared Base Components (Week 1)

Build these first - they're used everywhere.

### 1.1 Reusable Admin Components

**Order of implementation:**

#### 1. StatCard (Dashboard KPI)
```
📁 components/admin/dashboard/stat-card.tsx
├─ Dependencies: Button, Card, Icons (Lucide)
├─ Props: title, value, icon, change, trend, color
├─ Usage: Dashboard home, analytics pages
└─ Priority: ⭐⭐⭐ HIGH
```

**Why first**: Used on every dashboard overview page. Simple component, no data fetching.

#### 2. ChartCard (Data Visualization)
```
📁 components/admin/dashboard/chart-card.tsx
├─ Dependencies: Card, recharts (new dep)
├─ Props: title, type, data, options
├─ Usage: Dashboard, analytics pages
└─ Priority: ⭐⭐⭐ HIGH
```

**Why early**: Need for dashboard visualization. Can use mock data initially.

#### 3. ActivityFeed (Recent Activity)
```
📁 components/admin/dashboard/activity-feed.tsx
├─ Dependencies: Card, Avatar, Badge
├─ Props: activities: Activity[]
├─ Usage: Dashboard home
└─ Priority: ⭐⭐⭐ HIGH
```

**Why early**: Simple list component, used on dashboard.

#### 4. DataTable (Reusable Table)
```
📁 components/admin/tables/data-table.tsx
├─ Dependencies: Table, Button, Dialog, DropdownMenu
├─ Props: columns[], data[], onRowClick, selectable
├─ Features: Sorting, filtering, pagination, selection
├─ Usage: ALL list pages (departments, rooms, bookings, etc.)
└─ Priority: ⭐⭐⭐ CRITICAL
```

**Why critical**: This is the most-used component in admin dashboard. Everything else uses it.

**Implementation complexity**: Medium - involves state management for sorting/filtering/pagination

#### 5. FormField (Reusable Form Input)
```
📁 components/admin/forms/form-field.tsx
├─ Dependencies: Input, Label, Select, Textarea, Checkbox
├─ Props: name, label, type, required, error, options
├─ Usage: ALL forms across admin
└─ Priority: ⭐⭐⭐ CRITICAL
```

**Why critical**: All CRUD forms use this pattern. Standardizes form validation.

#### 6. Status Badge (Visual Status)
```
📁 components/admin/common/status-badge.tsx
├─ Dependencies: Badge, Icons (Lucide)
├─ Props: status: 'active' | 'pending' | 'inactive' | ...
├─ Usage: Bookings, orders, departments, rooms
└─ Priority: ⭐⭐⭐ HIGH
```

**Why early**: Used in many list tables and detail pages.

#### 7. Modal/Dialog Patterns
```
📁 components/admin/modals/
├── create-dialog.tsx     (New item dialog)
├── edit-dialog.tsx       (Edit item dialog)
├── delete-dialog.tsx     (Confirmation dialog)
└─ Dependencies: Dialog, Button, Form
```

**Why early**: Needed for CRUD operations on every module.

### 1.2 Navigation & Layout Components

#### 8. Enhanced Sidebar
```
📁 components/admin/sidebar/admin-sidebar.tsx
├─ Refactor: components/shared/sidebar.tsx
├─ Add: Hotel-specific menu structure
├─ Props: collapsed, items[], onNavigate
├─ Usage: (dashboard) layout.tsx
└─ Priority: ⭐⭐⭐ HIGH
```

**Hotel-specific menu:**
```typescript
const hotelSidebarMenu = [
  { section: 'Dashboard', items: [{ title: 'Overview', ... }, { title: 'Analytics', ... }] },
  { section: 'Operations', items: [{ title: 'Departments', ... }, { title: 'Rooms', ... }, ...] },
  { section: 'Revenue', items: [{ title: 'POS Terminals', ... }, { title: 'Games', ... }, ...] },
  { section: 'Settings', items: [{ title: 'Users', ... }, { title: 'Roles', ... }, ...] },
]
```

#### 9. Breadcrumbs
```
📁 components/admin/header/breadcrumbs.tsx
├─ Dependencies: Link, ChevronRight icon
├─ Props: items: { label, href }[]
├─ Usage: Admin header, detail pages
└─ Priority: ⭐⭐ MEDIUM
```

#### 10. Header/Topbar
```
📁 components/admin/header/admin-header.tsx
├─ Uses: Existing Topbar from template
├─ Add: Breadcrumbs, SearchBar
├─ Props: breadcrumbs?
├─ Usage: (dashboard) layout.tsx
└─ Priority: ⭐⭐ MEDIUM
```

### 1.3 Public Site Base Components

#### 11. Navbar (Public)
```
📁 components/shared/navbar.tsx
├─ Dependencies: Button, Link, ThemeToggle
├─ Props: transparent?, sticky?
├─ Features: Navigation menu, book CTA, sign in, theme toggle
├─ Responsive: Desktop nav, mobile hamburger
├─ Usage: (public) layout.tsx
└─ Priority: ⭐⭐⭐ HIGH
```

#### 12. Footer (Public)
```
📁 components/shared/footer.tsx
├─ Dependencies: Link, Button, Input
├─ Sections: About, Links, Contact, Newsletter, Social, Copyright
├─ Usage: (public) layout.tsx
└─ Priority: ⭐⭐⭐ HIGH
```

---

## Phase 2: Admin Pages & Modules (Weeks 2-3)

Now build the admin pages using Phase 1 components as building blocks.

### 2.1 Dashboard Home

#### 13. Dashboard Page
```
📁 app/(dashboard)/dashboard/page.tsx
├─ Uses: StatCard, ChartCard, ActivityFeed
├─ Structure: Header + KPI grid + Charts + Activity
├─ Data: Mock data initially, API later
└─ Priority: ⭐⭐⭐ HIGH
```

**Build order**: StatCard (1) → ChartCard (2) → ActivityFeed (3) → Dashboard page (13)

### 2.2 Departments Module

#### 14. Department Form Component
```
📁 components/admin/departments/department-form.tsx
├─ Uses: FormField, Button, Card
├─ Fields: name, manager select, budget, description, status
├─ Validation: Required fields, numeric budget
├─ Props: initialData?, onSubmit, isLoading
└─ Priority: ⭐⭐⭐ HIGH
```

#### 15. Department Table Component
```
📁 components/admin/departments/department-table.tsx
├─ Uses: DataTable (4)
├─ Columns: Name, Manager, Staff count, Status, Actions
├─ Actions: View, Edit, Delete
└─ Priority: ⭐⭐⭐ HIGH
```

#### 16. Department List Page
```
📁 app/(dashboard)/departments/page.tsx
├─ Uses: department-table.tsx, Button, Dialog
├─ Features: List with search, filters, new button
├─ Layout: Header + Filters + Table
└─ Priority: ⭐⭐⭐ HIGH
```

#### 17. Department Detail Page
```
📁 app/(dashboard)/departments/[id]/page.tsx
├─ Uses: Card, Tabs, ActivityFeed
├─ Tabs: Overview, Staff, Inventory, Analytics
├─ Layout: Header + Department info + Tabs
└─ Priority: ⭐⭐⭐ HIGH
```

#### 18. Department Edit Page
```
📁 app/(dashboard)/departments/[id]/edit/page.tsx
├─ Uses: department-form.tsx
├─ Layout: Header + Form
└─ Priority: ⭐⭐ MEDIUM
```

**Build order**: Form (14) → Table (15) → List page (16) → Detail page (17) → Edit page (18)

### 2.3 Rooms Module

#### 19. Room Card Component
```
📁 components/admin/rooms/room-card.tsx
├─ Uses: Card, Badge, Button, Image
├─ Fields: image, number, type, status, price, amenities
├─ Display: Grid or list item
└─ Priority: ⭐⭐⭐ HIGH
```

#### 20. Room Grid Component
```
📁 components/admin/rooms/room-grid.tsx
├─ Uses: room-card (19), Button (toggle list view)
├─ Layout: Responsive grid, 1 col mobile, 3 col desktop
└─ Priority: ⭐⭐⭐ HIGH
```

#### 21. Room List Table
```
📁 components/admin/rooms/room-list.tsx
├─ Uses: DataTable (4)
├─ Columns: Number, Type, Status, Capacity, Price, Dept, Actions
└─ Priority: ⭐⭐⭐ HIGH
```

#### 22. Room Form
```
📁 components/admin/rooms/room-form.tsx
├─ Uses: FormField, Button, Checkbox (amenities)
├─ Fields: number, type select, capacity, price, amenities, status
└─ Priority: ⭐⭐⭐ HIGH
```

#### 23. Rooms List Page
```
📁 app/(dashboard)/rooms/page.tsx
├─ Uses: room-grid (20), room-list (21), Button
├─ Features: Toggle grid/list view, filters, new room button
└─ Priority: ⭐⭐⭐ HIGH
```

#### 24. Room Detail Page
```
📁 app/(dashboard)/rooms/[id]/page.tsx
├─ Uses: Card, Tabs, Image carousel
├─ Tabs: Info, Amenities, Current booking, Maintenance
├─ Layout: Gallery + Info card + Tabs
└─ Priority: ⭐⭐⭐ HIGH
```

**Build order**: Card (19) → Grid (20) → List (21) → Form (22) → List page (23) → Detail page (24)

### 2.4 Bookings Module

#### 25. Booking Table
```
📁 components/admin/bookings/booking-table.tsx
├─ Uses: DataTable (4), Status badge (6)
├─ Columns: ID, Guest, Room, Check-in, Check-out, Status, Total, Actions
└─ Priority: ⭐⭐⭐ HIGH
```

#### 26. Bookings List Page
```
📁 app/(dashboard)/bookings/page.tsx
├─ Uses: booking-table (25), Filters
├─ Features: Filter by status, date range, guest name
└─ Priority: ⭐⭐⭐ HIGH
```

#### 27. Booking Detail Page
```
📁 app/(dashboard)/bookings/[id]/page.tsx
├─ Uses: Card, Tabs
├─ Tabs: Overview, Guest info, Payment, Activity
├─ Layout: Booking info + Guest + Payment + Timeline
└─ Priority: ⭐⭐⭐ HIGH
```

### 2.5 Orders Module

#### 28. Order Table
```
📁 components/admin/orders/order-table.tsx
├─ Uses: DataTable (4), Status badge (6)
├─ Columns: ID, Guest, Items, Status, Total, Actions
└─ Priority: ⭐⭐⭐ HIGH
```

#### 29. Orders List Page
```
📁 app/(dashboard)/orders/page.tsx
├─ Uses: order-table (28), Status filters
└─ Priority: ⭐⭐⭐ HIGH
```

#### 30. Order Detail Page
```
📁 app/(dashboard)/orders/[id]/page.tsx
├─ Uses: Card, Tabs, Timeline
├─ Tabs: Items, Status, Customer, History
└─ Priority: ⭐⭐⭐ HIGH
```

### 2.6 Quick Builds (Similar Pattern)

These follow the same pattern as above, just different data:

#### 31. Customers Module
```
📁 components/admin/customers/customer-table.tsx
📁 app/(dashboard)/customers/page.tsx
📁 app/(dashboard)/customers/[id]/page.tsx
```

#### 32. Inventory Module
```
📁 components/admin/inventory/inventory-table.tsx
📁 components/admin/inventory/inventory-form.tsx
📁 app/(dashboard)/inventory/page.tsx
📁 app/(dashboard)/inventory/[id]/page.tsx
```

---

## Phase 3: Revenue Management Modules (Week 4)

### 33. POS Terminals Module
```
📁 components/admin/pos-terminals/
├── terminal-list.tsx      (List with status indicators)
├── terminal-detail.tsx    (Detail with tabs)
├── terminal-status.tsx    (Status badge/indicator)
│
📁 app/(dashboard)/pos-terminals/
├── page.tsx              (List view)
├── [id]/page.tsx         (Detail)
├── [id]/transactions/    (Transaction history)
└── [id]/settings/        (Configuration)

Priority: ⭐⭐⭐ HIGH (Revenue critical)
```

### 34. Games & Entertainment Module
```
📁 components/admin/games/
├── game-list.tsx        (List with stats)
├── game-detail.tsx      (Detail with tabs)
├── game-card.tsx        (Card display)
│
📁 app/(dashboard)/games/
├── page.tsx            (List with KPI cards)
├── [id]/page.tsx       (Detail)
├── [id]/bookings/      (Booking history)
└── [id]/tournaments/   (Tournament mgmt)

Priority: ⭐⭐⭐ HIGH (Revenue critical)
```

### 35. Gym Memberships Module
```
📁 components/admin/gym-memberships/
├── membership-list.tsx    (List)
├── membership-detail.tsx  (Detail with tabs)
├── member-card.tsx        (Card display)
├── class-list.tsx         (Classes schedule)
├── trainer-list.tsx       (Trainers directory)
│
📁 app/(dashboard)/gym-memberships/
├── page.tsx            (Member list)
├── [id]/page.tsx       (Member detail)
├── classes/page.tsx    (Classes schedule)
└── trainers/page.tsx   (Trainers list)

Priority: ⭐⭐⭐ HIGH (Revenue critical)
```

---

## Phase 4: Public Website (Week 5)

### 4.1 Base Components

#### 36. HeroSection
```
📁 components/public/hero/hero-section.tsx
├─ Uses: Button, Input
├─ Props: backgroundImage, title, subtitle, cta[], children
├─ Features: Background image/video, CTA buttons
└─ Priority: ⭐⭐⭐ HIGH
```

#### 37. FeatureCard
```
📁 components/public/features/feature-card.tsx
├─ Uses: Card, Icons
├─ Props: icon, title, description
└─ Priority: ⭐⭐⭐ HIGH
```

#### 38. RoomCard (Public)
```
📁 components/public/rooms/room-card.tsx
├─ Different from admin room-card (19)
├─ Uses: Card, Button, Image, Badge
├─ Props: id, image, name, type, price, rating, amenities
├─ Features: Guest-facing, with booking button
└─ Priority: ⭐⭐⭐ HIGH
```

#### 39. TestimonialCard
```
📁 components/public/testimonials/testimonial-card.tsx
├─ Uses: Card, Avatar, Stars (rating)
├─ Props: text, author, role, image, rating
└─ Priority: ⭐⭐⭐ HIGH
```

#### 40. BookingWidget (Standalone)
```
📁 components/public/booking/booking-widget.tsx
├─ Uses: Input, Button, Select, DatePicker
├─ Features: Check-in/out date, rooms, guests
├─ Props: onSearch, embedded?
├─ Used: Homepage hero, sidebar on public pages
└─ Priority: ⭐⭐⭐ CRITICAL
```

### 4.2 Section Components

#### 41. FeaturesSection
```
📁 components/public/features/features-section.tsx
├─ Uses: feature-card (37)
├─ Layout: 4 features grid
└─ Priority: ⭐⭐⭐ HIGH
```

#### 42. RoomShowcase
```
📁 components/public/rooms/room-showcase.tsx
├─ Uses: room-card (38), Button (view all)
├─ Layout: Grid showing 3-4 featured rooms
└─ Priority: ⭐⭐⭐ HIGH
```

#### 43. TestimonialsSection
```
📁 components/public/testimonials/testimonials-section.tsx
├─ Uses: testimonial-card (39), Carousel
├─ Layout: Carousel or grid with testimonials
└─ Priority: ⭐⭐⭐ HIGH
```

#### 44. CTASection
```
📁 components/public/cta/cta-section.tsx
├─ Uses: Button, Heading
├─ Layout: Large call-to-action
├─ Props: title, subtitle, cta
└─ Priority: ⭐⭐⭐ HIGH
```

### 4.3 Homepage

#### 45. Homepage
```
📁 app/(public)/page.tsx
├─ Uses: HeroSection (36), FeaturesSection (41), RoomShowcase (42), 
│        TestimonialsSection (43), CTASection (44), BookingWidget (40)
├─ Structure: Hero + Features + Rooms + Testimonials + CTA + Footer
└─ Priority: ⭐⭐⭐ CRITICAL
```

### 4.4 Rooms Pages

#### 46. RoomGrid (Public)
```
📁 components/public/rooms/room-grid.tsx
├─ Uses: room-card (38), Filters
├─ Layout: Responsive grid with filters
└─ Priority: ⭐⭐⭐ HIGH
```

#### 47. Rooms Page
```
📁 app/(public)/rooms/page.tsx
├─ Uses: room-grid (46), Filters, Search
└─ Priority: ⭐⭐⭐ HIGH
```

#### 48. Room Detail Page (Public)
```
📁 app/(public)/rooms/[id]/page.tsx
├─ Uses: ImageCarousel, BookingWidget (40), Reviews
├─ Tabs: Info, Amenities, Reviews, Availability
└─ Priority: ⭐⭐⭐ HIGH
```

### 4.5 Other Public Pages (Quick Builds)

#### 49. Dining Page
```
📁 app/(public)/dining/page.tsx
├─ Components: DiningCard, DiningShowcase
└─ Priority: ⭐⭐ MEDIUM
```

#### 50. Amenities Page
```
📁 app/(public)/amenities/page.tsx
├─ Components: AmenitiesGrid
└─ Priority: ⭐⭐ MEDIUM
```

#### 51. Gallery Page
```
📁 app/(public)/gallery/page.tsx
├─ Components: GalleryGrid, ImageLightbox
└─ Priority: ⭐⭐ MEDIUM
```

#### 52. Contact Page
```
📁 app/(public)/contact/page.tsx
├─ Components: ContactForm, Map, ContactInfo
└─ Priority: ⭐⭐ MEDIUM
```

#### 53. Booking Flow
```
📁 app/(public)/booking/page.tsx
├─ Components: BookingForm (multi-step), ProgressBar
├─ Features: Step 1-5 wizard flow
└─ Priority: ⭐⭐⭐ HIGH
```

#### 54. Booking Confirmation
```
📁 app/(public)/booking/confirmation/page.tsx
├─ Components: ConfirmationCard, BookingDetails
└─ Priority: ⭐⭐⭐ HIGH
```

---

## Implementation Sequence Summary

### Total Components to Build: 54

### Optimal Build Order (Dependency-aware)

```
PHASE 0 (Existing):
├─ 5 existing UI components
├─ sidebar.tsx (enhance)
├─ layout.tsx (root)
└─ All shadcn/ui components

PHASE 1 (Foundation - 10 components):
1️⃣ StatCard
2️⃣ ChartCard
3️⃣ ActivityFeed
4️⃣ DataTable
5️⃣ FormField
6️⃣ StatusBadge
7️⃣ Modal dialogs
8️⃣ AdminSidebar (enhanced)
9️⃣ Breadcrumbs
🔟 Topbar/Header

PHASE 2 (Admin - 21 components):
11️⃣ Navbar (public)
1️⃣2️⃣ Footer
1️⃣3️⃣ Dashboard page
1️⃣4️⃣-1️⃣8️⃣ Departments module
1️⃣9️⃣-2️⃣4️⃣ Rooms module
2️⃣5️⃣-2️⃣7️⃣ Bookings module
2️⃣8️⃣-3️⃣0️⃣ Orders module
3️⃣1️⃣-3️⃣2️⃣ Customers & Inventory

PHASE 3 (Revenue - 9 components):
3️⃣3️⃣ POS Terminals module
3️⃣4️⃣ Games & Entertainment
3️⃣5️⃣ Gym Memberships

PHASE 4 (Public - 19 components):
3️⃣6️⃣-4️⃣4️⃣ Base components
4️⃣5️⃣ Homepage
4️⃣6️⃣-4️⃣8️⃣ Rooms pages
4️⃣9️⃣-5️⃣4️⃣ Other pages
```

---

## Estimated Timeline

```
Phase 1 (Foundation):      Week 1      (10 components)
Phase 2 (Admin):           Weeks 2-3   (21 components)
Phase 3 (Revenue):         Week 4      (9 components)
Phase 4 (Public):          Week 5      (19 components)
Phase 5 (Polish & Test):   Week 6      (optimization, bugs, QA)
Phase 6 (Deployment):      Week 7      (final checks, deploy)
─────────────────────────────────────
Total:                     7 weeks
```

---

## Key Dependencies Map

```
DataTable (4) ← Used by:
├─ Department table
├─ Rooms table
├─ Bookings table
├─ Orders table
├─ Customers table
├─ Inventory table
├─ POS Terminals
├─ Games list
└─ Gym Memberships

StatCard (1) ← Used by:
├─ Dashboard
├─ POS Terminals page
├─ Games page
└─ Gym Memberships page

FormField (5) ← Used by:
├─ Department form
├─ Room form
├─ Booking form
├─ Order form
├─ Contact form
└─ Gym form

StatusBadge (6) ← Used by:
├─ Booking table
├─ Order table
├─ POS Terminal status
└─ Room status
```

---

## Parallel Work Opportunities

After Phase 1 is complete, you can work in parallel:

- **Team Member A**: Departments module (Phase 2a)
- **Team Member B**: Rooms module (Phase 2b)
- **Team Member C**: Bookings module (Phase 2c)
- **Team Member D**: Public website (Phase 4)

As long as all use the Phase 1 components, they won't conflict.

---

**Implementation Roadmap Status**: ✅ COMPLETE & OPTIMIZED  
**Version**: 1.0.0  
**Last Updated**: November 18, 2025

**Next Step**: Start with Phase 1 Foundation Components!

````
