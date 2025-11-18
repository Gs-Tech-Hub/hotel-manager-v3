# API Implementation Guide - Hotel Manager V2

## What Has Been Created

A complete, consistent API system with the following components:

### 1. **Database Schema (Prisma)**
- **File**: `prisma/schema.prisma`
- **Models**: 60+ database models covering all hotel operations
- **Features**: Relationships, validations, default values, timestamps

### 2. **Type Definitions**
- **File**: `src/types/api.ts`
  - Generic API response types
  - Pagination and filtering interfaces
  - Error handling types

- **File**: `src/types/entities.ts`
  - Domain entity interfaces (IRoom, ICustomer, IBooking, etc.)
  - All models from Strapi schema converted to TypeScript interfaces

### 3. **Core Libraries**
- **File**: `src/lib/prisma.ts`
  - Singleton Prisma client
  - Connection management
  - Logging configuration

- **File**: `src/lib/api-response.ts`
  - Success/error response formatting
  - Error codes and HTTP status mapping
  - Consistent response structure

- **File**: `src/lib/api-handler.ts`
  - API route wrapper with error handling
  - Request validation utilities
  - Query parameter extraction
  - Response sending helpers

### 4. **Service Layer**
- **File**: `src/services/base.service.ts`
  - Generic CRUD operations
  - Pagination with filtering and sorting
  - Error handling
  - Count, exists, and utility methods

- **File**: `src/services/room.service.ts`
  - Room management
  - Availability checking
  - Status-based queries
  - Occupancy statistics

- **File**: `src/services/customer.service.ts`
  - Customer management
  - Search functionality
  - Profile loading
  - Customer statistics

- **File**: `src/services/booking.service.ts`
  - Booking management
  - Check-in/check-out operations
  - Revenue calculations
  - Booking statistics

### 5. **API Routes (Examples)**
- **File**: `app/api/rooms/route.ts`
  - GET: List all rooms with pagination and filtering
  - POST: Create new room with validation

- **File**: `app/api/customers/route.ts`
  - GET: List all customers with search
  - POST: Create new customer with duplicate check

- **File**: `app/api/bookings/route.ts`
  - GET: List bookings with status filtering
  - POST: Create booking with auto-generated ID

### 6. **Documentation**
- **File**: `API_GUIDE.md` - Complete API development guide

## Installation & Setup

### Step 1: Install Dependencies

```bash
npm install
```

This will install:
- `@prisma/client` - Database client
- `prisma` - CLI tools (dev only)
- `uuid` - For unique ID generation

### Step 2: Configure Database

Create `.env.local`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/hotel_manager"
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
API_SECRET_KEY="your-secret-key"
NODE_ENV="development"
```

### Step 3: Initialize Prisma

```bash
# Generate Prisma client
npx prisma generate

# Create database and run migrations
npx prisma migrate dev --name init
```

### Step 4: Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000/api/rooms` to test the API.

## Architecture Overview

### Request Flow

```
API Request
    ↓
API Route Handler (app/api/[endpoint]/route.ts)
    ↓
Validation & Authorization
    ↓
Service Layer (src/services/[entity].service.ts)
    ↓
Prisma Client (src/lib/prisma.ts)
    ↓
Database (PostgreSQL)
    ↓
Response Formatting (src/lib/api-response.ts)
    ↓
JSON Response
```

### Layered Architecture

```
Controllers (API Routes)
    ↓
Services (Business Logic)
    ↓
Prisma ORM (Data Access)
    ↓
PostgreSQL Database
```

## Response Examples

### Success Response
```json
{
  "success": true,
  "data": {
    "id": "room-001",
    "name": "Deluxe Room",
    "roomNumber": "101",
    "status": "available",
    "price": 150,
    "capacity": 2
  },
  "message": "Room created successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing required fields: name, roomNumber",
    "details": {
      "missing": ["name", "roomNumber"]
    }
  }
}
```

## Extending the API

### Adding a New Service

1. Create `src/services/[entity].service.ts`:
```typescript
import { BaseService } from './base.service';
import { IEntity } from '@/types/entities';

export class EntityService extends BaseService<IEntity> {
  constructor() {
    super('entity');
  }

  // Add custom methods here
  async customMethod() {
    // Implementation
  }
}

export const entityService = new EntityService();
```

2. Create `app/api/[entities]/route.ts`:
```typescript
import { entityService } from '@/services/entity.service';
import { sendSuccess, sendError } from '@/lib/api-handler';

export async function GET(req: NextRequest) {
  const entities = await entityService.findAll();
  return sendSuccess(entities);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const entity = await entityService.create(body);
  return sendSuccess(entity, 'Created', 201);
}
```

3. Create individual routes `app/api/[entities]/[id]/route.ts`:
```typescript
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const entity = await entityService.findById(params.id);
  return sendSuccess(entity);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const entity = await entityService.update(params.id, body);
  return sendSuccess(entity);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await entityService.delete(params.id);
  return sendSuccess(null, 'Deleted');
}
```

### Adding Custom Business Logic

Extend the service with domain-specific methods:

```typescript
export class BookingService extends BaseService<IBooking> {
  async getRevenueBetweenDates(startDate: Date, endDate: Date) {
    return await prisma.booking.aggregate({
      _sum: { totalPrice: true },
      where: {
        createdAt: { gte: startDate, lte: endDate }
      }
    });
  }
}
```

## API Endpoints Created

### Rooms
- `GET /api/rooms` - List with pagination
- `POST /api/rooms` - Create room

### Customers
- `GET /api/customers` - List with search
- `POST /api/customers` - Create customer

### Bookings
- `GET /api/bookings` - List with filtering
- `POST /api/bookings` - Create booking

## Models & Relations

### Room Model
```prisma
Room {
  id: String @id
  name: String
  roomNumber: String @unique
  status: String (available|occupied|maintenance)
  price: Int
  capacity: Int
  amenities: Amenity[] @relation
  beds: Bed[] @relation
  bookings: Booking[] @relation
}
```

### Customer Model
```prisma
Customer {
  id: String @id
  firstName: String
  lastName: String
  email: String @unique
  phone: String
  bookings: Booking[] @relation
  orders: Order[] @relation
}
```

### Booking Model
```prisma
Booking {
  id: String @id
  bookingId: String @unique
  customerId: String @relation
  roomId: String @relation
  checkin: DateTime
  checkout: DateTime
  nights: Int
  totalPrice: Int
  bookingStatus: String
  bookingItems: BookingItem[] @relation
}
```

## Error Handling

The API implements consistent error handling:

| Error Code | HTTP Status | Meaning |
|-----------|-------------|---------|
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid input data |
| UNAUTHORIZED | 401 | Authentication required |
| FORBIDDEN | 403 | Access denied |
| RESOURCE_ALREADY_EXISTS | 409 | Duplicate resource |
| INTERNAL_ERROR | 500 | Server error |

## Database Transactions

For complex operations involving multiple models:

```typescript
const result = await prisma.$transaction(async (tx) => {
  const booking = await tx.booking.create({ data: bookingData });
  const payment = await tx.payment.create({ data: paymentData });
  return { booking, payment };
});
```

## Performance Considerations

### 1. **Pagination**
Always paginate large datasets:
```typescript
GET /api/bookings?page=1&limit=10
```

### 2. **Selective Loading**
Load only needed relations:
```typescript
const booking = await prisma.booking.findUnique({
  where: { id: bookingId },
  include: { customer: true, room: true }
});
```

### 3. **Indexing**
Prisma automatically indexes:
- Primary keys
- Unique constraints
- Foreign keys

Add custom indexes in schema:
```prisma
model Booking {
  // ... fields
  @@index([customerId])
  @@index([createdAt])
}
```

## Security Best Practices

1. **Input Validation** - Always validate request data
2. **Authorization** - Implement role-based access
3. **Rate Limiting** - Limit requests per IP
4. **CORS** - Configure allowed origins
5. **Secrets** - Use environment variables
6. **SQL Injection** - Use Prisma (prevents by default)
7. **HTTPS** - Enforce in production

## Testing

Example using curl:

```bash
# Get all rooms
curl http://localhost:3000/api/rooms

# Create a room
curl -X POST http://localhost:3000/api/rooms \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Deluxe Room",
    "roomNumber": "101",
    "price": 150,
    "capacity": 2
  }'

# Get a customer
curl http://localhost:3000/api/customers/[id]

# Create a booking
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "[customer-id]",
    "roomId": "[room-id]",
    "checkin": "2024-01-15T00:00:00Z",
    "checkout": "2024-01-17T00:00:00Z"
  }'
```

## Next Steps

1. **Create Remaining Services** - Implement services for all models
2. **Add Dynamic Routes** - Create [id]/route.ts for all endpoints
3. **Authentication** - Implement JWT/session-based auth
4. **Validation** - Add Zod or Yup for schema validation
5. **Tests** - Write unit and integration tests
6. **Documentation** - Generate API docs with Swagger/OpenAPI
7. **Deployment** - Deploy to Vercel, Heroku, or self-hosted

## File Structure Summary

```
hotel-manager-v3/
├── app/
│   ├── api/
│   │   ├── rooms/route.ts
│   │   ├── customers/route.ts
│   │   └── bookings/route.ts
│   ├── layout.tsx
│   └── page.tsx
├── src/
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── api-response.ts
│   │   └── api-handler.ts
│   ├── services/
│   │   ├── base.service.ts
│   │   ├── room.service.ts
│   │   ├── customer.service.ts
│   │   └── booking.service.ts
│   └── types/
│       ├── api.ts
│       └── entities.ts
├── prisma/
│   └── schema.prisma
├── .env.example
├── API_GUIDE.md
├── API_IMPLEMENTATION.md (this file)
├── package.json
└── tsconfig.json
```

---

**Created**: November 13, 2025
**Framework**: Next.js 16 + TypeScript
**ORM**: Prisma
**Database**: PostgreSQL
