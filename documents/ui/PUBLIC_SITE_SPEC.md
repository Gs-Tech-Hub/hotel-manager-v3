# Public Website Landing Pages Specification
## Hotel Manager v2 - Guest-Facing Interface Design

**Document Version**: 1.0.0  
**Created**: November 15, 2025  
**Target Users**: Guests, Booking Agents, Travel Partners

---

## Website Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│             PUBLIC WEBSITE DOMAIN                   │
│          (hotel.com / yourhotel.com)               │
├─────────────────────────────────────────────────────┤
│                  NAVIGATION BAR                      │
│  Logo | Home | Rooms | Dining | Amenities | Gallery │
│                          Book Now | Sign In          │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │           HERO SECTION                          │ │
│ │  Background: Image/Video                        │ │
│ │  Title, Subtitle                                │ │
│ │  CTA Buttons                                    │ │
│ │  Booking Widget                                 │ │
│ └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐                 │
│ │ Ftr │  │ Ftr │  │ Ftr │  │ Ftr │  FEATURES     │
│ └─────┘  └─────┘  └─────┘  └─────┘                 │
├─────────────────────────────────────────────────────┤
│ ┌───────────────┐  ┌───────────────┐               │
│ │   Room Card   │  │   Room Card   │  ROOM SHOW   │
│ └───────────────┘  └───────────────┘               │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │           TESTIMONIALS CAROUSEL                 │ │
│ │  "Amazing stay!" - ⭐⭐⭐⭐⭐ - John Smith        │ │
│ └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │    CTA: BOOK YOUR STAY TODAY                   │ │
│ │           [Book Now Button]                     │ │
│ └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│                      FOOTER                          │
│  About | Contact | Social | Newsletter | Links      │
└─────────────────────────────────────────────────────┘
```

---

## Page Structure

### 1. Homepage (`/`)

#### Hero Section
```
┌─────────────────────────────────────────────────────┐
│                 [Background Image/Video]            │
│                                                     │
│              Welcome to Paradise Hotel              │
│         Experience Luxury & Comfort Like Never      │
│                    Before                           │
│                                                     │
│         [Explore Rooms]     [Book Now]             │
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │ Check-in: [Date]  Check-out: [Date]         │  │
│  │ Rooms: [Qty ▼]  Guests: [Qty ▼]             │  │
│  │                [Search Availability]        │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Components:**
- Full-width hero with background image or video
- Centered headline & subheading
- CTA buttons (secondary styling)
- Booking widget overlay (semi-transparent background)

**Code Example:**

```typescript
// app/(public)/page.tsx
import { HeroSection } from '@/components/public/hero/hero-section'
import { FeaturesSection } from '@/components/public/features/features-section'
import { RoomShowcase } from '@/components/public/room-showcase/room-showcase'
import { TestimonialsSection } from '@/components/public/testimonials/testimonials-section'
import { CTASection } from '@/components/public/cta/cta-section'
import { Footer } from '@/components/public/footer/footer'

export default function HomePage() {
  return (
    <>
      <HeroSection
        backgroundImage="/images/hero-banner.jpg"
        title="Welcome to Paradise Hotel"
        subtitle="Experience luxury and comfort"
        cta={[
          { label: 'Explore Rooms', href: '#rooms' },
          { label: 'Book Now', href: '/booking' },
        ]}
      >
        <BookingWidget />
      </HeroSection>

      <FeaturesSection />
      <RoomShowcase />
      <TestimonialsSection />
      <CTASection />
      <Footer />
    </>
  )
}
```

#### Features Section

```
┌─────────────────────────────────────────────────────┐
│         Why Choose Our Hotel?                       │
├─────────────────────────────────────────────────────┤
│ ┌──────────┐  ┌──────────┐  ┌──────────┐ ┌────────┐
│ │   WiFi   │  │ Gourmet  │  │ Fitness  │ │  Spa   │
│ │ Free     │  │ Dining   │  │ Center   │ │Wellness│
│ │ WiFi     │  │ World    │  │ Fully    │ │Relax & │
│ │          │  │ Class    │  │ Equipped │ │Rejuven │
│ └──────────┘  └──────────┘  └──────────┘ └────────┘
│       Icon + Title + Description (3 lines each)
└─────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// src/components/public/features/features-section.tsx
'use client'

import { Wifi, UtensilsCrossed, Dumbbell, Spa, Waves, Infinity } from 'lucide-react'
import { FeatureCard } from './feature-card'

const features = [
  {
    icon: Wifi,
    title: 'Free WiFi',
    description: 'High-speed internet throughout the hotel for seamless connectivity',
  },
  {
    icon: UtensilsCrossed,
    title: 'Gourmet Dining',
    description: 'World-class restaurant and bar with international cuisine',
  },
  {
    icon: Dumbbell,
    title: 'Fitness Center',
    description: 'State-of-the-art gym with modern equipment and classes',
  },
  {
    icon: Spa,
    title: 'Spa & Wellness',
    description: 'Relax and rejuvenate with our luxury spa services',
  },
  {
    icon: Waves,
    title: 'Swimming Pool',
    description: 'Olympic-sized pool with heated water year-round',
  },
  {
    icon: Infinity,
    title: 'Business Center',
    description: 'Fully equipped for your professional needs',
  },
]

export function FeaturesSection() {
  return (
    <section className="py-20 px-4 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-4xl font-bold text-center mb-4">Why Choose Us?</h2>
        <p className="text-center text-slate-600 mb-12 max-w-2xl mx-auto">
          Discover the perfect blend of comfort, luxury, and exceptional service
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  )
}

// src/components/public/features/feature-card.tsx
export function FeatureCard({ icon: Icon, title, description }) {
  return (
    <div className="text-center p-6">
      <div className="mb-4 flex justify-center">
        <Icon className="h-12 w-12 text-sky-500" />
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-slate-600">{description}</p>
    </div>
  )
}
```

### 2. Rooms Page (`/rooms`)

#### Room Grid with Filters

```
┌─────────────────────────────────────────────────────┐
│ Our Rooms                        [Grid] [List]      │
├─────────────────────────────────────────────────────┤
│ Filter: [Type ▼] [Price Range ▼] [Capacity ▼]     │
│ Sort: [Recommended ▼]  Search: [__________]        │
├─────────────────────────────────────────────────────┤
│ ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│ │              │  │              │  │            │ │
│ │  Room Image  │  │  Room Image  │  │ Room Image │ │
│ │              │  │              │  │            │ │
│ ├──────────────┤  ├──────────────┤  ├────────────┤ │
│ │ Deluxe Suite │  │ Standard     │  │ Family     │ │
│ │ 4 Guests     │  │ 2 Guests     │  │ 4 Guests   │ │
│ │ $199/night   │  │ $79/night    │  │ $150/night │ │
│ │              │  │              │  │            │ │
│ │ [View More]  │  │ [View More]  │  │ [View More]│ │
│ └──────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Features:**
- Grid layout (responsive: 1 col mobile, 2-3 cols desktop)
- Filter options (type, price, capacity)
- Search functionality
- View/List toggle
- Hover effects with preview

#### Room Detail Page (`/rooms/[id]`)

```
┌─────────────────────────────────────────────────────┐
│ Deluxe Suite                          [Book Now]    │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────┐  ┌──────────────┐  │
│ │                             │  │ Room Info    │  │
│ │                             │  │              │  │
│ │   Main Room Image           │  │ • 4 Guests   │  │
│ │   [Gallery Lightbox]        │  │ • Ocean View │  │
│ │                             │  │ • $199/night │  │
│ │  [Thumb] [Thumb] [Thumb]   │  │              │  │
│ └─────────────────────────────┘  ├──────────────┤  │
│                                   │ Amenities    │  │
│                                   │ • WiFi       │  │
│                                   │ • AC         │  │
│                                   │ • Mini Bar   │  │
│                                   │ • TV         │  │
│                                   │ • Shower     │  │
│                                   └──────────────┘  │
├─────────────────────────────────────────────────────┤
│ Description                                         │
│ Spacious and elegant suite with ocean view...      │
│                                                     │
│ Amenities: WiFi, Air Conditioning, Mini Bar, TV,  │
│ Shower, Bathrobe, Slippers, Room Service...       │
│                                                     │
│ Availability Calendar:                             │
│ [Calendar with available/booked dates]            │
│                                                     │
│ Guest Reviews                                       │
│ ⭐⭐⭐⭐⭐ (4.8) Based on 127 reviews              │
│ "Beautiful room with amazing view!" - John Smith   │
│                                                     │
│ [Book Now]  [Add to Wishlist]                      │
└─────────────────────────────────────────────────────┘
```

**Code Example:**

```typescript
// app/(public)/rooms/[id]/page.tsx
'use client'

import { useState } from 'react'
import { Image as ImageIcon, Heart, Calendar } from 'lucide-react'
import { Button } from '@/components/shared/button'
import { RoomGallery } from '@/components/public/room-showcase/room-gallery'
import { BookingWidget } from '@/components/public/booking-widget/booking-widget'
import { ReviewsSection } from '@/components/public/reviews/reviews-section'

export default function RoomDetailPage({ params: { id } }) {
  const [room, setRoom] = useState(null)
  const [selectedImages, setSelectedImages] = useState([])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left: Gallery */}
        <div className="md:col-span-2">
          <RoomGallery images={room?.images} />
        </div>

        {/* Right: Booking Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-bold mb-2">{room?.name}</h1>
            <div className="flex items-center gap-4">
              <span className="text-3xl font-bold text-sky-600">
                ${room?.price}/night
              </span>
              <Button variant="ghost" size="sm">
                <Heart className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <BookingWidget roomId={id} />

          <div>
            <h3 className="font-semibold mb-3">Room Details</h3>
            <div className="space-y-2 text-sm">
              <p>👥 Capacity: {room?.capacity} guests</p>
              <p>📏 Size: {room?.sqft} sq ft</p>
              <p>👁️ View: {room?.view}</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Amenities</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {room?.amenities?.map(amenity => (
                <div key={amenity} className="flex items-center gap-2">
                  <span className="text-sky-500">✓</span>
                  {amenity}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <ReviewsSection roomId={id} />
    </div>
  )
}
```

### 3. Dining Page (`/dining`)

```
┌─────────────────────────────────────────────────────┐
│ Dining & Bar                                        │
├─────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────┐  │
│ │ Main Restaurant                                │  │
│ │ Fine Dining Experience                         │  │
│ │ [Image] | Open: 6am-11pm | Cuisine: French    │  │
│ │ [View Menu] [Make Reservation]                 │  │
│ └────────────────────────────────────────────────┘  │
│                                                     │
│ ┌────────────────────────────────────────────────┐  │
│ │ Rooftop Bar                                    │  │
│ │ Cocktails with a View                          │  │
│ │ [Image] | Open: 5pm-2am | Drinks & Appetizers│  │
│ │ [View Menu]                                    │  │
│ └────────────────────────────────────────────────┘  │
│                                                     │
│ ┌────────────────────────────────────────────────┐  │
│ │ Café & Lounge                                  │  │
│ │ Coffee, Pastries & Light Bites                 │  │
│ │ [Image] | Open: 7am-10pm | Casual Dining      │  │
│ │ [View Menu]                                    │  │
│ └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 4. Amenities Page (`/amenities`)

```
┌─────────────────────────────────────────────────────┐
│ Hotel Amenities                                     │
├─────────────────────────────────────────────────────┤
│ ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│ │ [Icon/Image] │  │ [Icon/Image] │  │ [Icon/Img] │ │
│ │ Swimming     │  │ Fitness      │  │ Business   │ │
│ │ Pool         │  │ Center       │  │ Center     │ │
│ │              │  │              │  │            │ │
│ │ Olympic size │  │ Modern equip │  │ Meeting    │ │
│ │ heated pool  │  │ Classes      │  │ rooms      │ │
│ └──────────────┘  └──────────────┘  └────────────┘ │
│                                                     │
│ ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│ │ Spa          │  │ Restaurant   │  │ Concierge  │ │
│ └──────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 5. Gallery Page (`/gallery`)

```
Masonry grid layout with lightbox:
┌──────────┐  ┌─────────────┐  ┌───────┐
│ Image 1  │  │   Image 2   │  │ Img 3 │
│          │  │             │  │       │
└──────────┘  │             │  └───────┘
┌──────────────┐  └─────────────┘
│   Image 4    │
│              │  ┌──────────┐
│              │  │ Image 5  │
└──────────────┘  └──────────┘
```

### 6. Contact Page (`/contact`)

```
┌─────────────────────────────────────────────────────┐
│ Contact Us                                          │
├─────────────────────────────────────────────────────┤
│ ┌───────────────────┐  ┌───────────────────────┐  │
│ │ Contact Form      │  │ Contact Information   │  │
│ │ Name              │  │ 📞 (555) 123-4567    │  │
│ │ [_____________]   │  │ 📧 info@hotel.com    │  │
│ │                   │  │ 📍 123 Hotel St      │  │
│ │ Email             │  │    City, State 12345 │  │
│ │ [_____________]   │  │                      │  │
│ │                   │  │ Hours:               │  │
│ │ Message           │  │ Mon-Fri: 9am-6pm    │  │
│ │ [_______________] │  │ Sat-Sun: 10am-5pm   │  │
│ │                   │  │                      │  │
│ │ [Send Message]    │  │ [Map]                │  │
│ └───────────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 7. Booking Page (`/booking`)

```
Multi-step booking flow:

Step 1: Room Selection
┌────────────────────────────────┐
│ Select Your Room               │
│ ☐ Standard (2 guests)  $79/nt  │
│ ☐ Deluxe (2-4 guests)  $99/nt  │
│ ☐ Suite (4 guests)     $199/nt │
│                        [Next]   │
└────────────────────────────────┘

Step 2: Dates & Details
┌────────────────────────────────┐
│ Check-in: [Date Picker]        │
│ Check-out: [Date Picker]       │
│ Guests: [Qty]                  │
│                                │
│ Duration: 3 nights             │
│ Total: $297                    │
│              [Back] [Next]     │
└────────────────────────────────┘

Step 3: Guest Info
┌────────────────────────────────┐
│ Guest Information              │
│ First Name: [________]         │
│ Last Name: [________]          │
│ Email: [______________]        │
│ Phone: [______________]        │
│                                │
│             [Back] [Next]      │
└────────────────────────────────┘

Step 4: Payment
┌────────────────────────────────┐
│ Payment Information            │
│ Card Number: [________________]│
│ Exp: [__/__]  CVC: [___]       │
│                                │
│ Total: $297                    │
│ [Complete Booking]             │
└────────────────────────────────┘

Confirmation Page
┌────────────────────────────────┐
│ ✓ Booking Confirmed!           │
│                                │
│ Booking ID: BK-123456          │
│ Confirmation sent to email     │
│                                │
│ [Download Itinerary]           │
│ [Return Home]                  │
└────────────────────────────────┘
```

---

## Navigation Bar

```typescript
// src/components/public/header/navbar.tsx
'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/shared/button'
import { NavMenu } from './nav-menu'
import { MobileMenu } from './mobile-menu'

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Hotel Logo" className="h-8" />
          <span className="font-bold text-xl hidden sm:inline">Paradise Hotel</span>
        </a>

        {/* Desktop Navigation */}
        <NavMenu />

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="hidden md:inline-flex">
            Sign In
          </Button>
          <Button size="sm">Book Now</Button>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && <MobileMenu onClose={() => setIsMobileMenuOpen(false)} />}
    </nav>
  )
}
```

---

## Hero Section

```typescript
// src/components/public/hero/hero-section.tsx
'use client'

import { Button } from '@/components/shared/button'

export function HeroSection({ 
  backgroundImage, 
  title, 
  subtitle, 
  cta, 
  children 
}) {
  return (
    <section 
      className="
        relative h-screen bg-cover bg-center bg-no-repeat
        flex items-center justify-center text-center
      "
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), 
                         url('${backgroundImage}')`,
      }}
    >
      <div className="max-w-3xl mx-auto px-4 space-y-6">
        <h1 className="text-5xl md:text-6xl font-bold text-white">
          {title}
        </h1>
        
        <p className="text-xl md:text-2xl text-slate-100">
          {subtitle}
        </p>

        <div className="flex gap-4 justify-center flex-wrap pt-4">
          {cta?.map(btn => (
            <Button 
              key={btn.label}
              variant={btn.primary ? 'default' : 'outline'}
              size="lg"
              asChild
            >
              <a href={btn.href}>{btn.label}</a>
            </Button>
          ))}
        </div>
      </div>

      {/* Booking Widget Overlay */}
      {children && (
        <div className="absolute bottom-0 left-0 right-0 translate-y-1/2 max-w-2xl mx-auto w-full px-4">
          <div className="bg-white rounded-lg shadow-xl p-6">
            {children}
          </div>
        </div>
      )}
    </section>
  )
}
```

---

## Booking Widget

```typescript
// src/components/public/booking-widget/booking-widget.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/shared/button'
import { Input } from '@/components/shared/input'
import { Select } from '@/components/shared/select'
import { DatePicker } from './date-picker'

export function BookingWidget({ roomId = null }) {
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guests, setGuests] = useState(2)
  const [rooms, setRooms] = useState(1)

  const handleSearch = () => {
    const params = new URLSearchParams({
      checkIn,
      checkOut,
      guests,
      rooms,
      ...(roomId && { roomId }),
    })
    window.location.href = `/booking?${params}`
  }

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSearch() }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Check-in</label>
          <DatePicker 
            value={checkIn}
            onChange={setCheckIn}
            minDate={new Date()}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Check-out</label>
          <DatePicker 
            value={checkOut}
            onChange={setCheckOut}
            minDate={checkIn ? new Date(checkIn) : new Date()}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Guests</label>
          <Select
            value={guests}
            onChange={(e) => setGuests(parseInt(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6].map(n => (
              <option key={n} value={n}>{n} Guest{n > 1 ? 's' : ''}</option>
            ))}
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Rooms</label>
          <Select
            value={rooms}
            onChange={(e) => setRooms(parseInt(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map(n => (
              <option key={n} value={n}>{n} Room{n > 1 ? 's' : ''}</option>
            ))}
          </Select>
        </div>
      </div>

      <Button type="submit" className="w-full" size="lg">
        Check Availability
      </Button>
    </form>
  )
}
```

---

## Testimonials Section

```typescript
// src/components/public/testimonials/testimonials-section.tsx
'use client'

import { Star } from 'lucide-react'

const testimonials = [
  {
    author: 'John Smith',
    role: 'Business Traveler',
    content: 'Amazing hotel! Excellent service and beautiful rooms.',
    rating: 5,
    image: '/avatars/john.jpg',
  },
  {
    author: 'Sarah Johnson',
    role: 'Family Vacation',
    content: 'Perfect for families. Staff was very accommodating with our kids.',
    rating: 5,
    image: '/avatars/sarah.jpg',
  },
  {
    author: 'Michael Chen',
    role: 'Honeymoon',
    content: 'Romantic setting, great dining options, unforgettable experience!',
    rating: 5,
    image: '/avatars/michael.jpg',
  },
]

export function TestimonialsSection() {
  return (
    <section className="py-20 px-4 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold text-center mb-12">Guest Reviews</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <TestimonialCard key={testimonial.author} {...testimonial} />
          ))}
        </div>
      </div>
    </section>
  )
}

function TestimonialCard({ author, role, content, rating, image }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center gap-4 mb-4">
        <img 
          src={image} 
          alt={author} 
          className="h-12 w-12 rounded-full"
        />
        <div>
          <p className="font-semibold">{author}</p>
          <p className="text-sm text-slate-600">{role}</p>
        </div>
      </div>

      <div className="flex gap-1 mb-3">
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
        ))}
      </div>

      <p className="text-slate-700">"{content}"</p>
    </div>
  )
}
```

---

## Footer

```typescript
// src/components/public/footer/footer.tsx
'use client'

import { Mail, Phone, MapPin, Facebook, Instagram, Twitter } from 'lucide-react'
import { Button } from '@/components/shared/button'
import { Input } from '@/components/shared/input'

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* About */}
          <div>
            <h3 className="font-bold text-lg mb-4">Paradise Hotel</h3>
            <p className="text-sm text-slate-400">
              Luxury hospitality experience with world-class service.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/" className="hover:text-white">Home</a></li>
              <li><a href="/rooms" className="hover:text-white">Rooms</a></li>
              <li><a href="/dining" className="hover:text-white">Dining</a></li>
              <li><a href="/amenities" className="hover:text-white">Amenities</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4">Contact Info</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                (555) 123-4567
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                info@hotel.com
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-1 flex-shrink-0" />
                123 Hotel Street, City, ST 12345
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="font-semibold mb-4">Newsletter</h4>
            <p className="text-sm text-slate-400 mb-3">
              Subscribe to special offers
            </p>
            <form className="flex gap-2">
              <Input 
                type="email"
                placeholder="Your email"
                className="bg-slate-800 border-slate-700 text-white"
              />
              <Button size="sm">Subscribe</Button>
            </form>
          </div>
        </div>

        {/* Social & Bottom */}
        <div className="border-t border-slate-800 pt-8 flex items-center justify-between flex-wrap gap-4">
          <div className="flex gap-4">
            <a href="#" className="hover:text-sky-400"><Facebook className="h-5 w-5" /></a>
            <a href="#" className="hover:text-sky-400"><Instagram className="h-5 w-5" /></a>
            <a href="#" className="hover:text-sky-400"><Twitter className="h-5 w-5" /></a>
          </div>
          
          <p className="text-sm text-slate-400">
            &copy; 2024 Paradise Hotel. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
```

---

## Mobile Responsive Design

### Mobile Navigation (< 768px)

```
Header:
┌───────────────────────────────┐
│ ☰ Logo          [Book]        │
└───────────────────────────────┘

Mobile Menu (Drawer):
┌───────────────────────────────┐
│ ✕                             │
├───────────────────────────────┤
│ Home                           │
│ Rooms                          │
│ Dining                         │
│ Gallery                        │
│ Contact                        │
│ About                          │
├───────────────────────────────┤
│ [Sign In]                      │
│ [Book Now]                     │
└───────────────────────────────┘
```

### Responsive Grid Layouts

```typescript
// 1 column on mobile, 2 on tablet, 3 on desktop
<div className="
  grid grid-cols-1
  sm:grid-cols-2
  lg:grid-cols-3
  gap-4
">
  {items}
</div>
```

---

## SEO & Meta Tags

```typescript
// app/(public)/layout.tsx
export const metadata = {
  title: 'Paradise Hotel - Luxury Accommodation',
  description: 'Experience luxury and comfort at Paradise Hotel. Book your stay now.',
  keywords: ['hotel', 'accommodation', 'luxury', 'booking'],
  openGraph: {
    title: 'Paradise Hotel - Luxury Accommodation',
    description: 'Experience luxury and comfort',
    type: 'website',
    url: 'https://hotel.com',
    image: '/og-image.jpg',
  },
}
```

---

## Performance Optimization

- **Image Optimization**: Use Next.js Image component
- **Code Splitting**: Route-based lazy loading
- **Caching**: Static generation for public pages
- **CDN**: Serve images via CDN
- **Minification**: Automatic CSS/JS minification

---

**Landing Page Specification Status**: ✅ COMPLETE  
**Version**: 1.0.0  
**Last Updated**: November 15, 2025
