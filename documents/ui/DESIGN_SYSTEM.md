# Design System & Component Reference
## Hotel Manager v2 UI Standards

**Document Version**: 1.0.0  
**Created**: November 15, 2025

---

## Table of Contents

1. [Color System](#color-system)
2. [Typography](#typography)
3. [Spacing & Layout](#spacing--layout)
4. [Component Patterns](#component-patterns)
5. [Dark Mode](#dark-mode)
6. [Iconography](#iconography)
7. [Responsive Breakpoints](#responsive-breakpoints)
8. [Animation & Transitions](#animation--transitions)

---

## Color System

### Core Colors

#### Primary Palette (Slate - Professional & Trust)
```
Slate 50   (#f8fafc) - Light backgrounds
Slate 100  (#f1f5f9) - Subtle backgrounds
Slate 200  (#e2e8f0) - Borders, dividers
Slate 300  (#cbd5e1) - Secondary borders
Slate 400  (#94a3b8) - Secondary text
Slate 500  (#64748b) - Muted text
Slate 600  (#475569) - Secondary text
Slate 700  (#334155) - Body text
Slate 800  (#1e293b) - Headings, primary text
Slate 900  (#0f172a) - Dark headings
```

#### Accent Palette (Sky - Modern & Friendly)
```
Sky 400  (#38bdf8) - Hover states, secondary actions
Sky 500  (#0ea5e9) - Primary actions, links
Sky 600  (#0284c7) - Active states, hover dark
Sky 700  (#0369a1) - Pressed states
```

#### Status Colors
```
Success  (#10b981 - Emerald 500)   ✓ Active, completed, approved
Warning  (#f59e0b - Amber 500)     ⚠ Pending, attention needed
Danger   (#ef4444 - Red 500)       ✗ Error, delete, inactive
Info     (#3b82f6 - Blue 500)      ℹ Information, notifications
```

#### Semantic Colors
```
Background:        #ffffff (Light mode), #0f172a (Dark mode)
Foreground:        #0f172a (Light mode), #f8fafc (Dark mode)
Muted:             #f1f5f9 (Light mode), #1e293b (Dark mode)
Border:            #e2e8f0 (Light mode), #334155 (Dark mode)
```

### Color Usage Examples

```typescript
// ✅ Primary CTA Button
<Button className="bg-sky-500 text-white hover:bg-sky-600">
  Book Now
</Button>

// ✅ Secondary Button
<Button variant="outline" className="border-slate-300">
  Cancel
</Button>

// ✅ Status Badge - Success
<Badge className="bg-emerald-100 text-emerald-800">
  <CheckCircle className="mr-1 h-4 w-4" />
  Active
</Badge>

// ✅ Status Badge - Warning
<Badge className="bg-amber-100 text-amber-800">
  <AlertCircle className="mr-1 h-4 w-4" />
  Pending
</Badge>

// ✅ Status Badge - Danger
<Badge className="bg-red-100 text-red-800">
  <XCircle className="mr-1 h-4 w-4" />
  Inactive
</Badge>

// ✅ Disabled State
<Button disabled className="bg-slate-200 text-slate-400 cursor-not-allowed">
  Disabled
</Button>

// ✅ Link Color
<a href="#" className="text-sky-500 hover:text-sky-600 underline">
  Learn more
</a>
```

---

## Typography

### Font Family
```
Font Stack: -apple-system, BlinkMacSystemFont, 'Segoe UI', 
            Roboto, 'Helvetica Neue', Arial, sans-serif

Body Font Weight: 400 (regular)
Emphasis: 500, 600 (medium, semibold)
Headings: 600, 700 (semibold, bold)
```

### Font Sizes & Line Heights

```typescript
// H1 - Page Title
font-size: 2.25rem (36px)
line-height: 1.2
font-weight: 700
letter-spacing: -0.02em
usage: Main page titles

// H2 - Section Title
font-size: 1.875rem (30px)
line-height: 1.3
font-weight: 600
usage: Major section headings

// H3 - Subsection Title
font-size: 1.5rem (24px)
line-height: 1.4
font-weight: 600
usage: Cards, components

// H4 - Component Title
font-size: 1.25rem (20px)
line-height: 1.4
font-weight: 600
usage: Small section headers

// H5 - Label/Strong
font-size: 1.125rem (18px)
line-height: 1.5
font-weight: 600
usage: Form labels, emphasis

// H6 - Small Label
font-size: 1rem (16px)
line-height: 1.5
font-weight: 600
usage: Form group labels

// Body - Default
font-size: 1rem (16px)
line-height: 1.5
font-weight: 400
letter-spacing: 0
usage: Main content

// Small - Secondary
font-size: 0.875rem (14px)
line-height: 1.5
font-weight: 400
usage: Helper text, captions

// XSmall - Tertiary
font-size: 0.75rem (12px)
line-height: 1.5
font-weight: 500
usage: Tags, metadata, timestamps
```

### Typography Components

```typescript
// ✅ Heading 1
<h1 className="text-4xl font-bold tracking-tight">Page Title</h1>

// ✅ Heading 2
<h2 className="text-3xl font-semibold mt-8 mb-4">Section Title</h2>

// ✅ Heading 3
<h3 className="text-2xl font-semibold">Subsection</h3>

// ✅ Body Text
<p className="text-base text-slate-700">Regular paragraph text.</p>

// ✅ Muted Text
<p className="text-sm text-slate-500">Helper or secondary text.</p>

// ✅ Strong Emphasis
<strong className="font-semibold">Important text</strong>

// ✅ Code
<code className="bg-slate-100 px-2 py-1 rounded font-mono text-sm">
  function()
</code>
```

---

## Spacing & Layout

### Spacing Scale

```
4px   (0.25rem) - space-1   - Tight spacing
8px   (0.5rem)  - space-2   - Default spacing
12px  (0.75rem) - space-3   - Comfortable
16px  (1rem)    - space-4   - Standard gap
20px  (1.25rem) - space-5   - Generous
24px  (1.5rem)  - space-6   - Section spacing
32px  (2rem)    - space-8   - Large sections
40px  (2.5rem)  - space-10  - Extra large
48px  (3rem)    - space-12  - Major sections
56px  (3.5rem)  - space-14
64px  (4rem)    - space-16
```

### Layout Patterns

#### Container Sizes
```typescript
// ✅ Full width container
<div className="w-full">...</div>

// ✅ Centered container with max width
<div className="mx-auto max-w-7xl px-4">...</div>

// ✅ Sidebar layout
<div className="flex">
  <aside className="w-64 border-r">Sidebar</aside>
  <main className="flex-1">Content</main>
</div>

// ✅ Grid layout - Dashboard
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {items.map(item => <Card key={item.id} />)}
</div>

// ✅ Flex layout - Horizontal stack
<div className="flex items-center justify-between gap-4">
  <span>Label</span>
  <Button>Action</Button>
</div>
```

#### Padding Standards
```typescript
// ✅ Component padding
<Button className="px-4 py-2">Standard Button</Button>

// ✅ Card padding
<Card className="p-6">
  <CardHeader className="pb-4">Header</CardHeader>
  <CardContent>Content</CardContent>
</Card>

// ✅ Form spacing
<form className="space-y-6">
  <div className="space-y-2">
    <Label>Email</Label>
    <Input />
  </div>
</form>
```

---

## Component Patterns

### Button Patterns

#### Button Variants
```typescript
// Primary Action
<Button className="bg-sky-500 text-white hover:bg-sky-600">
  Submit
</Button>

// Secondary Action
<Button variant="outline">
  Cancel
</Button>

// Ghost/Text Button
<Button variant="ghost">
  Learn More
</Button>

// Destructive/Delete
<Button variant="destructive">
  Delete
</Button>

// Icon Button
<Button variant="ghost" size="sm" className="p-2">
  <X className="h-4 w-4" />
</Button>

// Loading State
<Button disabled>
  <Loader className="mr-2 h-4 w-4 animate-spin" />
  Loading...
</Button>
```

#### Button Sizes
```typescript
<Button size="sm" className="text-xs px-3 py-1">Small</Button>
<Button size="md" className="text-sm px-4 py-2">Medium</Button>
<Button size="lg" className="text-base px-6 py-3">Large</Button>
<Button className="w-full">Full Width</Button>
```

### Card Patterns

#### Basic Card
```typescript
<Card>
  <CardHeader className="border-b pb-4">
    <CardTitle className="text-lg">Card Title</CardTitle>
    <CardDescription>Optional description</CardDescription>
  </CardHeader>
  <CardContent className="pt-6">
    Card content goes here
  </CardContent>
  <CardFooter className="border-t pt-4">
    <Button>Action</Button>
  </CardFooter>
</Card>
```

#### Stat Card
```typescript
<Card className="p-6">
  <div className="flex items-start justify-between">
    <div>
      <p className="text-sm font-medium text-slate-600">Total Users</p>
      <p className="text-3xl font-bold mt-2">1,234</p>
      <p className="text-xs text-green-600 mt-1">↑ 12% from last month</p>
    </div>
    <Users className="h-8 w-8 text-sky-500" />
  </div>
</Card>
```

### Form Patterns

#### Input with Label
```typescript
<div className="space-y-2">
  <Label htmlFor="email">Email Address</Label>
  <Input
    id="email"
    type="email"
    placeholder="you@example.com"
  />
  <p className="text-xs text-slate-500">We'll never share your email</p>
</div>
```

#### Form Field Group
```typescript
<form className="space-y-6">
  <div className="space-y-2">
    <Label htmlFor="name">Full Name</Label>
    <Input id="name" placeholder="John Doe" />
  </div>
  
  <div className="space-y-2">
    <Label htmlFor="email">Email</Label>
    <Input id="email" type="email" />
  </div>
  
  <div className="space-y-2">
    <Label htmlFor="message">Message</Label>
    <Textarea id="message" rows={4} />
  </div>
  
  <div className="flex gap-3">
    <Button>Submit</Button>
    <Button variant="outline">Cancel</Button>
  </div>
</form>
```

#### Checkbox Group
```typescript
<fieldset>
  <legend className="text-sm font-medium mb-3">Amenities</legend>
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      <Checkbox id="wifi" />
      <Label htmlFor="wifi" className="font-normal">WiFi</Label>
    </div>
    <div className="flex items-center gap-2">
      <Checkbox id="ac" />
      <Label htmlFor="ac" className="font-normal">Air Conditioning</Label>
    </div>
  </div>
</fieldset>
```

### Table Patterns

#### Basic Data Table
```typescript
<div className="border rounded-lg overflow-hidden">
  <table className="w-full">
    <thead className="bg-slate-50 border-b">
      <tr>
        <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
        <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
        <th className="px-6 py-3 text-right text-sm font-semibold">Actions</th>
      </tr>
    </thead>
    <tbody>
      {items.map((item) => (
        <tr key={item.id} className="border-b hover:bg-slate-50">
          <td className="px-6 py-4">{item.name}</td>
          <td className="px-6 py-4">
            <Badge variant={item.status === 'active' ? 'success' : 'warning'}>
              {item.status}
            </Badge>
          </td>
          <td className="px-6 py-4 text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">⋯</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Edit</DropdownMenuItem>
                <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

### Modal/Dialog Patterns

#### Confirmation Dialog
```typescript
<AlertDialog open={isOpen} onOpenChange={setIsOpen}>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Item?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone. Are you sure?
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction className="bg-red-600">Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

#### Edit Modal
```typescript
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Edit Department</DialogTitle>
      <DialogDescription>
        Update department information
      </DialogDescription>
    </DialogHeader>
    
    <form className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" defaultValue={dept.name} />
      </div>
      
      <DialogFooter>
        <Button variant="outline" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Save Changes</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

---

## Dark Mode

### Implementation

```typescript
// App with dark mode
'use client'

import { ThemeProvider } from 'next-themes'

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

// Theme toggle component
'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/shared/button'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
```

### Dark Mode Colors

```css
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.6% 11.2%;
  --secondary: 217.2 91.2% 59.8%;
  --secondary-foreground: 222.2 47.6% 11.2%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.3% 65.1%;
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
}

/* Usage in components */
<div className="bg-white dark:bg-slate-950 text-black dark:text-white">
  Responsive to dark mode
</div>
```

---

## Iconography

### Icon Library - Lucide React

#### Common Admin Icons
```typescript
// Navigation & Layout
LayoutDashboard, Menu, X, ChevronLeft, ChevronRight, ChevronsUpDown
Home, Building, Building2, Zap, Wrench, Settings

// Data & Analytics
BarChart3, LineChart, PieChart, TrendingUp, TrendingDown
Activity, ArrowUp, ArrowDown, Percent

// Users & Permissions
Users, UserCheck, UserPlus, UserMinus, User, Lock, Unlock
Shield, AlertCircle, CheckCircle, XCircle, Clock

// Actions
Plus, Edit, Trash2, Copy, Download, Upload, Save
Eye, EyeOff, Search, Filter, Sliders, RefreshCw
MoreVertical, ChevronDown, Maximize, Minimize

// Departments & Operations
Briefcase, Factory, Users, GitBranch, Layers, Network
Inbox, Package, Truck, Zap, Wrench, Settings

// Content
Image, Video, FileText, File, Folder, FolderOpen
BookOpen, Book, Mail, MessageSquare, Phone

// Status & Feedback
AlertCircle, AlertTriangle, CheckCircle, XCircle, HelpCircle, Info
Smile, Frown, ThumbsUp, ThumbsDown, Flag, Star

// Rooms & Amenities
Home, Wifi, Wind, Coffee, Maximize, Bed, Bath, Sofa
DoorOpen, Lock, Unlock, Building, Hotel
```

#### Icon Usage Examples

```typescript
// Icon + Text Button
<Button>
  <Download className="mr-2 h-4 w-4" />
  Export Data
</Button>

// Icon only button
<Button variant="ghost" size="sm">
  <Settings className="h-4 w-4" />
</Button>

// Icon in heading
<div className="flex items-center gap-2">
  <Users className="h-6 w-6 text-sky-500" />
  <h2 className="text-2xl font-bold">Staff Management</h2>
</div>

// Icon with status badge
<div className="flex items-center gap-2">
  <div className="w-2 h-2 rounded-full bg-green-500" />
  <span className="text-sm">Active</span>
</div>

// Custom icon color
<AlertCircle className="h-5 w-5 text-red-500" />
<CheckCircle className="h-5 w-5 text-green-500" />
<Clock className="h-5 w-5 text-amber-500" />
```

---

## Responsive Breakpoints

### Tailwind CSS Breakpoints

```typescript
// Mobile First Approach
xs:  0px    - Extra small devices
sm:  640px  - Small devices
md:  768px  - Medium devices
lg:  1024px - Large devices
xl:  1280px - Extra large devices
2xl: 1536px - 2X extra large devices

// Example usage
<div className="
  grid-cols-1      // Mobile: 1 column
  sm:grid-cols-2   // Small: 2 columns
  lg:grid-cols-4   // Large: 4 columns
">
  {items}
</div>

// Responsive text size
<h1 className="
  text-2xl         // Mobile
  sm:text-3xl      // Small
  lg:text-4xl      // Large
">
  Responsive Heading
</h1>

// Responsive spacing
<div className="
  px-4             // Mobile padding
  sm:px-6          // Small padding
  lg:px-8          // Large padding
">
  Content
</div>

// Responsive display
<div className="hidden md:block">
  Desktop only content
</div>

<div className="md:hidden">
  Mobile only content
</div>
```

### Layout Responsive Patterns

```typescript
// Admin Dashboard - Sidebar responsive
<div className="
  flex flex-col     // Mobile: stacked
  md:flex-row       // Medium: sidebar + content
  md:gap-4
">
  <aside className="
    w-full            // Mobile: full width
    md:w-64           // Medium: fixed width
    border-b
    md:border-r
  ">
    Sidebar
  </aside>
  
  <main className="flex-1">
    Content
  </main>
</div>

// Cards Grid - Responsive columns
<div className="
  grid grid-cols-1   // Mobile: 1 column
  sm:grid-cols-2     // Small: 2 columns
  lg:grid-cols-3     // Large: 3 columns
  xl:grid-cols-4     // XL: 4 columns
  gap-4
">
  {cards.map(card => <Card key={card.id} />)}
</div>

// Navigation - Mobile toggle
<nav className="
  flex flex-col       // Mobile: stacked
  md:flex-row         // Medium: horizontal
  gap-4
  bg-white
  p-4
">
  {navItems}
</nav>
```

---

## Animation & Transitions

### Built-in Animations

```typescript
// Tailwind default durations
// 75ms, 100ms, 150ms, 200ms, 300ms, 500ms, 700ms, 1000ms

// Utility classes
animate-bounce    // Up-down bounce
animate-pulse     // Fade in-out pulse
animate-spin      // 360° rotation

// Transition utilities
transition          // All properties
transition-colors   // Color only
transition-opacity  // Opacity only
duration-200        // Animation duration
ease-in            // Easing function
```

### Custom Animations

```css
/* In tailwind.config.ts */
keyframes: {
  'accordion-down': {
    from: { height: '0' },
    to: { height: 'var(--radix-accordion-content-height)' },
  },
  'accordion-up': {
    from: { height: 'var(--radix-accordion-content-height)' },
    to: { height: '0' },
  },
  'fade-in': {
    '0%': { opacity: '0' },
    '100%': { opacity: '1' },
  },
  'slide-in': {
    '0%': { transform: 'translateX(-10px)', opacity: '0' },
    '100%': { transform: 'translateX(0)', opacity: '1' },
  },
},
animation: {
  'accordion-down': 'accordion-down 0.2s ease-out',
  'accordion-up': 'accordion-up 0.2s ease-out',
  'fade-in': 'fade-in 0.3s ease-in-out',
  'slide-in': 'slide-in 0.3s ease-out',
}
```

### Component Transition Examples

```typescript
// Fade transition
<div className="transition-opacity duration-300">
  Content
</div>

// Scale + opacity transition
<button className="
  transition-all duration-200
  hover:scale-105 hover:shadow-lg
">
  Hover me
</button>

// Smooth slide
<div className="
  transform transition-all duration-300
  translate-x-0 opacity-100
">
  Slide in content
</div>

// Loading spinner
<Loader className="h-4 w-4 animate-spin" />

// Skeleton loading
<div className="animate-pulse">
  <div className="h-4 bg-slate-200 rounded" />
</div>
```

---

## Additional Resources

- **Tailwind Colors**: https://tailwindcss.com/docs/customizing-colors
- **Lucide Icons**: https://lucide.dev/
- **shadcn/ui**: https://ui.shadcn.com/
- **Radix UI**: https://radix-ui.com/

---

**Document Status**: ✅ COMPLETE  
**Version**: 1.0.0  
**Last Updated**: November 15, 2025
