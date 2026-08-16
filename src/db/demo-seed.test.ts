import { describe, expect, it } from 'vitest'
import { count, eq } from 'drizzle-orm'
import { createTestDb } from './test-db'
import { resetDemoOrg } from './demo-seed'
import {
  comments,
  expenses,
  iplDues,
  iplPaymentProofs,
  memberships,
  problems,
  residences,
  units,
} from './schema'

async function snapshot(db: Awaited<ReturnType<typeof createTestDb>>) {
  const tables = {
    residences,
    memberships,
    units,
    iplDues,
    iplPaymentProofs,
    expenses,
    problems,
    comments,
  }
  const out: Record<string, number> = {}
  for (const [name, table] of Object.entries(tables)) {
    const rows = await db.select({ n: count() }).from(table)
    out[name] = rows[0]?.n ?? 0
  }
  return out
}

describe('demo org', () => {
  it('resets to the same state and leaves real data alone', async () => {
    const db = await createTestDb()
    const before = await snapshot(db)

    await resetDemoOrg(db)
    await resetDemoOrg(db)

    expect(await snapshot(db)).toEqual(before)

    // The two seeded residences outside the demo org must survive the wipe.
    for (const id of ['res-1', 'res-2']) {
      const found = await db
        .select()
        .from(residences)
        .where(eq(residences.id, id))
        .limit(1)
      expect(found).toHaveLength(1)
    }
  })
})
