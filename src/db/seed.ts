import { count, eq } from 'drizzle-orm'
import type { AppDatabase } from './index'
import { seedDemoOrg } from './demo-seed'
import {
  iplRates,
  managementGroupResidences,
  managementGroups,
  memberships,
  profiles,
  residences,
  unitMemberships,
  units,
} from './schema'

export async function seedDatabase(db: AppDatabase) {
  const existing = await db
    .select({ count: count() })
    .from(residences)
    .limit(1)
  if (existing[0]?.count && existing[0].count > 0) {
    await ensureDemoUsers(db)
    await ensureIplBaseline(db)
    await seedDemoOrg(db)
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

  await ensureIplBaseline(db)
  await seedDemoOrg(db)
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

/** Idempotent IPL pilot data: two residences, one management group, units, rates, accountant. */
async function ensureIplBaseline(db: AppDatabase) {
  const createdAt = '2026-08-01T00:00:00Z'
  const updatedAt = createdAt

  const res2 = await db
    .select()
    .from(residences)
    .where(eq(residences.id, 'res-2'))
    .limit(1)
  if (res2.length === 0) {
    await db.insert(residences).values({
      id: 'res-2',
      name: 'Pine Residence',
      createdAt,
    })
  }

  const accountant = await db
    .select()
    .from(profiles)
    .where(eq(profiles.email, 'accountant@example.com'))
    .limit(1)
  if (accountant.length === 0) {
    await db.insert(profiles).values({
      id: 'user-accountant',
      email: 'accountant@example.com',
      displayName: 'Ayu Accountant',
      createdAt,
    })
  }

  for (const mem of [
    {
      id: 'mem-accountant-res-1',
      userId: 'user-accountant',
      residenceId: 'res-1',
      role: 'accountant' as const,
    },
    {
      id: 'mem-accountant-res-2',
      userId: 'user-accountant',
      residenceId: 'res-2',
      role: 'accountant' as const,
    },
    {
      id: 'mem-manager-res-2',
      userId: 'user-manager',
      residenceId: 'res-2',
      role: 'manager' as const,
    },
    {
      id: 'mem-resident-res-2',
      userId: 'user-resident',
      residenceId: 'res-2',
      role: 'resident' as const,
    },
  ]) {
    const found = await db
      .select()
      .from(memberships)
      .where(eq(memberships.id, mem.id))
      .limit(1)
    if (found.length === 0) {
      await db.insert(memberships).values({ ...mem, createdAt })
    }
  }

  const mg = await db
    .select()
    .from(managementGroups)
    .where(eq(managementGroups.id, 'mg-1'))
    .limit(1)
  if (mg.length === 0) {
    await db.insert(managementGroups).values({
      id: 'mg-1',
      name: 'Oak+Pine Management',
      createdAt,
    })
  }

  for (const link of [
    { residenceId: 'res-1', sortOrder: 1 },
    { residenceId: 'res-2', sortOrder: 2 },
  ]) {
    const found = await db
      .select()
      .from(managementGroupResidences)
      .where(eq(managementGroupResidences.residenceId, link.residenceId))
      .limit(1)
    if (found.length === 0) {
      await db.insert(managementGroupResidences).values({
        managementGroupId: 'mg-1',
        residenceId: link.residenceId,
        sortOrder: link.sortOrder,
        createdAt,
      })
    }
  }

  for (const rate of [
    { residenceId: 'res-1', feePerM2Idr: 10000 },
    { residenceId: 'res-2', feePerM2Idr: 12000 },
  ]) {
    const found = await db
      .select()
      .from(iplRates)
      .where(eq(iplRates.residenceId, rate.residenceId))
      .limit(1)
    if (found.length === 0) {
      await db.insert(iplRates).values({
        ...rate,
        updatedAt,
        updatedByUserId: 'user-manager',
      })
    }
  }

  for (const unit of [
    { id: 'unit-1a', residenceId: 'res-1', label: '1A', luasTanahM2: 100 },
    { id: 'unit-1b', residenceId: 'res-1', label: '1B', luasTanahM2: 120 },
    { id: 'unit-2a', residenceId: 'res-2', label: '2A', luasTanahM2: 90 },
  ]) {
    const found = await db
      .select()
      .from(units)
      .where(eq(units.id, unit.id))
      .limit(1)
    if (found.length === 0) {
      await db.insert(units).values({
        ...unit,
        createdAt,
        updatedAt,
      })
    }
  }

  for (const link of [
    { id: 'um-resident-1a', unitId: 'unit-1a', membershipId: 'mem-resident' },
    { id: 'um-other-1b', unitId: 'unit-1b', membershipId: 'mem-other' },
    {
      id: 'um-resident-2a',
      unitId: 'unit-2a',
      membershipId: 'mem-resident-res-2',
    },
  ]) {
    const found = await db
      .select()
      .from(unitMemberships)
      .where(eq(unitMemberships.id, link.id))
      .limit(1)
    if (found.length === 0) {
      await db.insert(unitMemberships).values({ ...link, createdAt })
    }
  }
}
