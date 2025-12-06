# Department & Section Migration and Rollout Checklist

This checklist helps safely deploy changes that affect Departments, Department Sections, and related inventory/transfer functionality.

1. Pre-deploy verification
- Confirm all relevant API changes are covered by feature flags (if available).
- Run a local build and smoke the dashboard pages: `/departments`, `/departments/[code]`, `/departments/[code]/transfer` and `/admin/department-sections`.
- Ensure `sectionService` and `transferService` types are stable and exported from `src/services`.

2. Database
- No schema migrations are required for the current refactor.
- If future schema changes are needed, prepare a Prisma migration and add a reversible migration plan:
  - Create migration with `npx prisma migrate dev --name <name>`
  - Test migration on a staging copy of production DB.
  - Prepare rollback steps: keep snapshot or `pg_dump` before applying.

3. Seed / Backfill
- If new metadata fields are relied upon (e.g., `metadata.sectionStats`), ensure seeding scripts populate default values for existing rows.
- Run `scripts/check-seed-status.ts` and any `populate-departments.ts` as needed on staging.

4. Monitoring & Logging
- The app now emits console.time logs for key endpoints: departments and admin department-sections and transfer. Ensure logs are collected by your logging/aggregation.
- Add alert rules for high latency (> 2s) or error rate spikes on these endpoints.

5. Rollout Strategy
- Canary or staged rollout: enable on a small percentage of traffic or enable for internal admin users first.
- Monitor error rates, latencies, and look for increased memory usage or timeouts.

6. Rollback Criteria
- Increased error rates > 1% over baseline for 10 minutes.
- Latency increase > 200% or sustained median > 2s.
- Any data integrity errors reported in logs regarding transfers or inventory.

7. Post-deploy verification
- Perform the following smoke tests on production (or canary):
  - Create/Delete a department section via admin page.
  - Create a transfer request and approve it.
  - Navigate department detail pages and verify sections and products load correctly and show expected counts.

8. Documentation
- Update internal docs referencing the previous department/section data flow to point to `sectionService` for section-scoped data.
- Share short release notes to the team covering:
  - Why the change: avoid large payloads and separate concerns
  - New behavior: section-scoped endpoints, transfer validation changes
  - Rollback steps and important logs to watch

---
Generated: automated checklist created by refactor work
