Seed scripts

This folder contains seed scripts used for development and demos.

How to run

Run the master seed (uses tsx):

```powershell
npm run seed
```

You can override the initial admin credentials using environment variables:

```powershell
$env:SEED_ADMIN_EMAIL = 'admin@hotel.test'; $env:SEED_ADMIN_PASSWORD = 'strongpass'; npm run seed
```

Notes

- The admin user password is hashed using bcryptjs when created by the seed.
- The seed is idempotent and uses upserts/findFirst to avoid duplicate records. Re-running is safe for development.
- The seed creates default roles (admin, manager, staff) and assigns a broad `manage:*` permission to `admin`. Manager and staff receive a small set of default permissions as well.
- If you want to skip demo data (food/drinks/orders) in production-like runs, we can add an env flag to disable demo seeding.
