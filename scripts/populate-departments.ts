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

async function main() {
  try {
    // Canonical hotel departments. These should align with the domain models
    // (e.g., restaurants, bar_and_clubs, gym_and_sports) and also include
    // operational departments used by the hotel (housekeeping, front-desk, etc.).
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
      { code: 'housekeeping', name: 'Housekeeping', description: 'Room cleaning and linen services', type: 'housekeeping', icon: 'broom' },
      { code: 'front-desk', name: 'Front Desk', description: 'Guest arrivals, departures and reception', type: 'front-desk', icon: 'concierge-bell' },
      { code: 'spa', name: 'Spa', description: 'Spa and wellness services', type: 'spa', icon: 'spa' },
      { code: 'laundry', name: 'Laundry', description: 'Laundry and dry-cleaning services', type: 'laundry', icon: 'tshirt' },
      { code: 'kitchen', name: 'Kitchen', description: 'Kitchen and food preparation', type: 'kitchen', icon: 'kitchen' },
      { code: 'maintenance', name: 'Maintenance', description: 'Building and facilities maintenance', type: 'maintenance', icon: 'tools' },
      { code: 'security', name: 'Security', description: 'Safety and security operations', type: 'security', icon: 'shield-alt' },
      { code: 'events', name: 'Events', description: 'Event planning and conference services', type: 'events', icon: 'calendar-alt' },
      { code: 'concierge', name: 'Concierge', description: 'Guest services and concierge', type: 'concierge', icon: 'user-tie' },
      { code: 'accounting', name: 'Accounting', description: 'Finance, billing and accounts', type: 'accounting', icon: 'calculator' },
      { code: 'sales', name: 'Sales & Marketing', description: 'Sales, marketing and promotions', type: 'sales', icon: 'bullhorn' },
    ]

    for (const d of canonicalDepartments) {
      await upsertDepartment(d.code, d.name, { description: d.description, type: d.type, icon: (d as any).icon, metadata: (d as any).metadata })
    }

    // Optionally, create departments for each Restaurant/Bar entity
    // Commented by default — uncomment if you want one department per entity
    /*
    const restaurants = await prisma.restaurant.findMany()
    for (const r of restaurants) {
      await upsertDepartment(`restaurant:${r.id}`, r.name, { description: r.description || undefined, type: 'restaurant', referenceType: 'Restaurant', referenceId: r.id })
    }

    const bars = await prisma.barAndClub.findMany()
    for (const b of bars) {
      await upsertDepartment(`bar:${b.id}`, b.name, { description: b.description || undefined, type: 'bar', referenceType: 'BarAndClub', referenceId: b.id })
    }

    const gyms = await prisma.gymAndSport.findMany()
    for (const g of gyms) {
      await upsertDepartment(`gym:${g.id}`, g.name, { description: g.description || undefined, type: 'gym', referenceType: 'GymAndSport', referenceId: g.id })
    }
    */

    console.log('Departments upsert complete')
  } catch (err) {
    console.error('populate-departments error', err)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
