# Project Documentation — Consolidated Index

This folder provides a single, categorized index to the project's documentation so you can find guides, architectural notes, and implementation details in one place.

> Note: The documentation files themselves remain in the repository root. These links are relative and point to those files.
> Note: Documentation has been migrated into this `docs/` folder for hotel-manager-v3. Links below are local and relative to this directory.

## Quick start

- [00_START_HERE.md](getting-started/00_START_HERE.md) — Short onboarding checklist and first steps.
- [SETUP_DEPLOYMENT.md](getting-started/SETUP_DEPLOYMENT.md) — Full setup and deployment instructions (recommended first read).
- [README.md](../README.md) — Project overview and quick start commands.

## API

- [API_GUIDE.md](api/API_GUIDE.md) — Complete API reference and examples.
- [API_DEVELOPMENT_BLUEPRINT.md](api/API_DEVELOPMENT_BLUEPRINT.md) — Design and guidelines for building API endpoints.
- [API_IMPLEMENTATION.md](api/API_IMPLEMENTATION.md) — Implementation notes and developer guidelines.

## Architecture & System Overview

- [ARCHITECTURE.md](architecture/ARCHITECTURE.md) — Architectural diagrams and layer descriptions.
- [SYSTEM_SUMMARY.md](architecture/SYSTEM_SUMMARY.md) — High level system summary and readiness.
- [INDEX.md](architecture/INDEX.md) — Project index and cross-reference.

## Implementation Phases & Project Planning

- [PHASE1_SUMMARY.md](phases/PHASE1_SUMMARY.md)
- [PHASE1_SCHEMA_IMPLEMENTATION.md](phases/PHASE1_SCHEMA_IMPLEMENTATION.md)
- [PHASE2_SERVICE_LAYER.md](phases/PHASE2_SERVICE_LAYER.md)
- [PHASE3A_API_ROUTES.md](phases/PHASE3A_API_ROUTES.md)
- [PHASE3A_COMPLETION_CHECKLIST.md](phases/PHASE3A_COMPLETION_CHECKLIST.md)
- [PHASE3A_COMPLETION_SUMMARY.md](phases/PHASE3A_COMPLETION_SUMMARY.md)
- [PHASE3A_FINAL_SUMMARY.md](phases/PHASE3A_FINAL_SUMMARY.md)
- [PHASE3A_TESTING_GUIDE.md](phases/PHASE3A_TESTING_GUIDE.md)
- [PHASE3C_COMPLETE.md](phases/PHASE3C_COMPLETE.md)
- [PHASE4_VALIDATION_PLANNING.md](phases/PHASE4_VALIDATION_PLANNING.md)

## Inventory & Operations

- [INVENTORY_GUIDE.md](inventory/INVENTORY_GUIDE.md)
- [INVENTORY_IMPLEMENTATION.md](inventory/INVENTORY_IMPLEMENTATION.md)
- [INVENTORY_QUICK_REFERENCE.md](inventory/INVENTORY_QUICK_REFERENCE.md)

## Roles & Access

- [ROLES_AND_ACCESS.md](roles/ROLES_AND_ACCESS.md)
- [ROLES_QUICK_REFERENCE.md](roles/ROLES_QUICK_REFERENCE.md)
- [ROLES_SERVER_VS_FRONTEND.md](roles/ROLES_SERVER_VS_FRONTEND.md)
- [ROLES_VISUAL_GUIDE.md](roles/ROLES_VISUAL_GUIDE.md)

## UI/UX Implementation

- [ui/README.md](ui/README.md) — **START HERE** Documentation index and quick navigation
- [ui/UI_IMPLEMENTATION_SUMMARY.md](ui/UI_IMPLEMENTATION_SUMMARY.md) — Overview and implementation tracking
- [ui/UI_IMPLEMENTATION_GUIDE.md](ui/UI_IMPLEMENTATION_GUIDE.md) — Complete frontend architecture with shadcn/ui
- [ui/DESIGN_SYSTEM.md](ui/DESIGN_SYSTEM.md) — Color palette, typography, components, and design tokens
- [ui/ADMIN_DASHBOARD_SPEC.md](ui/ADMIN_DASHBOARD_SPEC.md) — Admin dashboard module specifications
- [ui/PUBLIC_SITE_SPEC.md](ui/PUBLIC_SITE_SPEC.md) — Public website landing pages specifications

## Implementation Artifacts

- [IMPLEMENTATION_CHECKLIST.md](implementation/IMPLEMENTATION_CHECKLIST.md)
- [IMPLEMENTATION_SUMMARY.md](implementation/IMPLEMENTATION_SUMMARY.md)
- [EXECUTIVE_SUMMARY.md](implementation/EXECUTIVE_SUMMARY.md)
- [VISUAL_COMPLETION_REPORT.md](implementation/VISUAL_COMPLETION_REPORT.md)

## Reference

- `prisma/schema.prisma` — Database schema (60+ models)
- `app/` — API routes (Next.js app router)
- `src/` — Source code (services, utilities, types)

## Contributing & Next Steps

If you'd like a generated docs site, we can:

- Move these markdown files into `docs/` and add a static site generator (Docsify / MkDocs / Docusaurus).
- Add sidebar/summaries and generate a site automatically.

If you'd prefer that I move files into `docs/` (so links are local and tidy) I can do that next — tell me whether you want files copied or moved.
