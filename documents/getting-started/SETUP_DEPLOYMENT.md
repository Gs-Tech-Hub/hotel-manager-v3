# Complete Setup & Deployment Guide

## Quick Start

### 1. Prerequisites
- Node.js 18+ and npm
- PostgreSQL 12+
- Git

### 2. Clone & Install

```bash
cd hotel-manager-v3
npm install
```

### 3. Environment Setup

Create `.env.local`:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/hotel_manager"

# API
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
API_SECRET_KEY="your-secret-key-change-this"

# Environment
NODE_ENV="development"
```

### 4. Initialize Database

```bash
# Generate Prisma client
npx prisma generate

# Create database and run migrations
npx prisma migrate dev --name init

# (Optional) Seed with test data
npx prisma db seed
```

### 5. Start Development

```bash
npm run dev
```

Visit `http://localhost:3000`

---

## Project Structure

```
hotel-manager-v3/
├── app/
│   ├── api/                           # API routes (Next.js App Router)
│   │   ├── rooms/                     # Room endpoints
│   │   │   ├── route.ts               # GET /api/rooms, POST /api/rooms
│   │   │   └── [id]/route.ts          # GET/PUT/DELETE /api/rooms/[id]
│   │   ├── customers/                 # Customer endpoints
│   │   ├── bookings/                  # Booking endpoints
│   │   ├── orders/                    # Order endpoints
│   │   ├── payments/                  # Payment endpoints
│   │   └── stats/dashboard/           # Dashboard statistics
│   ├── layout.tsx                     # Root layout
│   ├── page.tsx                       # Home page
│   └── globals.css                    # Global styles
│
├── src/
│   ├── lib/
│   │   ├── prisma.ts                  # Prisma client singleton
│   │   ├── api-response.ts            # Response formatting
│   │   └── api-handler.ts             # API middleware & helpers
│   │
│   ├── services/
│   │   ├── base.service.ts            # Base CRUD service
│   │   ├── room.service.ts            # Room operations
│   │   ├── customer.service.ts        # Customer operations
│   │   ├── booking.service.ts         # Booking operations
│   │   ├── order.service.ts           # Order operations
│   │   ├── payment.service.ts         # Payment operations
│   │   ├── food-drink.service.ts      # Food/Drink operations
│   │   ├── membership.service.ts      # Membership operations
│   │   └── employee.service.ts        # Employee operations
│   │
│   └── types/
│       ├── api.ts                     # API types
│       └── entities.ts                # Domain entity types
│
├── prisma/
│   ├── schema.prisma                  # Database schema
│   └── migrations/                    # Migration files
│
├── package.json                       # Dependencies
├── tsconfig.json                      # TypeScript config
├── next.config.ts                     # Next.js config
├── API_GUIDE.md                       # API documentation
└── API_IMPLEMENTATION.md              # Implementation guide
```

---

## Database Schema Overview

### Models (60+)

**Authentication & Admin**
- AdminUser, AdminRole, AdminPermission
- ApiToken, ApiTokenPermission
- TransferToken, TransferTokenPermission

**Core Hotel Operations**
- Room, Amenity, Bed, FloorPlan
- Customer, Booking, BookingItem, CheckIn

**Food & Beverage**
- Restaurant, BarAndClub
- FoodType, FoodItem, MenuCategory
- DrinkType, Drink

**Transactions**
- Order, Payment, PaymentType, PaymentDetail

**Activities**
- Game, GymAndSport, GymAndSportSession
- GymMembership, SportMembership, MembershipPlan

**Staff Management**
- PluginUsersPermissionsUser
- EmployeeOrder, EmployeeRecord, EmployeeSummary

**Business**
- Project, Expense, Vendor
- HotelService, ProductCount, Schedule

**Content**
- Article, Author, Category
- Slider, Carousel, About, Service
- Global, OrganisationInfo, SpecialInfo

---

## API Endpoints Reference

### Rooms
```
GET    /api/rooms                    # List rooms
POST   /api/rooms                    # Create room
GET    /api/rooms/[id]               # Get room details
PUT    /api/rooms/[id]               # Update room
DELETE /api/rooms/[id]               # Delete room
```

### Customers
```
GET    /api/customers                # List customers
POST   /api/customers                # Create customer
GET    /api/customers/[id]           # Get customer profile
PUT    /api/customers/[id]           # Update customer
DELETE /api/customers/[id]           # Delete customer
```

### Bookings
```
GET    /api/bookings                 # List bookings
POST   /api/bookings                 # Create booking
GET    /api/bookings/[id]            # Get booking details
PUT    /api/bookings/[id]            # Update booking
DELETE /api/bookings/[id]            # Cancel booking
```

### Orders
```
GET    /api/orders                   # List orders
POST   /api/orders                   # Create order
GET    /api/orders/[id]              # Get order details
PUT    /api/orders/[id]              # Update order
DELETE /api/orders/[id]              # Delete order
```

### Payments
```
GET    /api/payments                 # List payments
POST   /api/payments                 # Create payment
GET    /api/payments/[id]            # Get payment details
```

### Statistics
```
GET    /api/stats/dashboard          # Dashboard statistics
GET    /api/stats/rooms              # Room statistics
GET    /api/stats/bookings           # Booking statistics
GET    /api/stats/revenue            # Revenue statistics
```

---

## Common Operations

### Create a Room
```bash
curl -X POST http://localhost:3000/api/rooms \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Deluxe Suite",
    "roomNumber": "101",
    "status": "available",
    "price": 250,
    "capacity": 3
  }'
```

### Get Available Rooms
```bash
curl "http://localhost:3000/api/rooms?status=available"
```

### Create a Booking
```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust-123",
    "roomId": "room-101",
    "checkin": "2024-01-20T14:00:00Z",
    "checkout": "2024-01-22T11:00:00Z",
    "nights": 2,
    "guests": 2,
    "totalPrice": 500
  }'
```

### Get Customer Profile
```bash
curl http://localhost:3000/api/customers/cust-123
```

---

## Development Workflow

### Adding a New Feature

1. **Update Schema** (if needed)
   ```bash
   # Edit prisma/schema.prisma
   
   # Create migration
   npx prisma migrate dev --name feature_description
   ```

2. **Create Service**
   ```typescript
   // src/services/feature.service.ts
   export class FeatureService extends BaseService<IFeature> {
     constructor() {
       super('feature');
     }
     // Add custom methods
   }
   ```

3. **Create API Routes**
   ```typescript
   // app/api/features/route.ts
   export async function GET(req: NextRequest) { ... }
   export async function POST(req: NextRequest) { ... }
   
   // app/api/features/[id]/route.ts
   export async function GET(req: NextRequest, { params }) { ... }
   ```

4. **Test**
   ```bash
   curl http://localhost:3000/api/features
   ```

---

## Database Migrations

### Create Migration
```bash
npx prisma migrate dev --name migration_name
```

### View Pending Migrations
```bash
npx prisma migrate status
```

### Deploy Migrations (Production)
```bash
npx prisma migrate deploy
```

### Rollback (Development Only)
```bash
npx prisma migrate resolve --rolled-back migration_name
npx prisma migrate reset
```

### View Database in Studio
```bash
npx prisma studio
```

---

## Performance Optimization

### 1. Pagination
Always paginate list endpoints:
```javascript
GET /api/bookings?page=1&limit=20
```

### 2. Selective Loading
Load only needed relations:
```javascript
// Bad: loads all relations
const booking = await prisma.booking.findUnique({
  where: { id: bookingId },
});

// Good: loads only needed data
const booking = await prisma.booking.findUnique({
  where: { id: bookingId },
  include: { customer: true, room: true }
});
```

### 3. Database Indexes
Automatically created for:
- Primary keys (id)
- Unique fields (@unique)
- Foreign keys
- Composite indexes (@unique([field1, field2]))

Add custom indexes in schema:
```prisma
model Booking {
  // fields...
  @@index([customerId])
  @@index([createdAt])
}
```

### 4. Connection Pooling
Prisma client automatically manages connection pooling.

---

## Security Best Practices

### 1. Environment Variables
```env
# NEVER commit .env.local
# Keep secrets in environment variables only
DATABASE_URL=...
API_SECRET_KEY=...
```

### 2. Input Validation
```typescript
if (!body.name || typeof body.name !== 'string') {
  return sendError(ErrorCodes.VALIDATION_ERROR, 'Invalid name');
}
```

### 3. Authentication (To Implement)
```typescript
// Verify JWT or session
const user = await verifyAuth(req.headers.authorization);
if (!user) {
  return sendError(ErrorCodes.UNAUTHORIZED, 'Not authenticated');
}
```

### 4. Authorization (To Implement)
```typescript
// Check user permissions
if (user.role !== 'admin') {
  return sendError(ErrorCodes.FORBIDDEN, 'Insufficient permissions');
}
```

### 5. CORS Configuration
```typescript
// next.config.ts or middleware
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS,
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE',
};
```

---

## Testing

### Manual Testing with cURL
```bash
# List all rooms
curl http://localhost:3000/api/rooms

# Create a customer
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -d '{"firstName":"John","lastName":"Doe","email":"john@example.com","phone":"555-1234"}'

# Get dashboard stats
curl http://localhost:3000/api/stats/dashboard
```

### Automated Testing (To Add)
```bash
npm install --save-dev jest @testing-library/react
npm test
```

---

## Deployment

### Deploy to Vercel (Recommended for Next.js)

1. Push to GitHub
2. Connect repository to Vercel
3. Set environment variables
4. Deploy

```bash
# Or deploy via CLI
npm i -g vercel
vercel
```

### Deploy to Heroku

```bash
# Create Heroku app
heroku create app-name

# Set environment variables
heroku config:set DATABASE_URL="..."

# Deploy
git push heroku main
```

### Deploy to AWS EC2

```bash
# Install dependencies
npm install --production

# Build
npm run build

# Start with PM2
npm install -g pm2
pm2 start npm --name hotel-api -- start
pm2 startup
pm2 save
```

---

## Monitoring & Logging

### Add Logging (To Implement)
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

### Error Tracking (To Implement)
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.captureException(error);
```

---

## Useful Commands

```bash
# Development
npm run dev              # Start dev server

# Building
npm run build            # Production build
npm start                # Start production server

# Database
npx prisma generate      # Generate Prisma client
npx prisma migrate dev   # Create and run migration
npx prisma studio       # Open database GUI
npx prisma db seed      # Seed database

# Linting
npm run lint            # Run ESLint

# Other
npm run clean           # Clean build artifacts
```

---

## Troubleshooting

### Database Connection Error
```bash
# Check DATABASE_URL
echo $DATABASE_URL

# Test connection
npx prisma db execute --stdin
```

### Port Already in Use
```bash
# Change port in package.json
"dev": "next dev -p 3001"

# Or kill process
lsof -ti:3000 | xargs kill -9
```

### Prisma Type Errors
```bash
# Regenerate client
npx prisma generate

# Clear cache
rm -rf node_modules/.prisma
npm install
```

### Migration Conflicts
```bash
# Reset database (dev only!)
npx prisma migrate reset

# View schema
npx prisma validate
```

---

## Support & Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)

---

**Last Updated**: November 13, 2025
**Version**: 1.0.0
