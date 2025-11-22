import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

async function upsertDepartment(
  code: string,
  name: string,
  opts: {
    description?: string
    type?: string
    referenceType?: string
    referenceId?: string
    icon?: string
    image?: string
    metadata?: Record<string, any>
  } = {}
) {
  const slug = slugify(code || name)
  const data = {
    code,
    name,
    description: opts.description || null,
    slug,
    type: opts.type || code,
    icon: opts.icon || null,
    image: opts.image || null,
    referenceType: opts.referenceType || null,
    referenceId: opts.referenceId || null,
    metadata: opts.metadata || {},
    isActive: true,
  }

  console.log(`Upserting department ${code}`)
  const existing = await prisma.department.findUnique({ where: { code } })
  if (existing) {
    await prisma.department.update({ where: { code }, data })
    return
  }

  await prisma.department.create({ data })
}

type SeedOptions = {
  perEntity?: boolean // when false, do not create per-restaurant/bar departments
}

async function main(opts: SeedOptions = { perEntity: true }) {
  try {
    // Canonical hotel departments. These should align with the domain models
    // (e.g., restaurants, bar_and_clubs, gym_and_sports) and also include
    // operational departments used by the hotel (housekeeping, front-desk, etc.).
    // Canonical departments used in seeds. Keep other departments commented for reference.
    const canonicalDepartments: Array<{
      code: string
      name: string
      description?: string
      type?: string
      icon?: string
    }> = [
      { code: 'restaurant', name: 'Restaurant', description: 'Food & dining services', type: 'restaurants', icon: 'utensils' },
      { code: 'bar-and-clubs', name: 'Bar & Clubs', description: 'Bar and club services', type: 'bars', icon: 'cocktail' },
      { code: 'gym', name: 'Gym & Fitness', description: 'Gym and sport facilities', type: 'gyms', icon: 'dumbbell' },
      { code: 'games', name: 'Games & Entertainment', description: 'Arcade, pool, and entertainment', type: 'games', icon: 'gamepad' },
      { code: 'housekeeping', name: 'Housekeeping', description: 'Room cleaning and toiletries', type: 'housekeeping', icon: 'broom' },
      { code: 'laundry', name: 'Laundry', description: 'Laundry and dry-cleaning services', type: 'laundry', icon: 'tshirt' },
      { code: 'security', name: 'Security', description: 'Safety and security operations', type: 'security', icon: 'shield-alt' },
      // commented out for later reference:
      // { code: 'front-desk', name: 'Front Desk', description: 'Guest arrivals, departures and reception', type: 'front-desk', icon: 'concierge-bell' },
      // { code: 'spa', name: 'Spa', description: 'Spa and wellness services', type: 'spa', icon: 'spa' },
      // { code: 'maintenance', name: 'Maintenance', description: 'Building and facilities maintenance', type: 'maintenance', icon: 'tools' },
      // { code: 'events', name: 'Events', description: 'Event planning and conference services', type: 'events', icon: 'calendar-alt' },
      // { code: 'concierge', name: 'Concierge', description: 'Guest services and concierge', type: 'concierge', icon: 'user-tie' },
      // { code: 'accounting', name: 'Accounting', description: 'Finance, billing and accounts', type: 'accounting', icon: 'calculator' },
      // { code: 'sales', name: 'Sales & Marketing', description: 'Sales, marketing and promotions', type: 'sales', icon: 'bullhorn' },
    ]

    for (const d of canonicalDepartments) {
      await upsertDepartment(d.code, d.name, { description: d.description, type: d.type, icon: (d as any).icon, metadata: (d as any).metadata })
    }

    // --- Legacy migration: merge old department codes into canonical 'restaurant' ---
    // If a legacy code like 'REST' exists, move its relations to the canonical 'restaurant'
    try {
      const legacy = await prisma.department.findFirst({ where: { code: { in: ['REST', 'RESTAURANT'] } } })
      const canonicalRestaurant = await prisma.department.findUnique({ where: { code: 'restaurant' } })
      if (legacy && canonicalRestaurant && legacy.id !== canonicalRestaurant.id) {
        console.log(`Migrating legacy department ${legacy.code} -> restaurant`)
        // Reassign order_departments
        await prisma.orderDepartment.updateMany({ where: { departmentId: legacy.id }, data: { departmentId: canonicalRestaurant.id } })
        // Reassign terminals
        await prisma.terminal.updateMany({ where: { departmentId: legacy.id }, data: { departmentId: canonicalRestaurant.id } })
        // Delete legacy department
        await prisma.department.delete({ where: { id: legacy.id } })
        console.log(`Legacy department ${legacy.code} migrated and removed.`)
      }
    } catch (err) {
      console.warn('Legacy department migration failed:', err)
    }

    // Optionally, create departments for each Restaurant/Bar entity
    // Controlled by opts.perEntity. When perEntity is false we skip creating
    // per-entity departments and keep only the canonical 'restaurant' and 'bar-and-clubs' departments.
    if (opts.perEntity !== false) {
      // Create departments for each Restaurant and Bar entity with common sections.
      // This supports multiple sections per physical restaurant/bar (e.g., main dining, kitchen, pool-side bar).
      // If there are no Restaurant/Bar entries, create a couple of sample ones so
      // we can create per-entity department sections for demonstration/testing.
      let restaurants = await prisma.restaurant.findMany()
      if (!restaurants || restaurants.length === 0) {
        console.log('No restaurants found — seeding sample Restaurant entries')
        const sampleR = [
          { name: 'The Grand Dining', location: 'Lobby', description: 'Main hotel restaurant' },
          { name: 'Seaside Grill', location: 'Pool Level', description: 'Casual pool-side dining' },
        ]
        for (const r of sampleR) {
          const exists = await prisma.restaurant.findFirst({ where: { name: r.name } })
          if (!exists) await prisma.restaurant.create({ data: r })
        }
        restaurants = await prisma.restaurant.findMany()
      }
      for (const r of restaurants) {
        // Main dining department only (no kitchen section)
        await upsertDepartment(`restaurant:${r.id}:main`, `${r.name} — Main`, {
          description: r.description || undefined,
          type: 'restaurants',
          referenceType: 'Restaurant',
          referenceId: r.id,
          metadata: { section: 'main' },
        })
      }

      // Ensure Bar sections exist per BarAndClub entity (create sample bars if none)
      let bars = await prisma.barAndClub.findMany()
      if (!bars || bars.length === 0) {
        console.log('No bars found — seeding sample BarAndClub entries')
        const sampleB = [
          { name: 'Main Hotel Bar', location: 'Lobby', description: 'Main hotel bar' },
          { name: 'Poolside Bar', location: 'Pool', description: 'Pool-side bar' },
        ]
        for (const b of sampleB) {
          const exists = await prisma.barAndClub.findFirst({ where: { name: b.name } })
          if (!exists) await prisma.barAndClub.create({ data: b })
        }
        bars = await prisma.barAndClub.findMany()
      }

      for (const b of bars) {
        await upsertDepartment(`bar:${b.id}:main`, `${b.name} — Main`, {
          description: b.description || undefined,
          type: 'bars',
          referenceType: 'BarAndClub',
          referenceId: b.id,
          metadata: { section: 'main' },
        })
      }
    }

    console.log('Departments upsert complete')
  } catch (err) {
    console.error('populate-departments error', err)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

// Export the main function so other seed scripts can call it programmatically
export { main as seedDepartments }

// Keep backward compatibility when this script is executed directly
if (require.main === module) {
  main()
}
