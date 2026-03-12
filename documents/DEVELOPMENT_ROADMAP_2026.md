# Hotel Manager v3 → Enterprise SaaS: Development Roadmap 2026
**Version**: 2.0  
**Date**: March 11, 2026  
**Scope**: Complete refactoring to multi-tenant SaaS with inventory, accounting, payments, and terminal unification  

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Vision & Strategic Goals](#vision--strategic-goals)
4. [High-Level Architecture](#high-level-architecture)
5. [Feature Breakdown](#feature-breakdown)
6. [Implementation Phases (Master Timeline)](#implementation-phases-master-timeline)
7. [Detailed Phase Specifications](#detailed-phase-specifications)
8. [Integration Points & Dependencies](#integration-points--dependencies)
9. [Data Migration Strategy](#data-migration-strategy)
10. [Risk Assessment & Mitigation](#risk-assessment--mitigation)
11. [Success Metrics & KPIs](#success-metrics--kpis)
12. [Budget & Resource Planning](#budget--resource-planning)

---

## Executive Summary

This roadmap outlines the transformation of Hotel Manager v3 from a single-tenant hotel POS system into a **multi-tenant Enterprise SaaS platform** supporting:

- **Hotels** (room bookings, food/beverage POS, laundry, maintenance)
- **Restaurants & Bars** (dine-in, takeout, delivery)
- **Retail Operations** (boutiques, supermarkets, general retail with physical location tracking)
- **Unified Payments** (single terminal/payment experience across all modules)
- **Financial Compliance** (ledger-based accounting, multi-jurisdiction taxes, audit trails)

### Key Transformations

| Component | Current State | Target State | Benefit |
|-----------|---------------|--------------|---------|
| **Multi-Tenancy** | Single hotel | Unlimited tenants | New revenue streams |
| **Inventory** | Department-based, manual | Retail-ready with location tracking | Support 100+ SKUs, multiple locations |
| **Recipes** | None | Recipe management with ingredients | Meal cost tracking, ingredient control |
| **Supply Chain** | Manual POs, no tracking | Digital receiving & QC workflow | Reduced spoilage, supplier tracking |
| **Tax Handling** | Manual spreadsheets | Automated per jurisdiction | Compliance, accuracy |
| **Payments** | Cash-only, per department | Unified terminal + gateway | Reduced friction, unified reporting |
| **Bookings** | No tax in reservation | Tax-inclusive pricing | GDPR/VAT compliance |
| **Games** | Department counter | Terminal-native feature | Better UX, easier scaling |
| **Accounting** | Cash basis | Ledger-based double-entry | Financial statements, audits |

### Timeline Overview
```
Phase 1-2 (Weeks 1-4):      Foundation & Multi-Tenancy
Phase 3-4 (Weeks 5-8):      Accounting, Tax, Payments
Phase 5-6 (Weeks 9-12):     Inventory Refactoring
Phase 6a (Weeks 12.5-14):   Recipes & Meal Composition (Restaurant)
Phase 6b (Weeks 14-16):     Supply Chain & Receiving (Universal)
Phase 7-8 (Weeks 16-20):    Hotel Booking Tax & Terminal Unification  
Phase 9-10 (Weeks 21-24):   Migration, Testing, Launch
Total Duration: 24 weeks (~6 months)
```

---

## Current State Analysis

### Existing Architecture Gaps

**Tech Stack**: Next.js 15, TypeScript, Prisma ORM, PostgreSQL, shadcn/ui ✓

**Functional Gaps**:
1. **Multi-Tenancy**: None — all data in single schema
2. **Inventory System**: Simple department-based, no retail support
   - No SKU management
   - No physical location tracking
   - Manual category management
   - Transfers are logged but not optimized
3. **Tax System**: None — manual calculations
4. **Accounting**: None — immediate revenue recognition
5. **Payments**: Cash-only, no gateway integration
6. **Hotel Bookings**: No tax-inclusive pricing
7. **Games**: Coupled to department, hard to scale
8. **Terminals**: Separate UI per module, no unified experience

**Code Quality Issues**:
- 25% code duplication (auth, validation, response formats)
- Scattered permission checks
- No shared service layer
- Brittle API contracts

### Affected Modules

```
Current structure:
├── POS (orders, items)           → Needs: Tax, unified payments
├── Departments (kitchen, bar)    → Needs: Tax, terminal integration
├── Inventory (simple)            → Needs: SKU, location tracking, transfers
├── Bookings (rooms)              → Needs: Tax-inclusive pricing
├── Games (counter)               → Needs: Move to terminal
├── Auth (AdminUser + User)       → Needs: Consolidation to TenantUser
└── Admin Dashboard              → Needs: Multi-tenant support
```

---

## Vision & Strategic Goals

### Goal 1: Universal POS Platform
**Enable businesses of all types** (hotels, restaurants, retail) to operate on single system, with modular features enabled/disabled per subscription tier.

**Success**: Deploy to 10+ customers in 6 months (tier 1-2), 100+ in year 2.

### Goal 2: Financial Integrity
**Provide audit-ready financial reporting** with tax compliance, ledger transparency, and regulatory alignment (GDPR, VAT, sales tax).

**Success**: Zero audit findings for financial reporting; pass SOC 2 compliance.

### Goal 3: Payment Modernization
**Replace fragmented payment flows** with unified terminal experience, reducing friction and enabling advanced features (split payments, tips, receipts).

**Success**: 99.5% payment success rate; <2s receipt generation.

### Goal 4: Operational Excellence
**Streamline inventory, bookings, and service workflows** through simplified data models and terminal-native features.

**Success**: 40% reduction in admin tasks; support 1M+ SKUs across all customer locations.

---

## High-Level Architecture

### Platform Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MULTI-TENANT SaaS PLATFORM                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │
│  │ TENANT A         │  │ TENANT B         │  │ TENANT N             │ │
│  │ (Hotel Chain)    │  │ (Restaurant)     │  │ (Supermarket Chain)  │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘ │
│         │                      │                      │                │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │              LOCATIONS (Physical Stores/Hotels)              │      │
│  │  HQ   Branch 1   Branch 2   ... (configurable per tenant)    │      │
│  └──────────────────────────────────────────────────────────────┘      │
│         │                                                              │
│         ▼                                                              │
│  ┌─────────────────────────────────────────────────────┐               │
│  │           UNIFIED DATA LAYER (PostgreSQL + RLS)     │               │
│  │                                                     │               │
│  │  • Tenants, Locations, Users, Permissions           │               │
│  │  • Inventory (SKU, Categories, Location Stock)      │               │
│  │  • Orders, Invoices, Payments (unified)             │               │
│  │  • Hotel Bookings (with tax)                         │               │
│  │  • Ledger, Tax, Accounting                          │               │
│  │  • Games, Terminals, Sessions                      │               │
│  └─────────────────────────────────────────────────────┘               │
│         │                                                              │
│         ▼                                                              │
│  ┌─────────────────────────────────────────────────────┐               │
│  │           UNIFIED SERVICE LAYER                     │               │
│  │                                                     │               │
│  │  • TenantService      (config, isolation)           │               │
│  │  • InventoryService   (SKU, transfers, locations)   │               │
│  │  • AccountingService  (ledger, reports)             │               │
│  │  • TaxService         (compliance, calculations)    │               │
│  │  • PaymentService     (unified terminal)            │               │
│  │  • BookingService     (tax-inclusive pricing)       │               │
│  │  • GamesService       (lobby, terminal)             │               │
│  │  • NotificationService (email, receipts)            │               │
│  └─────────────────────────────────────────────────────┘               │
│         │                                                              │
│         ▼                                                              │
│  ┌─────────────────────────────────────────────────────┐               │
│  │           TERMINAL LAYER (Unified UI/UX)           │               │
│  │                                                     │               │
│  │  • Sales Terminal (orders + payments unified)       │               │
│  │  • Kitchen Display System (department status)       │               │
│  │  • Retail POS (SKU lookup, inventory)              │               │
│  │  • Hotel Kiosk (bookings, games)                   │               │
│  │  • Admin Dashboard (reports, config)               │               │
│  │  • Mobile Manager App (notifications, approvals)   │               │
│  └─────────────────────────────────────────────────────┘               │
│         │                                                              │
│         ▼                                                              │
│  ┌─────────────────────────────────────────────────────┐               │
│  │           EXTERNAL INTEGRATIONS                     │               │
│  │                                                     │               │
│  │  • Stripe (payments)          • SendGrid (email)    │               │
│  │  • S3 (PDFs, receipts)        • Tax APIs (compliance)│             │
│  └─────────────────────────────────────────────────────┘               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Core Data Model Changes

**Phase 1 Additions (Multi-Tenancy)**:
- `Tenant` — independent customer
- `Location` — store/hotel within tenant
- `TenantUser` — unified auth replacing AdminUser + User

**Phase 2 Additions (Accounting)**:
- `LedgerEntry` — financial transactions
- `ChartOfAccounts` — GL structure
- `Invoice`, `Payment` — unified payment model

**Phase 3 Additions (Tax)**:
- `TaxConfig` — jurisdiction rules
- `TaxRate` — percentage by category/item
- `TaxLine` — invoice-level tax details

**Phase 5 Additions (Inventory)**:
- `InventorySKU` — product master data
- `InventoryCategory`, `InventorySubCategory` — simplified hierarchy
- `LocationInventory` — stock per location
- `InventoryTransfer` — movement tracking
- `InventoryAudit` — reconciliation history

**Phase 7 Additions (Hotel Bookings + Terminal)**:
- `BookingTaxLine` — tax per room reservation
- `SalesTerminal` — unified checkout device
- `TerminalSession` — active terminal session
- `GameSession` — games now terminal-native

---

## Feature Breakdown

### 1. Multi-Tenancy (Phase 1-2)
**Scope**: Foundation for all other features

**Key Requirements**:
- ✓ Tenant isolation at database level (RLS)
- ✓ Unified user authentication (TenantUser)
- ✓ Tenant context in all API calls
- ✓ Permission inheritance (tenant → location → user)

**Deliverables**:
- Tenant management API
- Multi-tenant middleware
- Tenant configuration portal
- Data isolation tests

---

### 2. Accounting & Ledger (Phase 3)
**Scope**: Double-entry bookkeeping, financial reporting

**Key Requirements**:
- ✓ General Ledger with atomic posts
- ✓ Chart of Accounts (customizable per tenant)
- ✓ Trial balance, P&L, balance sheet reports
- ✓ Accounting period closing
- ✓ Audit trail (who/when/what changed)

**Deliverables**:
- `AccountingService` with posting logic
- Financial report APIs
- Period closing workflow
- Reconciliation tools

---

### 3. Tax System (Phase 4)
**Scope**: Multi-jurisdiction tax compliance

**Supported Jurisdictions** (Phase 4a):
- **USA**: Sales tax by state (CA, NY, TX, others)
- **EU**: VAT (20%, 10%, 5% rates) with reverse charge
- **UK**: VAT + Brexit implications

**Advanced** (Phase 4b - optional):
- **Canada**: GST/HST
- **Australia**: GST
- **Japan**: Consumption tax

**Key Requirements**:
- ✓ Rate lookup by jurisdiction + product category + customer type
- ✓ Compound tax support (stacked rates)
- ✓ Tax-inclusive pricing option
- ✓ Compliance reports (e.g., VAT return template)
- ✓ Effective dating (rate changes over time)

**Deliverables**:
- `TaxService` with rate engine
- Tax configuration UI
- Compliance report templates
- Tax line item tracking

---

### 4. Inventory System Refactoring (Phase 5-6)
**Scope**: Support retail-grade inventory with location tracking

**Current Issues**:
- Department-based only (no SKU master)
- No category hierarchy
- Manual transfers
- No physical location tracking

**Target Design**:

```
Inventory Hierarchy:
├── Tenant
│   ├── Category (e.g., "Beverages", "Groceries", "Rooms")
│   │   ├── SubCategory (e.g., "Spirits", "Wine", "Beer")
│   │   │   ├── SKU #1 (e.g., "Whiskey - Jameson 1L")
│   │   │   │   ├── InventoryLocation @ Location A (qty: 50)
│   │   │   │   ├── InventoryLocation @ Location B (qty: 30)
│   │   │   │   └── [Location C not stocked]
│   │   │   ├── SKU #2 (e.g., "Whiskey - Macallan 18yr")
│   │   │   │   └── InventoryLocation @ Location A (qty: 15)
│   │   │   └── ...
│   │   └── ...
│   └── ...
```

**Key Requirements**:
- ✓ SKU master data (product code, name, unit, cost, barcode)
- ✓ Simplified category hierarchy (2 levels: category + subcategory)
- ✓ Location-based stock tracking (qty on hand per location)
- ✓ Automated transfer workflow (request → approve → execute)
- ✓ Inventory reconciliation (periodic physical count)
- ✓ Stock alerts (low stock warnings)
- ✓ Historical tracking (audit trail of stock movements)
- ✓ Multi-unit support (buy in cases, sell in units)

**Deliverables**:
- `InventorySKU`, `InventoryCategory`, `LocationInventory` models
- `InventoryService` with location awareness
- SKU master data import tool (CSV)
- Transfer approval workflow
- Inventory reconciliation UI
- Stock alerting system

**Use Cases**:
- **Hotel**: Track mini-bar, linens, toiletries per room
- **Restaurant**: Track bottles, ingredients per station (kitchen, bar)
- **Supermarket**: 1000s SKUs across multiple locations
- **Boutique**: Clothing SKUs with size/color variants

---

### 4a. Recipe & Meal Composition (Phase 6a)
**Scope**: Restaurant meal building and ingredient consumption tracking

**Current Issues**:
- No recipe management
- Ingredient consumption not tracked
- No meal cost calculation
- Manual portion control
- Difficult to identify waste or recipe profitability

**Target Design**:

```
Recipe Hierarchy:
├── Tenant
│   └── Recipe (e.g., "Caesar Salad", "Grilled Salmon")
│       ├── RecipeIngredient
│       │   ├── SKU: "Lettuce - Romaine" (qty: 0.5, unit: "bunch")
│       │   ├── SKU: "Caesar Dressing" (qty: 2, unit: "oz")
│       │   ├── SKU: "Parmesan" (qty: 0.5, unit: "cup")
│       │   └── Cost per ingredient calculated
│       ├── RecipeServingSize (portions per recipe)
│       ├── TotalRecipeCost (auto-calculated)
│       ├── NumServings (e.g., 2 portions per batch)
│       └── CostPerPortion (TotalRecipeCost / NumServings)
│
└── RecipeProduction (when made)
    ├── RecipeProductionBatch (timestamp, quantity made)
    ├── InventoryReduction (automatically reduces stock per recipe ingredients)
    ├── ProductionYield (waste tracking, actual vs. expected)
    └── LaborCost (optional, per shift)
```

**Key Requirements**:
- ✓ Recipe master data (name, description, category)
- ✓ Recipe ingredients linked to SKUs with precise quantities
- ✓ Automatic cost calculation per recipe
- ✓ Cost per portion tracking
- ✓ Production batches (record when recipe is made)
- ✓ Auto-deduct ingredients from stock on production
- ✓ Yield tracking (expected vs. actual output)
- ✓ Labor cost assignment per recipe
- ✓ Recipe profitability reporting
- ✓ Ingredient substitution history
- ✓ Recipe versioning (track changes over time)
- ✓ Multi-location recipe variations (same recipe, different costs by location)

**Deliverables**:
- `Recipe`, `RecipeIngredient` models
- `RecipeProductionBatch` model (production tracking)
- `RecipeService` with ingredient auto-deduction
- Recipe creation/edit UI
- Recipe costing calculator
- Production entry interface (KDS integration)
- Recipe profitability report
- Waste analysis dashboard

**Use Cases**:
- **Restaurant**: Track exact ingredient usage per dish, identify margin leaks
- **Bakery**: Manage flour, sugar, eggs per bread/cake recipe
- **Cafe**: Manage espresso shots, milk, syrup per drink recipe
- **Catering**: Batch recipes by party size
- **Food Service**: Prevent over-production, reduce spoilage

---

### 4b. Supply Chain & Receiving (Phase 6b)
**Scope**: Supplier management, purchase orders, goods receiving, quality control

**Current Issues**:
- Manual purchase orders (email, phone)
- No receiving workflow
- No quality checks
- Inventory discrepancies (received != recorded)
- No supplier performance tracking
- Manual invoice matching

**Target Design**:

```
Supply Chain Flow:
1. PURCHASE ORDER (PO)
   ├── Vendor selection (from supplier list)
   ├── Line items (SKU, qty, unit price)
   ├── Delivery date
   ├── Special instructions
   └── Approval workflow (department → manager)

2. PURCHASE ORDER STATUS
   ├── Draft → Submitted → Confirmed → Dispatched → In Transit → Delivered
   └── Audit trail of status changes

3. GOODS RECEIPT
   ├── GoodsReceiptHeader
   │   ├── PO reference
   │   ├── Receiving location
   │   ├── Received timestamp
   │   └── Receiving person
   │
   └── GoodsReceiptLine
       ├── SKU matched to PO line
       ├── Quantity received (vs. qty ordered)
       ├── Quality check (pass/fail/partial)
       ├── Condition (damages, defects)
       ├── Unit price verified
       └── Serial/batch number (if applicable)

4. QUALITY CONTROL
   ├── Inspection checklist per product type
   ├── Photo documentation (optional)
   ├── Pass/Fail decision
   └── Rejection with reason → return authorization

5. INVENTORY UPDATE
   ├── On goods receipt acceptance
   ├── Stock added to LocationInventory
   ├── Cost valuation (FIFO/LIFO)
   └── 3-way match: PO → Receipt → Invoice

6. SUPPLIER PORTAL (Optional)
   ├── View open POs
   ├── Acknowledge receipt
   ├── Track delivery status
   └── Support tickets
```

**Key Requirements**:
- ✓ Supplier master data (name, contact, performance rating)
- ✓ Supplier catalog (SKU list, pricing, lead time)
- ✓ Purchase order creation (auto-generate from low stock)
- ✓ PO approval workflow (by department, budget limits)
- ✓ Receiving workflow (scan barcode, verify qty)
- ✓ Quality control checklist (customizable per product type)
- ✓ 3-way match (PO → Receipt → Invoice)
- ✓ Variance handling (qty discrepancies, price mismatches)
- ✓ Goods receipt reconciliation
- ✓ Return authorization (RMA) tracking
- ✓ Supplier performance metrics (on-time %, defect rate)
- ✓ Batch/lot tracking (for expiry, recalls)
- ✓ Cost variance reporting (standard cost vs. actual)

**Deliverables**:
- `Supplier`, `SupplierCatalog` models
- `PurchaseOrder`, `POLine` models
- `GoodsReceipt`, `GoodsReceiptLine` models
- `QualityControl` model
- `SupplyChainService` (PO management, receipt, matching)
- Receiving UI with barcode scanning
- QC checklist interface
- 3-way match verification
- Supplier performance dashboard
- Return authorization workflow
- Cost variance report

**Use Cases**:
- **Restaurant**: Daily produce ordering, quick receiving
- **Hotel**: Linen/toiletry supply from vendors
- **Supermarket**: High-volume supplier management, warehouse receiving
- **Retail**: Multiple distributors, SKU-level cost tracking
- **Multi-Location**: Centralized purchasing, distributed receiving

---

### 5. Unified Payment System (Phase 4 + Phase 7)
**Scope**: Single payment experience across all modules

**Current Issues**:
- Cash-only, no gateway
- Per-department payment flows
- No receipt generation
- No unified reporting

**Target Design**:
```
Any Order (POS, Booking, Retail, etc.)
    ↓
SalesTerminal (unified checkout)
    ↓
PaymentService (abstraction layer)
    ├── Stripe (primary)
    ├── Cash (secondary, for remote locations)
    ├── Card (manual entry, for phone)
    └── Mobile Wallet (future: Apple Pay, Google Pay)
    ↓
Payment Receipt (generated automatically)
    ↓
Ledger Post (payment + receivable cleared)
```

**Key Requirements**:
- ✓ Unified checkout page (works for all order types)
- ✓ Multiple payment methods (Stripe, cash, card, mobile)
- ✓ Payment intent creation (Stripe API)
- ✓ Webhook handling for async confirmations
- ✓ Automatic receipt generation (PDF + email)
- ✓ Receipt archiving (S3)
- ✓ Split payments (pay-later, tip handling)
- ✓ Refund workflow
- ✓ Payment reporting dashboard

**Deliverables**:
- `SalesTerminal` component (unified checkout)
- `PaymentService` with Stripe integration
- Receipt generation + email
- Payment webhook handler
- Refund API
- Payment reporting

---

### 6. Hotel Booking Tax Integration (Phase 7)
**Scope**: Add tax-aware hotel reservations

**Current Issues**:
- No tax on room reservations
- No tax line items on invoice
- Manual invoicing for bookings

**Target Design**:
```
Hotel Booking:
├── Room Rate: $100/night × 3 nights = $300
├── Tax (10% occupancy tax): $30
├── Total: $330
│
├── Invoice Generation:
│   ├── Room charges (line items)
│   ├── Tax line item (itemized by rate)
│   └── Total with tax
│
└── Payment:
    └── SalesTerminal (unified with restaurant/retail)
```

**Key Requirements**:
- ✓ Tax config per jurisdiction for accommodation
- ✓ Tax calculation at point of booking
- ✓ Invoice generation from booking (with tax)
- ✓ Payment integration (use unified PaymentService)
- ✓ Receipt with tax breakdown
- ✓ Accounting posting (room revenue + tax payable)
- ✓ Tax compliance reporting

**Deliverables**:
- Hotel booking tax calculation
- Booking-to-invoice workflow
- Integration with unified payments
- Tax line item tracking
- Compliance reports for accommodation

---

### 7. Games Migration to Terminal (Phase 7)
**Scope**: Move games feature from department to terminal

**Current Issues**:
- Games counter tied to department (`DepartmentGame`)
- Hard to display on multiple devices
- Limited by department scope

**Target Design**:
```
Sales Terminal
├── Main: Orders + Payments
├── Secondary: Games / Entertainment
│   ├── Lobby Games (slot machine, keno)
│   ├── Result display (leaderboards, jackpot)
│   └── Session tracking (player, stakes, winnings)
└── Integration: Games winnings → Order (line item) → Payment
```

**Key Requirements**:
- ✓ Separate `GameSession` from `Department`
- ✓ Terminal-native games UI
- ✓ Multi-terminal support (sync state across devices)
- ✓ Player session state (login, balance, rounds)
- ✓ Winnings integration (add to order as revenue line)
- ✓ Audit trail (game results, payouts)
- ✓ Reporting (game revenue, participation)

**Deliverables**:
- `SalesTerminal` games module
- `GameSession` model (independent of departments)
- Terminal synchronization (WebSocket or polling)
- Winnings-to-order workflow
- Games reporting UI

---

## Implementation Phases (Master Timeline)

### Phase Overview
```
┌──────────────────┬──────────┬──────────────────┬──────────────┐
│ Phase            │ Duration │ Team Size        │ Dependencies │
├──────────────────┼──────────┼──────────────────┼──────────────┤
│ 1. Foundation    │ 2 weeks  │ 1 FTE            │ None         │
│ 2. Services      │ 2 weeks  │ 1.5 FTE          │ Phase 1      │
│ 3. Accounting    │ 2 weeks  │ 1 FTE            │ Phase 1-2    │
│ 4. Tax & Pay     │ 2 weeks  │ 1.5 FTE          │ Phase 1-3    │
│ 5. Inventory     │ 2 weeks  │ 1.5 FTE          │ Phase 1-2    │
│ 6. Inv Advanced  │ 2 weeks  │ 1 FTE            │ Phase 5      │
│ 6a. Recipes      │ 1.5 weeks│ 1 FTE            │ Phase 5      │
│ 6b. Supply Chain │ 2 weeks  │ 1.5 FTE          │ Phase 5, 6a  │
│ 7. Booking Tax   │ 2 weeks  │ 1 FTE            │ Phase 4      │
│ 8. Terminal      │ 2 weeks  │ 1.5 FTE          │ Phase 4,5,7  │
│ 9. Migration     │ 1 week   │ 1 FTE            │ All Phases   │
│ 10. QA & Deploy  │ 2 weeks  │ 1.5 FTE          │ All Phases   │
└──────────────────┴──────────┴──────────────────┴──────────────┘

Total Effort: ~24 weeks
Stream Organization: Can run some phases in parallel
├── Stream A (Core): Phase 1 → 2 → 3 → 4 [8 weeks]
├── Stream B (Inventory): Phase 5 → 6 → 6a → 6b [7.5 weeks, starts week 9]
└── Stream C (Retail): Phase 7 → 8 [4 weeks, starts week 14]
All streams converge at Phase 9 (Migration) & 10 (QA)
```

### Phase 1: Multi-Tenancy Foundation (Weeks 1-2)
**Goal**: Establish tenant isolation without breaking existing code

**Stories**:
- [ ] S1.1: Add Tenant schema model
- [ ] S1.2: Add Location schema model
- [ ] S1.3: Create @withTenant decorator
- [ ] S1.4: Implement tenant middleware
- [ ] S1.5: Add tenant context to all route handlers
- [ ] S1.6: Tenant isolation tests (90%+ coverage)

**Acceptance Criteria**:
- [x] Request with invalid tenantId returns 403
- [x] TenantUser can only read own tenant data
- [x] All new endpoints require tenantId in path or header
- [x] Old endpoints continue working (backwards compatible)

**Output**: Tenant-aware API framework

---

### Phase 2: Shared Services Foundation (Weeks 3-4)
**Goal**: Consolidate services, eliminate code duplication

**Stories**:
- [ ] S2.1: Create service layer structure
- [ ] S2.2: Implement AccountingService stub
- [ ] S2.3: Implement TaxService stub
- [ ] S2.4: Implement PaymentService stub
- [ ] S2.5: Refactor duplicate validation schemas
- [ ] S2.6: Refactor duplicate auth checks into decorators

**Acceptance Criteria**:
- [x] All business logic in services (not in route handlers)
- [x] Code duplication reduced from 25% to <15%
- [x] All services use TenantContext
- [x] 100% test coverage on service layer

**Output**: Unified service architecture

---

### Phase 3: Accounting & Ledger (Weeks 5-6)
**Goal**: Implement double-entry bookkeeping and financial reporting

**Stories**:
- [ ] S3.1: Create LedgerEntry model + RLS policies
- [ ] S3.2: Create ChartOfAccounts (with defaults)
- [ ] S3.3: Implement AccountingService.postTransaction()
- [ ] S3.4: Implement trial balance calculation
- [ ] S3.5: Implement P&L report generation
- [ ] S3.6: Implement balance sheet report
- [ ] S3.7: Create accounting period model + closing workflow
- [ ] S3.8: Add ledger API endpoints

**Acceptance Criteria**:
- [x] Debits always equal credits (trial balance)
- [x] Period closing prevents adjustments to closed periods
- [x] Trial balance = sum of all accounts
- [x] P&L formula: Revenue - Expenses = Net Income
- [x] Ledger entries immutable (create-only, no deletes)

**Output**: Ledger-based accounting system

---

### Phase 4: Tax & Unified Payments (Weeks 7-8)
**Goal**: Tax calculation engine + payment gateway integration

**Stories**:
- [ ] S4.1: Create TaxConfig and TaxRate models
- [ ] S4.2: Implement TaxService.calculateTax()
- [ ] S4.3: Implement tax configuration per jurisdiction
- [ ] S4.4: Create Invoice and InvoiceLine models
- [ ] S4.5: Implement InvoiceService.generateInvoice()
- [ ] S4.6: Integrate Stripe API (create payment intent)
- [ ] S4.7: Implement PaymentService webhook handler
- [ ] S4.8: Create receipt generation (PDF + email)
- [ ] S4.9: Add tax compliance report API
- [ ] S4.10: Payment + ledger posting integration

**Acceptance Criteria**:
- [x] Order with tax: subtotal + tax = total
- [x] Invoice auto-generated from order
- [x] Payment intent created in Stripe
- [x] Webhook updates invoice status to "paid"
- [x] Receipt generated within 2 seconds
- [x] Tax compliance report matches ledger ±$0.01
- [x] All payments post to ledger (cash + A/R accounts)

**Output**: Integrated tax and payment system

---

### Phase 5: Inventory Foundation (Weeks 9-10)
**Goal**: New inventory data model with location tracking

**Stories**:
- [ ] S5.1: Create InventorySKU model (master data)
- [ ] S5.2: Create InventoryCategory + SubCategory models
- [ ] S5.3: Create LocationInventory model (qty per location)
- [ ] S5.4: Create InventoryTransfer model (movement tracking)
- [ ] S5.5: Implement InventoryService.getStockByLocation()
- [ ] S5.6: Implement InventoryService.transferStock()
- [ ] S5.7: Create inventory API endpoints
- [ ] S5.8: Build SKU master data import tool (CSV)

**Acceptance Criteria**:
- [x] SKU has unique code per tenant
- [x] Each SKU has category + subcategory
- [x] Stock tracked per location
- [x] Transfers logged with audit trail
- [x] Can import 1000+ SKUs via CSV
- [x] Stock calculation: on-hand at each location

**Output**: Location-aware inventory data model

---

### Phase 6: Inventory Advanced Features (Weeks 11-12)
**Goal**: Inventory optimization, transfers, reconciliation

**Stories**:
- [ ] S6.1: Implement InventoryService.reconcileStock()
- [ ] S6.2: Create transfer approval workflow (request → approve → execute)
- [ ] S6.3: Implement low-stock alerts
- [ ] S6.4: Build inventory reconciliation UI (physical count)
- [ ] S6.5: Implement InventoryService.adjustStock() (with audit)
- [ ] S6.6: Create inventory reporting (valuation, turns)
- [ ] S6.7: Implement InventoryService.reserveStock() (for pending orders)

**Acceptance Criteria**:
- [x] Reconciliation detects on-hand vs. system discrepancies
- [x] Transfers require approval before execution
- [x] Low-stock alerts trigger at configurable thresholds
- [x] Physical count UI supports barcode scanning
- [x] All stock adjustments logged with reason + approver
- [x] Inventory valuation report (FIFO/LIFO)

**Output**: Complete inventory management system

---

### Phase 7: Hotel Booking Tax Integration (Weeks 13-14)
**Goal**: Tax-aware hotel reservations with unified payments

**Stories**:
- [ ] S7.1: Extend BookingModel with tax fields
- [ ] S7.2: Implement booking tax calculation
- [ ] S7.3: Create booking-to-invoice workflow
- [ ] S7.4: Integrate booking with unified PaymentService
- [ ] S7.5: Add tax line items to booking invoices
- [ ] S7.6: Create booking payment receipt
- [ ] S7.7: Implement booking ledger posting (room revenue + tax)
- [ ] S7.8: Add booking to tax compliance reports

**Acceptance Criteria**:
- [x] Booking includes tax calculation at reservation time
- [x] Invoice generated from booking (with all line items)
- [x] Payment uses unified SalesTerminal checkout
- [x] Receipt includes room charges + tax lines
- [x] Room revenue posts to correct GL account
- [x] Tax payable posts to jurisdiction-specific account
- [x] Booking appears in tax compliance reports

**Output**: Tax-integrated hotel booking system

---

### Phase 8: Sales Terminal Unification (Weeks 15-16)
**Goal**: Single unified terminal for POS, bookings, games, payments

**Stories**:
- [ ] S8.1: Create SalesTerminal model (device/terminal configuration)
- [ ] S8.2: Create TerminalSession model (active session tracking)
- [ ] S8.3: Build unified SalesTerminal UI component
- [ ] S8.4: Migrate GameSession from Department to Terminal
- [ ] S8.5: Integrate all order types (POS, booking, retail)
- [ ] S8.6: Merge payment flows into SalesTerminal
- [ ] S8.7: Add games module to SalesTerminal
- [ ] S8.8: Implement multi-terminal state sync (WebSocket)
- [ ] S8.9: Build terminal management dashboard

**Acceptance Criteria**:
- [x] Single terminal can process POS orders + room bookings
- [x] Games integrated into terminal without games module override
- [x] Payment checkout works for all order types
- [x] State synced across multiple terminals (<100ms latency)
- [x] Games winnings add to order as line items
- [x] All terminal actions logged + auditable
- [x] Terminal session tracking (login, duration, transactions)

**Output**: Unified sales terminal (single point of sale across all modules)

---

### Phase 9: Data Migration (Week 17)
**Goal**: Migrate existing single-tenant data to new multi-tenant structure

**Stories**:
- [ ] S9.1: Create migration script (existing data → default tenant)
- [ ] S9.2: Validate data integrity post-migration
- [ ] S9.3: Reconcile accounts in new ledger
- [ ] S9.4: Map old departments to new inventory categories
- [ ] S9.5: Transform old game records to terminal sessions
- [ ] S9.6: Sunset old schema tables (AdminUser, etc.)

**Acceptance Criteria**:
- [x] All historical orders readable under default tenant
- [x] All inventory mapped to new structure with locations
- [x] Zero data loss
- [x] Ledger integrity verified (trial balance)
- [x] Old API endpoints return 410 Gone / redirects

**Output**: Data migrated to production

---

### Phase 10: QA, Testing & Launch (Weeks 18-20)
**Goal**: Comprehensive testing, launch readiness

**Stories**:
- [ ] S10.1: Integration testing (all modules end-to-end)
- [ ] S10.2: User acceptance testing (all roles)
- [ ] S10.3: Performance testing (concurrent tenants, orders)
- [ ] S10.4: Security testing (tenant isolation, auth)
- [ ] S10.5: Compliance audit (ledger, tax, data protection)
- [ ] S10.6: Documentation (API, admin guide, user manual)
- [ ] S10.7: Production deployment + monitoring
- [ ] S10.8: Customer onboarding & support

**Acceptance Criteria**:
- [x] 95%+ test coverage on critical paths
- [x] Zero security vulnerabilities (OWASP Top 10)
- [x] All audit findings resolved
- [x] <2s P99 latency on all APIs
- [x] 99.5% uptime SLA met
- [x] All documentation reviewed by customer success

**Output**: Production-ready, compliant SaaS platform

---

## Detailed Phase Specifications

### Phase 1 Detail: Multi-Tenancy Foundation

#### New Database Models
```prisma
model Tenant {
  id                    String    @id @default(cuid())
  name                  String
  status                String    @default("active")
  subscriptionTierId    String
  taxResidencyCountry   String?
  taxId                 String?   // VAT/Tax ID
  config                Json?     // Tenant-specific settings
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  
  locations             Location[]
  users                 TenantUser[]
  
  @@unique([name])
  @@map("tenants")
}

model Location {
  id                    String    @id @default(cuid())
  tenantId              String
  code                  String
  name                  String
  address               String?
  city                  String?
  state                 String?
  zip                   String?
  timezone              String    @default("UTC")
  latitude              Float?
  longitude             Float?
  isActive              Boolean   @default(true)
  
  tenant                Tenant    @relation(fields: [tenantId], references: [id])
  
  @@unique([tenantId, code])
  @@index([tenantId])
  @@map("locations")
}

model TenantUser {
  id                    String    @id @default(cuid())
  tenantId              String
  email                 String
  passwordHash          String
  firstName             String
  lastName              String
  status                String    @default("active")
  lastLoginAt           DateTime?
  
  tenant                Tenant    @relation(fields: [tenantId], references: [id])
  roles                 TenantUserRole[]
  
  @@unique([tenantId, email])
  @@index([tenantId])
  @@map("tenant_users")
}

model TenantUserRole {
  id                    String    @id @default(cuid())
  userId                String
  roleId                String
  locationId            String?   // Scoped to location if specified
  
  user                  TenantUser @relation(fields: [userId], references: [id])
  
  @@unique([userId, roleId, locationId])
  @@index([userId])
  @@map("tenant_user_roles")
}
```

#### New API Endpoints (Phase 1)
```
POST   /api/admin/tenants                    (create new tenant)
GET    /api/admin/tenants/:tenantId          (get tenant details)
PUT    /api/admin/tenants/:tenantId          (update tenant config)

POST   /api/tenants/:tenantId/locations      (add location)
GET    /api/tenants/:tenantId/locations      (list locations)
PUT    /api/tenants/:tenantId/locations/:id  (update location)

POST   /api/tenants/:tenantId/users          (invite user)
GET    /api/tenants/:tenantId/users          (list users)
PUT    /api/tenants/:tenantId/users/:id      (update user)
DELETE /api/tenants/:tenantId/users/:id      (remove user)
```

#### Middleware Pattern
```typescript
// lib/auth/tenant-context.ts
export async function extractTenantContext(
  request: Request
): Promise<TenantContext> {
  const token = request.headers.get('Authorization')?.split(' ')[1];
  const jwt = verifyToken(token);
  
  return {
    tenantId: jwt.tenantId,
    userId: jwt.userId,
    locationId: jwt.locationId,
    roles: jwt.roles
  };
}

// Decorator pattern for routes
export function withTenant(handler: Function) {
  return async (request: Request, params: any) => {
    const ctx = await extractTenantContext(request);
    if (!ctx.tenantId) return errorResponse(UNAUTHORIZED);
    
    return handler(request, params, ctx);
  };
}
```

---

### Phase 4 Detail: Tax & Payments Integration

#### Tax Model Structure
```prisma
model TaxConfig {
  id                    String    @id @default(cuid())
  tenantId              String
  jurisdiction          String    // "US-CA", "FR", "GB"
  taxName               String    // "Sales Tax", "VAT"
  isCompound            Boolean   @default(false)
  effectiveFrom         DateTime
  effectiveTo           DateTime?
  
  tenant                Tenant    @relation(fields: [tenantId], references: [id])
  rates                 TaxRate[]
  
  @@unique([tenantId, jurisdiction])
  @@index([tenantId])
  @@map("tax_configs")
}

model TaxRate {
  id                    String    @id @default(cuid())
  configId              String
  categoryId            String    // InventoryCategory
  rate                  Decimal   @db.Decimal(5,4)
  applicableTo          String[]  // ["dine-in", "takeout", "delivery"]
  exemptions            String[]  // ["medicine", "food-basic"]
  
  config                TaxConfig @relation(fields: [configId], references: [id])
  
  @@index([configId, categoryId])
  @@map("tax_rates")
}

model TaxLine {
  id                    String    @id @default(cuid())
  invoiceId             String
  taxConfigId           String
  rate                  Decimal   @db.Decimal(5,4)
  baseAmount            Decimal   @db.Decimal(12,2)
  taxAmount             Decimal   @db.Decimal(12,2)
  
  invoice               Invoice   @relation(fields: [invoiceId], references: [id])
  
  @@index([invoiceId, taxConfigId])
  @@map("tax_lines")
}
```

#### Payment Flow Integration
```typescript
// services/payment.service.ts
export class PaymentService {
  
  async createPaymentIntent(
    tenantId: string,
    orderId: string,
    totalWithTax: Decimal
  ) {
    // 1. Create Stripe intent
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(totalWithTax.toNumber() * 100), // cents
      currency: 'usd',
      metadata: { tenantId, orderId }
    });
    
    // 2. Create Payment record
    const payment = await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        stripeIntentId: intent.id,
        amount: totalWithTax,
        status: 'pending'
      }
    });
    
    return { clientSecret: intent.client_secret };
  }
  
  async handlePaymentWebhook(event: Stripe.Event) {
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      
      // 1. Update Payment status
      const payment = await prisma.payment.update({
        where: { stripeIntentId: intent.id },
        data: { status: 'succeeded', succeededAt: new Date() }
      });
      
      // 2. Update Invoice status
      const invoice = await prisma.invoice.update({
        where: { id: payment.invoiceId },
        data: { status: 'paid' }
      });
      
      // 3. Post to Ledger (Cash + A/R)
      await accountingService.postTransaction(
        tenantId,
        [
          {
            accountCode: '1000', // Cash
            debit: invoice.total,
            description: `Payment for invoice ${invoice.number}`
          },
          {
            accountCode: '1200', // A/R
            credit: invoice.total,
            description: `Payment for invoice ${invoice.number}`
          }
        ]
      );
      
      // 4. Generate Receipt
      await this.generateReceipt(payment.id, invoice.id);
    }
  }
}
```

---

### Phase 5 Detail: Inventory System Refactoring

#### Inventory Data Models
```prisma
model InventoryCategory {
  id                    String    @id @default(cuid())
  tenantId              String
  code                  String
  name                  String
  description           String?
  
  tenant                Tenant    @relation(fields: [tenantId], references: [id])
  subCategories        InventorySubCategory[]
  
  @@unique([tenantId, code])
  @@index([tenantId])
  @@map("inventory_categories")
}

model InventorySubCategory {
  id                    String    @id @default(cuid())
  categoryId            String
  code                  String
  name                  String
  
  category              InventoryCategory @relation(fields: [categoryId], references: [id])
  skus                  InventorySKU[]
  
  @@unique([categoryId, code])
  @@index([categoryId])
  @@map("inventory_subcategories")
}

model InventorySKU {
  id                    String    @id @default(cuid())
  tenantId              String
  subCategoryId         String
  
  code                  String    // Unique per tenant
  barcode               String?
  name                  String
  description           String?
  
  costPrice             Decimal   @db.Decimal(12,2)
  sellingPrice          Decimal   @db.Decimal(12,2)
  unit                  String    // "bottle", "kg", "piece"
  
  minStock              Int       @default(0)
  status                String    @default("active")
  
  tenant                Tenant    @relation(fields: [tenantId], references: [id])
  subCategory           InventorySubCategory @relation(fields: [subCategoryId], references: [id])
  
  locationStocks        LocationInventory[]
  transfers             InventoryTransfer[]
  audits                InventoryAudit[]
  
  @@unique([tenantId, code])
  @@index([tenantId, subCategoryId])
  @@map("inventory_skus")
}

model LocationInventory {
  id                    String    @id @default(cuid())
  locationId            String
  skuId                 String
  
  quantityOnHand        Int       @default(0)
  quantityReserved      Int       @default(0)
  quantityAvailable     Int?      @default(0) // Computed: onHand - reserved
  
  lastCountedAt         DateTime?
  lastMovedAt           DateTime  @updatedAt
  
  location              Location  @relation(fields: [locationId], references: [id])
  sku                   InventorySKU @relation(fields: [skuId], references: [id])
  
  @@unique([locationId, skuId])
  @@index([locationId])
  @@index([skuId])
  @@map("location_inventories")
}

model InventoryTransfer {
  id                    String    @id @default(cuid())
  tenantId              String
  skuId                 String
  
  fromLocationId        String
  toLocationId          String
  quantity              Int
  
  status                String    @default("pending") // pending, approved, completed, cancelled
  reason                String?
  requestedAt           DateTime  @default(now())
  approvedAt            DateTime?
  completedAt           DateTime?
  approvedBy            String?
  
  tenant                Tenant    @relation(fields: [tenantId], references: [id])
  sku                   InventorySKU @relation(fields: [skuId], references: [id])
  
  @@index([tenantId, status])
  @@index([skuId])
  @@map("inventory_transfers")
}

model InventoryAudit {
  id                    String    @id @default(cuid())
  locationId            String
  skuId                 String
  
  countedQuantity       Int
  systemQuantity        Int
  variance              Int        // counted - system
  
  countedAt             DateTime
  adjustedAt            DateTime?
  adjustedBy            String?
  reason                String?
  
  sku                   InventorySKU @relation(fields: [skuId], references: [id])
  
  @@index([locationId, skuId])
  @@index([countedAt])
  @@map("inventory_audits")
}
```

#### Inventory Service Methods (Phase 5)
```typescript
export class InventoryService {
  
  // Get stock at location
  async getStockByLocation(
    tenantId: string,
    locationId: string,
    categoryId?: string
  ) {
    return await prisma.locationInventory.findMany({
      where: {
        location: { tenantId },
        locationId,
        sku: categoryId ? { subCategory: { categoryId } } : undefined
      },
      include: { sku: true }
    });
  }
  
  // Request transfer (approval workflow)
  async requestTransfer(
    tenantId: string,
    skuId: string,
    fromLocationId: string,
    toLocationId: string,
    quantity: number,
    reason?: string
  ) {
    return await prisma.inventoryTransfer.create({
      data: {
        tenantId,
        skuId,
        fromLocationId,
        toLocationId,
        quantity,
        reason,
        status: 'pending'
      }
    });
  }
  
  // Approve and execute transfer
  async executeTransfer(
    tenantId: string,
    transferId: string,
    approvedBy: string
  ) {
    const transfer = await prisma.inventoryTransfer.findUnique({
      where: { id: transferId }
    });
    
    // Update source location
    await prisma.locationInventory.update({
      where: {
        locationId_skuId: {
          locationId: transfer.fromLocationId,
          skuId: transfer.skuId
        }
      },
      data: { quantityOnHand: { decrement: transfer.quantity } }
    });
    
    // Update destination location
    await prisma.locationInventory.update({
      where: {
        locationId_skuId: {
          locationId: transfer.toLocationId,
          skuId: transfer.skuId
        }
      },
      data: { quantityOnHand: { increment: transfer.quantity } }
    });
    
    // Mark transfer complete
    return await prisma.inventoryTransfer.update({
      where: { id: transferId },
      data: {
        status: 'completed',
        approvedAt: new Date(),
        completedAt: new Date(),
        approvedBy
      }
    });
  }
  
  // Reconciliation (physical count vs. system)
  async reconcileStock(
    tenantId: string,
    locationId: string,
    skuId: string,
    countedQuantity: number,
    reason: string,
    auditedBy: string
  ) {
    const stock = await prisma.locationInventory.findUnique({
      where: {
        locationId_skuId: { locationId, skuId }
      }
    });
    
    const variance = countedQuantity - stock.quantityOnHand;
    
    // Create audit record
    const audit = await prisma.inventoryAudit.create({
      data: {
        locationId,
        skuId,
        countedQuantity,
        systemQuantity: stock.quantityOnHand,
        variance,
        countedAt: new Date(),
        reason
      }
    });
    
    // Auto-adjust if variance found
    if (variance !== 0) {
      await prisma.locationInventory.update({
        where: {
          locationId_skuId: { locationId, skuId }
        },
        data: {
          quantityOnHand: countedQuantity
        }
      });
      
      // Log adjustment
      await prisma.inventoryAudit.update({
        where: { id: audit.id },
        data: {
          adjustedAt: new Date(),
          adjustedBy: auditedBy
        }
      });
    }
    
    return audit;
  }
  
  // Reserve stock for pending order
  async reserveStock(
    tenantId: string,
    locationId: string,
    skuId: string,
    quantity: number
  ) {
    return await prisma.locationInventory.update({
      where: {
        locationId_skuId: { locationId, skuId }
      },
      data: {
        quantityReserved: { increment: quantity }
      }
    });
  }
}
```

---

### Phase 6a Detail: Recipe & Meal Composition

#### Recipe Data Models
```prisma
model Recipe {
  id                    String    @id @default(cuid())
  tenantId              String
  locationId            String
  
  name                  String
  description           String?
  category              String    // "appetizer", "main", "dessert", "drink"
  
  version               Int       @default(1)
  isActive              Boolean   @default(true)
  
  portionsPerBatch      Int       // How many servings per batch
  totalRecipeCost       Decimal   @db.Decimal(12,2) // Auto-calculated
  costPerPortion        Decimal   @db.Decimal(12,2) // Auto-calculated
  
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  
  tenant                Tenant    @relation(fields: [tenantId], references: [id])
  location              Location  @relation(fields: [locationId], references: [id])
  
  ingredients           RecipeIngredient[]
  productionBatches     RecipeProductionBatch[]
  
  @@unique([tenantId, locationId, name])
  @@index([tenantId, isActive])
  @@map("recipes")
}

model RecipeIngredient {
  id                    String    @id @default(cuid())
  recipeId              String
  skuId                 String
  
  quantityRequired      Decimal   @db.Decimal(10,3)
  unit                  String    // "oz", "cup", "kg", "piece"
  costPerUnit           Decimal   @db.Decimal(12,4) // From SKU cost, locked at recipe creation
  totalIngredientCost   Decimal   @db.Decimal(12,2) // qty * cost
  
  isOptional            Boolean   @default(false)
  notes                 String?
  
  version               Int       @default(1)
  effectiveFrom         DateTime  @default(now())
  effectiveTo           DateTime?
  
  recipe                Recipe    @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  sku                   InventorySKU @relation(fields: [skuId], references: [id])
  
  @@unique([recipeId, skuId, version])
  @@index([recipeId])
  @@map("recipe_ingredients")
}

model RecipeProductionBatch {
  id                    String    @id @default(cuid())
  recipeId              String
  locationId            String
  
  batchNumber           String    // Auto-generated: RECIPE-20260312-001
  quantityProduced      Int       // Number of portions made
  
  startedAt             DateTime
  completedAt           DateTime?
  producedBy            String    // TenantUser ID
  
  expectedYield         Int      // portions (from recipe)
  actualYield           Int?     // portions (actual count)
  yieldVariance         Int?     // actual - expected
  
  laborCostPerBatch     Decimal?  @db.Decimal(10,2) // Optional
  status                String    @default("in progress") // "in progress", "completed", "discarded"
  notes                 String?
  
  recipe                Recipe    @relation(fields: [recipeId], references: [id])
  
  inventoryDeductions   RecipeInventoryDeduction[]
  
  @@index([recipeId, locationId])
  @@index([startedAt])
  @@map("recipe_production_batches")
}

model RecipeInventoryDeduction {
  id                    String    @id @default(cuid())
  batchId               String
  skuId                 String
  locationId            String
  
  quantityDeducted      Decimal   @db.Decimal(10,3)
  unit                  String
  reason                String    @default("production")
  
  deductedAt            DateTime  @default(now())
  
  batch                 RecipeProductionBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)
  sku                   InventorySKU @relation(fields: [skuId], references: [id])
  
  @@index([batchId, skuId])
  @@map("recipe_inventory_deductions")
}
```

#### RecipeService Implementation
```typescript
export class RecipeService {
  
  // Create recipe with ingredients
  async createRecipe(
    tenantId: string,
    locationId: string,
    data: {
      name: string;
      description?: string;
      category: string;
      portionsPerBatch: number;
      ingredients: Array<{
        skuId: string;
        quantityRequired: number;
        unit: string;
        isOptional?: boolean;
      }>;
    }
  ) {
    // 1. Calculate costs from SKU master
    const ingredientCosts = await Promise.all(
      data.ingredients.map(async (ing) => {
        const sku = await prisma.inventorySKU.findUnique({
          where: { id: ing.skuId }
        });
        return {
          ...ing,
          costPerUnit: sku.costPrice,
          totalIngredientCost: sku.costPrice.mul(ing.quantityRequired)
        };
      })
    );
    
    // 2. Calculate total recipe cost
    const totalRecipeCost = ingredientCosts.reduce(
      (sum, ing) => sum.add(ing.totalIngredientCost),
      new Decimal(0)
    );
    
    // 3. Create recipe
    const recipe = await prisma.recipe.create({
      data: {
        tenantId,
        locationId,
        name: data.name,
        description: data.description,
        category: data.category,
        portionsPerBatch: data.portionsPerBatch,
        totalRecipeCost: totalRecipeCost,
        costPerPortion: totalRecipeCost.div(data.portionsPerBatch),
        ingredients: {
          createMany: {
            data: ingredientCosts.map(ing => ({
              skuId: ing.skuId,
              quantityRequired: new Decimal(ing.quantityRequired),
              unit: ing.unit,
              costPerUnit: ing.costPerUnit,
              totalIngredientCost: ing.totalIngredientCost,
              isOptional: ing.isOptional || false
            }))
          }
        }
      },
      include: { ingredients: { include: { sku: true } } }
    });
    
    return recipe;
  }
  
  // Start production batch
  async startProductionBatch(
    recipeId: string,
    locationId: string,
    producedBy: string,
    quantityToMake: number,
    laborCost?: Decimal
  ) {
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: { ingredients: true }
    });
    
    // Auto-generate batch number
    const batchCount = await prisma.recipeProductionBatch.count({
      where: { recipeId, startedAt: { gte: startOfDay(new Date()) } }
    });
    const batchNumber = `${recipe.name.toUpperCase()}-${format(new Date(), 'yyyyMMdd')}-${String(batchCount + 1).padStart(3, '0')}`;
    
    // Create batch
    const batch = await prisma.recipeProductionBatch.create({
      data: {
        recipeId,
        locationId,
        batchNumber,
        quantityProduced: quantityToMake,
        expectedYield: quantityToMake * recipe.portionsPerBatch,
        startedAt: new Date(),
        producedBy,
        laborCostPerBatch: laborCost,
        status: 'in progress'
      }
    });
    
    return batch;
  }
  
  // Complete batch and auto-deduct inventory
  async completeBatch(
    batchId: string,
    actualYield: number,
    completedBy: string
  ) {
    const batch = await prisma.recipeProductionBatch.findUnique({
      where: { id: batchId },
      include: { recipe: { include: { ingredients: true } } }
    });
    
    // 1. Calculate variance
    const variance = actualYield - batch.expectedYield;
    
    // 2. Deduct ingredients from inventory
    const deductions = await Promise.all(
      batch.recipe.ingredients.map(async (ingredient) => {
        const quantityToDeduct = ingredient.quantityRequired.mul(batch.quantityProduced);
        
        // Create deduction record
        await prisma.recipeInventoryDeduction.create({
          data: {
            batchId,
            skuId: ingredient.skuId,
            locationId: batch.locationId,
            quantityDeducted: quantityToDeduct,
            unit: ingredient.unit
          }
        });
        
        // Update LocationInventory
        return await prisma.locationInventory.update({
          where: {
            locationId_skuId: {
              locationId: batch.locationId,
              skuId: ingredient.skuId
            }
          },
          data: {
            quantityOnHand: { decrement: quantityToDeduct.toNumber() }
          }
        });
      })
    );
    
    // 3. Mark batch complete
    const completedBatch = await prisma.recipeProductionBatch.update({
      where: { id: batchId },
      data: {
        completedAt: new Date(),
        actualYield,
        yieldVariance: variance,
        status: 'completed'
      }
    });
    
    return completedBatch;
  }
  
  // Get recipe profitability
  async getRecipeProfitability(
    tenantId: string,
    locationId: string,
    recipeId: string,
    startDate: Date,
    endDate: Date
  ) {
    const batches = await prisma.recipeProductionBatch.findMany({
      where: {
        recipeId,
        locationId,
        completedAt: { gte: startDate, lte: endDate },
        status: 'completed'
      }
    });
    
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId }
    });
    
    const totalBatchesMade = batches.length;
    const totalPortionsMade = batches.reduce((sum, b) => sum + b.actualYield, 0);
    const totalRecipeCostUsed = new Decimal(totalBatchesMade).mul(recipe.totalRecipeCost);
    const totalLaborCost = batches.reduce(
      (sum, b) => sum.add(b.laborCostPerBatch || 0),
      new Decimal(0)
    );
    const totalCost = totalRecipeCostUsed.add(totalLaborCost);
    const costPerPortion = totalCost.div(totalPortionsMade);
    
    return {
      recipeName: recipe.name,
      totalBatchesMade,
      totalPortionsMade,
      totalRecipeCost: totalRecipeCostUsed,
      totalLaborCost,
      costPerPortion,
      expectedYieldVariance: batches.reduce((sum, b) => sum + (b.yieldVariance || 0), 0)
    };
  }
}
```

#### Recipe API Endpoints (Phase 6a)
```
POST   /api/tenants/:tenantId/recipes                        (create recipe)
GET    /api/tenants/:tenantId/recipes                        (list recipes)
GET    /api/tenants/:tenantId/recipes/:recipeId              (get recipe details)
PUT    /api/tenants/:tenantId/recipes/:recipeId              (update recipe)
DELETE /api/tenants/:tenantId/recipes/:recipeId              (retire recipe)

POST   /api/tenants/:tenantId/recipes/:recipeId/production   (start batch)
GET    /api/tenants/:tenantId/recipes/:recipeId/batches      (list batches)
PUT    /api/tenants/:tenantId/recipes/:recipeId/batches/:batchId (complete batch)

GET    /api/tenants/:tenantId/recipes/profitability          (costs & margins)
GET    /api/tenants/:tenantId/recipes/:recipeId/costing      (detailed recipe costing)
```

---

### Phase 6b Detail: Supply Chain & Receiving

#### Supply Chain Data Models
```prisma
model Supplier {
  id                    String    @id @default(cuid())
  tenantId              String
  
  code                  String
  name                  String
  contact               String?
  email                 String?
  phone                 String?
  address               String?
  
  paymentTerms          String?   // "net30", "net60", "cod"
  leadTimeDays          Int?
  minimumOrderValue     Decimal?  @db.Decimal(12,2)
  
  performanceRating     Decimal?  @db.Decimal(3,2) // 1-5 stars
  onTimePercentage      Decimal?  @db.Decimal(5,2)
  defectRate            Decimal?  @db.Decimal(5,2)
  
  isActive              Boolean   @default(true)
  
  tenant                Tenant    @relation(fields: [tenantId], references: [id])
  
  catalogs              SupplierCatalog[]
  purchaseOrders        PurchaseOrder[]
  
  @@unique([tenantId, code])
  @@index([tenantId])
  @@map("suppliers")
}

model SupplierCatalog {
  id                    String    @id @default(cuid())
  supplierId            String
  skuId                 String
  
  supplierSKU           String    // Supplier's product code
  price                 Decimal   @db.Decimal(12,4)
  minimumQuantity       Int
  leadTimeDays          Int
  
  effectiveFrom         DateTime  @default(now())
  effectiveTo           DateTime?
  
  supplier              Supplier  @relation(fields: [supplierId], references: [id])
  sku                   InventorySKU @relation(fields: [skuId], references: [id])
  
  @@unique([supplierId, skuId])
  @@index([supplierId])
  @@map("supplier_catalogs")
}

model PurchaseOrder {
  id                    String    @id @default(cuid())
  tenantId              String
  supplierId            String
  locationId            String
  
  poNumber              String    // Auto-generated: PO-20260312-00123
  status                String    @default("draft") // draft, submitted, confirmed, shipped, delivered, cancelled
  
  orderDate             DateTime  @default(now())
  estimatedDelivery     DateTime
  actualDelivery        DateTime?
  
  subtotal              Decimal   @db.Decimal(12,2)
  tax                   Decimal   @db.Decimal(12,2) @default(0)
  shippingCost          Decimal?  @db.Decimal(12,2)
  total                 Decimal   @db.Decimal(12,2)
  
  orderedBy             String    // TenantUser ID
  approvedBy            String?
  approvedAt            DateTime?
  
  notes                 String?
  specialInstructions   String?
  
  tenant                Tenant    @relation(fields: [tenantId], references: [id])
  supplier              Supplier  @relation(fields: [supplierId], references: [id])
  location              Location  @relation(fields: [locationId], references: [id])
  
  lines                 POLine[]
  goodsReceipts         GoodsReceipt[]
  
  @@unique([tenantId, poNumber])
  @@index([tenantId, status])
  @@index([supplierId])
  @@map("purchase_orders")
}

model POLine {
  id                    String    @id @default(cuid())
  poId                  String
  skuId                 String
  
  quantityOrdered       Decimal   @db.Decimal(10,3)
  unit                  String
  unitPrice             Decimal   @db.Decimal(12,4)
  lineTotal             Decimal   @db.Decimal(12,2) // qty * unitPrice
  
  quantityReceived      Decimal   @db.Decimal(10,3) @default(0)
  quantityAccepted      Decimal   @db.Decimal(10,3) @default(0)
  quantityRejected      Decimal   @db.Decimal(10,3) @default(0)
  
  po                    PurchaseOrder @relation(fields: [poId], references: [id], onDelete: Cascade)
  sku                   InventorySKU @relation(fields: [skuId], references: [id])
  
  @@index([poId])
  @@map("po_lines")
}

model GoodsReceipt {
  id                    String    @id @default(cuid())
  poId                  String
  locationId            String
  
  receiptNumber         String    // Auto-generated: GR-20260312-00001
  receivedDate          DateTime  @default(now())
  receivedBy            String    // TenantUser ID
  
  status                String    @default("pending") // pending (awaiting QC), accepted, partial, rejected
  notes                 String?
  
  po                    PurchaseOrder @relation(fields: [poId], references: [id])
  
  lines                 GoodsReceiptLine[]
  qcChecks              QualityControl[]
  
  @@unique([poId, receiptNumber])
  @@index([poId, receivedDate])
  @@map("goods_receipts")
}

model GoodsReceiptLine {
  id                    String    @id @default(cuid())
  receiptId             String
  poLineId              String
  skuId                 String
  
  quantityReceived      Decimal   @db.Decimal(10,3)
  unit                  String
  conditionStatus       String    @default("good") // good, damaged, defective
  
  conditionNotes        String?
  serialNumber          String?   // For tracking
  batchNumber           String?   // For expiry tracking
  expiryDate            DateTime?
  
  receipt               GoodsReceipt @relation(fields: [receiptId], references: [id], onDelete: Cascade)
  sku                   InventorySKU @relation(fields: [skuId], references: [id])
  
  @@index([receiptId, skuId])
  @@map("goods_receipt_lines")
}

model QualityControl {
  id                    String    @id @default(cuid())
  receiptId             String
  
  checklistType         String    // "fresh_produce", "frozen", "dry_goods", "beverages"
  checkedBy             String    // TenantUser ID
  checkedAt             DateTime  @default(now())
  
  checksPassed          Int       // Number of items passing
  checksFailed          Int       // Number of items failing
  
  result                String    @default("pass") // pass, fail, conditional
  notes                 String?
  photoUrl              String?
  
  receipt               GoodsReceipt @relation(fields: [receiptId], references: [id], onDelete: Cascade)
  
  @@index([receiptId])
  @@map("quality_controls")
}
```

#### SupplyChainService Implementation
```typescript
export class SupplyChainService {
  
  // Create purchase order
  async createPurchaseOrder(
    tenantId: string,
    supplierId: string,
    locationId: string,
    lines: Array<{ skuId: string; quantity: number; unitPrice: Decimal }>,
    estimatedDelivery: Date,
    orderedBy: string
  ) {
    // Calculate totals
    const subtotal = lines.reduce(
      (sum, line) => sum.add(new Decimal(line.quantity).mul(line.unitPrice)),
      new Decimal(0)
    );
    
    // Auto-generate PO number
    const poCount = await prisma.purchaseOrder.count({
      where: { tenantId, orderDate: { gte: startOfDay(new Date()) } }
    });
    const poNumber = `PO-${format(new Date(), 'yyyyMMdd')}-${String(poCount + 1).padStart(5, '0')}`;
    
    // Create PO
    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierId,
        locationId,
        poNumber,
        orderDate: new Date(),
        estimatedDelivery,
        subtotal,
        total: subtotal, // Tax/shipping calculated later
        orderedBy,
        status: 'draft',
        lines: {
          createMany: {
            data: lines.map(line => ({
              skuId: line.skuId,
              quantityOrdered: new Decimal(line.quantity),
              unit: 'piece', // TODO: get from SKU
              unitPrice: line.unitPrice,
              lineTotal: new Decimal(line.quantity).mul(line.unitPrice)
            }))
          }
        }
      },
      include: { lines: { include: { sku: true } } }
    });
    
    return po;
  }
  
  // Submit PO for approval
  async submitPurchaseOrder(poId: string, submittedBy: string) {
    return await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: 'submitted',
        orderedBy: submittedBy
      }
    });
  }
  
  // Approve PO
  async approvePurchaseOrder(poId: string, approvedBy: string) {
    return await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: 'confirmed',
        approvedBy,
        approvedAt: new Date()
      }
    });
  }
  
  // Receive goods (goods receipt post)
  async receiveGoods(
    poId: string,
    locationId: string,
    lines: Array<{
      poLineId: string;
      skuId: string;
      quantityReceived: number;
      conditionStatus: string;
      batchNumber?: string;
      expiryDate?: Date;
    }>,
    receivedBy: string
  ) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { lines: true }
    });
    
    // Auto-generate receipt number
    const grCount = await prisma.goodsReceipt.count({
      where: { poId }
    });
    const receiptNumber = `GR-${format(new Date(), 'yyyyMMdd')}-${String(grCount + 1).padStart(5, '0')}`;
    
    // Create goods receipt
    const gr = await prisma.goodsReceipt.create({
      data: {
        poId,
        locationId,
        receiptNumber,
        receivedDate: new Date(),
        receivedBy,
        status: 'pending', // Awaiting QC
        lines: {
          createMany: {
            data: lines.map(line => ({
              poLineId: line.poLineId,
              skuId: line.skuId,
              quantityReceived: new Decimal(line.quantityReceived),
              unit: 'piece', // TODO: get from SKU
              conditionStatus: line.conditionStatus,
              batchNumber: line.batchNumber,
              expiryDate: line.expiryDate
            }))
          }
        }
      },
      include: { lines: true }
    });
    
    return gr;
  }
  
  // Perform quality control check
  async performQualityCheck(
    receiptId: string,
    checklistType: string,
    checksPassed: number,
    checksFailed: number,
    checkedBy: string,
    result: string,
    notes?: string
  ) {
    const qc = await prisma.qualityControl.create({
      data: {
        receiptId,
        checklistType,
        checksPassed,
        checksFailed,
        result,
        notes,
        checkedBy,
        checkedAt: new Date()
      }
    });
    
    // Auto-accept goods if QC passes
    if (result === 'pass') {
      const gr = await prisma.goodsReceipt.update({
        where: { id: receiptId },
        data: { status: 'accepted' }
      });
      
      // Post to inventory
      await this.acceptGoods(receiptId);
    }
    
    return qc;
  }
  
  // Accept goods and update inventory
  async acceptGoods(receiptId: string) {
    const gr = await prisma.goodsReceipt.findUnique({
      where: { id: receiptId },
      include: { lines: true }
    });
    
    // Update LocationInventory for each line
    await Promise.all(
      gr.lines.map(async (line) => {
        // Get or create inventory record
        let locInv = await prisma.locationInventory.findUnique({
          where: {
            locationId_skuId: {
              locationId: gr.locationId,
              skuId: line.skuId
            }
          }
        });
        
        if (!locInv) {
          locInv = await prisma.locationInventory.create({
            data: {
              locationId: gr.locationId,
              skuId: line.skuId,
              quantityOnHand: line.quantityReceived.toNumber()
            }
          });
        } else {
          locInv = await prisma.locationInventory.update({
            where: { id: locInv.id },
            data: {
              quantityOnHand: { increment: line.quantityReceived.toNumber() }
            }
          });
        }
        
        return locInv;
      })
    );
    
    // Update GoodsReceipt status
    return await prisma.goodsReceipt.update({
      where: { id: receiptId },
      data: {
        status: 'accepted'
      }
    });
  }
  
  // Get supplier performance metrics
  async getSupplierPerformance(
    tenantId: string,
    supplierId: string,
    startDate: Date,
    endDate: Date
  ) {
    const pos = await prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        supplierId,
        orderDate: { gte: startDate, lte: endDate },
        status: { in: ['delivered', 'confirmed'] }
      }
    });
    
    const deliveredOnTime = pos.filter(po => !po.actualDelivery || po.actualDelivery <= po.estimatedDelivery).length;
    const onTimePercentage = pos.length > 0 ? (deliveredOnTime / pos.length) * 100 : 0;
    
    return {
      totalOrders: pos.length,
      onTimePercentage,
      defectRate: 0 // TODO: calculate from QC data
    };
  }
}
```

#### Supply Chain API Endpoints (Phase 6b)
```
POST   /api/tenants/:tenantId/suppliers                      (add supplier)
GET    /api/tenants/:tenantId/suppliers                      (list suppliers)
GET    /api/tenants/:tenantId/suppliers/:supplierId          (supplier details + performance)
PUT    /api/tenants/:tenantId/suppliers/:supplierId          (update supplier)

GET    /api/tenants/:tenantId/suppliers/:supplierId/catalog  (supplier catalog)
POST   /api/tenants/:tenantId/purchase-orders                (create PO)
GET    /api/tenants/:tenantId/purchase-orders                (list POs)
GET    /api/tenants/:tenantId/purchase-orders/:poId          (PO details)
PUT    /api/tenants/:tenantId/purchase-orders/:poId/submit   (submit for approval)
PUT    /api/tenants/:tenantId/purchase-orders/:poId/approve  (approve PO)

POST   /api/tenants/:tenantId/goods-receipts                 (create receipt)
GET    /api/tenants/:tenantId/goods-receipts                 (list receipts)
POST   /api/tenants/:tenantId/goods-receipts/:grId/qc        (QC check)
POST   /api/tenants/:tenantId/goods-receipts/:grId/accept    (accept goods)

GET    /api/tenants/:tenantId/suppliers/:supplierId/performance (metrics)
```

---

### Phase 8 Detail: Sales Terminal Unification

#### Sales Terminal Models
```prisma
model SalesTerminal {
  id                    String    @id @default(cuid())
  tenantId              String
  locationId            String
  
  code                  String
  name                  String
  deviceId              String?   // Hardware identifier
  status                String    @default("active")
  
  config                Json?     // Terminal-specific settings
  lastHeartbeat         DateTime?
  
  tenant                Tenant    @relation(fields: [tenantId], references: [id])
  location              Location  @relation(fields: [locationId], references: [id])
  
  sessions              TerminalSession[]
  orders                Order[]
  
  @@unique([tenantId, code])
  @@index([tenantId, locationId])
  @@map("sales_terminals")
}

model TerminalSession {
  id                    String    @id @default(cuid())
  terminalId            String
  userId                String
  
  loginAt               DateTime  @default(now())
  logoutAt              DateTime?
  status                String    @default("active")
  
  ordersProcessed       Int       @default(0)
  totalAmount           Decimal   @db.Decimal(12,2) @default(0)
  
  terminal              SalesTerminal @relation(fields: [terminalId], references: [id])
  
  @@index([terminalId, userId])
  @@index([loginAt, logoutAt])
  @@map("terminal_sessions")
}

model GameSession {
  id                    String    @id @default(cuid())
  terminalId            String
  playerId              String
  
  gameType              String    // "slots", "keno", "lotto"
  startedAt             DateTime  @default(now())
  endedAt               DateTime?
  
  initialBalance        Decimal   @db.Decimal(12,2)
  finalBalance          Decimal   @db.Decimal(12,2)
  winnings              Decimal   @db.Decimal(12,2) @default(0)
  
  roundsPlayed          Int       @default(0)
  
  terminal              SalesTerminal @relation(fields: [terminalId], references: [id])
  
  @@index([terminalId, playerId])
  @@index([startedAt])
  @@map("game_sessions")
}
```

#### Unified SalesTerminal Component
```typescript
// components/sales-terminal/SalesTerminal.tsx
export const SalesTerminal: React.FC<SalesTerminalProps> = ({
  terminalId,
  tenantId
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'games' | 'settings'>('orders');
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  
  return (
    <div className="sales-terminal">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        
        {/* TAB 1: Orders (POS, Bookings, Retail) */}
        <TabsContent value="orders">
          <OrderEntry
            terminalId={terminalId}
            orderTypes={['pos', 'booking', 'retail']}
            onOrderCreated={setCurrentOrder}
          />
          {currentOrder && (
            <OrderSummary order={currentOrder} />
          )}
          <UnifiedCheckout
            order={currentOrder}
            tenantId={tenantId}
            onPaymentComplete={handlePaymentComplete}
          />
        </TabsContent>
        
        {/* TAB 2: Games (moved from Department) */}
        <TabsContent value="games">
          <GamesMenu
            terminalId={terminalId}
            onGameStart={setGameSession}
          />
          {gameSession && (
            <GameInterface
              session={gameSession}
              onWinnings={handleGameWinnings}
              onSessionEnd={handleGameEnd}
            />
          )}
        </TabsContent>
        
        {/* TAB 3: Terminal Settings */}
        <TabsContent value="settings">
          <TerminalSettings
            terminalId={terminalId}
            onUpdate={handleSettingsUpdate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
```

---

## Integration Points & Dependencies

### Data Flow Across Phases

```
Phase 1 (Tenants)
    ↓
    ├→ Phase 2 (Services)
    │    ↓
    │    ├→ Phase 3 (Accounting) → Ledger posts all transactions
    │    │    ↓
    │    │    └→ Phase 4 (Tax & Payment) → Uses ledger accounts
    │    │
    │    └→ Phase 5 (Inventory Base) → Services use tenant context
    │         ↓
    │         ├→ Phase 6 (Inventory Advanced) → Uses reconciliation, transfers
    │         │    ↓
    │         │    ├→ Phase 6a (Recipes) → Consumes inventory items, auto-deducts stock
    │         │    │    └→ Integration: Recipe production batches → Inventory Service
    │         │    │
    │         │    └→ Phase 6b (Supply Chain) → Replenishes inventory from suppliers
    │         │         └→ Integration: Goods receipt accepted → Inventory Service
    │         │
    │         └→ Phase 8 (Terminal)
    │              └→ Integrates: Phase 4 (payments), Phase 6a (recipes for KDS), Phase 6b (stock levels)
    │
    └→ Phase 7 (Booking Tax)
         ↓
         Depends on: Phase 4 (tax engine), Phase 3 (ledger posting)
         └→ Integrates into Phase 8 (Terminal)
```

### Critical Dependencies

| Dependency | Phase A | Phase B | Issue | Mitigation |
|-----------|---------|---------|-------|-----------|
| Tenant context | 1 | 2-8, 6a, 6b | All phases need TenantContext | Build Phase 1 first, thoroughly |
| Service layer | 2 | 3-8, 6a, 6b | Services must exist before use | Phase 2 before Phase 3+4 |
| Ledger exists | 3 | 4, 7 | Tax & Payment post to ledger | Phase 3 before Phase 4, 7 |
| Tax engine | 4 | 7, 8 | Bookings and terminal need tax | Phase 4 before Phase 7 |
| Inventory model | 5 | 6, 6a, 6b, 8 | All inventory features need SKU | Phase 5 before Phase 6, 6a, 6b |
| Inventory Advanced | 6 | 6a, 6b, 8 | Reconciliation, transfers needed | Phase 6 before Phase 6a/6b |
| Recipes exist | 6a | 8 | Terminal KDS needs recipes | Phase 6a before Phase 8 (optional) |
| Supply Chain | 6b | 6a, 8 | Stock replenishment for recipes | Phase 6b can run parallel to 6a |
| Game sessions | - | 8 | Games migrate to terminal | Refactor in Phase 8 |

### Integration Points Detail

**Phase 6a → Phase 5/6 Integration**:
- Recipe ingredient deductions call `InventoryService.adjustStock()`
- Production batches auto-update `LocationInventory`
- Batch completion triggers ledger post (COGS entry)

**Phase 6b → Phase 5/6 Integration**:
- Goods receipt acceptance calls `InventoryService.addStock()`
- PO matching validates against purchased items
- Receipt triggers ledger post (Purchases account)

**Phase 6a/6b → Phase 4 Integration**:
- Recipe costing uses supplier catalog pricing
- Meal pricing calculated as: ingredient cost + margin

**Phase 6a/6b → Phase 8 Integration**:
- Terminal KDS displays recipe definitions (prep instructions)
- Terminal inventory UI shows stock from Phase 5
- Recipe production batches created from terminal
- Supply chain creates POs for low-stock items (auto-reorder)

---

## Data Migration Strategy

### Migration Timeline
```
WEEK 21 (Phase 9 Start - after Phases 1-8 complete)

Day 1-2: Pre-Migration
  ├─ Full database backup (3x)
  ├─ Run migration script on staging
  ├─ Validate data integrity
  └─ Document rollback steps

Day 3-5: Production Migration
  ├─ Create "Default" tenant
  ├─ Migrate all existing data → default tenant
  ├─ Transform departments → inventory categories
  ├─ Transform old game records → game sessions
  ├─ Create supplier master for legacy vendors
  ├─ Validate ledger trial balance
  └─ Verify all historical orders visible

Day 6-7: Verification & Cleanup
  ├─ Run integrity checks
  ├─ Spot-check 100+ orders
  ├─ Verify tax calculations
  ├─ Verify payment records
  └─ Deploy to production
```

### Data Transformation Mappings

**Old → New Mapping**:
```typescript
// AdminUser → TenantUser (with default tenant)
OLD AdminUser
  ├─ email, password, firstName, lastName
  └─ role → maps to TenantUserRole under "Default" tenant

// User (employee) → TenantUser
OLD User
  ├─ preserves all fields
  └─ assigned to "Default" tenant

// Department → InventoryCategory
OLD Department
  ├─ code → category.code
  ├─ name → category.name
  └─ Each dept stock → InventorySKU + LocationInventory

// DepartmentInventory → LocationInventory
OLD DepartmentInventory
  ├─ Mapped to specific SKU
  ├─ Quantity → LocationInventory.quantityOnHand
  └─ Linked to Default Location

// Order → Order (no schema change)
OLD Order
  ├─ tenantId = "default"
  ├─ Recalculate tax if applicable
  └─ Post initial revenue to ledger

// Games (DepartmentGame) → GameSession
OLD DepartmentGame
  ├─ departmentId → terminalId (mapped from default terminal)
  ├─ Transform to GameSession structure
  └─ Preserve historical records
```

### Migration Script Template
```bash
#!/bin/bash
# scripts/v2-to-saas-migration.sh

set -e

echo "Starting migration to v2 SaaS structure..."

# 1. Create default tenant
npm run script -- scripts/create-default-tenant.ts

# 2. Transform schema
npm run db:migrate -- --name migrate_to_saas

# 3. Run data transformation
npm run script -- scripts/transform-data-to-tenant.ts

# 4. Validate integrity
npm run script -- scripts/validate-migration.ts

# 5. Post legacy addresses
npm run script -- scripts/post-historical-revenue.ts

echo "Migration complete!"
```

---

## Risk Assessment & Mitigation

### High-Risk Areas

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **Data loss during migration** | Medium | Critical | 3 backups, test on staging, rollback plan |
| **Tenant data leakage** | Low | Critical | RLS policy tests, isolation tests, penetration test |
| **Tax calculation errors** | Medium | High | Unit tests per jurisdiction, audits, compliance review |
| **Payment webhook failures** | Medium | High | Idempotent webhooks, retry logic, manual reconciliation |
| **Inventory counting discrepancies** | Medium | Medium | Reconciliation UI, audit trail, variance reports |
| **Terminal sync issues (multi-terminal)** | Medium | Medium | WebSocket fallback, conflict resolution, transaction logs |
| **Performance degradation** | Low | High | DB indexing on tenantId, query optimization, load testing |
| **Integration failures (phase dependencies)** | Medium | High | Clear interfaces, contract testing, staged rollout |

### Mitigation Strategies

**Code Level**:
- Comprehensive unit + integration tests (95%+ coverage)
- Staging environment mirrors production
- Contract-based API testing
- Database migration dry runs

**Data Level**:
- 3-copy backup strategy (daily, weekly, monthly)
- Point-in-time recovery tested
- Data validation scripts (pre & post migration)
- Audit trail for all financial transactions

**Operational**:
- Staged rollout (Phase 1-2 to internal users first)
- Close monitoring (error logs, performance metrics)
- Runbook for common issues
- Escalation procedures documented
- Customer communication plan (during darktime)

---

## Success Metrics & KPIs

### Functional Success

| Metric | Target | How to Measure |
|--------|--------|---|
| **Zero data loss** | 100% | All historical data visible under default tenant |
| **Tax compliance** | ±$0.01 accuracy | Compliance report matches ledger |
| **Payment success rate** | 99.5% | Stripe dashboard metrics |
| **Receipt generation time** | <2 seconds P99 | CloudWatch logs |
| **Terminal state sync** | <100ms latency | WebSocket ping/pong tests |
| **Inventory reconciliation** | <5% variance | Audit trail reports |

### Code Quality

| Metric | Target | How to Measure |
|--------|--------|---|
| **Test coverage** | 95% critical paths | Jest/Cypress coverage reports |
| **Code duplication** | <5% | SonarQube analysis |
| **Cyclomatic complexity** | <10 per function | ESLint/SonarQube |
| **Build time** | <5 minutes | CI/CD pipeline logs |
| **API response time** | <200ms P95 | New Relic APM |

### Business Metrics (Post-Launch)

| Metric | Target | Timeline |
|--------|--------|----------|
| Customer tenants deployed | 10+ | By Month 3 |
| Orders processed (monthly) | 100K+ | By Month 6 |
| Revenue per tenant | $500-5K/mo | By Month 6 |
| Customer satisfaction | 4.5+/5 | Continuous |
| Churn rate | <2% | After 6 months |

---

## Budget & Resource Planning

### Development Effort

| Phase | Duration | Developers | Designer | QA | Total Cost (@ $150/hr) |
|-------|----------|-----------|----------|-----|-----|
| 1. Foundation | 2 weeks | 1 | 0 | 0.25 | $4,500 |
| 2. Services | 2 weeks | 1.5 | 0 | 0.25 | $6,750 |
| 3. Accounting | 2 weeks | 1 | 0 | 0.5 | $7,500 |
| 4. Tax & Pay | 2 weeks | 1.5 | 0.5 | 0.75 | $11,250 |
| 5. Inventory | 2 weeks | 1.5 | 0.5 | 0.5 | $9,750 |
| 6. Inventory Adv | 2 weeks | 1 | 0.5 | 0.5 | $7,500 |
| 6a. Recipes | 1.5 weeks | 1 | 0.5 | 0.5 | $6,375 |
| 6b. Supply Chain | 2 weeks | 1.5 | 0.5 | 0.75 | $10,875 |
| 7. Booking Tax | 2 weeks | 1 | 0 | 0.5 | $6,750 |
| 8. Terminal | 2 weeks | 1.5 | 1 | 1 | $15,000 |
| 9. Migration | 1 week | 1 | 0 | 1 | $4,500 |
| 10. QA & Deploy | 2 weeks | 1 | 0 | 1.5 | $9,000 |
| **TOTAL** | **24 weeks** | **~14 FTE-weeks** | **4 weeks** | **7.5 weeks** | **$99,250** |

### Infrastructure Costs

| Component | Cost/Month | Notes |
|-----------|-----------|-------|
| PostgreSQL (RDS) | $200-500 | Scales with data |
| Redis (caching) | $50-100 | Session + cache |
| Stripe (processing) | 2.9% + $0.30 | Per transaction |
| S3 (PDFs, receipts) | $20-50 | Compressed files |
| CloudFront (CDN) | $10-30 | Receipt PDFs |
| **Base Infrastructure** | **~$350-800/mo** | **Before customer volume** |

### Total Estimated Cost (First 6 Months)

```
Development:        $99,250  (24 weeks of team effort)
Infrastructure:     $3,000   (6 months @ $500/mo average)
Third-party:        $5,000   (Stripe, SendGrid, monitoring, tools)
Contingency (15%):  $15,338
─────────────────────────────
TOTAL               $122,588
```

---

## Next Steps (Execution Plan)

### Immediate (Week 1)
- [ ] Stakeholder alignment on roadmap
- [ ] Team assignment & sprint planning
- [ ] Setup staging environment
- [ ] Create feature branches for Phase 1
- [ ] Begin database schema design for Tenant model

### Short-term (Weeks 2-4)
- [ ] Complete Phase 1 (Tenants)
- [ ] Begin Phase 2 (Services)
- [ ] Setup CI/CD for automated testing
- [ ] Parallel: Design Phase 5 inventory schema

### Medium-term (Weeks 5-12)
- [ ] Complete Phases 3-6 (Accounting, Tax, Inventory)
- [ ] Weekly stakeholder demos
- [ ] Staging environment mirror production
- [ ] Begin security audit

### Long-term (Weeks 13-20)
- [ ] Complete Phases 7-10 (Booking, Terminal, QA, Migration)
- [ ] Production readiness review
- [ ] Customer onboarding preparation
- [ ] Launch to first 3 customers

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 2.1 | March 12, 2026 | Team | Added Phase 6a (Recipes) & 6b (Supply Chain), extended timeline to 24 weeks, updated budget to $122.5K |
| 2.0 | March 11, 2026 | Team | Added inventory refactoring, terminal unification, booking tax integration |
| 1.0 | March 10, 2026 | Team | Initial SaaS refactor roadmap |

---

## Appendix: Glossary

| Term | Definition |
|------|-----------|
| **Tenant** | Independent customer / organization (hotel, restaurant, supermarket) |
| **Location** | Physical store, hotel branch, or warehouse within tenant |
| **SKU** | Stock-keeping unit; unique product identifier |
| **Category** | Top-level product grouping (Beverages, Groceries, Rooms) |
| **SubCategory** | Secondary grouping (Spirits, Wine, Beer) |
| **Recipe** | Meal definition with required ingredients and portions |
| **Recipe Batch** | Single production run of a recipe; auto-deducts inventory |
| **Supplier** | Vendor providing goods/ingredients |
| **Purchase Order** | Request to supplier with line items and quantities |
| **Goods Receipt** | Receipt of goods from supplier; updated inventory |
| **Quality Control** | Inspection checklist for received goods |
| **Ledger Entry** | Atomic financial transaction (debit/credit pair) |
| **Invoice** | Request for payment derived from order |
| **Receipt** | Proof of payment issued after payment confirmed |
| **Tax Line** | Invoice line item showing tax calculation |
| **Terminal** | Single point of sale device (unified POS) |
| **Game Session** | Player session within games module (now terminal-native) |
| **Transfer** | Movement of inventory between locations |
| **Reconciliation** | Matching physical count to system records |

---

**Document approved by**: [Stakeholder names]  
**Next review date**: April 15, 2026  
**Status**: Ready for implementation
