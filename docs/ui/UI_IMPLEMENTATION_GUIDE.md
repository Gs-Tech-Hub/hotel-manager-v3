# UI Implementation Guide - Hotel Manager v2
## Comprehensive Frontend Architecture with shadcn, Tailwind CSS & Icons

**Document Version**: 1.1.0  
**Created**: November 15, 2025  
**Status**: Extended with Revenue Management Modules

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Installation & Setup](#installation--setup)
5. [Design System](#design-system)
6. [Admin Dashboard](#admin-dashboard)
7. [Website Landing Pages](#website-landing-pages)
8. [Component Library](#component-library)
9. [Implementation Roadmap](#implementation-roadmap)
10. [Best Practices](#best-practices)

---

## Overview

This document outlines the complete UI/UX implementation strategy for Hotel Manager v2, combining:

- **shadcn/ui** - Enterprise-grade component library
- **Tailwind CSS** - Utility-first styling framework
- **Lucide Icons** - Beautiful, consistent icon system
- **Admin Dashboard** - Department management interface
- **Landing Pages** - Public website templates
- **Responsive Design** - Mobile-first approach
- **Accessibility** - WCAG 2.1 compliance

### Key Goals

✅ Professional, modern aesthetics  
✅ Consistent component library  
✅ Scalable architecture  
✅ Accessibility & responsiveness  
✅ Fast loading & performance  
✅ Easy to maintain & extend  

---

## Technology Stack

### Core Frontend
```json
{
  "next": "16.0.3",
  "react": "19.2.0",
  "react-dom": "19.2.0",
  "tailwindcss": "^4",
  "@tailwindcss/postcss": "^4"
}
```

### UI Components & Icons
```json
{
  "shadcn/ui": "latest",
  "lucide-react": "latest",
  "radix-ui": "latest",
  "class-variance-authority": "^0.7.0",
  "clsx": "^2.0.0"
}
```

### Utilities
```json
{
  "zustand": "^4.4.0",
  "react-query": "^3.39.0",
  "axios": "^1.6.0",
  "date-fns": "^2.30.0",
  "react-hook-form": "^7.48.0",
  "zod": "^3.22.0"
}
```

### Development Tools
```json
{
  "typescript": "^5",
  "@types/react": "^19",
  "@types/react-dom": "^19",
  "tailwind-merge": "^2.2.0",
  "tailwindcss-animate": "^1.0.7"
}
```

---

## Project Structure

### Recommended Directory Layout

```
hotel-manager-v3/
├── app/
│   ├── (admin)/                          # Admin dashboard layout group
│   │   ├── layout.tsx                    # Admin layout with sidebar
│   │   ├── page.tsx                      # Dashboard home
│   │   ├── dashboard/
│   │   │   ├── page.tsx                  # Overview & stats
│   │   │   └── layout.tsx
│   │   │
│   │   ├── departments/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                  # Departments list
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx              # Department detail
│   │   │   │   ├── edit/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── staff/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── inventory/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── analytics/
│   │   │   │       └── page.tsx
│   │   │   └── create/
│   │   │       └── page.tsx
│   │   │
│   │   ├── rooms/
│   │   │   ├── page.tsx                  # Rooms management
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx
│   │   │   │   └── edit/
│   │   │   │       └── page.tsx
│   │   │   └── create/
│   │   │       └── page.tsx
│   │   │
│   │   ├── bookings/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx
│   │   │   └── analytics/
│   │   │       └── page.tsx
│   │   │
│   │   ├── customers/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx
│   │   │   └── analytics/
│   │   │       └── page.tsx
│   │   │
│   │   ├── orders/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx
│   │   │   └── analytics/
│   │   │       └── page.tsx
│   │   │
│   │   ├── inventory/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx
│   │   │   └── analytics/
│   │   │       └── page.tsx
│   │   │
│   │   ├── staff/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx
│   │   │   └── schedules/
│   │   │       └── page.tsx
│   │   │
│   │   ├── settings/
│   │   │   ├── page.tsx                  # Admin settings
│   │   │   ├── roles/
│   │   │   │   └── page.tsx              # Role management
│   │   │   └── users/
│   │   │       └── page.tsx              # User management
│   │   │
│   │   ├── reports/
│   │   │   ├── page.tsx
│   │   │   ├── revenue/
│   │   │   │   └── page.tsx
│   │   │   ├── occupancy/
│   │   │   │   └── page.tsx
│   │   │   └── export/
│   │   │       └── page.tsx
│   │   │
│   │   ├── pos-terminals/                # ⭐ NEW: POS Terminal Management
│   │   │   ├── page.tsx                  # Terminal list
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx              # Terminal detail
│   │   │   │   ├── transactions/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── settings/
│   │   │   │       └── page.tsx
│   │   │   └── create/
│   │   │       └── page.tsx
│   │   │
│   │   ├── games/                        # ⭐ NEW: Games & Entertainment
│   │   │   ├── page.tsx                  # Games list
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx              # Game detail
│   │   │   │   ├── bookings/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── tournaments/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── maintenance/
│   │   │   │       └── page.tsx
│   │   │   ├── tournaments/
│   │   │   │   └── page.tsx
│   │   │   └── create/
│   │   │       └── page.tsx
│   │   │
│   │   ├── gym-memberships/              # ⭐ NEW: Gym & Sports Memberships
│   │   │   ├── page.tsx                  # Memberships list
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx              # Member detail
│   │   │   │   ├── classes/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── trainer/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── payments/
│   │   │   │       └── page.tsx
│   │   │   ├── classes/
│   │   │   │   └── page.tsx              # Classes management
│   │   │   ├── trainers/
│   │   │   │   └── page.tsx              # Trainers management
│   │   │   └── create/
│   │   │       └── page.tsx
│   │   │
│   │   └── api/
│   │       └── (existing API routes)
│   │
│   ├── (public)/                         # Public landing page layout group
│   │   ├── layout.tsx                    # Public layout
│   │   ├── page.tsx                      # Homepage
│   │   ├── about/
│   │   │   └── page.tsx
│   │   ├── rooms/
│   │   │   ├── page.tsx                  # Rooms showcase
│   │   │   └── [id]/
│   │   │       └── page.tsx              # Room detail
│   │   ├── dining/
│   │   │   ├── page.tsx                  # Restaurant & Bar
│   │   │   └── menu/
│   │   │       └── page.tsx
│   │   ├── amenities/
│   │   │   └── page.tsx
│   │   ├── gallery/
│   │   │   └── page.tsx
│   │   ├── contact/
│   │   │   └── page.tsx
│   │   └── booking/
│   │       ├── page.tsx
│   │       └── confirmation/
│   │           └── page.tsx
│   │
│   ├── api/                              # API routes (existing)
│   │   ├── admin/
│   │   ├── bookings/
│   │   ├── customers/
│   │   ├── departments/
│   │   ├── orders/
│   │   └── stats/
│   │
│   ├── layout.tsx                        # Root layout
│   ├── page.tsx                          # Root page (redirect)
│   ├── globals.css                       # Global styles
│   └── not-found.tsx                     # 404 page
│
├── src/
│   ├── components/
│   │   ├── admin/                        # Admin-specific components
│   │   │   ├── sidebar/
│   │   │   │   ├── admin-sidebar.tsx
│   │   │   │   ├── sidebar-menu.tsx
│   │   │   │   └── sidebar-item.tsx
│   │   │   ├── header/
│   │   │   │   ├── admin-header.tsx
│   │   │   │   ├── user-menu.tsx
│   │   │   │   └── breadcrumbs.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── dashboard-grid.tsx
│   │   │   │   ├── stat-card.tsx
│   │   │   │   ├── chart-card.tsx
│   │   │   │   └── recent-activity.tsx
│   │   │   ├── tables/
│   │   │   │   ├── data-table.tsx        # Reusable table
│   │   │   │   ├── departments-table.tsx
│   │   │   │   ├── rooms-table.tsx
│   │   │   │   ├── bookings-table.tsx
│   │   │   │   ├── customers-table.tsx
│   │   │   │   ├── orders-table.tsx
│   │   │   │   ├── staff-table.tsx
│   │   │   │   ├── pos-terminals-table.tsx   # ⭐ NEW
│   │   │   │   ├── games-table.tsx           # ⭐ NEW
│   │   │   │   └── memberships-table.tsx     # ⭐ NEW
│   │   │   ├── modals/
│   │   │   │   ├── create-modal.tsx
│   │   │   │   ├── edit-modal.tsx
│   │   │   │   ├── delete-modal.tsx
│   │   │   │   └── bulk-action-modal.tsx
│   │   │   ├── forms/
│   │   │   │   ├── department-form.tsx
│   │   │   │   ├── room-form.tsx
│   │   │   │   ├── booking-form.tsx
│   │   │   │   ├── customer-form.tsx
│   │   │   │   ├── staff-form.tsx
│   │   │   │   ├── role-form.tsx
│   │   │   │   ├── pos-terminal-form.tsx     # ⭐ NEW
│   │   │   │   ├── game-form.tsx             # ⭐ NEW
│   │   │   │   ├── membership-form.tsx       # ⭐ NEW
│   │   │   │   ├── class-form.tsx            # ⭐ NEW
│   │   │   │   └── trainer-form.tsx          # ⭐ NEW
│   │   │   ├── cards/
│   │   │   │   ├── department-card.tsx
│   │   │   │   ├── quick-stat-card.tsx
│   │   │   │   ├── activity-card.tsx
│   │   │   │   ├── terminal-status-card.tsx     # ⭐ NEW
│   │   │   │   ├── game-card.tsx                # ⭐ NEW
│   │   │   │   └── membership-card.tsx          # ⭐ NEW
│   │   │   └── dialogs/
│   │   │       ├── confirm-dialog.tsx
│   │   │       └── action-dialog.tsx
│   │   │
│   │   ├── public/                       # Public site components
│   │   │   ├── header/
│   │   │   │   ├── navbar.tsx
│   │   │   │   ├── nav-menu.tsx
│   │   │   │   └── mobile-menu.tsx
│   │   │   ├── footer/
│   │   │   │   ├── footer.tsx
│   │   │   │   └── footer-section.tsx
│   │   │   ├── hero/
│   │   │   │   ├── hero-section.tsx
│   │   │   │   └── hero-slider.tsx
│   │   │   ├── features/
│   │   │   │   ├── features-grid.tsx
│   │   │   │   └── feature-card.tsx
│   │   │   ├── testimonials/
│   │   │   │   ├── testimonials-carousel.tsx
│   │   │   │   └── testimonial-card.tsx
│   │   │   ├── booking-widget/
│   │   │   │   ├── booking-form.tsx
│   │   │   │   ├── date-picker.tsx
│   │   │   │   └── price-calculator.tsx
│   │   │   ├── room-showcase/
│   │   │   │   ├── room-grid.tsx
│   │   │   │   └── room-card.tsx
│   │   │   ├── gallery/
│   │   │   │   ├── gallery-grid.tsx
│   │   │   │   └── lightbox.tsx
│   │   │   └── cta/
│   │   │       └── cta-section.tsx
│   │   │
│   │   ├── shared/                       # Shared components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── radio.tsx
│   │   │   ├── label.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── pill.tsx
│   │   │   ├── card.tsx
│   │   │   ├── alert.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── accordion.tsx
│   │   │   ├── pagination.tsx
│   │   │   ├── loading-skeleton.tsx
│   │   │   ├── empty-state.tsx
│   │   │   └── error-boundary.tsx
│   │   │
│   │   └── icons/
│   │       └── custom-icons.tsx          # Custom icon variants
│   │
│   ├── hooks/
│   │   ├── use-admin.ts                  # Admin-specific hooks
│   │   ├── use-api.ts                    # API calls wrapper
│   │   ├── use-form.ts                   # Form handling
│   │   ├── use-pagination.ts
│   │   ├── use-filters.ts
│   │   ├── use-sort.ts
│   │   ├── use-debounce.ts
│   │   ├── use-clipboard.ts
│   │   ├── use-local-storage.ts
│   │   └── use-viewport.ts               # Responsive hooks
│   │
│   ├── store/
│   │   ├── admin-store.ts                # Zustand stores
│   │   ├── ui-store.ts
│   │   ├── auth-store.ts
│   │   └── notifications-store.ts
│   │
│   ├── utils/
│   │   ├── cn.ts                         # Tailwind merge utility
│   │   ├── format.ts                     # Formatting utilities
│   │   ├── api-client.ts                 # API client wrapper
│   │   ├── constants.ts                  # UI constants
│   │   └── validators.ts                 # Form validators
│   │
│   ├── styles/
│   │   ├── globals.css                   # Global styles
│   │   ├── admin.css                     # Admin-specific styles
│   │   ├── public.css                    # Public site styles
│   │   └── animations.css                # Custom animations
│   │
│   ├── types/
│   │   ├── admin.ts                      # Admin types
│   │   ├── components.ts                 # Component props types
│   │   └── (existing entity types)
│   │
│   └── lib/
│       └── (existing utilities)
│
├── public/
│   ├── images/
│   │   ├── admin/
│   │   │   ├── logo-dark.png
│   │   │   └── logo-light.png
│   │   ├── public/
│   │   │   ├── hero-banner.jpg
│   │   │   ├── rooms/
│   │   │   ├── amenities/
│   │   │   └── gallery/
│   │   └── icons/
│   │       └── custom-icons/
│   │
│   ├── videos/
│   │   └── hero-video.mp4
│   │
│   └── documents/
│       └── hotel-brochure.pdf
│
└── docs/
    ├── UI_IMPLEMENTATION_GUIDE.md        # This file
    ├── COMPONENT_LIBRARY.md              # Component documentation
    ├── DESIGN_SYSTEM.md                  # Design tokens & guidelines
    ├── ADMIN_DASHBOARD_SPEC.md           # Admin dashboard specification
    └── PUBLIC_SITE_SPEC.md               # Landing page specification
```

---

## Installation & Setup

### Step 1: Install Dependencies

```bash
npm install
npm install -D shadcn-ui
```

### Step 2: Install shadcn/ui Components

```bash
# Initialize shadcn/ui
npx shadcn-ui@latest init -d

# Install required components
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add select
npx shadcn-ui@latest add checkbox
npx shadcn-ui@latest add radio
npx shadcn-ui@latest add label
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add card
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add tooltip
npx shadcn-ui@latest add popover
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add accordion
npx shadcn-ui@latest add pagination
npx shadcn-ui@latest add table
npx shadcn-ui@latest add date-picker
npx shadcn-ui@latest add command
npx shadcn-ui@latest add combobox
```

### Step 3: Install Additional Libraries

```bash
npm install lucide-react zustand react-query axios date-fns react-hook-form zod
npm install -D tailwindcss-animate tailwind-merge
```

### Step 4: Configure Tailwind CSS

**Update `tailwind.config.ts`:**

```typescript
import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
}
export default config
```

### Step 5: Create Global Styles

**Update `app/globals.css`:**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --muted: 221.2 63.3% 97.8%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 222.2 47.6% 11.2%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --primary: 222.2 47.6% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 217.2 91.2% 59.8%;
    --secondary-foreground: 222.2 47.6% 11.2%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.3% 65.1%;
    --accent: 210 40% 98%;
    --accent-foreground: 222.2 47.6% 11.2%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.6% 11.2%;
    --secondary: 217.2 91.2% 59.8%;
    --secondary-foreground: 222.2 47.6% 11.2%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

---

## Design System

### Color Palette

#### Primary Colors
- **Primary**: `#1e293b` (Slate 900) - Main brand color
- **Primary Foreground**: `#f8fafc` (Slate 50)

#### Secondary Colors
- **Secondary**: `#0ea5e9` (Sky 500) - Accent color
- **Secondary Foreground**: `#1e293b`

#### Status Colors
- **Success**: `#10b981` (Emerald 500)
- **Warning**: `#f59e0b` (Amber 500)
- **Danger**: `#ef4444` (Red 500)
- **Info**: `#3b82f6` (Blue 500)

#### Neutral Colors
- **Background**: `#ffffff` (White)
- **Foreground**: `#1e293b` (Slate 900)
- **Muted**: `#f1f5f9` (Slate 100)
- **Muted Foreground**: `#64748b` (Slate 500)
- **Border**: `#e2e8f0` (Slate 200)

### Typography Scale

```css
/* Headings */
h1 { font-size: 2.25rem; font-weight: 700; line-height: 1.2; }
h2 { font-size: 1.875rem; font-weight: 600; line-height: 1.3; }
h3 { font-size: 1.5rem; font-weight: 600; line-height: 1.4; }
h4 { font-size: 1.25rem; font-weight: 600; line-height: 1.4; }
h5 { font-size: 1.125rem; font-weight: 600; line-height: 1.5; }
h6 { font-size: 1rem; font-weight: 600; line-height: 1.5; }

/* Body */
body { font-size: 1rem; line-height: 1.5; }
.small { font-size: 0.875rem; line-height: 1.5; }
.xs { font-size: 0.75rem; line-height: 1.5; }

/* Font Family */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Spacing Scale

```
4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 56px, 64px
Classes: space-1 to space-16
```

### Border Radius

```
Rounded Small: 0.25rem (4px)
Rounded Medium: 0.5rem (8px)   [default]
Rounded Large: 0.75rem (12px)
Rounded XL: 1rem (16px)
Rounded Full: 9999px (pill)
```

### Shadow Depth

```
Subtle: 0 1px 2px rgba(0, 0, 0, 0.05)
Base: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)
Medium: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)
Large: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)
XL: 0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)
```

### Icon Library

**Lucide React Icons** - 1000+ professional icons

Common Admin Dashboard Icons:
```typescript
// Navigation
LayoutDashboard, Menu, X, ChevronLeft, ChevronRight
BarChart3, LineChart, PieChart, TrendingUp
Users, UserCheck, UserPlus, UserMinus
Settings, Lock, LogOut, Bell, Search

// Departments
Building, Building2, Briefcase, Factory
Users, UserCog, Zap, Wrench

// Rooms
Home, Hotel, Maximize, Wind, Wifi, Coffee

// Bookings
Calendar, Clock, CheckCircle, XCircle
AlertCircle, HelpCircle, MoreVertical, ArrowRight

// Orders
ShoppingCart, Package, Truck, CreditCard
DollarSign, TrendingUp, BarChart, PieChart

// Actions
Plus, Edit, Trash2, Copy, Download, Upload
Eye, EyeOff, Filter, Sliders, RefreshCw, Save

// Status
CheckCircle, AlertCircle, XCircle, Clock, Pause
```

---

## Admin Dashboard

### Dashboard Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Admin Layout                         │
│                                                         │
│  ┌──────────┬────────────────────────────────────────┐ │
│  │          │                                        │ │
│  │ Sidebar  │        Admin Header (Navbar)          │ │
│  │          │  • Logo, Search, Notifications, Menu  │ │
│  │ • Logo   │                                        │ │
│  │ • Nav    ├────────────────────────────────────────┤ │
│  │ • Menu   │                                        │ │
│  │ • Dark   │        Page Content                    │ │
│  │   Mode   │        (Dashboard/Module/etc)         │ │
│  │ • User   │                                        │ │
│  │   Menu   │        • Dynamic based on route       │ │
│  │          │        • Responsive grid/tables       │ │
│  │          │        • Forms & modals               │ │
│  │          │                                        │ │
│  │          │                                        │ │
│  └──────────┴────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Dashboard Pages

#### 1. **Dashboard Home** (`/admin/dashboard`)

**Layout:**
- Header with date range filter
- KPI cards (4-column grid, responsive)
- Charts section (2-column revenue & occupancy)
- Recent bookings/activities table
- Quick actions panel

**Components:**
```typescript
<DashboardGrid>
  <StatCard icon={...} label="Total Rooms" value={150} change={+5} />
  <StatCard icon={...} label="Occupancy" value="87%" change={+3} />
  <StatCard icon={...} label="Revenue (Month)" value="$45,230" change={+12} />
  <StatCard icon={...} label="Bookings (Today)" value={28} change={+8} />
</DashboardGrid>

<div className="grid grid-cols-2">
  <ChartCard title="Revenue Trend" chart={<LineChart ... />} />
  <ChartCard title="Room Status" chart={<PieChart ... />} />
</div>

<RecentActivity items={recentBookings} />
```

#### 2. **Departments Management** (`/admin/departments`)

**List View:**
- Searchable data table with columns:
  - Department code & name
  - Manager name
  - Staff count
  - Status badge
  - Actions (View, Edit, Delete)
- Filters: Status, Manager
- Bulk actions: Export, Delete multiple
- Create button

**Detail View** (`/admin/departments/[id]`):
- Department info card
- Overview stats (staff, budget, expenses)
- Staff list table
- Inventory overview
- Recent activities
- Edit & Delete buttons

**Edit View** (`/admin/departments/[id]/edit`):
- Form with fields:
  - Department code (read-only)
  - Name, Description
  - Manager (dropdown)
  - Budget (currency)
  - Status (active/inactive)
- Save & Cancel buttons

#### 3. **Rooms Management** (`/admin/rooms`)

**Features:**
- Grid & List view toggle
- Advanced filters: Room type, status, price range
- Sort options: By name, price, status
- Bulk assignment to departments
- Import/Export functionality

**Room Card (Grid):**
```
┌─────────────────────┐
│  [Room Image]       │
├─────────────────────┤
│ Room 101            │
│ Suite | 4 Guests    │
│ $199/night          │
│ Status: Available   │
│ ⋯ Menu              │
└─────────────────────┘
```

#### 4. **Bookings & Analytics** (`/admin/bookings`)

**List with Columns:**
- Booking ID
- Guest name
- Room
- Check-in / Check-out
- Status badge
- Total price
- Actions

**Analytics Tab:**
- Booking timeline (last 30 days)
- Revenue breakdown
- Occupancy rate
- Cancellation rate
- Average stay duration

#### 5. **Orders Management** (`/admin/orders`)

**Features:**
- Real-time order status updates
- Filter by type (Food, Drinks, Room Service)
- Sort by date, status, amount
- Quick fulfillment actions
- Order detail modal with items list

#### 6. **Inventory Management** (`/admin/inventory`)

**Features:**
- Multi-department stock view
- Low stock warnings (red badge)
- Barcode scanning interface
- Stock movement history
- Reorder functionality
- Department-specific inventory

#### 7. **Staff Management** (`/admin/staff`)

**Features:**
- Staff table with roles/departments
- Schedule view (calendar)
- Attendance tracking
- Performance metrics
- Shift management

#### 8. **Settings & Admin** (`/admin/settings`)

**Sections:**
- General settings (hotel name, address, etc.)
- Role Management (Create, Edit, Delete roles)
- User Management (Assign roles, permissions)
- System settings (Email templates, notifications)
- Audit logs

### Admin Component Library

#### Sidebar Component
```typescript
<AdminSidebar>
  <SidebarLogo />
  <SidebarNav>
    <SidebarItem 
      label="Dashboard" 
      icon={LayoutDashboard} 
      href="/admin/dashboard" 
      isActive
    />
    <SidebarItem 
      label="Departments" 
      icon={Building} 
      href="/admin/departments"
      badge={3}  // New items
    />
    {/* More items */}
  </SidebarNav>
  <SidebarFooter>
    <UserMenu />
    <ThemeToggle />
  </SidebarFooter>
</AdminSidebar>
```

#### Data Table Component
```typescript
<DataTable
  columns={departmentColumns}
  data={departments}
  onSort={handleSort}
  onFilter={handleFilter}
  pagination={{ page: 1, limit: 10 }}
  actions={{
    onEdit: (row) => openEditModal(row),
    onDelete: (row) => openDeleteDialog(row),
  }}
/>
```

#### Stat Card
```typescript
<StatCard
  icon={Users}
  label="Total Staff"
  value={150}
  subtext="Across all departments"
  trend={{ value: 5, direction: 'up', period: 'this month' }}
  onClick={() => navigateTo('/admin/staff')}
/>
```

---

## Website Landing Pages

### Landing Page Architecture

```
┌─────────────────────────────────────────────────┐
│              Navigation Bar                     │
│  • Logo | Home | Rooms | Dining | Gallery       │
│  • Contact | Book Now                           │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│      Hero Section (Full Width)                  │
│  • Background image/video                       │
│  • Call-to-action buttons                       │
│  • Booking widget                               │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│      Features/Highlights Section                │
│  • 4-column grid of amenities                   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│      Room Showcase Section                      │
│  • Featured rooms (carousel or grid)            │
│  • Quick view modal on hover                    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│      Testimonials Section                       │
│  • Guest reviews carousel                       │
│  • Rating stars & quotes                        │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│      CTA Section                                │
│  • "Book Your Stay" with special offer          │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│      Footer                                     │
│  • Links, contact, social media                 │
│  • Newsletter signup                            │
└─────────────────────────────────────────────────┘
```

### Landing Page Components

#### Navbar
```typescript
<Navbar>
  <NavBrand logo={logo} />
  <NavMenu items={[
    { label: 'Home', href: '/' },
    { label: 'Rooms', href: '/rooms' },
    { label: 'Dining', href: '/dining' },
    { label: 'Amenities', href: '/amenities' },
    { label: 'Gallery', href: '/gallery' },
    { label: 'Contact', href: '/contact' },
  ]} />
  <NavActions>
    <Button variant="secondary" size="sm">Sign In</Button>
    <Button size="sm">Book Now</Button>
  </NavActions>
  <MobileMenuToggle />
</Navbar>
```

#### Hero Section
```typescript
<HeroSection
  backgroundImage="hero-banner.jpg"
  title="Welcome to Paradise Hotel"
  subtitle="Experience luxury and comfort"
  cta={[
    { label: 'Book Now', href: '/booking' },
    { label: 'Explore', href: '#features' },
  ]}
>
  <BookingWidget />
</HeroSection>
```

#### Features Grid
```typescript
<FeaturesSection>
  <FeatureCard
    icon={Wifi}
    title="Free WiFi"
    description="High-speed internet throughout"
  />
  <FeatureCard
    icon={UtensilsCrossed}
    title="Gourmet Dining"
    description="World-class restaurant & bar"
  />
  <FeatureCard
    icon={Dumbbell}
    title="Fitness Center"
    description="Fully equipped gym"
  />
  <FeatureCard
    icon={Spa}
    title="Spa & Wellness"
    description="Relaxation & rejuvenation"
  />
</FeaturesSection>
```

#### Rooms Showcase
```typescript
<RoomShowcase>
  <RoomCard
    image="room-image.jpg"
    title="Deluxe Suite"
    description="Spacious suite with ocean view"
    price={199}
    capacity={4}
    amenities={['WiFi', 'AC', 'Mini Bar']}
    onViewDetails={() => navigateTo('/rooms/123')}
  />
  {/* More room cards */}
</RoomShowcase>
```

#### Booking Widget
```typescript
<BookingWidget>
  <DateRangePicker 
    label="Check-in / Check-out"
    onDatesChange={handleDateChange}
  />
  <Select 
    label="Room Type"
    options={roomTypes}
    onChange={handleRoomTypeChange}
  />
  <NumberInput
    label="Guests"
    min={1}
    max={10}
    onChange={handleGuestChange}
  />
  <Button onClick={handleSearch} fullWidth>
    Search Availability
  </Button>
</BookingWidget>
```

#### Testimonials
```typescript
<TestimonialsSection>
  <TestimonialCard
    author="John Smith"
    role="Business Traveler"
    image="avatar.jpg"
    rating={5}
    text="Exceptional service and comfort!"
  />
  {/* More testimonials */}
</TestimonialsSection>
```

#### Footer
```typescript
<Footer>
  <FooterColumn title="Quick Links">
    <Link href="/about">About Us</Link>
    <Link href="/rooms">Rooms</Link>
    <Link href="/dining">Dining</Link>
  </FooterColumn>
  <FooterColumn title="Contact">
    <p>📞 (555) 123-4567</p>
    <p>📧 info@hotel.com</p>
  </FooterColumn>
  <FooterColumn title="Follow Us">
    <SocialLinks />
  </FooterColumn>
  <NewsletterSignup />
</Footer>
```

---

## Component Library

### Base Components (shadcn/ui)

#### Form Components
```typescript
// Button variants
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>

// Input field
<Input 
  label="Email"
  type="email"
  placeholder="your@email.com"
  disabled={false}
  error="Invalid email"
/>

// Select dropdown
<Select
  label="Department"
  options={departments}
  value={selected}
  onChange={handleChange}
/>

// Checkbox
<Checkbox 
  label="I agree to terms"
  checked={agreed}
  onChange={handleCheck}
/>

// Radio group
<RadioGroup
  label="Room Type"
  options={[
    { value: 'single', label: 'Single Room' },
    { value: 'double', label: 'Double Room' },
  ]}
  value={selected}
  onChange={handleChange}
/>

// Textarea
<Textarea
  label="Comments"
  placeholder="Enter your comments..."
  rows={5}
/>
```

#### Display Components
```typescript
// Badge for status
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="destructive">Inactive</Badge>

// Card container
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    {/* Footer */}
  </CardFooter>
</Card>

// Alert box
<Alert variant="info">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Information</AlertTitle>
  <AlertDescription>Important info message</AlertDescription>
</Alert>

// Empty state
<EmptyState
  icon={Package}
  title="No Results"
  description="Try adjusting your filters"
  action={<Button>Reset Filters</Button>}
/>
```

#### Interaction Components
```typescript
// Dialog/Modal
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>Dialog description</DialogDescription>
    </DialogHeader>
    {/* Content */}
    <DialogFooter>
      <Button onClick={() => setIsOpen(false)}>Close</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

// Dropdown menu
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost">⋯</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={handleDelete} className="text-red-600">
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>

// Tooltip
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost">?</Button>
  </TooltipTrigger>
  <TooltipContent>This is helpful information</TooltipContent>
</Tooltip>

// Tabs
<Tabs defaultValue="overview" className="w-full">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="details">Details</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">{/* Content */}</TabsContent>
  <TabsContent value="details">{/* Content */}</TabsContent>
</Tabs>

// Accordion
<Accordion type="single" collapsible>
  <AccordionItem value="item-1">
    <AccordionTrigger>Section 1</AccordionTrigger>
    <AccordionContent>Content 1</AccordionContent>
  </AccordionItem>
</Accordion>
```

### Custom Admin Components

```typescript
// Data table with sorting, filtering, pagination
<DataTable
  columns={columns}
  data={data}
  sortable={true}
  filterable={true}
  pageSize={10}
  onRowClick={handleRowClick}
/>

// Dashboard stat card
<StatCard
  icon={TrendingUp}
  title="Revenue"
  value="$45,230"
  change={+12}
  period="vs last month"
/>

// Department quick action panel
<DepartmentPanel department={dept} />

// Role/Permission manager
<RoleManager
  roles={roles}
  onCreateRole={handleCreate}
  onUpdateRole={handleUpdate}
  onDeleteRole={handleDelete}
/>
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Tasks:**
- [ ] Install shadcn/ui components
- [ ] Configure Tailwind CSS & theme
- [ ] Create project folder structure
- [ ] Build base layout components (Sidebar, Header)
- [ ] Implement authentication flow
- [ ] Setup dark mode toggle

**Deliverables:**
- Working admin layout template
- Base component library
- Design system documentation

### Phase 2: Admin Dashboard (Week 3-4)

**Tasks:**
- [ ] Build dashboard home page
- [ ] Create department management module
- [ ] Implement rooms management
- [ ] Build bookings & analytics
- [ ] Create orders management
- [ ] Setup inventory module

**Deliverables:**
- Full admin dashboard with all main modules
- Data tables with CRUD operations
- Charts and analytics

### Phase 3: Website Landing Pages (Week 5-6)

**Tasks:**
- [ ] Design and build navbar
- [ ] Create hero section
- [ ] Build features section
- [ ] Implement room showcase
- [ ] Create testimonials section
- [ ] Build footer

**Deliverables:**
- Complete landing page
- Room detail pages
- Booking flow

### Phase 4: Enhancement (Week 7-8)

**Tasks:**
- [ ] Add animations & transitions
- [ ] Implement responsive design refinements
- [ ] Setup SEO optimization
- [ ] Add progressive loading
- [ ] Performance optimization
- [ ] Accessibility audit

**Deliverables:**
- Fully optimized, production-ready UI
- Performance metrics < 2s load time
- WCAG 2.1 AA compliance

---

## Best Practices

### Component Organization

```typescript
// ✅ DO: Clear, descriptive component names
<AdminSidebar />
<DepartmentManagementTable />
<RoomBookingWidget />

// ❌ DON'T: Generic names
<Sidebar />
<Table />
<Widget />
```

### Tailwind Class Management

```typescript
// ✅ DO: Use cn() utility for conditional classes
import { cn } from '@/lib/utils'

export function Card({ className, ...props }) {
  return (
    <div className={cn('bg-white rounded-lg shadow', className)} {...props} />
  )
}

// ❌ DON'T: String concatenation
className={`bg-white ${isActive ? 'bg-blue-500' : 'bg-gray-100'} ...`}
```

### Form Handling

```typescript
// ✅ DO: Use react-hook-form with zod validation
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
})

export function MyForm() {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  })
  
  return <form onSubmit={form.handleSubmit(onSubmit)} />
}
```

### State Management

```typescript
// ✅ DO: Use Zustand for global state
import { create } from 'zustand'

const useDepartmentStore = create((set) => ({
  departments: [],
  fetchDepartments: async () => {
    // fetch logic
  },
}))

// Use in components
const departments = useDepartmentStore((state) => state.departments)
```

### API Integration

```typescript
// ✅ DO: Create API client wrapper
import axios from 'axios'

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
})

// Add interceptors for auth, error handling
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Use with react-query
const { data, isLoading, error } = useQuery(
  ['departments'],
  () => apiClient.get('/api/departments'),
)
```

### Accessibility

```typescript
// ✅ DO: Semantic HTML & ARIA attributes
<nav role="navigation" aria-label="Main navigation">
  <a href="/admin" aria-current={isActive ? 'page' : undefined}>
    Dashboard
  </a>
</nav>

// ✅ DO: Keyboard navigation
onKeyDown={(e) => {
  if (e.key === 'Enter') handleSubmit()
  if (e.key === 'Escape') handleCancel()
}}

// ✅ DO: Color not the only indicator
<Badge variant="success" className="bg-green-100 text-green-800">
  <CheckCircle className="mr-1 h-4 w-4" />
  Active
</Badge>
```

### Performance

```typescript
// ✅ DO: Lazy load routes
const DepartmentPage = dynamic(
  () => import('@/pages/admin/departments'),
  { loading: () => <LoadingSpinner /> }
)

// ✅ DO: Memoize expensive components
export const DataTable = React.memo(function DataTable({ data }) {
  return <table>{/* ... */}</table>
})

// ✅ DO: Optimize images
<Image
  src="/images/room.jpg"
  alt="Room preview"
  width={400}
  height={300}
  priority={false}
  placeholder="blur"
/>
```

### TypeScript

```typescript
// ✅ DO: Define proper types
interface Department {
  id: string
  code: string
  name: string
  managerId: string
  staff: Employee[]
}

// ✅ DO: Use discriminated unions for variants
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'

// ✅ DO: Generic components
function Table<T extends Record<string, any>>({
  columns,
  data,
}: {
  columns: Column<T>[]
  data: T[]
}) {
  // Implementation
}
```

---

## File Creation Checklist

### Configuration Files
- [ ] `next.config.ts` - Next.js configuration
- [ ] `tailwind.config.ts` - Tailwind configuration
- [ ] `tsconfig.json` - TypeScript configuration
- [ ] `postcss.config.mjs` - PostCSS configuration
- [ ] `.eslintrc.json` - ESLint configuration

### Component Files
- [ ] `src/components/admin/sidebar/admin-sidebar.tsx`
- [ ] `src/components/admin/header/admin-header.tsx`
- [ ] `src/components/admin/tables/data-table.tsx`
- [ ] `src/components/admin/forms/department-form.tsx`
- [ ] `src/components/public/header/navbar.tsx`
- [ ] `src/components/public/hero/hero-section.tsx`
- [ ] `src/components/shared/button.tsx`
- [ ] `src/components/shared/input.tsx`
- [ ] `src/components/shared/select.tsx`

### Hook Files
- [ ] `src/hooks/use-admin.ts`
- [ ] `src/hooks/use-api.ts`
- [ ] `src/hooks/use-pagination.ts`

### Store Files
- [ ] `src/store/admin-store.ts`
- [ ] `src/store/ui-store.ts`

### Utility Files
- [ ] `src/utils/cn.ts`
- [ ] `src/utils/api-client.ts`
- [ ] `src/utils/constants.ts`

### Page Files
- [ ] `app/(admin)/layout.tsx`
- [ ] `app/(admin)/page.tsx`
- [ ] `app/(admin)/dashboard/page.tsx`
- [ ] `app/(admin)/departments/page.tsx`
- [ ] `app/(public)/layout.tsx`
- [ ] `app/(public)/page.tsx`

### Style Files
- [ ] `app/globals.css`
- [ ] `src/styles/admin.css`
- [ ] `src/styles/public.css`

---

## Summary

This UI Implementation Guide provides:

✅ **Complete project structure** for scalable growth  
✅ **Design system** for consistency & brand alignment  
✅ **Component library** with shadcn/ui & Lucide icons  
✅ **Admin dashboard** for all department operations  
✅ **Landing pages** for public website presence  
✅ **Best practices** for React, TypeScript & Tailwind  
✅ **Implementation roadmap** for phased delivery  
✅ **Installation guide** for quick setup  

Follow this guide to build a professional, maintainable, and scalable UI layer for Hotel Manager v2.

---

**Next Steps:**
1. Review this document with your team
2. Prepare the project structure
3. Install dependencies (Week 1)
4. Begin Phase 1 (Foundation) implementation
5. Follow the phased roadmap

**Support Resources:**
- shadcn/ui: https://ui.shadcn.com/
- Tailwind CSS: https://tailwindcss.com/
- Lucide Icons: https://lucide.dev/
- Next.js: https://nextjs.org/
- React: https://react.dev/

---

**Document Status**: ✅ COMPLETE & READY TO IMPLEMENT  
**Created**: November 15, 2025  
**Version**: 1.0.0
