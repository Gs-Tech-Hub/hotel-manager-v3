# Hotel Manager API - Development Guide

## Overview

This is a comprehensive, consistent API system for the Hotel Manager V2 application, built with:

- **Next.js 16** - React framework with built-in API routes
- **Prisma ORM** - Type-safe database access
- **TypeScript** - Strong typing throughout
- **PostgreSQL** - Relational database

## Project Structure

```
src/
├── types/
│   ├── api.ts                 # API request/response types
│   └── entities.ts            # Domain entity interfaces
├── lib/
│   ├── prisma.ts              # Prisma client singleton
│   ├── api-response.ts        # Response formatting utilities
│   └── api-handler.ts         # API route handler wrapper
└── services/
    ├── base.service.ts        # Base service with CRUD operations
    ├── room.service.ts        # Room management
    ├── customer.service.ts    # Customer management
    ├── booking.service.ts     # Booking management
    └── [other-services].ts    # Domain-specific services

app/
└── api/
    ├── rooms/
    │   └── route.ts           # Room API endpoints
    ├── customers/
    │   └── route.ts           # Customer API endpoints
    ├── bookings/
    │   └── route.ts           # Booking API endpoints
    └── [other-routes]/        # Additional API routes
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

Additional dependencies needed for Prisma:

```bash
npm install @prisma/client
npm install -D prisma
npm install uuid
npm install -D @types/uuid
```

### 2. Setup Environment Variables

Create a `.env.local` file:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/hotel_manager"

# API Configuration
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
API_SECRET_KEY="your-secret-key-here"

# Environment
NODE_ENV="development"
```

### 3. Initialize Prisma

```bash
# Generate Prisma client
npx prisma generate

# Create/update database
npx prisma migrate dev --name init

# (Optional) Seed the database
npx prisma db seed
```

### 4. Start Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:3000/api`

## API Endpoints

### Rooms
- `GET /api/rooms` - Get all rooms (paginated)
- `POST /api/rooms` - Create a new room
- `GET /api/rooms/[id]` - Get room details
- `PUT /api/rooms/[id]` - Update room
- `DELETE /api/rooms/[id]` - Delete room

### Customers
- `GET /api/customers` - Get all customers (paginated)
- `POST /api/customers` - Create a new customer
- `GET /api/customers/[id]` - Get customer profile
- `PUT /api/customers/[id]` - Update customer
- `DELETE /api/customers/[id]` - Delete customer

### Bookings
- `GET /api/bookings` - Get all bookings (paginated)
- `POST /api/bookings` - Create a new booking
- `GET /api/bookings/[id]` - Get booking details
- `PUT /api/bookings/[id]` - Update booking
- `DELETE /api/bookings/[id]` - Cancel booking

## Response Format

All API responses follow a consistent format:

### Success Response (200, 201)
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response (4xx, 5xx)
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { ... }
  }
}
```

## Query Parameters

### Pagination
```
?page=1&limit=10
```

### Filtering
```
?filters=[{"field":"status","operator":"eq","value":"available"}]
```

### Sorting
```
?sort=[{"field":"createdAt","direction":"desc"}]
```

### Search
```
?search=john
```

## Error Codes

- `NOT_FOUND` - Resource not found (404)
- `INVALID_INPUT` - Invalid request data (400)
- `UNAUTHORIZED` - Authentication required (401)
- `FORBIDDEN` - Access denied (403)
- `CONFLICT` - Resource already exists (409)
- `VALIDATION_ERROR` - Data validation failed (400)
- `INTERNAL_ERROR` - Server error (500)

## Service Layer

The service layer provides a consistent interface for database operations:

### BaseService<T>

All services extend `BaseService<T>` which provides:

- `findAll(params)` - Get paginated records
- `findById(id)` - Get single record
- `findOne(where)` - Find by condition
- `create(data)` - Create new record
- `update(id, data)` - Update record
- `delete(id)` - Delete record
- `deleteMany(where)` - Delete multiple
- `count(where)` - Count records
- `exists(where)` - Check existence

### Domain Services

Each domain has a specialized service:

#### RoomService
- `getRoomsByStatus(status)`
- `getAvailableRooms()`
- `checkAvailability(roomId, startDate, endDate)`
- `getRoomDetails(roomId)`
- `getOccupancyStats()`

#### CustomerService
- `getByEmail(email)`
- `getCustomerProfile(customerId)`
- `searchCustomers(query)`
- `getCustomerStats()`

#### BookingService
- `getBookingDetails(bookingId)`
- `getCustomerBookings(customerId)`
- `getActiveBookings()`
- `createBookingWithItems(bookingData, items)`
- `getBookingRevenue(startDate?, endDate?)`
- `getBookingStats()`
- `checkInBooking(bookingId)`
- `checkOutBooking(bookingId)`

## Database Schema

The Prisma schema (`prisma/schema.prisma`) includes models for:

- **Admin & Auth**: AdminUser, AdminRole, AdminPermission, ApiToken, TransferToken
- **Hotel Management**: Room, Amenity, Bed, FloorPlan
- **Customers & Bookings**: Customer, Booking, BookingItem, CheckIn
- **Restaurant & Bar**: Restaurant, BarAndClub, FoodType, FoodItem, DrinkType, Drink
- **Orders & Payments**: Order, Payment, PaymentType, PaymentDetail
- **Games**: Game
- **Gym & Sports**: GymAndSport, GymAndSportSession, GymMembership, SportMembership, MembershipPlan
- **Employee**: PluginUsersPermissionsUser, EmployeeOrder, EmployeeRecord, EmployeeSummary
- **Projects & Expenses**: Project, Expense, Vendor
- **Utilities**: HotelService, ProductCount, Schedule, PromoCoupon, JobApplication
- **Content**: Article, Author, Category, Slider, Carousel, About, Service, Global, OrganisationInfo, SpecialInfo

## Development Best Practices

### 1. Always use Type-Safe Services
```typescript
import { roomService } from '@/services/room.service';

const room = await roomService.findById(roomId);
```

### 2. Handle Errors Consistently
```typescript
import { sendError, sendSuccess } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';

return sendError(ErrorCodes.NOT_FOUND, 'Room not found');
```

### 3. Validate Input
```typescript
if (!body.name || !body.roomNumber) {
  return sendError(
    ErrorCodes.VALIDATION_ERROR,
    'Missing required fields'
  );
}
```

### 4. Use Consistent Response Format
```typescript
return sendSuccess(data, 'Success message', 200);
```

## Database Migrations

After schema changes:

```bash
# Create migration
npx prisma migrate dev --name description_of_change

# Apply migrations to production
npx prisma migrate deploy

# View migration status
npx prisma migrate status

# Reset database (dev only)
npx prisma migrate reset
```

## Performance Optimization

### Pagination
Always use pagination for list endpoints:
```typescript
const response = await service.findAll({ page: 1, limit: 10 });
```

### Selective Loading
Use Prisma's `include` to load related data:
```typescript
const booking = await prisma.booking.findUnique({
  where: { id: bookingId },
  include: { customer: true, room: true },
});
```

### Indexes
The Prisma schema automatically creates indexes on:
- Primary keys (id)
- Unique fields (email, slug, etc.)
- Foreign keys

## Testing

Example of testing a service:

```typescript
import { roomService } from '@/services/room.service';

async function test() {
  const rooms = await roomService.findAll({ page: 1, limit: 10 });
  console.log(rooms);
}
```

## Troubleshooting

### Database Connection Issues
```bash
# Test connection
npx prisma db execute --stdin < query.sql

# View database
npx prisma studio
```

### Type Issues
```bash
# Regenerate Prisma client
npx prisma generate
```

### Migration Issues
```bash
# Resolve conflicts
npx prisma migrate resolve --rolled-back migration_name

# Reset (development only)
npx prisma migrate reset
```

## Security

- All endpoints should validate input
- Implement authentication/authorization
- Use environment variables for secrets
- Implement rate limiting for production
- Validate and sanitize all user inputs

## Next Steps

1. Create remaining API routes following the pattern
2. Implement authentication middleware
3. Add request validation with Zod or yup
4. Set up logging and monitoring
5. Add database seeding
6. Create integration tests
7. Deploy to production

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
