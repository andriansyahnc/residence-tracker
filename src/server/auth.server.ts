import { deleteCookie, useSession } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import type { AuthLookup, SessionUser } from '../domain/types'
import { getDb } from '../db'
import { profiles } from '../db/schema'
import { getStore } from '../lib/store'

export const SESSION_COOKIE = 'rpt-session'

function sessionConfig() {
  return {
    name: SESSION_COOKIE,
    password:
      process.env.SESSION_SECRET ??
      'dev-residence-tracker-secret-32chars-min',
    cookie: {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    },
  }
}

/** While impersonating, `userId` is the borrowed account and `realUserId` is yours. */
type SessionData = { userId: string; realUserId?: string }

export async function readSessionAuth(): Promise<AuthLookup | null> {
  const session = await useSession<SessionData>(sessionConfig())
  const userId = session.data.userId
  if (!userId) return null

  const [profile] = await getDb()
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1)
  if (!profile) return null

  return getStore().findAuthUserByEmail(profile.email)
}

export async function readSessionUser(): Promise<SessionUser | null> {
  const auth = await readSessionAuth()
  return auth?.kind === 'member' ? auth.user : null
}

export async function writeSessionUser(userId: string) {
  const session = await useSession<SessionData>(sessionConfig())
  await session.update({ userId, realUserId: undefined })
}

/** The account you signed in with. Same as the session user unless impersonating. */
export async function readRealUserId(): Promise<string | null> {
  const session = await useSession<SessionData>(sessionConfig())
  return session.data.realUserId ?? session.data.userId ?? (null as string | null)
}

export async function readImpersonatedUserId(): Promise<string | null> {
  const session = await useSession<SessionData>(sessionConfig())
  return session.data.realUserId ? session.data.userId ?? null : null
}

export async function startSessionImpersonation(targetUserId: string) {
  const session = await useSession<SessionData>(sessionConfig())
  const realUserId = session.data.realUserId ?? session.data.userId
  await session.update({ userId: targetUserId, realUserId })
}

export async function stopSessionImpersonation() {
  const session = await useSession<SessionData>(sessionConfig())
  const realUserId = session.data.realUserId
  if (!realUserId) return
  await session.update({ userId: realUserId, realUserId: undefined })
}

export async function clearSession() {
  const session = await useSession<SessionData>(sessionConfig())
  await session.clear()
  deleteCookie(SESSION_COOKIE)
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await readSessionUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}
