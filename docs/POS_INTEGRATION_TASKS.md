# POS, Sales Terminal & Department/Inventory Integration — One-Page Task Plan

Purpose: A concise, actionable one-page plan to implement comprehensive backend-to-frontend integration between Sales Terminals, Department accounting, and Inventory management.

## Objectives
- Enable reliable transactions from sales terminals through backend services to frontend POS.
- Maintain correct inventory reservations and department allocations in real time.
- Provide robust error handling, reconciliation, and observability.

## Scope
- Sales terminal <-> backend communication (transaction lifecycle, receipts, retries).
- Backend services for orders, inventory adjustments, and department allocation.
- Frontend POS checkout flow and operator UI to interact with terminals and show inventory state.

## High-level deliverables
- API contract (OpenAPI) & event schemas
- Backend services: transactions, inventory, department allocation
- Frontend updates: checkout UI, terminal status, inventory indicators
- Tests (unit, integration, e2e) and CI pipelines
- Monitoring, runbooks, and operator documentation

## Task breakdown (actionable)
1. Define integration scope & contracts
   - Stakeholders: POS product owner, backend lead, inventory owner, terminals vendor.
   - Deliverable: OpenAPI + event schema (JSON schema), sequence diagrams.
   - Acceptance: Sign-off by stakeholders.

2. Map data models & migrations
   - Identify required DB changes (orders, transactions, inventory_reservations, department_sales).
   - Draft Prisma schema updates and safe migration path.
   - Acceptance: Zero data-loss migration plan.

3. Backend: transaction service
   - Endpoints: POST /pos/transactions, GET /pos/transactions/{id}, POST /pos/transactions/{id}/complete
   - Support idempotency keys and strong validation.
   - Handle partial failures with compensating actions (rollback reservations).

4. Inventory integration
   - Reserve inventory on preliminary transaction creation.
   - Decrement on transaction completion; restore on cancellation/failure.
   - Concurrency strategy: optimistic locking or DB transactions.

5. Department allocation
   - Determine allocation rules (per item, per order split).
   - Record department entries for each transaction for reporting and KPIs.

6. Sales terminal integration
   - Choose transport: secure HTTP(S) webhook, WebSocket, or vendor SDK.
   - Implement handshake and authentication (API keys or mTLS/JWT).
   - Implement terminal lifecycle events: connected, disconnected, printed, error, ack.
   - Add retries, exponential backoff, and dead-letter handling for failed messages.

7. Frontend changes (checkout flow)
   - Update `components/admin/pos/pos-checkout.tsx` to: show terminal picker, inventory availability, terminal status, and transaction progress.
   - UX for failures: retry, cancel, or manual override with audit trail.
   - UI rules:
     - Each terminal ID MUST be bound to a department at creation time. There should be no manual department dropdown on the checkout screen — the terminal determines department context.
     - Department menus/products must be scoped to the terminal's assigned department and displayed automatically when that terminal is selected.
     - Admin terminal list (e.g. the admin view that lists available terminals) MUST surface a compact sales summary (today's transactions count and gross total) inline so admins can see terminal performance at a glance without clicking into each terminal.

8. Security & permissions
   - Terminal credentials management and rotation.
   - Role-based access control for POS operators and admins.
   - Audit logs for all state-changing operations.

9. Testing & QA
   - Unit tests for business logic.
   - Integration tests: simulate terminal messages, inventory race conditions.
   - E2E tests: full checkout -> inventory decrement -> department allocation.

10. Deploy, monitor & reconcile
    - Add metrics: transaction counts, failure rates, inventory mismatch rates.
    - Set alerts for reconciliation anomalies and failed terminal comms.
    - Build reconciliation jobs to compare POS vs backend ledgers nightly.

11. Docs & runbooks
    - Developer docs: API, sequence diagrams, migration notes.
    - Operator runbooks: terminal setup, recovery steps, contact points.

## Recommended timeline (example)
- Week 1: Scope, API contracts, schema mapping
- Week 2: Backend transaction & inventory prototypes
- Week 3: Terminal integration (handshake, auth) + frontend checkout wire-up
- Week 4: Tests, monitoring, reconciliation jobs, docs

## Acceptance criteria
- Terminals can create and complete transactions with end-to-end success.
- Inventory reservations reflect in real time and reconcile nightly with <1% variance.
- Department sales are recorded correctly and appear in reports.
- Failures are recoverable with documented runbooks.

## Risks & mitigations
- Inventory races: mitigate with DB transactions and optimistic locking.
- Terminal network unreliability: implement retries, buffering, and DLQ.
- Data schema migration risk: run migrations in maintenance window and test on staging.

## Next steps
- Schedule stakeholder workshop to finalize API contract.
- Assign owners for backend, frontend, and inventory integration tasks.
- Create tracking tickets per todo item and start sprint planning.

## Additional UI/behavior rules (implementation notes)

- Terminal-to-Department binding
   - When creating a terminal, persist terminal metadata: { id, name, departmentCode, assignedProducts? }.
   - Use the terminal's departmentCode to drive the menu and allocations — frontend checkout screen must not show a separate department selector.
   - Back-end APIs that operate on a terminal should accept terminalId and derive department context server-side.

- Admin terminals list summary
   - Add a read-only endpoint such as `/api/admin/pos/terminals` that returns for each terminal: { id, name, departmentCode, status, today: { count, total } }.
   - The admin UI should render the `today` mini-summary inline next to each terminal row (count + formatted currency total) and provide a refresh action per row or global refresh.
   - The summary must be derived from the canonical transaction store (not client-side estimates) and should be cached for short intervals (e.g., 30-60s) to prevent heavy queries.

These rules are intended to simplify operator UX, remove duplicated UI for department selection, and give admins quick visibility into terminal activity without extra clicks.

---

Files created:
- `docs/POS_INTEGRATION_TASKS.md` — one-page task plan (this file)

If you want, I can:
- Convert the tasks into GitHub issues or project board cards.
- Produce the initial OpenAPI skeleton and sample Prisma schema diffs.
- Implement a first-pass change in `components/admin/pos/pos-checkout.tsx` to show terminal status and inventory availability.
