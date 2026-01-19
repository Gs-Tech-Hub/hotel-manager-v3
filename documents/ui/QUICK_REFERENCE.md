````markdown
# Quick Reference Guide
## Hotel Manager v3 - Implementation Checklist & Command Reference

**Document Version**: 1.0.0  
**Created**: November 18, 2025  
**Purpose**: Fast lookup for developers building the UI

---

## Table of Contents

1. [Project Setup Commands](#project-setup-commands)
2. [Component Creation Template](#component-creation-template)
3. [File Structure Quick Reference](#file-structure-quick-reference)
4. [Common Patterns](#common-patterns)
5. [Troubleshooting](#troubleshooting)
6. [Resources](#resources)

---

## Project Setup Commands

### Initial Setup (if starting from scratch)

```bash
# Clone and install
git clone <repo-url>
cd hotel-manager-v3
npm install

# Install shadcn/ui components as needed
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
# ... (see SHADCN_COMPONENTS.md for all available)

# Run development server
npm run dev

# Visit http://localhost:3000
```

### Create New Page

```bash
# Create directory structure
mkdir -p app/(dashboard)/[module-name]
touch app/(dashboard)/[module-name]/page.tsx

# With detail page
mkdir -p app/(dashboard)/[module-name]/[id]
touch app/(dashboard)/[module-name]/[id]/page.tsx
```

### Create New Component

```bash
# Admin component
mkdir -p components/admin/[module-name]
touch components/admin/[module-name]/[component-name].tsx

# Public component
mkdir -p components/public/[section]/
touch components/public/[section]/[component-name].tsx

# Shared component
touch components/shared/[component-name].tsx
```

---

## Component Creation Template

### Page Component (Route)

```typescript
// app/(dashboard)/[module]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import { DataTable } from '@/components/admin/tables/data-table'

export default function [ModuleName]Page() {
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Fetch data
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      // API call here
      setData(result)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">[Module Name]</h1>
          <p className="text-muted-foreground">Manage your [module items]</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New [Item]
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <DataTable columns={columns} data={data} />
      )}
    </div>
  )
}
```

### Feature Component

```typescript
// components/admin/[module]/[component].tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface [ComponentName]Props {
  // Define props
  title: string
  description?: string
  onAction?: () => void
}

export function [ComponentName]({
  title,
  description,
  onAction,
}: [ComponentName]Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>
        {/* Component content */}
      </CardContent>
    </Card>
  )
}
```

### Form Component

```typescript
// components/admin/[module]/[form].tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface FormProps {
  initialData?: any
  onSubmit: (data: any) => Promise<void>
  isLoading?: boolean
}

export function [FormName]({ initialData, onSubmit, isLoading }: FormProps) {
  const [formData, setFormData] = useState(initialData || {})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="field-name">Field Label</Label>
        <Input
          id="field-name"
          value={formData.fieldName || ''}
          onChange={(e) => setFormData({ ...formData, fieldName: e.target.value })}
          placeholder="Enter value"
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save'}
        </Button>
        <Button type="button" variant="outline">
          Cancel
        </Button>
      </div>
    </form>
  )
}
```

---

## File Structure Quick Reference

### Where to Put Things

| Item | Location | Example |
|------|----------|---------|
| **Page Route** | `app/(section)/module/page.tsx` | `app/(dashboard)/rooms/page.tsx` |
| **Nested Route** | `app/(section)/module/[id]/page.tsx` | `app/(dashboard)/rooms/[id]/page.tsx` |
| **Admin Component** | `components/admin/module/component.tsx` | `components/admin/rooms/room-card.tsx` |
| **Public Component** | `components/public/section/component.tsx` | `components/public/rooms/room-showcase.tsx` |
| **Shared Component** | `components/shared/component.tsx` | `components/shared/navbar.tsx` |
| **UI Component** | `components/ui/component.tsx` | `components/ui/button.tsx` |
| **Type Definition** | `types/category.ts` | `types/admin.ts` |
| **Service/API** | `services/module.ts` | `services/rooms.ts` |
| **Utility Function** | `lib/utils.ts` or `lib/helpers.ts` | `lib/utils.ts` |

### Quick Imports

```typescript
// UI Components
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Icons (Lucide)
import { Plus, Edit, Trash2, Search, Filter, MoreVertical } from 'lucide-react'

// Utilities
import { cn } from '@/lib/utils'

// Types
import type { Department, Room, Booking } from '@/types/admin'
```

---

## Common Patterns

### Pattern 1: Data Table with Sorting/Filtering

```typescript
const columns = [
  {
    key: 'name',
    label: 'Name',
    sortable: true,
    render: (item) => <span className="font-medium">{item.name}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (item) => (
      <Badge variant={item.status === 'active' ? 'success' : 'warning'}>
        {item.status}
      </Badge>
    ),
  },
  {
    key: 'actions',
    label: 'Actions',
    render: (item) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleEdit(item)}>Edit</DropdownMenuItem>
          <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(item)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

<DataTable columns={columns} data={items} />
```

### Pattern 2: Modal Form

```typescript
const [isOpen, setIsOpen] = useState(false)

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Create Item</DialogTitle>
    </DialogHeader>
    <Form onSubmit={async (data) => {
      await api.create(data)
      setIsOpen(false)
    }} />
  </DialogContent>
</Dialog>
```

### Pattern 3: Detail Page with Tabs

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

<Tabs defaultValue="overview" className="space-y-4">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="details">Details</TabsTrigger>
    <TabsTrigger value="history">History</TabsTrigger>
  </TabsList>
  
  <TabsContent value="overview">
    {/* Overview content */}
  </TabsContent>
  
  <TabsContent value="details">
    {/* Details content */}
  </TabsContent>
</Tabs>
```

### Pattern 4: Stat Cards Grid

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  <StatCard
    title="Total Items"
    value="150"
    icon={Users}
    change="+5%"
    trend="up"
    color="blue"
  />
  <StatCard
    title="Active Items"
    value="120"
    icon={CheckCircle}
    change="+12%"
    trend="up"
    color="green"
  />
  {/* More stat cards */}
</div>
```

### Pattern 5: Hero Section

```typescript
<section className="relative h-96 bg-cover bg-center" 
  style={{ backgroundImage: 'url(/images/hero.jpg)' }}>
  <div className="absolute inset-0 bg-black/40" />
  <div className="relative h-full flex flex-col items-center justify-center text-center text-white space-y-4">
    <h1 className="text-4xl md:text-5xl font-bold">Welcome</h1>
    <p className="text-lg max-w-2xl">Subtitle text here</p>
    <div className="flex gap-4">
      <Button size="lg">Primary CTA</Button>
      <Button size="lg" variant="outline">Secondary CTA</Button>
    </div>
  </div>
</section>
```

### Pattern 6: Responsive Grid

```typescript
{/* Mobile: 1 col, Tablet: 2 cols, Desktop: 3-4 cols */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  {items.map(item => <Card key={item.id}>{/* Card content */}</Card>)}
</div>
```

### Pattern 7: Accordion

```typescript
<Accordion type="single" collapsible className="w-full">
  <AccordionItem value="item-1">
    <AccordionTrigger>Is it accordion?</AccordionTrigger>
    <AccordionContent>
      Yes. It adheres to the WAI-ARIA design pattern.
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

### Pattern 8: Status Badge

```typescript
<Badge variant={statusVariant}>
  {status === 'active' && <CheckCircle className="mr-1 h-3 w-3" />}
  {status === 'pending' && <Clock className="mr-1 h-3 w-3" />}
  {status === 'inactive' && <XCircle className="mr-1 h-3 w-3" />}
  {status.charAt(0).toUpperCase() + status.slice(1)}
</Badge>
```

---

## Troubleshooting

### Issue: Component not rendering

**Solution:**
```typescript
// Make sure it's a client component if using hooks
'use client'

// Or move hooks to a separate client component
// and import it in your page
```

### Issue: Styles not applying

**Solution:**
```typescript
// Use className instead of style
<div className="bg-primary text-white p-4">
  // ✅ Correct
</div>

// Avoid inline styles for theme colors
<div style={{ background: '#0ea5e9' }}>
  // ❌ Won't work with dark mode
</div>
```

### Issue: Dark mode not working

**Solution:**
```typescript
// Use dark: prefix for dark mode variants
<div className="bg-white dark:bg-slate-950 text-black dark:text-white">
  // ✅ Correct
</div>

// Make sure ThemeProvider is in root layout
import { ThemeProvider } from '@/components/theme-provider'
```

### Issue: Icons not showing

**Solution:**
```typescript
// Make sure to import from lucide-react
import { MoreVertical, Plus, Edit } from 'lucide-react'

// Use correct component name
<Plus className="h-4 w-4" />  // ✅
<plus className="h-4 w-4" />  // ❌
```

### Issue: TypeScript errors

**Solution:**
```typescript
// Always import types
import type { Department, Room } from '@/types/admin'

// Use proper typing
interface ComponentProps {
  data: Department[]
  onSelect: (dept: Department) => void
}
```

---

## Resources

### Documentation Files
- **STRUCTURAL_IMPLEMENTATION_GUIDE.md** - This file's parent guide
- **DESIGN_SYSTEM.md** - Colors, typography, spacing
- **ADMIN_DASHBOARD_SPEC.md** - Admin interface details
- **PUBLIC_SITE_SPEC.md** - Landing page details
- **UI_IMPLEMENTATION_GUIDE.md** - Full implementation guide

### Useful Links
- **shadcn/ui**: https://ui.shadcn.com/
- **Tailwind CSS**: https://tailwindcss.com/
- **Lucide Icons**: https://lucide.dev/
- **Next.js Docs**: https://nextjs.org/docs
- **React Hooks**: https://react.dev/reference/react

### Component Library
- Button, Card, Dialog, Input, Label
- Table, Tabs, Accordion, Select
- Form, Textarea, Checkbox, Switch
- Avatar, Badge, Dropdown Menu
- And 5+ more available

### Color Reference
```
Primary:    sky-500 (#0ea5e9)
Secondary:  slate-800 (#1e293b)
Success:    emerald-500 (#10b981)
Warning:    amber-500 (#f59e0b)
Danger:     red-500 (#ef4444)
Muted:      slate-500 (#64748b)
Background: white / dark:slate-950
```

---

## Development Workflow

### 1. Before Starting
```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Check for TypeScript errors
npm run type-check
```

### 2. During Development
```bash
# Run dev server
npm run dev

# Type check while developing (in another terminal)
npm run type-check -- --watch

# Format code
npm run format

# Lint code
npm run lint
```

### 3. Before Committing
```bash
# Format all files
npm run format

# Run full lint check
npm run lint

# Run type check
npm run type-check

# Run tests (if available)
npm test

# Then commit
git add .
git commit -m "feat: add [feature name]"
```

### 4. Mobile Testing
```bash
# Test responsive design
# - Open DevTools (F12)
# - Toggle device toolbar (Ctrl+Shift+M)
# - Test: Mobile (375px), Tablet (768px), Desktop (1024px)

# Test dark mode
# - Click theme toggle in topbar
# - Verify all components work in dark mode
```

---

## Code Style Guidelines

### Naming Conventions

```typescript
// Components: PascalCase
export function DepartmentCard() { }
export function UserAvatar() { }

// Files: kebab-case
components/admin/departments/department-card.tsx
components/public/rooms/room-showcase.tsx

// Variables/Functions: camelCase
const departmentName = 'Housekeeping'
function handleSubmit() { }

// Types: PascalCase
type Department = { }
interface RoomProps { }

// Constants: UPPER_SNAKE_CASE
const MAX_ITEMS_PER_PAGE = 10
const API_BASE_URL = 'https://api.example.com'
```

### Component Structure

```typescript
'use client'  // if using hooks

import type { ComponentProps }
import { Component } from 'component-library'

interface MyComponentProps {
  title: string
  onAction?: () => void
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  // Hooks
  const [state, setState] = useState()
  
  // Handlers
  const handleClick = () => { }
  
  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  )
}
```

---

## Quick Checklist for New Feature

- [ ] Create directory structure
- [ ] Create page/component files
- [ ] Add TypeScript types
- [ ] Import required dependencies
- [ ] Build UI with shadcn/ui components
- [ ] Add event handlers
- [ ] Test responsive design (mobile, tablet, desktop)
- [ ] Test dark mode
- [ ] Test accessibility (keyboard nav, screen reader)
- [ ] Format code: `npm run format`
- [ ] Run type check: `npm run type-check`
- [ ] Run linter: `npm run lint`
- [ ] Commit changes with descriptive message

---

**Quick Reference Status**: ✅ READY TO USE  
**Version**: 1.0.0  
**Last Updated**: November 18, 2025

**💡 Tip**: Bookmark this page for quick lookup while developing!

````
