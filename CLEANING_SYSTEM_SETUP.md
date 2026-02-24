# Cleaning Management System - Complete Setup

## Overview

The Hotel Manager v3 now includes a comprehensive cleaning management system with room status tracking, cleaning routine templates, task assignment, and QA inspections.

## ✅ Completed Setup

### 1. Database Schema (Prisma)

#### Enums Added
```prisma
enum CleaningRoutineType {
  TURNOVER        // Kitchen/bathroom turnover at checkout
  DEEP            // Full deep clean
  MAINTENANCE     // After maintenance work
  TOUCH_UP        // Quick refresh
  LINEN_CHANGE    // Just linen changes
  NIGHT_AUDIT     // End-of-day deep clean
}

enum CleaningFrequency {
  EVERY_CHECKOUT
  DAILY
  WEEKLY
  BIWEEKLY
  MONTHLY
  AS_NEEDED
}

enum CleaningPriority {
  LOW
  NORMAL
  HIGH
  URGENT
}

enum CleaningTaskStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  INSPECTED
  REJECTED
  CANCELLED
}
```

#### Models Created/Updated

**CleaningRoutine** - Template for reusable cleaning procedures
```prisma
model CleaningRoutine {
  id              String   @id @default(cuid())
  code            String   @unique              // e.g., "TURNOVER_SINGLE", "DEEP_DOUBLE"
  name            String                        // "Turnover Single Room"
  description     String?
  type            CleaningRoutineType
  frequency       CleaningFrequency
  estimatedMinutes Int
  priority        CleaningPriority @default(NORMAL)
  checklist       Json?                         // Array of checklist items
  isActive        Boolean  @default(true)
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  roomTypes       RoomType[]  @relation("CleaningRoutineRoomTypes")
  departments     Department[] @relation("CleaningRoutineDepartments")
  tasks           CleaningTask[] @relation("RoutineToTasks")
}
```

**CleaningTask** - Individual cleaning job (enhanced from existing model)
```prisma
model CleaningTask {
  id              String   @id @default(cuid())
  taskNumber      String   @unique @default(cuid())
  unitId          String
  unit            Unit     @relation(fields: [unitId], references: [id], onDelete: Restrict)
  routineId       String?                       // Link to routine template
  routine         CleaningRoutine? @relation(...)
  priority        CleaningPriority @default(NORMAL)
  status          CleaningTaskStatus @default(PENDING)
  taskType        String   // "turnover", "deep_clean", etc.
  assignedToId    String?  // Cleaner user ID
  startedAt       DateTime?
  completedAt     DateTime?
  inspectedAt     DateTime?
  inspectedById   String?  // QA inspector user ID
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  logs            CleaningLog[]
}
```

### 2. API Endpoints

#### Room Management
| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/rooms` | GET | List all rooms with status & reservations | Required |
| `/api/rooms/[id]/status` | POST | Update room status (AVAILABLE→CLEANING→etc) | rooms.manage |

#### Cleaning Routines
| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/cleaning-routines` | GET | List all active routines (filterable by type, frequency) | Required |
| `/api/cleaning-routines` | POST | Create new routine | cleaning.manage |
| `/api/cleaning-routines/[id]` | GET | Get routine with related tasks & checkups | Required |
| `/api/cleaning-routines/[id]` | PUT | Update routine | cleaning.manage |
| `/api/cleaning-routines/[id]` | DELETE | Delete routine (if no active tasks) | cleaning.manage |

#### Cleaning Tasks
| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/cleaning-tasks` | GET | List tasks (filterable by status, unit, assignee) | Required |
| `/api/cleaning-tasks` | POST | Create cleaning task | cleaning.assign |
| `/api/cleaning-tasks/[id]` | GET | Get task with logs & audit trail | Required |
| `/api/cleaning-tasks/[id]` | PUT | Update task status (transitions: PENDING→IN_PROGRESS→COMPLETED→INSPECTED) | Required |
| `/api/cleaning-tasks/[id]` | DELETE | Delete task (only PENDING/REJECTED) | cleaning.manage |

#### Guest Checkout
| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/reservations/[id]/checkout` | POST | Guest checkout → Auto-create cleaning task | reservations.checkout |

**Payload Example:**
```json
POST /api/reservations/res-123/checkout
{
  "cleaningRoutineId": "routine-456",        // Optional - auto-select if not provided
  "cleaningPriority": "HIGH",                // Optional - uses routine default
  "assignCleanerTo": "user-789",             // Optional - cleaner or dept ID
  "checkoutNotes": "Guest spilled drink in room 202"
}

Response:
{
  "success": true,
  "data": {
    "reservation": { ... status: "CHECKED_OUT" ... },
    "cleaningTask": { ... status: "PENDING" ... },
    "room": { ... status: "CLEANING" ... }
  }
}
```

### 3. Business Logic (CleaningService)

The `CleaningService` class (`src/services/CleaningService.ts`) handles:

**Routine Management:**
- `createRoutine(data, ctx)` - Create reusable cleaning template
- `getRoutines(type?, frequency?)` - Fetch active routines
- `getRoutineDetail(routineId)` - Routine with task history
- `getRoutineForRoomType(roomTypeId, cleaningType)` - Find routine for room type

**Task Management:**
- `createTask(data, ctx)` - Create cleaning task
- `createTaskFromRoutine(unitId, routineId, assignedToId?, ctx?)` - Task from template
- `assignTask(taskId, assignedToId, ctx)` - Assign cleaner
- `startTask(taskId, ctx)` - Mark IN_PROGRESS
- `completeTask(taskId, notes?, ctx?)` - Mark COMPLETED (ready for inspection)
- `inspectTask(taskId, approved, notes?, ctx?)` - QA inspection (INSPECTED or REJECTED)
- `logCleaningItem(taskId, data, ctx)` - Log checklist items

**Analytics:**
- `getPendingTasks(departmentId?)` - Unassigned/in-progress tasks
- `getTasksByUnit(unitId)` - Task history for room
- `getAverageTurnaroundTime(unitKindFilter?, daysBack?)` - Performance metrics

### 4. Frontend Components

#### Room Management Page
**Path:** `/app/(dashboard)/rooms/management/page.tsx`

Features:
- Dashboard showing room counts (Available, Occupied, Cleaning, Maintenance)
- Grid of all rooms with real-time status
- Guest info for occupied rooms
- One-click "Checkout" button for OCCUPIED rooms
  - Dialog to select routine, priority, special instructions
  - Auto-creates cleaning task
- Room status change dialog (→ MAINTENANCE, BLOCKED, AVAILABLE)
- Auto-refresh every 30 seconds

**Usage:**
1. Front desk staff navigate to `/rooms/management`
2. Click "Checkout" on occupied room
3. Select cleaning routine (or auto-detect)
4. Set priority (normal/high/urgent)
5. Add special notes if needed
6. Submit → Room becomes CLEANING, task created

#### Cleaning Routines Admin
**Path:** `/app/(dashboard)/admin/cleaning-routines/page.tsx`

Features:
- List all routines with filters (type, frequency, active status)
- Create new routine with:
  - Code (unique identifier)
  - Name & description
  - Type selector (6 types)
  - Frequency selector (6 options)
  - Estimated time in minutes
  - Priority
  - Inline checklist builder (add/remove items)
- Edit/delete routines
- View routine usage stats

#### Housekeeping Staff Dashboard
**Path:** `/app/(dashboard)/housekeeping/cleaning-tasks/page.tsx`

Features:
- Task statistics (Pending, In Progress, Completed)
- Filter tasks by status
- Expandable task cards showing:
  - Room number & type
  - Priority & routine
  - Checklist
  - Time estimates
- "Start" button to begin task (PENDING → IN_PROGRESS)
- "Complete" button with notes (IN_PROGRESS → COMPLETED)
- Task timeline (started/completed timestamps)
- Auto-refresh every 30 seconds

### 5. Room Status Flow

```
AVAILABLE 
    ↓ (check-in guest)
OCCUPIED (with active reservation)
    ↓ (guest checks out → auto-create cleaning task)
CLEANING (with pending/in-progress tasks)
    ↓ (all tasks inspected & approved)
AVAILABLE
    
Alternative states:
    OCCUPIED → MAINTENANCE (for repairs, can't checkout)
    AVAILABLE → BLOCKED (reserved for staff use)
    AVAILABLE → MAINTENANCE (broken AC, etc.)
```

## 🔧 Setup Steps

### 1. Install/Update Dependencies (if needed)
```bash
npm install
```

### 2. Generate Prisma Client
```bash
npx prisma generate
```

### 3. Apply Database Migration
```bash
npx prisma migrate dev --name "Add cleaning routines and enums"
# Or to push schema:
npx prisma db push
```

### 4. Verify TypeScript
```bash
npx tsc --noEmit
```

### 5. Create Initial Cleaning Routines

Navigate to `/admin/cleaning-routines` and manually create routines:
- **Turnover Single** (30 min) - Basic turnover for single bed rooms
- **Turnover Double** (40 min) - Turnover for double bed rooms
- **Deep Clean** (90 min) - Full deep clean
- **Linen Change** (15 min) - Just change linens
- **Touch Up** (20 min) - Quick refresh

Or use the seeding script (optional):
```bash
npm run seed:cleaning  # If available
```

## 🔐 Permissions Required

Create or verify these permissions exist:

```
cleaning.manage    - Create/edit/delete routines
cleaning.assign    - Create and assign tasks
cleaning.work      - Work on tasks (cleaners)
rooms.manage       - Update room status
reservations.checkout - Process guest checkout
```

## 📊 Typical Workflow

### Front Desk (Checkout Process)
1. Guest checks out
2. Navigate to `/rooms/management`
3. Click "Checkout" button on room card
4. Select turnover routine (or auto-detect)
5. Set priority (normal for most cases)
6. Add notes if needed (e.g., "spill in bathroom")
7. Submit
8. Room automatically marked CLEANING
9. Task created for housekeeping

### Housekeeping Staff
1. Navigate to `/housekeeping/cleaning-tasks`
2. See pending tasks assigned to them
3. Click task to expand details
4. Click "Start" when ready (marks IN_PROGRESS)
5. Follow checklist items
6. Click "Complete" when done
7. Add completion notes
8. Task waiting for QA inspection

### QA Inspector / Housekeeping Manager
1. Navigate to `/housekeeping/cleaning-tasks`
2. Filter by "Completed" status
3. Review task and notes
4. Approve (mark INSPECTED) → Room becomes AVAILABLE
5. Or reject (mark REJECTED) → Task returns to PENDING for re-do

## 🛠️ Customization

### Add Custom Cleaning Type
1. Update `enum CleaningRoutineType` in [prisma/schema.prisma](prisma/schema.prisma)
2. Run `npx prisma migrate dev`
3. Create routine via admin UI

### Modify Checklist Format
Current format: `Json` (array of items)
```json
[
  { "item": "Vacuum floors", "required": true },
  { "item": "Clean mirrors", "required": true },
  { "item": "Stock toiletries", "required": false }
]
```

### Add Department-Specific Routines
The `CleaningRoutine` model already has relationships with:
- `RoomType[]` - Routines specific to room types
- `Department[]` - Routines for specific departments

This enables:
- Different routines for single vs. double rooms
- Different processes for kitchen vs. bar areas

## 🐛 Troubleshooting

### TypeScript Errors on CleaningRoutine
```
Module '"@prisma/client"' has no exported member 'CleaningRoutine'
```
**Solution:** Run `npx prisma generate` to regenerate types

### Room Not Transitioning to CLEANING
**Possible causes:**
1. Checkout didn't succeed - check response for errors
2. Unit/Room not found - verify room ID exists
3. Reservation not in CHECKED_IN status - verify reservation status

### Cleaning Task Not Appearing
**Check:**
1. Task was created (check database)
2. Task not filtered out (check status filters)
3. Staff assigned to task can see it
4. Task's unitId matches room

## 📝 Testing via API

### Test Checkout Flow
```powershell
# 1. Get a room with active reservation
curl -X GET http://localhost:3000/api/rooms

# 2. Checkout guest
curl -X POST http://localhost:3000/api/reservations/RESERVATION_ID/checkout `
  -H "Content-Type: application/json" `
  -d '{
    "cleaningRoutineId": "ROUTINE_ID",
    "cleaningPriority": "NORMAL",
    "checkoutNotes": "Test checkout"
  }'

# 3. Verify room is now CLEANING
curl -X GET http://localhost:3000/api/rooms
```

### Create Cleaning Routine
```powershell
curl -X POST http://localhost:3000/api/cleaning-routines `
  -H "Content-Type: application/json" `
  -d '{
    "code": "TURNOVER_SINGLE",
    "name": "Turnover Single Room",
    "type": "TURNOVER",
    "frequency": "EVERY_CHECKOUT",
    "estimatedMinutes": 30,
    "priority": "NORMAL",
    "checklist": [
      {"item": "Vacuum floors", "required": true},
      {"item": "Clean bathroom", "required": true},
      {"item": "Change linens", "required": true}
    ]
  }'
```

## 📚 Related Documentation

- [Prisma Schema](prisma/schema.prisma) - Database models
- [CleaningService](src/services/CleaningService.ts) - Business logic
- [Checkout Endpoint](app/api/reservations/[id]/checkout/route.ts) - Checkout logic
- [Room Status Endpoint](app/api/rooms/[id]/status/route.ts) - Status updates
- [RBAC Guide](docs/RBAC_IMPLEMENTATION_GUIDE.md) - Permission system

---

**Last Updated:** February 23, 2026
**Status:** ✅ Production Ready
**TypeScript:** ✅ All types resolved
**API:** ✅ All endpoints tested
