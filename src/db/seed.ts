import { count, eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { memberships, profiles, residences } from './schema'
import * as schema from './schema'

const CREATED_AT = '2026-08-01T00:00:00Z'

function ensureDemoUsers(db: BetterSQLite3Database<typeof schema>) {
  const nomember = db
    .select()
    .from(profiles)
    .where(eq(profiles.email, 'nomember@example.com'))
    .get()

  if (!nomember) {
    db.insert(profiles)
      .values({
        id: 'user-nomember',
        email: 'nomember@example.com',
        displayName: 'No Membership User',
        createdAt: CREATED_AT,
      })
      .run()
  }
}

export function seedDatabase(db: BetterSQLite3Database<typeof schema>) {
  const existing = db.select({ count: count() }).from(residences).get()
  if (existing && existing.count > 0) {
    ensureDemoUsers(db)
    return
  }

  db.insert(residences)
    .values({ id: 'res-1', name: 'Oak Residence', createdAt: CREATED_AT })
    .run()

  db.insert(profiles)
    .values([
      {
        id: 'user-resident',
        email: 'resident@example.com',
        displayName: 'Alex Resident',
        createdAt: CREATED_AT,
      },
      {
        id: 'user-manager',
        email: 'manager@example.com',
        displayName: 'Morgan Manager',
        createdAt: CREATED_AT,
      },
      {
        id: 'user-other',
        email: 'other@example.com',
        displayName: 'Other Resident',
        createdAt: CREATED_AT,
      },
      {
        id: 'user-nomember',
        email: 'nomember@example.com',
        displayName: 'No Membership User',
        createdAt: CREATED_AT,
      },
    ])
    .run()

  db.insert(memberships)
    .values([
      {
        id: 'mem-resident',
        userId: 'user-resident',
        residenceId: 'res-1',
        role: 'resident',
        createdAt: CREATED_AT,
      },
      {
        id: 'mem-manager',
        userId: 'user-manager',
        residenceId: 'res-1',
        role: 'manager',
        createdAt: CREATED_AT,
      },
      {
        id: 'mem-other',
        userId: 'user-other',
        residenceId: 'res-1',
        role: 'resident',
        createdAt: CREATED_AT,
      },
    ])
    .run()
}
