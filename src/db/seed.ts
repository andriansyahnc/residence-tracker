import { count, eq } from 'drizzle-orm'
import type { AppDatabase } from './index'
import { memberships, profiles, residences } from './schema'

export async function seedDatabase(db: AppDatabase) {
  const existing = await db
    .select({ count: count() })
    .from(residences)
    .limit(1)
  if (existing[0]?.count && existing[0].count > 0) {
    await ensureDemoUsers(db)
    return
  }

  const createdAt = '2026-08-01T00:00:00Z'

  await db.insert(residences).values({
    id: 'res-1',
    name: 'Oak Residence',
    createdAt,
  })

  await db.insert(profiles).values([
    {
      id: 'user-resident',
      email: 'resident@example.com',
      displayName: 'Alex Resident',
      createdAt,
    },
    {
      id: 'user-manager',
      email: 'manager@example.com',
      displayName: 'Morgan Manager',
      createdAt,
    },
    {
      id: 'user-other',
      email: 'other@example.com',
      displayName: 'Other Resident',
      createdAt,
    },
    {
      id: 'user-nomember',
      email: 'nomember@example.com',
      displayName: 'No Membership User',
      createdAt,
    },
  ])

  await db.insert(memberships).values([
    {
      id: 'mem-resident',
      userId: 'user-resident',
      residenceId: 'res-1',
      role: 'resident',
      createdAt,
    },
    {
      id: 'mem-manager',
      userId: 'user-manager',
      residenceId: 'res-1',
      role: 'manager',
      createdAt,
    },
    {
      id: 'mem-other',
      userId: 'user-other',
      residenceId: 'res-1',
      role: 'resident',
      createdAt,
    },
  ])
}

async function ensureDemoUsers(db: AppDatabase) {
  const nomember = await db
    .select()
    .from(profiles)
    .where(eq(profiles.email, 'nomember@example.com'))
    .limit(1)

  if (nomember.length === 0) {
    await db.insert(profiles).values({
      id: 'user-nomember',
      email: 'nomember@example.com',
      displayName: 'No Membership User',
      createdAt: '2026-08-01T00:00:00Z',
    })
  }
}
