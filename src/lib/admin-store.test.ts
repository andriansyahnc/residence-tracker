import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../db/test-db'
import { platformRoles, profiles } from '../db/schema'
import { createAdminStore } from './admin-store'

const AT = '2026-08-01T00:00:00Z'

describe('admin-store', () => {
  let store: ReturnType<typeof createAdminStore>

  beforeEach(async () => {
    const db = await createTestDb()
    store = createAdminStore(db)
    await db.insert(profiles).values({
      id: 'user-super',
      email: 'super@example.com',
      displayName: 'Super',
      createdAt: AT,
    })
    await db
      .insert(platformRoles)
      .values({ userId: 'user-super', role: 'superadmin', createdAt: AT })
  })

  it('keeps everything shut for a non-superadmin', async () => {
    await expect(store.listOverview('user-manager')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(
      store.createResidence('user-manager', 'Nekat'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('impersonates a manager but never a plain resident', async () => {
    // user-resident is a resident in res-1, user-manager is its manager.
    await expect(
      store.startImpersonation('user-super', 'user-resident'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    const target = await store.startImpersonation('user-super', 'user-manager')
    expect(target.userId).toBe('user-manager')
  })

  it('creates a residence and a user in it', async () => {
    const residence = await store.createResidence('user-super', 'Bukit Indah')
    await store.createUser('user-super', {
      email: 'Baru@Example.com',
      displayName: 'Warga Baru',
      residenceId: residence.id,
      role: 'manager',
    })

    const overview = await store.listOverview('user-super')
    const created = overview.users.find((u) => u.email === 'baru@example.com')
    expect(created?.memberships[0]).toMatchObject({
      residenceId: residence.id,
      role: 'manager',
    })
  })
})
