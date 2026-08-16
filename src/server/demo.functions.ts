import { createServerFn } from '@tanstack/react-start'
import { DEMO_RESIDENCE_ID } from '../domain/constants'

/**
 * Wipes and re-seeds the demo org. The residence check is the guard that keeps a
 * real manager from ever reaching this — it only runs for a manager whose
 * membership is in the demo residence.
 */
export const resetDemo = createServerFn({ method: 'POST' }).handler(async () => {
  const { requireSessionUser } = await import('./auth.server')
  const user = await requireSessionUser()

  if (user.residenceId !== DEMO_RESIDENCE_ID || user.role !== 'manager') {
    return { ok: false as const, error: 'Not allowed' }
  }

  const { getDb } = await import('../db')
  const { resetDemoOrg } = await import('../db/demo-seed')
  await resetDemoOrg(getDb())

  return { ok: true as const }
})
