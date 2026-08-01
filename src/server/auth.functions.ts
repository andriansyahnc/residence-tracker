import { createServerFn } from '@tanstack/react-start'
import type { AuthLookup, SessionUser } from '../domain/types'
import { getStore } from '../lib/store'

export const getSession = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => {
    const { readSessionUser } = await import('./auth.server')
    return readSessionUser()
  },
)

export const getAuthState = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AuthLookup | null> => {
    const { readSessionAuth } = await import('./auth.server')
    return readSessionAuth()
  },
)

export const loginWithEmail = createServerFn({ method: 'POST' })
  .validator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const auth = getStore().findAuthUserByEmail(data.email.trim())
    if (!auth) {
      return { ok: false as const, error: 'No account found for this email' }
    }

    const { writeSessionUser } = await import('./auth.server')
    if (auth.kind === 'no-membership') {
      await writeSessionUser(auth.userId)
      return { ok: true as const, redirectTo: '/not-a-member' as const }
    }

    await writeSessionUser(auth.user.userId)
    return {
      ok: true as const,
      redirectTo: '/problems' as const,
      user: auth.user,
    }
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  const { clearSession } = await import('./auth.server')
  await clearSession()
  return { ok: true }
})
