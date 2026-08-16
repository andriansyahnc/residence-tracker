import { createServerFn } from '@tanstack/react-start'
import { getAdminStore } from '../lib/admin-store'

type ResidenceRole = 'resident' | 'manager' | 'accountant'

/** The account you signed in with, plus who you are borrowing right now. */
export const getAdminContext = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { readRealUserId, readImpersonatedUserId } = await import('./auth.server')
    const realUserId = await readRealUserId()
    if (!realUserId) return null

    const store = getAdminStore()
    const impersonatedUserId = await readImpersonatedUserId()
    return {
      realUserId,
      platformRole: await store.platformRoleOf(realUserId),
      impersonatedUserId,
      impersonatedDisplayName: impersonatedUserId
        ? await store.displayNameOf(impersonatedUserId)
        : null,
    }
  },
)

export const getAdminOverview = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { readRealUserId } = await import('./auth.server')
    const realUserId = await readRealUserId()
    if (!realUserId) throw new Error('Unauthorized')
    return getAdminStore().listOverview(realUserId)
  },
)

export const createResidence = createServerFn({ method: 'POST' })
  .validator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    const { readRealUserId } = await import('./auth.server')
    const realUserId = await readRealUserId()
    if (!realUserId) throw new Error('Unauthorized')
    return getAdminStore().createResidence(realUserId, data.name)
  })

export const createUser = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      email: string
      displayName: string
      residenceId: string
      role: ResidenceRole
    }) => data,
  )
  .handler(async ({ data }) => {
    const { readRealUserId } = await import('./auth.server')
    const realUserId = await readRealUserId()
    if (!realUserId) throw new Error('Unauthorized')
    return getAdminStore().createUser(realUserId, data)
  })

export const setMembershipRole = createServerFn({ method: 'POST' })
  .validator(
    (data: { userId: string; residenceId: string; role: ResidenceRole }) => data,
  )
  .handler(async ({ data }) => {
    const { readRealUserId } = await import('./auth.server')
    const realUserId = await readRealUserId()
    if (!realUserId) throw new Error('Unauthorized')
    return getAdminStore().setMembershipRole(realUserId, data)
  })

export const startImpersonation = createServerFn({ method: 'POST' })
  .validator((data: { targetUserId: string }) => data)
  .handler(async ({ data }) => {
    const { readRealUserId, startSessionImpersonation } = await import(
      './auth.server'
    )
    const realUserId = await readRealUserId()
    if (!realUserId) throw new Error('Unauthorized')

    const target = await getAdminStore().startImpersonation(
      realUserId,
      data.targetUserId,
    )
    await startSessionImpersonation(target.userId)
    return { ok: true as const, displayName: target.displayName }
  })

export const stopImpersonation = createServerFn({ method: 'POST' }).handler(
  async () => {
    const { readRealUserId, stopSessionImpersonation } = await import(
      './auth.server'
    )
    const realUserId = await readRealUserId()
    if (realUserId) await getAdminStore().endImpersonation(realUserId)
    await stopSessionImpersonation()
    return { ok: true as const }
  },
)
